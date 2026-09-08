# main.py

# -----------------------------------------------------------------------
# SERVEUR CENTRAL - ATELIER MAISON
# -----------------------------------------------------------------------
#
# Ce fichier fusionne :
#
#   - la logique du serveur central nécessaire au frontend React ;
#   - la logique SQLite / événements existante ;
#   - les ajouts récents de l'équipe :
#       * image associée à un événement ;
#       * historique du servo ;
#       * routes /api/servo ;
#       * ancienne page statique conservée si le dossier static existe.
#
# Architecture :
#
#     React / téléphone
#            |
#            v
#     serveur FastAPI
#            |
#            v
#          switch
#        /        \
#       v          v
# Raspberry     Raspberry
#  mobile         fixe
#
# React ne contacte jamais directement les Raspberry.
# Le serveur central est l'intermédiaire entre l'interface et le matériel.
# -----------------------------------------------------------------------

import json
import sqlite3
import time
import uuid

from pathlib import Path
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from fastapi import (
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    FileResponse,
    Response,
    StreamingResponse,
)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


# =========================================================================
# CONFIGURATION
# =========================================================================

# Base SQLite du projet.
CHEMIN_BASE = Path(__file__).parent / "evenements.db"

# Ancienne interface statique de l'équipe.
#
# Elle est conservée pour compatibilité si le dossier existe,
# mais le frontend principal reste l'application React séparée.
DOSSIER_STATIC = Path(__file__).parent / "static"

# Captures créées depuis l'interface React.
DOSSIER_MEDIA = Path(__file__).parent / "media"
DOSSIER_MEDIA.mkdir(exist_ok=True)

# Petite API HTTP locale attendue sur chaque Raspberry.
PORT_API_RASPBERRY = 8001

# Heartbeat attendu environ toutes les 5 secondes.
# Au-delà de 15 secondes sans heartbeat : OFFLINE.
DELAI_OFFLINE_SECONDES = 15

# Timeout des commandes serveur central -> Raspberry.
DELAI_REQUETE_RASPBERRY = 3

# Durée de conservation d'un média non sauvegardé.
DUREE_MEDIA_SECONDES = 24 * 60 * 60

# -------------------------------------------------------------------------
# État de commande des Raspberry mobiles en mode polling.
#
# Les commandes sont conservées par IP afin que plusieurs robots mobiles
# puissent coexister sans récupérer la commande d'un autre logement.
# -------------------------------------------------------------------------
COMMANDES_ROBOT_PAR_IP: dict[str, dict[str, int | str]] = {}
ETAT_ACTIVATION_ROBOT_PAR_IP: dict[str, bool] = {}


# =========================================================================
# BASE DE DONNÉES
# =========================================================================

def get_connexion():
    """
    Ouvre une connexion SQLite.

    row_factory permet d'utiliser le nom des colonnes :
        ligne["capteur"]
    au lieu de leur position.

    PRAGMA foreign_keys active les contraintes de clés étrangères pour
    les nouvelles tables de la partie entreprise.
    """
    connexion = sqlite3.connect(CHEMIN_BASE)
    connexion.row_factory = sqlite3.Row
    connexion.execute("PRAGMA foreign_keys = ON")
    return connexion


def initialiser_base():
    """
    Crée les tables manquantes sans supprimer les données existantes.

    Cette fonction reprend aussi la migration ajoutée par l'équipe pour
    la colonne image de la table evenements.
    """
    connexion = get_connexion()

    # ---------------------------------------------------------------------
    # Table des événements de surveillance
    # ---------------------------------------------------------------------
    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS evenements (
            id TEXT PRIMARY KEY,
            capteur TEXT NOT NULL,
            zone TEXT NOT NULL,
            horodatage INTEGER NOT NULL,
            decision TEXT NOT NULL DEFAULT 'en_attente',
            horodatage_decision INTEGER,
            image BLOB
        )
        """
    )

    # ---------------------------------------------------------------------
    # Migration ajoutée par l'équipe
    #
    # Si la table existait avant l'ajout de la colonne image,
    # CREATE TABLE IF NOT EXISTS ne la modifie pas.
    #
    # On vérifie donc les colonnes puis on ajoute image si nécessaire.
    # ---------------------------------------------------------------------
    colonnes_existantes = [
        ligne["name"]
        for ligne in connexion.execute(
            "PRAGMA table_info(evenements)"
        ).fetchall()
    ]

    if "image" not in colonnes_existantes:
        connexion.execute(
            "ALTER TABLE evenements ADD COLUMN image BLOB"
        )

    # ---------------------------------------------------------------------
    # Historique du servo ajouté par l'équipe
    # ---------------------------------------------------------------------
    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS historique_servo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            angle INTEGER NOT NULL,
            horodatage INTEGER NOT NULL
        )
        """
    )

    # ---------------------------------------------------------------------
    # Contrôleurs Raspberry
    # ---------------------------------------------------------------------
    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS controleurs (
            ip TEXT PRIMARY KEY,
            has_servo INTEGER NOT NULL,
            derniere_vue INTEGER NOT NULL
        )
        """
    )

    # ---------------------------------------------------------------------
    # Composants déclarés par les Raspberry
    # ---------------------------------------------------------------------
    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS composants (
            id TEXT PRIMARY KEY,
            ip_controleur TEXT NOT NULL,
            nom TEXT NOT NULL,
            enabled INTEGER NOT NULL,
            valeur TEXT,
            derniere_vue INTEGER NOT NULL
        )
        """
    )

    # ---------------------------------------------------------------------
    # État global du système
    # ---------------------------------------------------------------------
    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS systeme (
            id INTEGER PRIMARY KEY,
            armed INTEGER NOT NULL
        )
        """
    )

    connexion.execute(
        """
        INSERT OR IGNORE INTO systeme (id, armed)
        VALUES (1, 1)
        """
    )

    # ---------------------------------------------------------------------
    # Médias générés depuis l'interface React
    # ---------------------------------------------------------------------
    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS media (
            id TEXT PRIMARY KEY,
            camera_id TEXT NOT NULL,
            camera_name TEXT NOT NULL,
            kind TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            saved INTEGER NOT NULL,
            filename TEXT NOT NULL
        )
        """
    )

    # ---------------------------------------------------------------------
    # MIGRATIONS ENTREPRISE SUR LA TABLE evenements
    # ---------------------------------------------------------------------
    #
    # Les Raspberry continuent d'envoyer le même JSON qu'avant.
    #
    # Le serveur ajoute simplement des informations de rattachement :
    #
    # - source_ip       : IP du Raspberry ayant envoyé l'événement ;
    # - customer_id     : client correspondant, si le Raspberry est affecté ;
    # - site_id         : site surveillé correspondant ;
    # - company_alert_id: dossier d'alerte créé pour le centre de supervision.
    #
    # Ces colonnes sont facultatives pour ne pas casser les anciens
    # événements ni les Raspberry qui ne sont pas encore rattachés à un site.
    # ---------------------------------------------------------------------

    colonnes_evenements = {
        ligne["name"]
        for ligne in connexion.execute(
            "PRAGMA table_info(evenements)"
        ).fetchall()
    }

    migrations_evenements = {
        "source_ip":
            "TEXT",

        "customer_id":
            "TEXT",

        "site_id":
            "TEXT",

        "company_alert_id":
            "TEXT",
    }

    for colonne, definition in migrations_evenements.items():
        if colonne not in colonnes_evenements:
            connexion.execute(
                f"ALTER TABLE evenements ADD COLUMN {colonne} {definition}"
            )

    # ---------------------------------------------------------------------
    # UTILISATEURS INTERNES ENTREPRISE
    # ---------------------------------------------------------------------
    #
    # L'authentification réelle n'est pas encore implémentée.
    #
    # Cette table prépare néanmoins les rôles futurs :
    # ADMIN / SUPERVISOR / OPERATOR / FIELD_AGENT.
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS company_users (
            id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT,
            role TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OFFLINE',
            created_at INTEGER NOT NULL,
            last_activity_at INTEGER
        )
        """
    )

    # ---------------------------------------------------------------------
    # CLIENTS
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at INTEGER NOT NULL,
            notes TEXT
        )
        """
    )

    # ---------------------------------------------------------------------
    # SITES SURVEILLÉS
    # ---------------------------------------------------------------------
    #
    # Un client peut avoir plusieurs sites :
    #
    # - domicile principal ;
    # - résidence secondaire ;
    # - local professionnel ;
    # - etc.
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS monitored_sites (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            name TEXT NOT NULL,
            address TEXT NOT NULL,
            city TEXT NOT NULL,
            postal_code TEXT NOT NULL,
            country TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OFFLINE',
            armed INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # CONTACTS D'URGENCE
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS emergency_contacts (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            relationship TEXT NOT NULL,
            phone TEXT NOT NULL,
            priority INTEGER NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # ASSOCIATION SITE <-> RASPBERRY
    # ---------------------------------------------------------------------
    #
    # Cette table évite de modifier profondément la table controleurs
    # créée par l'équipe.
    #
    # Un Raspberry peut être rattaché à un seul site à la fois.
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS site_controllers (
            site_id TEXT NOT NULL,
            controller_ip TEXT NOT NULL UNIQUE,
            PRIMARY KEY(site_id, controller_ip),
            FOREIGN KEY(site_id) REFERENCES monitored_sites(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # ALERTES OPÉRATIONNELLES ENTREPRISE
    # ---------------------------------------------------------------------
    #
    # evenements = détection technique brute.
    #
    # company_alerts = dossier métier traité par le centre de supervision.
    #
    # outcome permet de conserver la conclusion réelle d'une alerte même
    # lorsqu'elle passe ensuite au statut RESOLVED.
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS company_alerts (
            id TEXT PRIMARY KEY,
            source_event_id TEXT NOT NULL UNIQUE,
            customer_id TEXT NOT NULL,
            site_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            source_sensor TEXT NOT NULL,
            source_equipment_id TEXT,
            camera_id TEXT,
            priority TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'NEW',
            outcome TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            resolved_at INTEGER,
            assigned_operator_id TEXT,
            FOREIGN KEY(customer_id) REFERENCES customers(id),
            FOREIGN KEY(site_id) REFERENCES monitored_sites(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # TIMELINE D'UNE ALERTE
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS alert_actions (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            type TEXT NOT NULL,
            actor_type TEXT NOT NULL,
            actor_id TEXT,
            actor_name TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            details TEXT,
            FOREIGN KEY(alert_id) REFERENCES company_alerts(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # APPELS CLIENT
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS client_calls (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            alert_id TEXT,
            operator_id TEXT NOT NULL,
            result TEXT NOT NULL,
            comment TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id),
            FOREIGN KEY(alert_id) REFERENCES company_alerts(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # COMMENTAIRES INTERNES
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS company_comments (
            id TEXT PRIMARY KEY,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER
        )
        """
    )

    # ---------------------------------------------------------------------
    # SUPPORT
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS support_tickets (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            site_id TEXT,
            equipment_id TEXT,
            subject TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'NEW',
            assigned_company_user_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            resolved_at INTEGER,
            FOREIGN KEY(customer_id) REFERENCES customers(id),
            FOREIGN KEY(site_id) REFERENCES monitored_sites(id)
        )
        """
    )

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS support_messages (
            id TEXT PRIMARY KEY,
            ticket_id TEXT NOT NULL,
            author_type TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            message TEXT NOT NULL,
            internal INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(ticket_id) REFERENCES support_tickets(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # INTERVENANTS TERRAIN
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS field_agents (
            id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            area TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'AVAILABLE',
            current_intervention_id TEXT
        )
        """
    )

    # ---------------------------------------------------------------------
    # INTERVENTIONS TERRAIN
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS interventions (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            customer_id TEXT NOT NULL,
            site_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'REQUESTED',
            requested_at INTEGER NOT NULL,
            accepted_at INTEGER,
            arrived_at INTEGER,
            completed_at INTEGER,
            report TEXT,
            FOREIGN KEY(alert_id) REFERENCES company_alerts(id),
            FOREIGN KEY(customer_id) REFERENCES customers(id),
            FOREIGN KEY(site_id) REFERENCES monitored_sites(id),
            FOREIGN KEY(agent_id) REFERENCES field_agents(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # ESCALADES URGENCE / POLICE
    # ---------------------------------------------------------------------
    #
    # Dans le prototype, cette table TRACE l'escalade.
    # Elle ne déclenche aucun appel réel vers les forces de l'ordre.
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS emergency_escalations (
            id TEXT PRIMARY KEY,
            alert_id TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'REQUESTED',
            reason TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(alert_id) REFERENCES company_alerts(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # JOURNAL D'AUDIT
    # ---------------------------------------------------------------------
    #
    # Contrairement aux commentaires, les logs sont générés
    # automatiquement par le backend lors des actions sensibles.
    #
    # customer_id est stocké pour pouvoir filtrer rapidement les logs
    # depuis une fiche client.
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            action TEXT NOT NULL,
            actor_id TEXT,
            actor_name TEXT NOT NULL,
            actor_type TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            metadata TEXT,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        )
        """
    )

    # ---------------------------------------------------------------------
    # INDEX
    # ---------------------------------------------------------------------
    #
    # Ces index ne changent pas les données.
    # Ils accélèrent les recherches utilisées par les pages entreprise.
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_company_alerts_customer
        ON company_alerts(customer_id, created_at DESC)
        """
    )

    connexion.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_company_alerts_status
        ON company_alerts(status, created_at DESC)
        """
    )

    connexion.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_alert_actions_alert
        ON alert_actions(alert_id, created_at ASC)
        """
    )

    connexion.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_support_customer
        ON support_tickets(customer_id, created_at DESC)
        """
    )

    connexion.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_audit_customer
        ON audit_logs(customer_id, created_at DESC)
        """
    )

    connexion.commit()
    connexion.close()


# =========================================================================
# MODÈLES PYDANTIC
# =========================================================================

class NouvelEvenement(BaseModel):
    """
    Données reçues lorsqu'un Raspberry signale un événement.
    """
    capteur: str
    zone: str
    horodatage: int


class Decision(BaseModel):
    """
    Décision prise depuis l'interface.
    """
    decision: str


class CommandeServo(BaseModel):
    """
    Commande servo historique de l'équipe.

    Exemple :
        {
            "angle": 90
        }
    """
    angle: int


class EtatComposant(BaseModel):
    """
    État réel d'un composant transmis dans le heartbeat.
    """
    name: str
    enabled: bool
    value: str | int | float | bool | None = None


class HeartbeatControleur(BaseModel):
    """
    Heartbeat périodique d'un Raspberry.

    FastAPI déduit FIXED/MOBILE à partir de has_servo.
    """
    has_servo: bool
    components: list[EtatComposant]


class EtatSysteme(BaseModel):
    armed: bool


class EtatActivation(BaseModel):
    enabled: bool


class CommandeRobot(BaseModel):
    command: str
    speed: int
    robotId: str | None = None


class EtatMedia(BaseModel):
    saved: bool


class MediaItem(BaseModel):
    id: str
    cameraId: str
    cameraName: str
    kind: str
    createdAt: str
    expiresAt: str
    saved: bool
    mediaUrl: str


class Equipement(BaseModel):
    """
    Format consommé par src/types/dashboard.ts côté React.
    """
    id: str
    name: str
    location: str
    controllerId: str
    kind: str
    status: str
    enabled: bool
    controllable: bool
    value: str | None = None
    lastSeen: str
    groupId: str
    groupName: str
    groupDescription: str
    groupKind: str
    groupOrder: int
    displayOrder: int
    streamUrl: str | None = None
    parentDeviceId: str | None = None


# =========================================================================
# MODÈLES PYDANTIC - ESPACE ENTREPRISE
# =========================================================================
#
# L'authentification réelle n'est pas encore activée.
#
# Les routes d'action reçoivent donc temporairement :
#
#   operatorId
#   operatorName
#
# Ces champs seront plus tard remplacés par l'identité issue de la session
# authentifiée côté serveur.
# =========================================================================

class IdentiteOperateur(BaseModel):
    operatorId: str
    operatorName: str


class PriseEnChargeAlerte(IdentiteOperateur):
    pass


class ModificationStatutAlerte(IdentiteOperateur):
    status: str
    comment: str | None = None


class AppelClientEntreprise(IdentiteOperateur):
    result: str
    comment: str | None = None


class AffectationIntervenant(IdentiteOperateur):
    agentId: str
    comment: str | None = None


class EscaladeUrgenceEntreprise(IdentiteOperateur):
    reason: str


class NouveauCommentaireEntreprise(IdentiteOperateur):
    targetType: str
    targetId: str
    message: str


class NouveauMessageSupport(IdentiteOperateur):
    message: str
    internal: bool


class ModificationStatutSupport(IdentiteOperateur):
    status: str


class NouvelleCommandeRobotEntreprise(IdentiteOperateur):
    # Identifiant exact du composant ROBOT (ou SERVO de compatibilité)
    # sélectionné côté entreprise. Facultatif pour rester compatible avec
    # les anciennes versions du frontend.
    robotId: str | None = None
    command: str
    speed: int


class ActivationEquipementEntreprise(IdentiteOperateur):
    enabled: bool


class NouvelleVueCameraEntreprise(IdentiteOperateur):
    pass


class NouvelleCaptureCameraEntreprise(IdentiteOperateur):
    pass


# -------------------------------------------------------------------------
# Administration légère des données entreprise
# -------------------------------------------------------------------------
#
# Ces modèles permettent de créer les clients / sites / intervenants depuis
# Swagger maintenant, puis depuis l'interface d'administration plus tard.
# -------------------------------------------------------------------------

class NouveauClientEntreprise(BaseModel):
    firstName: str
    lastName: str
    email: str
    phone: str
    notes: str | None = None


class NouveauSiteEntreprise(BaseModel):
    name: str
    address: str
    city: str
    postalCode: str
    country: str = "France"


class NouveauContactUrgence(BaseModel):
    firstName: str
    lastName: str
    relationship: str
    phone: str
    priority: int


class NouveauTicketSupport(BaseModel):
    customerId: str
    siteId: str | None = None
    equipmentId: str | None = None
    subject: str
    description: str
    category: str
    priority: str = "MEDIUM"


class NouvelIntervenantEntreprise(BaseModel):
    firstName: str
    lastName: str
    phone: str
    area: str


class NouvelUtilisateurEntreprise(BaseModel):
    firstName: str
    lastName: str
    email: str
    phone: str | None = None
    role: str


# =========================================================================
# OUTILS DE FORMATAGE / CLASSIFICATION
# =========================================================================

def date_iso_depuis_timestamp(timestamp: int) -> str:
    """
    Transforme un timestamp Unix en date ISO lisible par JavaScript.
    """
    return time.strftime(
        "%Y-%m-%dT%H:%M:%S",
        time.localtime(timestamp),
    )


def creer_identifiant_equipement(ip: str, nom: str) -> str:
    """
    Exemple :
        192.168.1.4 + camera
        -> 192-168-1-4-camera
    """
    return (
        f"{ip}-{nom}"
        .lower()
        .replace(".", "-")
        .replace(" ", "-")
        .replace("_", "-")
    )


def statut_controleur(derniere_vue: int) -> str:
    """
    ONLINE si un heartbeat récent existe, sinon OFFLINE.
    """
    temps_ecoule = int(time.time()) - derniere_vue

    return (
        "ONLINE"
        if temps_ecoule <= DELAI_OFFLINE_SECONDES
        else "OFFLINE"
    )


def type_composant(nom: str, categorie: str) -> str:
    """
    Convertit le nom technique déclaré par le Raspberry
    vers le type attendu par React.
    """
    normalise = nom.strip().lower()

    if normalise == "camera":
        return (
            "ROBOT_CAMERA"
            if categorie == "MOBILE"
            else "CAMERA"
        )

    if normalise in (
        "photoresistance",
        "light_sensor",
    ):
        return "PHOTORESISTOR"

    if normalise in (
        "button",
        "bouton",
    ):
        return "BUTTON"

    if normalise == "led":
        return "LED"

    if normalise == "servo":
        return "SERVO"

    if normalise == "robot":
        return "ROBOT"

    if normalise in (
        "motion_sensor",
        "motion",
        "pir",
    ):
        return "MOTION_SENSOR"

    return "OTHER"


def nom_affichable(nom: str, categorie: str) -> str:
    """
    Nom utilisateur dérivé du type technique.
    """
    noms = {
        "CAMERA": "Caméra fixe",
        "ROBOT_CAMERA": "Caméra mobile",
        "PHOTORESISTOR": "Capteur de luminosité",
        "BUTTON": "Bouton",
        "LED": "LED",
        "SERVO": "Servomoteur",
        "ROBOT": "Robot",
        "MOTION_SENSOR": "Capteur de mouvement",
    }

    return noms.get(
        type_composant(nom, categorie),
        nom,
    )


# =========================================================================
# COMMUNICATION SERVEUR CENTRAL -> RASPBERRY
# =========================================================================

def envoyer_json_au_raspberry(
    ip: str,
    chemin: str,
    methode: str,
    contenu: dict | None = None,
):
    """
    Envoie une requête HTTP à l'API locale d'un Raspberry.

    Exemple :
        http://192.168.1.4:8001/components/camera/enabled
    """
    url = (
        f"http://{ip}:{PORT_API_RASPBERRY}"
        f"{chemin}"
    )

    donnees = None

    if contenu is not None:
        donnees = json.dumps(
            contenu
        ).encode(
            "utf-8"
        )

    requete = urllib_request.Request(
        url=url,
        data=donnees,
        method=methode,
        headers={
            "Content-Type":
                "application/json",
        },
    )

    try:
        with urllib_request.urlopen(
            requete,
            timeout=DELAI_REQUETE_RASPBERRY,
        ) as reponse:
            texte = reponse.read().decode(
                "utf-8"
            )

            return (
                json.loads(texte)
                if texte
                else {}
            )

    except (
        urllib_error.URLError,
        TimeoutError,
    ) as erreur:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Le Raspberry {ip} "
                f"ne répond pas : {erreur}"
            ),
        ) from erreur


# =========================================================================
# LECTURE / CONSTRUCTION D'ÉQUIPEMENTS
# =========================================================================

def lire_equipement_sql(
    identifiant: str,
):
    """
    Lit un composant avec les informations de son Raspberry.
    """
    connexion = get_connexion()

    ligne = connexion.execute(
        """
        SELECT
            composants.id,
            composants.ip_controleur,
            composants.nom,
            composants.enabled,
            composants.valeur,
            composants.derniere_vue,
            controleurs.has_servo,
            controleurs.derniere_vue AS controleur_derniere_vue
        FROM composants
        JOIN controleurs
          ON controleurs.ip = composants.ip_controleur
        WHERE composants.id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    connexion.close()

    if ligne is None:
        raise HTTPException(
            status_code=404,
            detail="Équipement introuvable.",
        )

    return ligne


def construire_equipement(
    ligne,
    ordre: int,
):
    """
    Transforme une ligne SQLite en objet Equipment pour React.
    """
    categorie = (
        "MOBILE"
        if bool(ligne["has_servo"])
        else "FIXED"
    )

    kind = type_composant(
        ligne["nom"],
        categorie,
    )

    mobile = (
        categorie == "MOBILE"
    )

    valeur = None

    if ligne["valeur"] is not None:
        try:
            valeur_brute = json.loads(
                ligne["valeur"]
            )

            if valeur_brute is not None:
                valeur = str(
                    valeur_brute
                )

        except json.JSONDecodeError:
            valeur = ligne["valeur"]

    # Le frontend reçoit une URL du SERVEUR CENTRAL.
    # Il ne reçoit jamais une URL Raspberry directe.
    stream_url = None

    if kind in (
        "CAMERA",
        "ROBOT_CAMERA",
    ):
        stream_url = (
            f"/api/cameras/{ligne['id']}/stream"
        )

    return {
        "id":
            ligne["id"],

        "name":
            nom_affichable(
                ligne["nom"],
                categorie,
            ),

        "location":
            "Non renseignée",

        "controllerId":
            ligne["ip_controleur"],

        "kind":
            kind,

        "status":
            statut_controleur(
                ligne[
                    "controleur_derniere_vue"
                ]
            ),

        "enabled":
            bool(
                ligne["enabled"]
            ),

        "controllable":
            kind != "OTHER",

        "value":
            valeur,

        "lastSeen":
            date_iso_depuis_timestamp(
                ligne[
                    "controleur_derniere_vue"
                ]
            ),

        "groupId":
            "mobile"
            if mobile
            else "fixed",

        "groupName":
            "Équipements mobiles"
            if mobile
            else "Équipements fixes",

        "groupDescription":
            (
                "Ensemble contenant un servomoteur."
                if mobile
                else "Ensemble sans servomoteur."
            ),

        "groupKind":
            categorie,

        "groupOrder":
            2
            if mobile
            else 1,

        "displayOrder":
            ordre,

        "streamUrl":
            stream_url,

        "parentDeviceId":
            None,
    }


# =========================================================================
# MÉDIAS
# =========================================================================

def nettoyer_medias_expires():
    """
    Supprime les captures expirées non sauvegardées.
    """
    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    lignes = connexion.execute(
        """
        SELECT id, filename
        FROM media
        WHERE saved = 0
          AND expires_at < ?
        """,
        (
            maintenant,
        ),
    ).fetchall()

    for ligne in lignes:
        chemin = (
            DOSSIER_MEDIA
            /
            ligne["filename"]
        )

        if chemin.exists():
            chemin.unlink()

    connexion.execute(
        """
        DELETE FROM media
        WHERE saved = 0
          AND expires_at < ?
        """,
        (
            maintenant,
        ),
    )

    connexion.commit()
    connexion.close()


# =========================================================================
# OUTILS - ESPACE ENTREPRISE
# =========================================================================

STATUTS_ALERTES_AUTORISES = {
    "NEW",
    "IN_REVIEW",
    "CLIENT_CONTACT",
    "FALSE_ALARM",
    "CONFIRMED",
    "ESCALATED",
    "AGENT_DISPATCHED",
    "RESOLVED",
}

PRIORITES_AUTORISEES = {
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
}

RESULTATS_APPEL_AUTORISES = {
    "ANSWERED",
    "NO_ANSWER",
    "UNAVAILABLE",
    "FALSE_ALARM_CONFIRMED",
    "SUSPICIOUS_SITUATION_CONFIRMED",
}

STATUTS_SUPPORT_AUTORISES = {
    "NEW",
    "IN_PROGRESS",
    "WAITING_CUSTOMER",
    "RESOLVED",
    "CLOSED",
}

CATEGORIES_SUPPORT_AUTORISEES = {
    "CAMERA",
    "ROBOT",
    "SENSOR",
    "NETWORK",
    "ACCOUNT",
    "ALERT",
    "OTHER",
}

ROLES_ENTREPRISE_AUTORISES = {
    "ADMIN",
    "SUPERVISOR",
    "OPERATOR",
    "FIELD_AGENT",
}


def date_iso_ou_none(timestamp):
    """
    Même format que date_iso_depuis_timestamp(), mais accepte NULL.

    Cela évite de recopier la même vérification dans chaque route.
    """
    if timestamp is None:
        return None

    return date_iso_depuis_timestamp(
        int(timestamp)
    )


def json_ou_none(valeur):
    """
    Décode une colonne JSON SQLite si elle contient une valeur.

    Les colonnes details / metadata sont stockées en TEXT dans SQLite
    parce que SQLite ne possède pas de type JSON strict.
    """
    if valeur is None:
        return None

    try:
        return json.loads(valeur)
    except (
        json.JSONDecodeError,
        TypeError,
    ):
        return None


def client_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "firstName":
            ligne["first_name"],

        "lastName":
            ligne["last_name"],

        "email":
            ligne["email"],

        "phone":
            ligne["phone"],

        "status":
            ligne["status"],

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),

        "notes":
            ligne["notes"],
    }


def site_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "customerId":
            ligne["customer_id"],

        "name":
            ligne["name"],

        "address":
            ligne["address"],

        "city":
            ligne["city"],

        "postalCode":
            ligne["postal_code"],

        "country":
            ligne["country"],

        "status":
            ligne["status"],

        "armed":
            bool(
                ligne["armed"]
            ),

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),
    }


def contact_urgence_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "customerId":
            ligne["customer_id"],

        "firstName":
            ligne["first_name"],

        "lastName":
            ligne["last_name"],

        "relationship":
            ligne["relationship"],

        "phone":
            ligne["phone"],

        "priority":
            ligne["priority"],
    }


def alerte_entreprise_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "sourceEventId":
            ligne["source_event_id"],

        "customerId":
            ligne["customer_id"],

        "siteId":
            ligne["site_id"],

        "title":
            ligne["title"],

        "description":
            ligne["description"],

        "sourceSensor":
            ligne["source_sensor"],

        "sourceEquipmentId":
            ligne["source_equipment_id"],

        "cameraId":
            ligne["camera_id"],

        "priority":
            ligne["priority"],

        "status":
            ligne["status"],

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),

        "updatedAt":
            date_iso_depuis_timestamp(
                ligne["updated_at"]
            ),

        "resolvedAt":
            date_iso_ou_none(
                ligne["resolved_at"]
            ),

        "assignedOperatorId":
            ligne["assigned_operator_id"],
    }


def action_alerte_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "alertId":
            ligne["alert_id"],

        "type":
            ligne["type"],

        "actorType":
            ligne["actor_type"],

        "actorId":
            ligne["actor_id"],

        "actorName":
            ligne["actor_name"],

        "description":
            ligne["description"],

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),

        "details":
            json_ou_none(
                ligne["details"]
            ),
    }


def commentaire_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "targetType":
            ligne["target_type"],

        "targetId":
            ligne["target_id"],

        "authorId":
            ligne["author_id"],

        "authorName":
            ligne["author_name"],

        "message":
            ligne["message"],

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),

        "updatedAt":
            date_iso_ou_none(
                ligne["updated_at"]
            ),
    }


def ticket_support_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "customerId":
            ligne["customer_id"],

        "siteId":
            ligne["site_id"],

        "equipmentId":
            ligne["equipment_id"],

        "subject":
            ligne["subject"],

        "description":
            ligne["description"],

        "category":
            ligne["category"],

        "priority":
            ligne["priority"],

        "status":
            ligne["status"],

        "assignedCompanyUserId":
            ligne["assigned_company_user_id"],

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),

        "updatedAt":
            date_iso_depuis_timestamp(
                ligne["updated_at"]
            ),

        "resolvedAt":
            date_iso_ou_none(
                ligne["resolved_at"]
            ),
    }


def message_support_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "ticketId":
            ligne["ticket_id"],

        "authorType":
            ligne["author_type"],

        "authorId":
            ligne["author_id"],

        "authorName":
            ligne["author_name"],

        "message":
            ligne["message"],

        "internal":
            bool(
                ligne["internal"]
            ),

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),
    }


def intervenant_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "firstName":
            ligne["first_name"],

        "lastName":
            ligne["last_name"],

        "phone":
            ligne["phone"],

        "area":
            ligne["area"],

        "status":
            ligne["status"],

        "currentInterventionId":
            ligne["current_intervention_id"],
    }


def intervention_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "alertId":
            ligne["alert_id"],

        "customerId":
            ligne["customer_id"],

        "siteId":
            ligne["site_id"],

        "agentId":
            ligne["agent_id"],

        "status":
            ligne["status"],

        "requestedAt":
            date_iso_depuis_timestamp(
                ligne["requested_at"]
            ),

        "acceptedAt":
            date_iso_ou_none(
                ligne["accepted_at"]
            ),

        "arrivedAt":
            date_iso_ou_none(
                ligne["arrived_at"]
            ),

        "completedAt":
            date_iso_ou_none(
                ligne["completed_at"]
            ),

        "report":
            ligne["report"],
    }


def escalade_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "alertId":
            ligne["alert_id"],

        "operatorId":
            ligne["operator_id"],

        "status":
            ligne["status"],

        "reason":
            ligne["reason"],

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),
    }


def audit_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "action":
            ligne["action"],

        "actorId":
            ligne["actor_id"],

        "actorName":
            ligne["actor_name"],

        "actorType":
            ligne["actor_type"],

        "resourceType":
            ligne["resource_type"],

        "resourceId":
            ligne["resource_id"],

        "description":
            ligne["description"],

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),

        "metadata":
            json_ou_none(
                ligne["metadata"]
            ),
    }


def utilisateur_entreprise_depuis_ligne(ligne):
    return {
        "id":
            ligne["id"],

        "firstName":
            ligne["first_name"],

        "lastName":
            ligne["last_name"],

        "email":
            ligne["email"],

        "phone":
            ligne["phone"],

        "role":
            ligne["role"],

        "status":
            ligne["status"],

        "createdAt":
            date_iso_depuis_timestamp(
                ligne["created_at"]
            ),

        "lastActivityAt":
            date_iso_ou_none(
                ligne["last_activity_at"]
            ),
    }


def verifier_client_existe(
    connexion,
    customer_id: str,
):
    ligne = connexion.execute(
        """
        SELECT *
        FROM customers
        WHERE id = ?
        """,
        (
            customer_id,
        ),
    ).fetchone()

    if ligne is None:
        raise HTTPException(
            status_code=404,
            detail="Client introuvable.",
        )

    return ligne


def verifier_site_existe(
    connexion,
    site_id: str,
):
    ligne = connexion.execute(
        """
        SELECT *
        FROM monitored_sites
        WHERE id = ?
        """,
        (
            site_id,
        ),
    ).fetchone()

    if ligne is None:
        raise HTTPException(
            status_code=404,
            detail="Site surveillé introuvable.",
        )

    return ligne


def verifier_alerte_entreprise_existe(
    connexion,
    alert_id: str,
):
    ligne = connexion.execute(
        """
        SELECT *
        FROM company_alerts
        WHERE id = ?
        """,
        (
            alert_id,
        ),
    ).fetchone()

    if ligne is None:
        raise HTTPException(
            status_code=404,
            detail="Alerte entreprise introuvable.",
        )

    return ligne


def verifier_ticket_support_existe(
    connexion,
    ticket_id: str,
):
    ligne = connexion.execute(
        """
        SELECT *
        FROM support_tickets
        WHERE id = ?
        """,
        (
            ticket_id,
        ),
    ).fetchone()

    if ligne is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket support introuvable.",
        )

    return ligne


def lire_rattachement_ip(
    connexion,
    ip: str,
):
    """
    Retrouve le client et le site correspondant à l'IP d'un Raspberry.

    Le Raspberry ne connaît pas le client.
    Il envoie seulement ses données au serveur central.

    C'est le serveur qui réalise :

        IP Raspberry
            -> site_controllers
            -> monitored_sites
            -> customer
    """
    return connexion.execute(
        """
        SELECT
            monitored_sites.id AS site_id,
            monitored_sites.customer_id AS customer_id,
            monitored_sites.name AS site_name
        FROM site_controllers
        JOIN monitored_sites
          ON monitored_sites.id = site_controllers.site_id
        WHERE site_controllers.controller_ip = ?
        LIMIT 1
        """,
        (
            ip,
        ),
    ).fetchone()


def recalculer_statuts_sites():
    """
    Recalcule ONLINE / DEGRADED / OFFLINE à partir des heartbeats réels.

    Règles :
    - aucun contrôleur rattaché       -> OFFLINE
    - tous les contrôleurs ONLINE     -> ONLINE
    - certains ONLINE, certains OFFLINE -> DEGRADED
    - tous OFFLINE                    -> OFFLINE

    Cette fonction est appelée avant les lectures importantes de l'espace
    entreprise. Aucun faux état de disponibilité n'est inventé.
    """
    connexion = get_connexion()

    sites = connexion.execute(
        """
        SELECT id
        FROM monitored_sites
        """
    ).fetchall()

    maintenant = int(
        time.time()
    )

    for site in sites:
        lignes = connexion.execute(
            """
            SELECT controleurs.derniere_vue
            FROM site_controllers
            LEFT JOIN controleurs
              ON controleurs.ip = site_controllers.controller_ip
            WHERE site_controllers.site_id = ?
            """,
            (
                site["id"],
            ),
        ).fetchall()

        if not lignes:
            statut = "OFFLINE"

        else:
            etats = []

            for ligne in lignes:
                derniere_vue = (
                    ligne["derniere_vue"]
                )

                online = (
                    derniere_vue is not None
                    and
                    maintenant
                    - int(derniere_vue)
                    <= DELAI_OFFLINE_SECONDES
                )

                etats.append(
                    online
                )

            if all(etats):
                statut = "ONLINE"

            elif any(etats):
                statut = "DEGRADED"

            else:
                statut = "OFFLINE"

        connexion.execute(
            """
            UPDATE monitored_sites
            SET status = ?
            WHERE id = ?
            """,
            (
                statut,
                site["id"],
            ),
        )

    connexion.commit()
    connexion.close()


def determiner_priorite_evenement(
    capteur: str,
) -> str:
    """
    Première règle de priorisation du prototype.

    Elle reste volontairement simple et explicable :

    - bouton / urgence / panic  -> CRITICAL
    - mouvement / caméra / PIR -> HIGH
    - autre détection          -> MEDIUM

    Plus tard cette fonction pourra être remplacée par un moteur de règles
    sans modifier les routes React.
    """
    normalise = (
        capteur
        .strip()
        .lower()
    )

    if any(
        mot in normalise
        for mot in (
            "panic",
            "urgence",
            "bouton",
        )
    ):
        return "CRITICAL"

    if any(
        mot in normalise
        for mot in (
            "mouvement",
            "motion",
            "camera",
            "caméra",
            "pir",
        )
    ):
        return "HIGH"

    return "MEDIUM"


def creer_action_alerte_sql(
    connexion,
    *,
    alert_id: str,
    type_action: str,
    actor_type: str,
    actor_name: str,
    description: str,
    actor_id: str | None = None,
    details: dict | None = None,
    created_at: int | None = None,
):
    """
    Ajoute une étape à la timeline opérationnelle d'une alerte.
    """
    action_id = str(
        uuid.uuid4()
    )

    horodatage = (
        created_at
        if created_at is not None
        else int(time.time())
    )

    connexion.execute(
        """
        INSERT INTO alert_actions (
            id,
            alert_id,
            type,
            actor_type,
            actor_id,
            actor_name,
            description,
            created_at,
            details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            action_id,
            alert_id,
            type_action,
            actor_type,
            actor_id,
            actor_name,
            description,
            horodatage,
            (
                json.dumps(
                    details,
                    ensure_ascii=False,
                )
                if details is not None
                else None
            ),
        ),
    )

    return action_id


def creer_audit_sql(
    connexion,
    *,
    action: str,
    actor_name: str,
    actor_type: str,
    resource_type: str,
    resource_id: str,
    description: str,
    customer_id: str | None = None,
    actor_id: str | None = None,
    metadata: dict | None = None,
    created_at: int | None = None,
):
    """
    Enregistre une trace d'audit non éditable depuis l'interface.

    Les logs ne sont donc jamais créés directement par React.
    """
    audit_id = str(
        uuid.uuid4()
    )

    horodatage = (
        created_at
        if created_at is not None
        else int(time.time())
    )

    connexion.execute(
        """
        INSERT INTO audit_logs (
            id,
            customer_id,
            action,
            actor_id,
            actor_name,
            actor_type,
            resource_type,
            resource_id,
            description,
            created_at,
            metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            audit_id,
            customer_id,
            action,
            actor_id,
            actor_name,
            actor_type,
            resource_type,
            resource_id,
            description,
            horodatage,
            (
                json.dumps(
                    metadata,
                    ensure_ascii=False,
                )
                if metadata is not None
                else None
            ),
        ),
    )

    return audit_id


def calculer_statistiques_client(
    customer_id: str,
    period: str,
):
    """
    Calcule les statistiques avancées directement à partir des données
    SQLite réelles.

    Aucune donnée fictive n'est produite.

    systemAvailabilityPercent reste NULL tant qu'on ne stocke pas un
    historique temporel suffisamment fiable des heartbeats.
    """
    periodes_jours = {
        "7D":
            7,

        "30D":
            30,

        "90D":
            90,

        "1Y":
            365,
    }

    if period not in periodes_jours:
        raise HTTPException(
            status_code=422,
            detail=(
                "period doit être "
                "7D, 30D, 90D ou 1Y."
            ),
        )

    maintenant = int(
        time.time()
    )

    jours = periodes_jours[
        period
    ]

    depuis = (
        maintenant
        -
        jours
        * 24
        * 60
        * 60
    )

    connexion = get_connexion()

    verifier_client_existe(
        connexion,
        customer_id,
    )

    total_detections = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM evenements
        WHERE customer_id = ?
          AND horodatage >= ?
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["total"]

    total_alertes = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM company_alerts
        WHERE customer_id = ?
          AND created_at >= ?
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["total"]

    alertes_confirmees = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM company_alerts
        WHERE customer_id = ?
          AND created_at >= ?
          AND outcome = 'CONFIRMED'
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["total"]

    fausses_alertes = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM company_alerts
        WHERE customer_id = ?
          AND created_at >= ?
          AND outcome = 'FALSE_ALARM'
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["total"]

    moyenne_prise_en_charge = connexion.execute(
        """
        SELECT AVG(
            (
                SELECT MIN(alert_actions.created_at)
                FROM alert_actions
                WHERE alert_actions.alert_id = company_alerts.id
                  AND alert_actions.type = 'ALERT_TAKEN'
            )
            - company_alerts.created_at
        ) AS moyenne
        FROM company_alerts
        WHERE company_alerts.customer_id = ?
          AND company_alerts.created_at >= ?
          AND EXISTS (
              SELECT 1
              FROM alert_actions
              WHERE alert_actions.alert_id = company_alerts.id
                AND alert_actions.type = 'ALERT_TAKEN'
          )
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["moyenne"]

    moyenne_resolution = connexion.execute(
        """
        SELECT AVG(
            resolved_at
            - created_at
        ) AS moyenne
        FROM company_alerts
        WHERE customer_id = ?
          AND created_at >= ?
          AND resolved_at IS NOT NULL
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["moyenne"]

    appels_client = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM client_calls
        WHERE customer_id = ?
          AND created_at >= ?
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["total"]

    interventions = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM interventions
        WHERE customer_id = ?
          AND requested_at >= ?
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["total"]

    escalades = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM emergency_escalations
        JOIN company_alerts
          ON company_alerts.id = emergency_escalations.alert_id
        WHERE company_alerts.customer_id = ?
          AND emergency_escalations.created_at >= ?
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["total"]

    tickets_support = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM support_tickets
        WHERE customer_id = ?
          AND created_at >= ?
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["total"]

    tickets_resolus = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM support_tickets
        WHERE customer_id = ?
          AND created_at >= ?
          AND status IN ('RESOLVED', 'CLOSED')
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchone()["total"]

    # ---------------------------------------------------------------------
    # Activité quotidienne
    # ---------------------------------------------------------------------
    #
    # SQLite transforme les timestamps Unix en date YYYY-MM-DD.
    # ---------------------------------------------------------------------

    lignes_alertes_journalieres = connexion.execute(
        """
        SELECT
            date(created_at, 'unixepoch', 'localtime') AS jour,
            COUNT(*) AS alerts,
            SUM(
                CASE
                    WHEN outcome = 'CONFIRMED'
                    THEN 1
                    ELSE 0
                END
            ) AS confirmed,
            SUM(
                CASE
                    WHEN outcome = 'FALSE_ALARM'
                    THEN 1
                    ELSE 0
                END
            ) AS false_alarms
        FROM company_alerts
        WHERE customer_id = ?
          AND created_at >= ?
        GROUP BY jour
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchall()

    lignes_detections_journalieres = connexion.execute(
        """
        SELECT
            date(horodatage, 'unixepoch', 'localtime') AS jour,
            COUNT(*) AS detections
        FROM evenements
        WHERE customer_id = ?
          AND horodatage >= ?
        GROUP BY jour
        """,
        (
            customer_id,
            depuis,
        ),
    ).fetchall()

    connexion.close()

    alertes_par_jour = {
        ligne["jour"]:
            ligne
        for ligne in lignes_alertes_journalieres
    }

    detections_par_jour = {
        ligne["jour"]:
            ligne["detections"]
        for ligne in lignes_detections_journalieres
    }

    activite = []

    # On produit une ligne par jour même lorsqu'il n'y a aucune alerte,
    # afin que les graphiques React restent continus.
    for decalage in range(
        jours - 1,
        -1,
        -1,
    ):
        timestamp_jour = (
            maintenant
            -
            decalage
            * 24
            * 60
            * 60
        )

        jour = time.strftime(
            "%Y-%m-%d",
            time.localtime(
                timestamp_jour
            ),
        )

        ligne_alerte = (
            alertes_par_jour.get(
                jour
            )
        )

        activite.append(
            {
                "date":
                    jour,

                "detections":
                    int(
                        detections_par_jour.get(
                            jour,
                            0,
                        )
                    ),

                "alerts":
                    int(
                        ligne_alerte["alerts"]
                        if ligne_alerte
                        else 0
                    ),

                "confirmedAlerts":
                    int(
                        ligne_alerte["confirmed"]
                        if ligne_alerte
                        else 0
                    ),

                "falseAlarms":
                    int(
                        ligne_alerte["false_alarms"]
                        if ligne_alerte
                        else 0
                    ),
            }
        )

    return {
        "customerId":
            customer_id,

        "period":
            period,

        "totalDetections":
            int(
                total_detections
            ),

        "totalAlerts":
            int(
                total_alertes
            ),

        "confirmedAlerts":
            int(
                alertes_confirmees
            ),

        "falseAlarms":
            int(
                fausses_alertes
            ),

        "averageTakeoverTimeSeconds":
            (
                float(
                    moyenne_prise_en_charge
                )
                if moyenne_prise_en_charge
                is not None
                else None
            ),

        "averageResolutionTimeSeconds":
            (
                float(
                    moyenne_resolution
                )
                if moyenne_resolution
                is not None
                else None
            ),

        "clientCalls":
            int(
                appels_client
            ),

        "fieldInterventions":
            int(
                interventions
            ),

        "emergencyEscalations":
            int(
                escalades
            ),

        "supportTickets":
            int(
                tickets_support
            ),

        "resolvedSupportTickets":
            int(
                tickets_resolus
            ),

        "systemAvailabilityPercent":
            None,

        "dailyActivity":
            activite,
    }


# =========================================================================
# CRÉATION DU SERVEUR FASTAPI
# =========================================================================

app = FastAPI(
    title="Serveur central Atelier Maison"
)

initialiser_base()


# =========================================================================
# CORS
# =========================================================================
#
# React tourne sur une origine différente de FastAPI :
#
#     React   :5173
#     FastAPI :8000
#
# Le navigateur a donc besoin de CORS.
#
# Le regex autorise les adresses privées 192.168.x.x utilisées pendant
# les tests LAN / hotspot du prototype.
# =========================================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_origin_regex=(
        r"^https?://192\.168\."
        r"\d{1,3}\.\d{1,3}"
        r"(:\d+)?$"
    ),

    allow_credentials=True,

    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],

    allow_headers=[
        "*",
    ],
)


# =========================================================================
# ANCIEN DOSSIER STATIC
# =========================================================================
#
# On conserve le travail existant de l'équipe sans rendre le démarrage
# du serveur dépendant de la présence de ce dossier.
# =========================================================================

if DOSSIER_STATIC.exists():
    app.mount(
        "/static",
        StaticFiles(
            directory=DOSSIER_STATIC
        ),
        name="static",
    )


# =========================================================================
# PAGE D'ACCUEIL + HEALTH
# =========================================================================

@app.get("/")
def page_accueil():
    """
    Si l'ancienne page static existe, on la conserve.

    Sinon on renvoie une réponse JSON simple.
    """
    index_html = (
        DOSSIER_STATIC
        /
        "index.html"
    )

    if index_html.exists():
        return FileResponse(
            index_html
        )

    return {
        "status":
            "serveur central Atelier Maison actif",

        "api":
            "/api",
    }


@app.get("/api/health")
def health():
    """
    Vérifie uniquement la liaison client -> FastAPI.
    """
    return {
        "status":
            "ok",
    }


# =========================================================================
# COMMANDE SERVO HISTORIQUE DE L'ÉQUIPE
# =========================================================================
#
# Cette logique est conservée telle que prévue par l'équipe :
#
#   PC -> POST /api/servo
#   Raspberry -> GET /api/servo
#
# Elle peut coexister avec /api/robot/command.
#
# IMPORTANT :
# /api/servo et /api/robot/command ne représentent pas forcément
# exactement le même usage matériel.
# =========================================================================

angle_servo = 90


@app.post("/api/servo")
def commander_servo(
    commande: CommandeServo,
):
    """
    Le PC envoie un angle compris entre 0 et 180 degrés.
    """
    global angle_servo

    if (
        commande.angle < 0
        or commande.angle > 180
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "L'angle doit être "
                "compris entre 0 et 180"
            ),
        )

    ancien_angle = angle_servo
    angle_servo = commande.angle

    if angle_servo != ancien_angle:
        horodatage = int(
            time.time()
        )

        connexion = get_connexion()

        connexion.execute(
            """
            INSERT INTO historique_servo
            (angle, horodatage)
            VALUES (?, ?)
            """,
            (
                angle_servo,
                horodatage,
            ),
        )

        connexion.commit()
        connexion.close()

        print(
            "[serveur] nouvelle commande servo : "
            f"{angle_servo} degrés"
        )

    else:
        print(
            "[serveur] commande servo : "
            f"{angle_servo} degrés "
            "(aucun changement)"
        )

    return {
        "ok":
            True,

        "angle":
            angle_servo,
    }


@app.get("/api/servo")
def lire_commande_servo():
    """
    La Raspberry récupère la dernière commande servo.
    """
    return {
        "angle":
            angle_servo,
    }


@app.get("/api/servo/historique")
def historique_servo():
    """
    Renvoie l'historique des changements d'angle du servo.
    """
    connexion = get_connexion()

    lignes = connexion.execute(
        """
        SELECT *
        FROM historique_servo
        ORDER BY horodatage DESC
        """
    ).fetchall()

    connexion.close()

    return [
        dict(ligne)
        for ligne in lignes
    ]


# =========================================================================
# HEARTBEAT DES RASPBERRY
# =========================================================================

@app.post("/api/controleurs/heartbeat")
def heartbeat_controleur(
    informations: HeartbeatControleur,
    request: Request,
):
    """
    Le Raspberry n'envoie pas son IP dans le JSON.

    FastAPI récupère l'IP depuis la connexion réseau.
    """
    if request.client is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Impossible de déterminer "
                "l'adresse IP du Raspberry."
            ),
        )

    ip = request.client.host
    maintenant = int(
        time.time()
    )

    # Déduplication des composants.
    composants_uniques: dict[str, EtatComposant] = {}

    for composant in informations.components:
        nom = (
            composant.name
            .strip()
            .lower()
        )

        if nom:
            composants_uniques[nom] = (
                composant
            )

    if not composants_uniques:
        raise HTTPException(
            status_code=422,
            detail=(
                "Le Raspberry doit déclarer "
                "au moins un composant."
            ),
        )

    connexion = get_connexion()

    connexion.execute(
        """
        INSERT INTO controleurs
        (ip, has_servo, derniere_vue)
        VALUES (?, ?, ?)
        ON CONFLICT(ip)
        DO UPDATE SET
            has_servo = excluded.has_servo,
            derniere_vue = excluded.derniere_vue
        """,
        (
            ip,
            (
                1
                if informations.has_servo
                else 0
            ),
            maintenant,
        ),
    )

    # Le heartbeat représente l'état matériel courant.
    connexion.execute(
        """
        DELETE FROM composants
        WHERE ip_controleur = ?
        """,
        (
            ip,
        ),
    )

    for (
        nom,
        composant,
    ) in composants_uniques.items():

        if (
            informations.has_servo
            and nom == "robot"
            and ip not in ETAT_ACTIVATION_ROBOT_PAR_IP
        ):
            ETAT_ACTIVATION_ROBOT_PAR_IP[ip] = composant.enabled

        identifiant = (
            creer_identifiant_equipement(
                ip,
                nom,
            )
        )

        connexion.execute(
            """
            INSERT INTO composants (
                id,
                ip_controleur,
                nom,
                enabled,
                valeur,
                derniere_vue
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                identifiant,
                ip,
                nom,
                (
                    1
                    if (
                        ETAT_ACTIVATION_ROBOT_PAR_IP.get(
                            ip,
                            composant.enabled,
                        )
                        if (
                            informations.has_servo
                            and nom == "robot"
                        )
                        else composant.enabled
                    )
                    else 0
                ),
                json.dumps(
                    composant.value,
                    ensure_ascii=False,
                ),
                maintenant,
            ),
        )

    connexion.commit()
    connexion.close()

    categorie = (
        "MOBILE"
        if informations.has_servo
        else "FIXED"
    )

    print(
        f"[serveur] heartbeat {ip} "
        f"/ {categorie} / "
        f"{list(composants_uniques.keys())}"
    )

    return {
        "ok":
            True,

        "categorie":
            categorie,
    }


# =========================================================================
# ÉTAT GLOBAL DE SURVEILLANCE
# =========================================================================

@app.get(
    "/api/system",
    response_model=EtatSysteme,
)
def lire_systeme():
    connexion = get_connexion()

    ligne = connexion.execute(
        """
        SELECT armed
        FROM systeme
        WHERE id = 1
        """
    ).fetchone()

    connexion.close()

    return {
        "armed":
            bool(
                ligne["armed"]
            ),
    }


@app.put(
    "/api/system",
    response_model=EtatSysteme,
)
def modifier_systeme(
    etat: EtatSysteme,
):
    """
    Transmet l'état global à tous les Raspberry ONLINE.

    La valeur centrale n'est mémorisée qu'après succès.
    """
    connexion = get_connexion()

    controleurs = connexion.execute(
        """
        SELECT ip, derniere_vue
        FROM controleurs
        """
    ).fetchall()

    connexion.close()

    if not controleurs:
        raise HTTPException(
            status_code=503,
            detail=(
                "Aucun Raspberry enregistré."
            ),
        )

    hors_ligne = [
        ligne["ip"]
        for ligne in controleurs
        if statut_controleur(
            ligne["derniere_vue"]
        ) == "OFFLINE"
    ]

    if hors_ligne:
        raise HTTPException(
            status_code=503,
            detail=(
                "Raspberry hors ligne : "
                + ", ".join(
                    hors_ligne
                )
            ),
        )

    for controleur in controleurs:
        envoyer_json_au_raspberry(
            controleur["ip"],
            "/system",
            "PUT",
            {
                "armed":
                    etat.armed,
            },
        )

    connexion = get_connexion()

    connexion.execute(
        """
        UPDATE systeme
        SET armed = ?
        WHERE id = 1
        """,
        (
            1
            if etat.armed
            else 0,
        ),
    )

    connexion.commit()
    connexion.close()

    return etat


# =========================================================================
# ÉQUIPEMENTS
# =========================================================================

@app.get(
    "/api/equipements",
    response_model=list[Equipement],
)
def lister_equipements():
    """
    Liste dynamique construite à partir des heartbeats.
    """
    connexion = get_connexion()

    lignes = connexion.execute(
        """
        SELECT
            composants.id,
            composants.ip_controleur,
            composants.nom,
            composants.enabled,
            composants.valeur,
            composants.derniere_vue,
            controleurs.has_servo,
            controleurs.derniere_vue AS controleur_derniere_vue
        FROM composants
        JOIN controleurs
          ON controleurs.ip = composants.ip_controleur
        ORDER BY
            controleurs.has_servo ASC,
            composants.nom ASC
        """
    ).fetchall()

    connexion.close()

    return [
        construire_equipement(
            ligne,
            index + 1,
        )
        for (
            index,
            ligne,
        ) in enumerate(
            lignes
        )
    ]


@app.put(
    "/api/equipements/{identifiant}/enabled"
)
def modifier_equipement(
    identifiant: str,
    etat: EtatActivation,
):
    """
    Demande au Raspberry concerné d'activer ou désactiver le composant.
    """
    ligne = lire_equipement_sql(
        identifiant
    )

    if statut_controleur(
        ligne[
            "controleur_derniere_vue"
        ]
    ) != "ONLINE":
        raise HTTPException(
            status_code=503,
            detail=(
                "Le Raspberry responsable de "
                "cet équipement est hors ligne."
            ),
        )

    categorie = (
        "MOBILE"
        if bool(ligne["has_servo"])
        else "FIXED"
    )

    kind = type_composant(
        ligne["nom"],
        categorie,
    )

    # Le robot mobile reçoit ses commandes par polling GET /api/robot/command.
    # Il ne doit donc pas être contacté sur :8001 pour son alimentation logique.
    if kind == "ROBOT" and categorie == "MOBILE":
        ip_mobile = ligne["ip_controleur"]

        ETAT_ACTIVATION_ROBOT_PAR_IP[ip_mobile] = etat.enabled

        if not etat.enabled:
            COMMANDES_ROBOT_PAR_IP[ip_mobile] = {
                "command": "STOP",
                "speed": 0,
            }

        connexion = get_connexion()
        connexion.execute(
            """
            UPDATE composants
            SET enabled = ?
            WHERE id = ?
            """,
            (
                1 if etat.enabled else 0,
                identifiant,
            ),
        )
        connexion.commit()
        connexion.close()

        return {
            "ok": True,
            "enabled": etat.enabled,
        }

    nom_encode = urllib_parse.quote(
        ligne["nom"],
        safe="",
    )

    envoyer_json_au_raspberry(
        ligne["ip_controleur"],
        (
            f"/components/"
            f"{nom_encode}/enabled"
        ),
        "PUT",
        {
            "enabled":
                etat.enabled,
        },
    )

    connexion = get_connexion()

    connexion.execute(
        """
        UPDATE composants
        SET enabled = ?
        WHERE id = ?
        """,
        (
            1
            if etat.enabled
            else 0,
            identifiant,
        ),
    )

    connexion.commit()
    connexion.close()

    return {
        "ok":
            True,
    }


# =========================================================================
# SYSTÈME MOBILE / ROBOT - MODE POLLING SANS UVICORN SUR LE RASPBERRY
# =========================================================================

def resoudre_ip_robot(robot_id: str | None = None) -> str:
    """
    Retrouve l'IP du Raspberry mobile ciblé.

    Si React fournit robotId, le serveur utilise l'équipement correspondant.
    Sinon, on conserve une compatibilité avec l'ancien prototype en prenant
    le Raspberry mobile vu le plus récemment.
    """
    if robot_id:
        ligne = lire_equipement_sql(robot_id)

        if not bool(ligne["has_servo"]):
            raise HTTPException(
                status_code=400,
                detail="Cet équipement n'appartient pas à un Raspberry mobile.",
            )

        categorie = "MOBILE"
        kind = type_composant(ligne["nom"], categorie)

        if kind not in {"ROBOT", "SERVO"}:
            raise HTTPException(
                status_code=400,
                detail="L'équipement indiqué ne représente pas le robot mobile.",
            )

        return ligne["ip_controleur"]

    connexion = get_connexion()
    controleur = connexion.execute(
        """
        SELECT ip, derniere_vue
        FROM controleurs
        WHERE has_servo = 1
        ORDER BY derniere_vue DESC
        LIMIT 1
        """
    ).fetchone()
    connexion.close()

    if controleur is None:
        raise HTTPException(
            status_code=404,
            detail="Aucun système mobile n'est enregistré.",
        )

    return controleur["ip"]


def memoriser_commande_robot(
    ip_mobile: str,
    command: str,
    speed: int,
):
    commande_normalisee = command.strip().upper()

    commandes_autorisees = {
        "FORWARD",
        "BACKWARD",
        "LEFT",
        "RIGHT",
        "STOP",
    }

    if commande_normalisee not in commandes_autorisees:
        raise HTTPException(
            status_code=422,
            detail="Commande robot inconnue.",
        )

    if not 0 <= speed <= 100:
        raise HTTPException(
            status_code=422,
            detail="La vitesse doit être comprise entre 0 et 100.",
        )

    connexion = get_connexion()
    controleur = connexion.execute(
        """
        SELECT ip, derniere_vue
        FROM controleurs
        WHERE ip = ? AND has_servo = 1
        LIMIT 1
        """,
        (ip_mobile,),
    ).fetchone()
    connexion.close()

    if controleur is None:
        raise HTTPException(
            status_code=404,
            detail="Raspberry mobile introuvable.",
        )

    if (
        commande_normalisee != "STOP"
        and statut_controleur(controleur["derniere_vue"]) != "ONLINE"
    ):
        raise HTTPException(
            status_code=503,
            detail="Le système mobile est hors ligne.",
        )

    if (
        commande_normalisee != "STOP"
        and not ETAT_ACTIVATION_ROBOT_PAR_IP.get(ip_mobile, True)
    ):
        raise HTTPException(
            status_code=409,
            detail="Le robot est éteint.",
        )

    vitesse = 0 if commande_normalisee == "STOP" else speed

    COMMANDES_ROBOT_PAR_IP[ip_mobile] = {
        "command": commande_normalisee,
        "speed": vitesse,
    }

    print(
        "[serveur] commande robot mémorisée : "
        f"{ip_mobile} / {commande_normalisee} / {vitesse}"
    )

    return {
        "ok": True,
        "controllerIp": ip_mobile,
        "command": commande_normalisee,
        "speed": vitesse,
        "enabled": ETAT_ACTIVATION_ROBOT_PAR_IP.get(ip_mobile, True),
    }


@app.post("/api/robot/command")
def commander_robot(commande: CommandeRobot):
    """
    React mémorise une commande pour le Raspberry mobile ciblé.
    Le Raspberry la récupère ensuite par polling GET.
    """
    ip_mobile = resoudre_ip_robot(commande.robotId)

    return memoriser_commande_robot(
        ip_mobile,
        commande.command,
        commande.speed,
    )


@app.get("/api/robot/command")
def lire_commande_robot(request: Request):
    """
    Route lue en boucle par chaque Raspberry mobile.

    request.client.host permet à chaque robot de récupérer uniquement sa
    propre commande, sans modifier l'URL utilisée par le programme Raspberry.
    """
    if request.client is None:
        raise HTTPException(
            status_code=400,
            detail="Impossible de déterminer l'IP du Raspberry.",
        )

    ip_mobile = request.client.host

    commande = COMMANDES_ROBOT_PAR_IP.get(
        ip_mobile,
        {
            "command": "STOP",
            "speed": 0,
        },
    )

    return {
        "command": commande["command"],
        "speed": commande["speed"],
        "enabled": ETAT_ACTIVATION_ROBOT_PAR_IP.get(ip_mobile, True),
    }


# =========================================================================
# CAMÉRA : PROXY DE FLUX
# =========================================================================

@app.get(
    "/api/cameras/{camera_id}/stream"
)
def flux_camera(
    camera_id: str,
):
    """
    Le navigateur ouvre cette route FastAPI.

    FastAPI récupère ensuite le flux du Raspberry.
    """
    ligne = lire_equipement_sql(
        camera_id
    )

    categorie = (
        "MOBILE"
        if bool(ligne["has_servo"])
        else "FIXED"
    )

    kind = type_composant(
        ligne["nom"],
        categorie,
    )

    if kind not in (
        "CAMERA",
        "ROBOT_CAMERA",
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Cet équipement "
                "n'est pas une caméra."
            ),
        )

    if statut_controleur(
        ligne[
            "controleur_derniere_vue"
        ]
    ) != "ONLINE":
        raise HTTPException(
            status_code=503,
            detail="Caméra hors ligne.",
        )

    if not bool(
        ligne["enabled"]
    ):
        raise HTTPException(
            status_code=409,
            detail="Caméra désactivée.",
        )

    nom_encode = urllib_parse.quote(
        ligne["nom"],
        safe="",
    )

    url = (
        f"http://"
        f"{ligne['ip_controleur']}"
        f":{PORT_API_RASPBERRY}"
        f"/camera/stream"
        f"?name={nom_encode}"
    )

    try:
        reponse = urllib_request.urlopen(
            urllib_request.Request(
                url=url,
                method="GET",
            ),
            timeout=DELAI_REQUETE_RASPBERRY,
        )

    except (
        urllib_error.URLError,
        TimeoutError,
    ) as erreur:
        raise HTTPException(
            status_code=502,
            detail=(
                "Impossible d'obtenir "
                f"le flux : {erreur}"
            ),
        ) from erreur

    content_type = reponse.headers.get(
        "Content-Type",
        (
            "multipart/x-mixed-replace; "
            "boundary=frame"
        ),
    )

    def generer_flux():
        try:
            while True:
                bloc = reponse.read(
                    8192
                )

                if not bloc:
                    break

                yield bloc

        finally:
            reponse.close()

    return StreamingResponse(
        generer_flux(),
        headers={
            "Content-Type":
                content_type,
        },
    )


# =========================================================================
# CAMÉRA : CAPTURE DEMANDÉE PAR REACT
# =========================================================================

@app.post(
    "/api/cameras/{camera_id}/screenshot",
    response_model=MediaItem,
)
def capture_camera(
    camera_id: str,
):
    """
    Récupère une image du Raspberry
    et la stocke dans le dossier media du serveur.
    """
    ligne = lire_equipement_sql(
        camera_id
    )

    categorie = (
        "MOBILE"
        if bool(ligne["has_servo"])
        else "FIXED"
    )

    kind = type_composant(
        ligne["nom"],
        categorie,
    )

    if kind not in (
        "CAMERA",
        "ROBOT_CAMERA",
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Cet équipement "
                "n'est pas une caméra."
            ),
        )

    if statut_controleur(
        ligne[
            "controleur_derniere_vue"
        ]
    ) != "ONLINE":
        raise HTTPException(
            status_code=503,
            detail="Caméra hors ligne.",
        )

    if not bool(
        ligne["enabled"]
    ):
        raise HTTPException(
            status_code=409,
            detail="Caméra désactivée.",
        )

    nom_encode = urllib_parse.quote(
        ligne["nom"],
        safe="",
    )

    url = (
        f"http://"
        f"{ligne['ip_controleur']}"
        f":{PORT_API_RASPBERRY}"
        f"/camera/screenshot"
        f"?name={nom_encode}"
    )

    try:
        with urllib_request.urlopen(
            urllib_request.Request(
                url=url,
                method="POST",
            ),
            timeout=DELAI_REQUETE_RASPBERRY,
        ) as reponse:

            image = reponse.read()

            content_type = (
                reponse.headers.get(
                    "Content-Type",
                    "image/jpeg",
                )
            )

    except (
        urllib_error.URLError,
        TimeoutError,
    ) as erreur:
        raise HTTPException(
            status_code=502,
            detail=(
                "Impossible de prendre "
                f"la capture : {erreur}"
            ),
        ) from erreur

    extension = (
        ".png"
        if "png" in content_type
        else ".jpg"
    )

    media_id = str(
        uuid.uuid4()
    )

    filename = (
        f"{media_id}{extension}"
    )

    (
        DOSSIER_MEDIA
        /
        filename
    ).write_bytes(
        image
    )

    maintenant = int(
        time.time()
    )

    expiration = (
        maintenant
        +
        DUREE_MEDIA_SECONDES
    )

    camera_name = nom_affichable(
        ligne["nom"],
        categorie,
    )

    connexion = get_connexion()

    connexion.execute(
        """
        INSERT INTO media (
            id,
            camera_id,
            camera_name,
            kind,
            created_at,
            expires_at,
            saved,
            filename
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            media_id,
            camera_id,
            camera_name,
            "SCREENSHOT",
            maintenant,
            expiration,
            0,
            filename,
        ),
    )

    connexion.commit()
    connexion.close()

    return {
        "id":
            media_id,

        "cameraId":
            camera_id,

        "cameraName":
            camera_name,

        "kind":
            "SCREENSHOT",

        "createdAt":
            date_iso_depuis_timestamp(
                maintenant
            ),

        "expiresAt":
            date_iso_depuis_timestamp(
                expiration
            ),

        "saved":
            False,

        "mediaUrl":
            (
                f"/api/media/files/"
                f"{filename}"
            ),
    }


# =========================================================================
# MÉDIAS DE L'INTERFACE REACT
# =========================================================================

@app.get(
    "/api/media",
    response_model=list[MediaItem],
)
def lister_media():
    nettoyer_medias_expires()

    connexion = get_connexion()

    lignes = connexion.execute(
        """
        SELECT *
        FROM media
        ORDER BY created_at DESC
        """
    ).fetchall()

    connexion.close()

    return [
        {
            "id":
                ligne["id"],

            "cameraId":
                ligne["camera_id"],

            "cameraName":
                ligne["camera_name"],

            "kind":
                ligne["kind"],

            "createdAt":
                date_iso_depuis_timestamp(
                    ligne["created_at"]
                ),

            "expiresAt":
                date_iso_depuis_timestamp(
                    ligne["expires_at"]
                ),

            "saved":
                bool(
                    ligne["saved"]
                ),

            "mediaUrl":
                (
                    "/api/media/files/"
                    f"{ligne['filename']}"
                ),
        }
        for ligne in lignes
    ]


@app.put(
    "/api/media/{media_id}/saved"
)
def modifier_media(
    media_id: str,
    etat: EtatMedia,
):
    connexion = get_connexion()

    ligne = connexion.execute(
        """
        SELECT id
        FROM media
        WHERE id = ?
        """,
        (
            media_id,
        ),
    ).fetchone()

    if ligne is None:
        connexion.close()

        raise HTTPException(
            status_code=404,
            detail="Média introuvable.",
        )

    connexion.execute(
        """
        UPDATE media
        SET saved = ?
        WHERE id = ?
        """,
        (
            1
            if etat.saved
            else 0,
            media_id,
        ),
    )

    connexion.commit()
    connexion.close()

    return {
        "ok":
            True,
    }


@app.delete(
    "/api/media/{media_id}"
)
def supprimer_media(
    media_id: str,
):
    """
    Supprime définitivement une capture.

    La suppression retire :
    - le fichier image du dossier media ;
    - la ligne correspondante dans SQLite.
    """
    connexion = get_connexion()

    ligne = connexion.execute(
        """
        SELECT id, filename
        FROM media
        WHERE id = ?
        """,
        (
            media_id,
        ),
    ).fetchone()

    if ligne is None:
        connexion.close()

        raise HTTPException(
            status_code=404,
            detail="Média introuvable.",
        )

    nom_securise = Path(
        ligne["filename"]
    ).name

    chemin = (
        DOSSIER_MEDIA
        /
        nom_securise
    )

    if chemin.exists():
        try:
            chemin.unlink()

        except OSError as erreur:
            connexion.close()

            raise HTTPException(
                status_code=500,
                detail=(
                    "Impossible de supprimer "
                    "le fichier de la capture."
                ),
            ) from erreur

    connexion.execute(
        """
        DELETE FROM media
        WHERE id = ?
        """,
        (
            media_id,
        ),
    )

    connexion.commit()
    connexion.close()

    return {
        "ok":
            True,
    }


@app.get(
    "/api/media/files/{filename}"
)
def lire_fichier_media(
    filename: str,
):
    """
    Sert un fichier sans permettre de sortir du dossier media.
    """
    nom_securise = Path(
        filename
    ).name

    if nom_securise != filename:
        raise HTTPException(
            status_code=400,
            detail=(
                "Nom de fichier invalide."
            ),
        )

    chemin = (
        DOSSIER_MEDIA
        /
        nom_securise
    )

    if not chemin.exists():
        raise HTTPException(
            status_code=404,
            detail="Fichier introuvable.",
        )

    return FileResponse(
        chemin
    )


# =========================================================================
# ÉVÉNEMENTS : CRÉATION
# =========================================================================

@app.post("/api/evenements")
def creer_evenement(
    evenement: NouvelEvenement,
    request: Request,
):
    """
    Appelée lorsqu'un Raspberry signale une détection.

    La compatibilité avec le JSON historique est conservée :
    le Raspberry envoie toujours uniquement :

        capteur
        zone
        horodatage

    Le serveur récupère lui-même l'IP source via request.client.host.

    Si cette IP est rattachée à un site surveillé, le serveur crée
    automatiquement le dossier company_alert correspondant.

    Si le Raspberry n'est pas encore rattaché à un client/site :
    l'événement technique est quand même enregistré normalement.
    """
    identifiant = str(
        uuid.uuid4()
    )

    source_ip = (
        request.client.host
        if request.client is not None
        else None
    )

    connexion = get_connexion()

    rattachement = (
        lire_rattachement_ip(
            connexion,
            source_ip,
        )
        if source_ip
        else None
    )

    customer_id = (
        rattachement["customer_id"]
        if rattachement
        else None
    )

    site_id = (
        rattachement["site_id"]
        if rattachement
        else None
    )

    company_alert_id = None

    # Équipement technique associé à l'événement lorsque le heartbeat du
    # Raspberry permet de le déterminer.
    source_equipment_id = None
    camera_id = None

    if source_ip:
        composants_source = connexion.execute(
            """
            SELECT id, nom
            FROM composants
            WHERE ip_controleur = ?
            ORDER BY nom ASC
            """,
            (
                source_ip,
            ),
        ).fetchall()

        capteur_normalise = (
            evenement.capteur
            .strip()
            .lower()
        )

        for composant in composants_source:
            nom_normalise = (
                composant["nom"]
                .strip()
                .lower()
            )

            if (
                source_equipment_id is None
                and (
                    nom_normalise == capteur_normalise
                    or nom_normalise in capteur_normalise
                    or capteur_normalise in nom_normalise
                )
            ):
                source_equipment_id = (
                    composant["id"]
                )

            # Une caméra du même Raspberry est utile à l'opérateur pour
            # vérifier une alerte, même si l'événement initial provient
            # d'un autre capteur du contrôleur.
            if (
                camera_id is None
                and "camera" in nom_normalise
            ):
                camera_id = (
                    composant["id"]
                )

    # ---------------------------------------------------------------------
    # CRÉATION DU DOSSIER ENTREPRISE
    # ---------------------------------------------------------------------
    #
    # Un dossier d'alerte n'est créé que si le Raspberry est rattaché
    # à un site. Cela évite d'inventer un faux client ou un faux site.
    # ---------------------------------------------------------------------

    if rattachement is not None:
        company_alert_id = str(
            uuid.uuid4()
        )

        priorite = (
            determiner_priorite_evenement(
                evenement.capteur
            )
        )

        maintenant = int(
            time.time()
        )

        titre = "Alerte intrusion"

        description = (
            f"Événement détecté dans la zone "
            f"{evenement.zone} sur le site "
            f"{rattachement['site_name']}."
        )

        connexion.execute(
            """
            INSERT INTO company_alerts (
                id,
                source_event_id,
                customer_id,
                site_id,
                title,
                description,
                source_sensor,
                source_equipment_id,
                camera_id,
                priority,
                status,
                outcome,
                created_at,
                updated_at
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                'NEW', NULL, ?, ?
            )
            """,
            (
                company_alert_id,
                identifiant,
                customer_id,
                site_id,
                titre,
                description,
                evenement.capteur,
                source_equipment_id,
                camera_id,
                priorite,
                evenement.horodatage,
                maintenant,
            ),
        )

        creer_action_alerte_sql(
            connexion,
            alert_id=
                company_alert_id,
            type_action=
                "ALERT_CREATED",
            actor_type=
                "SYSTEM",
            actor_name=
                "Système Atelier Maison",
            description=
                (
                    "Alerte créée automatiquement "
                    "à partir d'une détection Raspberry."
                ),
            details=
                {
                    "sensor":
                        evenement.capteur,

                    "zone":
                        evenement.zone,

                    "sourceIp":
                        source_ip,
                },
            created_at=
                evenement.horodatage,
        )

    # ---------------------------------------------------------------------
    # ENREGISTREMENT DE L'ÉVÉNEMENT TECHNIQUE
    # ---------------------------------------------------------------------

    connexion.execute(
        """
        INSERT INTO evenements (
            id,
            capteur,
            zone,
            horodatage,
            decision,
            source_ip,
            customer_id,
            site_id,
            company_alert_id
        )
        VALUES (?, ?, ?, ?, 'en_attente', ?, ?, ?, ?)
        """,
        (
            identifiant,
            evenement.capteur,
            evenement.zone,
            evenement.horodatage,
            source_ip,
            customer_id,
            site_id,
            company_alert_id,
        ),
    )

    connexion.commit()
    connexion.close()

    print(
        "[serveur] nouvel événement reçu : "
        f"{evenement.capteur} / "
        f"{evenement.zone} "
        f"(id={identifiant}, "
        f"source={source_ip}, "
        f"company_alert={company_alert_id})"
    )

    return {
        "id":
            identifiant,

        # Ce champ supplémentaire ne casse pas les anciens Raspberry :
        # ils peuvent continuer à lire uniquement "id".
        "companyAlertId":
            company_alert_id,
    }


# =========================================================================
# ÉVÉNEMENTS : DÉCISION
# =========================================================================

@app.get(
    "/api/evenements/{identifiant}/decision"
)
def lire_decision(
    identifiant: str,
):
    connexion = get_connexion()

    ligne = connexion.execute(
        """
        SELECT decision
        FROM evenements
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    connexion.close()

    if ligne is None:
        raise HTTPException(
            status_code=404,
            detail="événement introuvable",
        )

    return {
        "decision":
            ligne["decision"],
    }


@app.post(
    "/api/evenements/{identifiant}/decision"
)
def repondre_evenement(
    identifiant: str,
    reponse: Decision,
):
    """
    Enregistre la réponse du particulier et synchronise immédiatement
    le dossier d'alerte côté entreprise.

    vraie_alerte  -> CONFIRMED
    fausse_alerte -> FALSE_ALARM
    """
    if reponse.decision not in (
        "fausse_alerte",
        "vraie_alerte",
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "decision doit être "
                "'fausse_alerte' ou "
                "'vraie_alerte'"
            ),
        )

    connexion = get_connexion()

    ligne = connexion.execute(
        """
        SELECT
            id,
            customer_id,
            company_alert_id
        FROM evenements
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    if ligne is None:
        connexion.close()

        raise HTTPException(
            status_code=404,
            detail="événement introuvable",
        )

    maintenant = int(
        time.time()
    )

    connexion.execute(
        """
        UPDATE evenements
        SET
            decision = ?,
            horodatage_decision = ?
        WHERE id = ?
        """,
        (
            reponse.decision,
            maintenant,
            identifiant,
        ),
    )

    company_alert_id = ligne[
        "company_alert_id"
    ]

    if company_alert_id:
        if reponse.decision == "vraie_alerte":
            statut_entreprise = "CONFIRMED"
            outcome = "CONFIRMED"
            description_action = (
                "Le particulier a confirmé l'intrusion "
                "depuis son espace utilisateur."
            )

        else:
            statut_entreprise = "FALSE_ALARM"
            outcome = "FALSE_ALARM"
            description_action = (
                "Le particulier a indiqué qu'il s'agissait "
                "d'une fausse alerte."
            )

        connexion.execute(
            """
            UPDATE company_alerts
            SET
                title = 'Alerte intrusion',
                status = ?,
                outcome = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                statut_entreprise,
                outcome,
                maintenant,
                company_alert_id,
            ),
        )

        creer_action_alerte_sql(
            connexion,
            alert_id=
                company_alert_id,
            type_action=
                "STATUS_CHANGED",
            actor_type=
                "CUSTOMER",
            actor_name=
                "Particulier",
            description=
                description_action,
            details=
                {
                    "decision":
                        reponse.decision,

                    "status":
                        statut_entreprise,
                },
            created_at=
                maintenant,
        )

        creer_audit_sql(
            connexion,
            customer_id=
                ligne["customer_id"],
            action=
                "CUSTOMER_ALERT_DECISION",
            actor_name=
                "Particulier",
            actor_type=
                "CUSTOMER",
            resource_type=
                "ALERT",
            resource_id=
                company_alert_id,
            description=
                description_action,
            metadata=
                {
                    "eventId":
                        identifiant,

                    "decision":
                        reponse.decision,

                    "status":
                        statut_entreprise,
                },
            created_at=
                maintenant,
        )

    connexion.commit()
    connexion.close()

    print(
        "[serveur] décision reçue pour "
        f"{identifiant} : "
        f"{reponse.decision} "
        f"(company_alert={company_alert_id})"
    )

    return {
        "ok":
            True,

        "companyAlertId":
            company_alert_id,
    }


# =========================================================================
# ÉVÉNEMENTS : IMAGE AJOUTÉE PAR L'ÉQUIPE
# =========================================================================
#
# Ces deux routes sont différentes de /api/cameras/.../screenshot.
#
# Ici l'image est liée à UN ÉVÉNEMENT précis et stockée directement
# dans SQLite dans la colonne BLOB "image".
# =========================================================================

@app.post(
    "/api/evenements/{identifiant}/image"
)
async def recevoir_capture_evenement(
    identifiant: str,
    fichier: UploadFile = File(...),
):
    """
    Le Raspberry envoie une capture liée à un événement précis.
    """
    contenu = await fichier.read()

    connexion = get_connexion()

    resultat = connexion.execute(
        """
        UPDATE evenements
        SET image = ?
        WHERE id = ?
        """,
        (
            contenu,
            identifiant,
        ),
    )

    connexion.commit()

    lignes_modifiees = (
        resultat.rowcount
    )

    connexion.close()

    if lignes_modifiees == 0:
        raise HTTPException(
            status_code=404,
            detail="événement introuvable",
        )

    return {
        "ok":
            True,
    }


@app.get(
    "/api/evenements/{identifiant}/image"
)
def lire_capture_evenement(
    identifiant: str,
):
    """
    Renvoie la photo associée à un événement.

    404 si l'événement n'existe pas ou n'a aucune image.
    """
    connexion = get_connexion()

    ligne = connexion.execute(
        """
        SELECT image
        FROM evenements
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    connexion.close()

    if (
        ligne is None
        or ligne["image"] is None
    ):
        raise HTTPException(
            status_code=404,
            detail=(
                "pas de capture "
                "pour cet événement"
            ),
        )

    return Response(
        content=ligne["image"],
        media_type="image/jpeg",
    )


# =========================================================================
# ÉVÉNEMENTS : LISTE
# =========================================================================

@app.get("/api/evenements")
def lister_evenements(
    decision: str | None = None,
):
    """
    Renvoie les événements du plus récent au plus ancien.

    IMPORTANT :
    on ne sélectionne PAS la colonne image ici.

    Une image BLOB ne doit pas être incluse dans la réponse JSON générale.
    Elle possède sa route dédiée :
        /api/evenements/{id}/image
    """
    connexion = get_connexion()

    if decision is not None:
        lignes = connexion.execute(
            """
            SELECT
                id,
                capteur,
                zone,
                horodatage,
                decision,
                horodatage_decision
            FROM evenements
            WHERE decision = ?
            ORDER BY horodatage DESC
            """,
            (
                decision,
            ),
        ).fetchall()

    else:
        lignes = connexion.execute(
            """
            SELECT
                id,
                capteur,
                zone,
                horodatage,
                decision,
                horodatage_decision
            FROM evenements
            ORDER BY horodatage DESC
            """
        ).fetchall()

    connexion.close()

    return [
        dict(ligne)
        for ligne in lignes
    ]


# =========================================================================
# ÉVÉNEMENTS : SUPPRESSION
# =========================================================================

@app.delete(
    "/api/evenements/{identifiant}"
)
def supprimer_evenement(
    identifiant: str,
):
    connexion = get_connexion()

    connexion.execute(
        """
        DELETE FROM evenements
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    )

    connexion.commit()
    connexion.close()

    return {
        "ok":
            True,
    }


@app.delete("/api/evenements")
def vider_historique():
    connexion = get_connexion()

    connexion.execute(
        "DELETE FROM evenements"
    )

    connexion.commit()
    connexion.close()

    return {
        "ok":
            True,
    }



# =========================================================================
# API ENTREPRISE : HEALTH
# =========================================================================

@app.get("/api/company/health")
def company_health():
    """
    Vérifie que les routes du centre de supervision sont disponibles.

    companyApi.ts attend volontairement :
        {"ok": true}
    """
    return {
        "ok":
            True,
    }


# =========================================================================
# API ENTREPRISE : ADMINISTRATION LÉGÈRE
# =========================================================================
#
# Ces routes permettent de créer les données indispensables au prototype
# depuis Swagger maintenant.
#
# Elles pourront être raccordées à de vraies pages d'administration plus
# tard, sans changer le modèle de données.
# =========================================================================

@app.get("/api/company/users")
def lister_utilisateurs_entreprise():
    connexion = get_connexion()

    lignes = connexion.execute(
        """
        SELECT *
        FROM company_users
        ORDER BY last_name ASC, first_name ASC
        """
    ).fetchall()

    connexion.close()

    return [
        utilisateur_entreprise_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


@app.post("/api/company/users")
def creer_utilisateur_entreprise(
    utilisateur:
        NouvelUtilisateurEntreprise,
):
    role = (
        utilisateur.role
        .strip()
        .upper()
    )

    if role not in ROLES_ENTREPRISE_AUTORISES:
        raise HTTPException(
            status_code=422,
            detail=(
                "role doit être ADMIN, SUPERVISOR, "
                "OPERATOR ou FIELD_AGENT."
            ),
        )

    identifiant = str(
        uuid.uuid4()
    )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    try:
        connexion.execute(
            """
            INSERT INTO company_users (
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                status,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'OFFLINE', ?)
            """,
            (
                identifiant,
                utilisateur.firstName.strip(),
                utilisateur.lastName.strip(),
                utilisateur.email.strip(),
                (
                    utilisateur.phone.strip()
                    if utilisateur.phone
                    else None
                ),
                role,
                maintenant,
            ),
        )

        connexion.commit()

    except sqlite3.IntegrityError as erreur:
        connexion.close()

        raise HTTPException(
            status_code=409,
            detail=(
                "Un utilisateur entreprise utilise déjà cet email."
            ),
        ) from erreur

    ligne = connexion.execute(
        """
        SELECT *
        FROM company_users
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    connexion.close()

    return utilisateur_entreprise_depuis_ligne(
        ligne
    )


@app.post("/api/company/customers")
def creer_client_entreprise(
    client:
        NouveauClientEntreprise,
):
    identifiant = str(
        uuid.uuid4()
    )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    connexion.execute(
        """
        INSERT INTO customers (
            id,
            first_name,
            last_name,
            email,
            phone,
            status,
            created_at,
            notes
        )
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
        """,
        (
            identifiant,
            client.firstName.strip(),
            client.lastName.strip(),
            client.email.strip(),
            client.phone.strip(),
            maintenant,
            (
                client.notes.strip()
                if client.notes
                else None
            ),
        ),
    )

    connexion.commit()

    ligne = verifier_client_existe(
        connexion,
        identifiant,
    )

    connexion.close()

    return client_depuis_ligne(
        ligne
    )


@app.post("/api/company/customers/{customer_id}/sites")
def creer_site_entreprise(
    customer_id:
        str,

    site:
        NouveauSiteEntreprise,
):
    identifiant = str(
        uuid.uuid4()
    )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    verifier_client_existe(
        connexion,
        customer_id,
    )

    connexion.execute(
        """
        INSERT INTO monitored_sites (
            id,
            customer_id,
            name,
            address,
            city,
            postal_code,
            country,
            status,
            armed,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'OFFLINE', 0, ?)
        """,
        (
            identifiant,
            customer_id,
            site.name.strip(),
            site.address.strip(),
            site.city.strip(),
            site.postalCode.strip(),
            site.country.strip(),
            maintenant,
        ),
    )

    connexion.commit()

    ligne = verifier_site_existe(
        connexion,
        identifiant,
    )

    connexion.close()

    return site_depuis_ligne(
        ligne
    )


@app.post("/api/company/customers/{customer_id}/emergency-contacts")
def creer_contact_urgence(
    customer_id:
        str,

    contact:
        NouveauContactUrgence,
):
    if contact.priority < 1:
        raise HTTPException(
            status_code=422,
            detail=(
                "priority doit être supérieure ou égale à 1."
            ),
        )

    identifiant = str(
        uuid.uuid4()
    )

    connexion = get_connexion()

    verifier_client_existe(
        connexion,
        customer_id,
    )

    connexion.execute(
        """
        INSERT INTO emergency_contacts (
            id,
            customer_id,
            first_name,
            last_name,
            relationship,
            phone,
            priority
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            identifiant,
            customer_id,
            contact.firstName.strip(),
            contact.lastName.strip(),
            contact.relationship.strip(),
            contact.phone.strip(),
            contact.priority,
        ),
    )

    connexion.commit()

    ligne = connexion.execute(
        """
        SELECT *
        FROM emergency_contacts
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    connexion.close()

    return contact_urgence_depuis_ligne(
        ligne
    )


# =========================================================================
# API ENTREPRISE : RASPBERRY / INSTALLATION CLIENT
# =========================================================================
#
# Le frontend d'administration ne connaît jamais les IP à l'avance.
#
# Les Raspberry apparaissent ici uniquement après un heartbeat reçu par le
# serveur central. Cette API permet ensuite de les rattacher à un site.
# =========================================================================

def construire_controleur_entreprise(
    connexion,
    controller_ip:
        str,
    has_servo,
    derniere_vue,
    site_id=None,
    site_name=None,
    customer_id=None,
    customer_name=None,
):
    """
    Construit la représentation entreprise d'un Raspberry.

    On expose également ses composants afin que la fiche client puisse
    afficher l'installation réelle : caméra, capteur, robot, servo, etc.
    """
    categorie = (
        "MOBILE"
        if bool(has_servo)
        else "FIXED"
    )

    if derniere_vue is None:
        statut = "OFFLINE"
    else:
        statut = (
            "ONLINE"
            if (
                int(time.time())
                - int(derniere_vue)
                <= DELAI_OFFLINE_SECONDES
            )
            else "OFFLINE"
        )

    composants = connexion.execute(
        """
        SELECT
            id,
            ip_controleur,
            nom,
            enabled,
            valeur,
            derniere_vue
        FROM composants
        WHERE ip_controleur = ?
        ORDER BY nom ASC
        """,
        (
            controller_ip,
        ),
    ).fetchall()

    composants_formates = []

    for composant in composants:
        valeur = None

        if composant["valeur"] is not None:
            try:
                valeur_brute = json.loads(
                    composant["valeur"]
                )

                if valeur_brute is not None:
                    valeur = str(
                        valeur_brute
                    )

            except json.JSONDecodeError:
                valeur = composant["valeur"]

        composants_formates.append(
            {
                "id":
                    composant["id"],

                "controllerIp":
                    composant["ip_controleur"],

                "name":
                    composant["nom"],

                "kind":
                    type_composant(
                        composant["nom"],
                        categorie,
                    ),

                "enabled":
                    bool(
                        composant["enabled"]
                    ),

                "value":
                    valeur,

                # Le statut opérationnel d'un composant dépend de la
                # présence récente de son Raspberry.
                "status":
                    statut,

                "lastSeen":
                    date_iso_ou_none(
                        composant["derniere_vue"]
                    ),
            }
        )

    return {
        "ip":
            controller_ip,

        "controllerType":
            categorie,

        "hasServo":
            (
                bool(has_servo)
                if has_servo is not None
                else None
            ),

        "status":
            statut,

        "lastSeen":
            date_iso_ou_none(
                derniere_vue
            ),

        "assigned":
            site_id is not None,

        "siteId":
            site_id,

        "siteName":
            site_name,

        "customerId":
            customer_id,

        "customerName":
            customer_name,

        "components":
            composants_formates,
    }


@app.get("/api/company/controllers")
def lister_controleurs_entreprise():
    """
    Liste TOUS les Raspberry connus du serveur central.

    Utilisation principale :
    écran Admin -> Nouveau client -> Installation.

    Un Raspberry non encore affecté retourne assigned=false.
    """
    connexion = get_connexion()

    lignes = connexion.execute(
        """
        SELECT
            controleurs.ip,
            controleurs.has_servo,
            controleurs.derniere_vue,
            monitored_sites.id AS site_id,
            monitored_sites.name AS site_name,
            customers.id AS customer_id,
            (
                customers.first_name
                || ' '
                || customers.last_name
            ) AS customer_name
        FROM controleurs
        LEFT JOIN site_controllers
          ON site_controllers.controller_ip = controleurs.ip
        LEFT JOIN monitored_sites
          ON monitored_sites.id = site_controllers.site_id
        LEFT JOIN customers
          ON customers.id = monitored_sites.customer_id
        ORDER BY
            CASE
                WHEN monitored_sites.id IS NULL THEN 0
                ELSE 1
            END ASC,
            controleurs.ip ASC
        """
    ).fetchall()

    resultat = [
        construire_controleur_entreprise(
            connexion,
            controller_ip=
                ligne["ip"],
            has_servo=
                ligne["has_servo"],
            derniere_vue=
                ligne["derniere_vue"],
            site_id=
                ligne["site_id"],
            site_name=
                ligne["site_name"],
            customer_id=
                ligne["customer_id"],
            customer_name=
                ligne["customer_name"],
        )
        for ligne in lignes
    ]

    connexion.close()

    return resultat


@app.put("/api/company/sites/{site_id}/controllers/{controller_ip}")
def rattacher_controleur_site(
    site_id:
        str,

    controller_ip:
        str,
):
    """
    Affecte une IP Raspberry à un site surveillé.

    Une IP ne peut appartenir qu'à un seul site à la fois.
    """
    connexion = get_connexion()

    verifier_site_existe(
        connexion,
        site_id,
    )

    controleur = connexion.execute(
        """
        SELECT ip
        FROM controleurs
        WHERE ip = ?
        """,
        (
            controller_ip,
        ),
    ).fetchone()

    if controleur is None:
        connexion.close()

        raise HTTPException(
            status_code=404,
            detail=(
                "Raspberry inconnu. "
                "Attends son premier heartbeat avant de l'affecter."
            ),
        )

    # Si l'IP était rattachée ailleurs, on la déplace vers le nouveau site.
    connexion.execute(
        """
        DELETE FROM site_controllers
        WHERE controller_ip = ?
        """,
        (
            controller_ip,
        ),
    )

    connexion.execute(
        """
        INSERT INTO site_controllers (
            site_id,
            controller_ip
        )
        VALUES (?, ?)
        """,
        (
            site_id,
            controller_ip,
        ),
    )

    connexion.commit()
    connexion.close()

    recalculer_statuts_sites()

    return {
        "ok":
            True,

        "siteId":
            site_id,

        "controllerIp":
            controller_ip,
    }


@app.get("/api/company/sites/{site_id}/controllers")
def lister_controleurs_site(
    site_id:
        str,
):
    """
    Liste les Raspberry déjà rattachés à un site, avec leurs composants.

    Cette route est utilisée lors de l'ouverture de la fiche client.
    """
    connexion = get_connexion()

    site = verifier_site_existe(
        connexion,
        site_id,
    )

    client = verifier_client_existe(
        connexion,
        site["customer_id"],
    )

    lignes = connexion.execute(
        """
        SELECT
            site_controllers.controller_ip,
            controleurs.has_servo,
            controleurs.derniere_vue
        FROM site_controllers
        LEFT JOIN controleurs
          ON controleurs.ip = site_controllers.controller_ip
        WHERE site_controllers.site_id = ?
        ORDER BY site_controllers.controller_ip ASC
        """,
        (
            site_id,
        ),
    ).fetchall()

    resultat = [
        construire_controleur_entreprise(
            connexion,
            controller_ip=
                ligne["controller_ip"],
            has_servo=
                ligne["has_servo"],
            derniere_vue=
                ligne["derniere_vue"],
            site_id=
                site["id"],
            site_name=
                site["name"],
            customer_id=
                client["id"],
            customer_name=
                (
                    f"{client['first_name']} "
                    f"{client['last_name']}"
                ),
        )
        for ligne in lignes
    ]

    connexion.close()

    return resultat


@app.post("/api/company/agents")
def creer_intervenant_entreprise(
    intervenant:
        NouvelIntervenantEntreprise,
):
    identifiant = str(
        uuid.uuid4()
    )

    connexion = get_connexion()

    connexion.execute(
        """
        INSERT INTO field_agents (
            id,
            first_name,
            last_name,
            phone,
            area,
            status,
            current_intervention_id
        )
        VALUES (?, ?, ?, ?, ?, 'AVAILABLE', NULL)
        """,
        (
            identifiant,
            intervenant.firstName.strip(),
            intervenant.lastName.strip(),
            intervenant.phone.strip(),
            intervenant.area.strip(),
        ),
    )

    connexion.commit()

    ligne = connexion.execute(
        """
        SELECT *
        FROM field_agents
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    connexion.close()

    return intervenant_depuis_ligne(
        ligne
    )


@app.post("/api/company/support")
def creer_ticket_support(
    ticket:
        NouveauTicketSupport,
):
    categorie = (
        ticket.category
        .strip()
        .upper()
    )

    priorite = (
        ticket.priority
        .strip()
        .upper()
    )

    if categorie not in CATEGORIES_SUPPORT_AUTORISEES:
        raise HTTPException(
            status_code=422,
            detail="Catégorie support inconnue.",
        )

    if priorite not in PRIORITES_AUTORISEES:
        raise HTTPException(
            status_code=422,
            detail="Priorité support inconnue.",
        )

    identifiant = str(
        uuid.uuid4()
    )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    verifier_client_existe(
        connexion,
        ticket.customerId,
    )

    if ticket.siteId is not None:
        site = verifier_site_existe(
            connexion,
            ticket.siteId,
        )

        if site["customer_id"] != ticket.customerId:
            connexion.close()

            raise HTTPException(
                status_code=409,
                detail=(
                    "Ce site n'appartient pas au client indiqué."
                ),
            )

    connexion.execute(
        """
        INSERT INTO support_tickets (
            id,
            customer_id,
            site_id,
            equipment_id,
            subject,
            description,
            category,
            priority,
            status,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?)
        """,
        (
            identifiant,
            ticket.customerId,
            ticket.siteId,
            ticket.equipmentId,
            ticket.subject.strip(),
            ticket.description.strip(),
            categorie,
            priorite,
            maintenant,
            maintenant,
        ),
    )

    creer_audit_sql(
        connexion,
        customer_id=
            ticket.customerId,
        action=
            "SUPPORT_TICKET_CREATED",
        actor_name=
            "Système Atelier Maison",
        actor_type=
            "SYSTEM",
        resource_type=
            "SUPPORT_TICKET",
        resource_id=
            identifiant,
        description=
            "Ticket support créé.",
    )

    connexion.commit()

    ligne = verifier_ticket_support_existe(
        connexion,
        identifiant,
    )

    connexion.close()

    return ticket_support_depuis_ligne(
        ligne
    )


# =========================================================================
# API ENTREPRISE : DASHBOARD
# =========================================================================

@app.get("/api/company/dashboard")
def dashboard_entreprise():
    recalculer_statuts_sites()

    connexion = get_connexion()

    actifs = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM company_alerts
        WHERE status NOT IN ('FALSE_ALARM', 'RESOLVED')
        """
    ).fetchone()["total"]

    critiques = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM company_alerts
        WHERE priority = 'CRITICAL'
          AND status NOT IN ('FALSE_ALARM', 'RESOLVED')
        """
    ).fetchone()["total"]

    attente_operateur = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM company_alerts
        WHERE status = 'NEW'
        """
    ).fetchone()["total"]

    clients = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM customers
        WHERE status = 'ACTIVE'
        """
    ).fetchone()["total"]

    sites = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM monitored_sites
        """
    ).fetchone()["total"]

    equipements = connexion.execute(
        """
        SELECT
            composants.id,
            controleurs.derniere_vue
        FROM composants
        JOIN controleurs
          ON controleurs.ip = composants.ip_controleur
        """
    ).fetchall()

    equipements_online = 0
    equipements_offline = 0

    for equipement in equipements:
        if (
            statut_controleur(
                equipement["derniere_vue"]
            )
            == "ONLINE"
        ):
            equipements_online += 1

        else:
            equipements_offline += 1

    intervenants_disponibles = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM field_agents
        WHERE status = 'AVAILABLE'
        """
    ).fetchone()["total"]

    interventions_actives = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM interventions
        WHERE status NOT IN ('COMPLETED', 'CANCELLED')
        """
    ).fetchone()["total"]

    support_ouvert = connexion.execute(
        """
        SELECT COUNT(*) AS total
        FROM support_tickets
        WHERE status NOT IN ('RESOLVED', 'CLOSED')
        """
    ).fetchone()["total"]

    moyenne = connexion.execute(
        """
        SELECT AVG(
            (
                SELECT MIN(alert_actions.created_at)
                FROM alert_actions
                WHERE alert_actions.alert_id = company_alerts.id
                  AND alert_actions.type = 'ALERT_TAKEN'
            )
            - company_alerts.created_at
        ) AS moyenne
        FROM company_alerts
        WHERE EXISTS (
            SELECT 1
            FROM alert_actions
            WHERE alert_actions.alert_id = company_alerts.id
              AND alert_actions.type = 'ALERT_TAKEN'
        )
        """
    ).fetchone()["moyenne"]

    connexion.close()

    return {
        "activeAlerts":
            int(
                actifs
            ),

        "criticalAlerts":
            int(
                critiques
            ),

        "alertsWaitingForOperator":
            int(
                attente_operateur
            ),

        "monitoredCustomers":
            int(
                clients
            ),

        "monitoredSites":
            int(
                sites
            ),

        "onlineEquipments":
            equipements_online,

        "offlineEquipments":
            equipements_offline,

        "availableAgents":
            int(
                intervenants_disponibles
            ),

        "activeInterventions":
            int(
                interventions_actives
            ),

        "openSupportTickets":
            int(
                support_ouvert
            ),

        "averageAlertTakeoverTimeSeconds":
            (
                float(
                    moyenne
                )
                if moyenne is not None
                else None
            ),
    }


# =========================================================================
# API ENTREPRISE : ALERTES
# =========================================================================

@app.get("/api/company/alerts")
def lister_alertes_entreprise(
    status:
        str | None = None,

    priority:
        str | None = None,

    customerId:
        str | None = None,

    search:
        str | None = None,
):
    clauses = []
    valeurs = []

    if status:
        clauses.append(
            "status = ?"
        )
        valeurs.append(
            status.upper()
        )

    if priority:
        clauses.append(
            "priority = ?"
        )
        valeurs.append(
            priority.upper()
        )

    if customerId:
        clauses.append(
            "customer_id = ?"
        )
        valeurs.append(
            customerId
        )

    if search:
        clauses.append(
            """
            (
                title LIKE ?
                OR description LIKE ?
                OR source_sensor LIKE ?
            )
            """
        )

        motif = (
            f"%{search}%"
        )

        valeurs.extend(
            [
                motif,
                motif,
                motif,
            ]
        )

    where_sql = (
        "WHERE "
        + " AND ".join(
            clauses
        )
        if clauses
        else ""
    )

    connexion = get_connexion()

    lignes = connexion.execute(
        f"""
        SELECT *
        FROM company_alerts
        {where_sql}
        ORDER BY
            CASE priority
                WHEN 'CRITICAL' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'MEDIUM' THEN 3
                ELSE 4
            END ASC,
            created_at DESC
        """,
        valeurs,
    ).fetchall()

    connexion.close()

    return [
        alerte_entreprise_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


@app.get("/api/company/alerts/{alert_id}")
def lire_alerte_entreprise(
    alert_id:
        str,
):
    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    client = verifier_client_existe(
        connexion,
        alerte["customer_id"],
    )

    site = verifier_site_existe(
        connexion,
        alerte["site_id"],
    )

    actions = connexion.execute(
        """
        SELECT *
        FROM alert_actions
        WHERE alert_id = ?
        ORDER BY created_at ASC
        """,
        (
            alert_id,
        ),
    ).fetchall()

    commentaires = connexion.execute(
        """
        SELECT *
        FROM company_comments
        WHERE target_type = 'ALERT'
          AND target_id = ?
        ORDER BY created_at ASC
        """,
        (
            alert_id,
        ),
    ).fetchall()

    interventions = connexion.execute(
        """
        SELECT *
        FROM interventions
        WHERE alert_id = ?
        ORDER BY requested_at DESC
        """,
        (
            alert_id,
        ),
    ).fetchall()

    escalade = connexion.execute(
        """
        SELECT *
        FROM emergency_escalations
        WHERE alert_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (
            alert_id,
        ),
    ).fetchone()

    connexion.close()

    resultat = {
        "alert":
            alerte_entreprise_depuis_ligne(
                alerte
            ),

        "customer":
            client_depuis_ligne(
                client
            ),

        "site":
            site_depuis_ligne(
                site
            ),

        "actions":
            [
                action_alerte_depuis_ligne(
                    ligne
                )
                for ligne in actions
            ],

        "comments":
            [
                commentaire_depuis_ligne(
                    ligne
                )
                for ligne in commentaires
            ],

        "interventions":
            [
                intervention_depuis_ligne(
                    ligne
                )
                for ligne in interventions
            ],
    }

    if escalade is not None:
        resultat[
            "emergencyEscalation"
        ] = escalade_depuis_ligne(
            escalade
        )

    return resultat


@app.get("/api/company/alerts/{alert_id}/actions")
def lister_actions_alerte(
    alert_id:
        str,
):
    connexion = get_connexion()

    verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    lignes = connexion.execute(
        """
        SELECT *
        FROM alert_actions
        WHERE alert_id = ?
        ORDER BY created_at ASC
        """,
        (
            alert_id,
        ),
    ).fetchall()

    connexion.close()

    return [
        action_alerte_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


@app.post("/api/company/alerts/{alert_id}/take")
def prendre_en_charge_alerte(
    alert_id:
        str,

    prise_en_charge:
        PriseEnChargeAlerte,
):
    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    connexion.execute(
        """
        UPDATE company_alerts
        SET
            status = 'IN_REVIEW',
            assigned_operator_id = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            prise_en_charge.operatorId,
            maintenant,
            alert_id,
        ),
    )

    creer_action_alerte_sql(
        connexion,
        alert_id=
            alert_id,
        type_action=
            "ALERT_TAKEN",
        actor_type=
            "COMPANY",
        actor_id=
            prise_en_charge.operatorId,
        actor_name=
            prise_en_charge.operatorName,
        description=
            (
                f"Alerte prise en charge par "
                f"{prise_en_charge.operatorName}."
            ),
        created_at=
            maintenant,
    )

    creer_audit_sql(
        connexion,
        customer_id=
            alerte["customer_id"],
        action=
            "ALERT_STATUS_CHANGED",
        actor_id=
            prise_en_charge.operatorId,
        actor_name=
            prise_en_charge.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "ALERT",
        resource_id=
            alert_id,
        description=
            "Alerte prise en charge.",
        metadata=
            {
                "status":
                    "IN_REVIEW",
            },
        created_at=
            maintenant,
    )

    connexion.commit()

    ligne = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    connexion.close()

    return alerte_entreprise_depuis_ligne(
        ligne
    )


@app.put("/api/company/alerts/{alert_id}/status")
def modifier_statut_alerte_entreprise(
    alert_id:
        str,

    modification:
        ModificationStatutAlerte,
):
    statut = (
        modification.status
        .strip()
        .upper()
    )

    if statut not in STATUTS_ALERTES_AUTORISES:
        raise HTTPException(
            status_code=422,
            detail="Statut d'alerte inconnu.",
        )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    outcome = (
        alerte["outcome"]
    )

    if statut == "FALSE_ALARM":
        outcome = "FALSE_ALARM"

    elif statut in {
        "CONFIRMED",
        "ESCALATED",
        "AGENT_DISPATCHED",
    }:
        outcome = "CONFIRMED"

    resolved_at = (
        maintenant
        if statut == "RESOLVED"
        else alerte["resolved_at"]
    )

    connexion.execute(
        """
        UPDATE company_alerts
        SET
            status = ?,
            outcome = ?,
            updated_at = ?,
            resolved_at = ?
        WHERE id = ?
        """,
        (
            statut,
            outcome,
            maintenant,
            resolved_at,
            alert_id,
        ),
    )

    type_action = (
        "ALERT_RESOLVED"
        if statut == "RESOLVED"
        else "STATUS_CHANGED"
    )

    creer_action_alerte_sql(
        connexion,
        alert_id=
            alert_id,
        type_action=
            type_action,
        actor_type=
            "COMPANY",
        actor_id=
            modification.operatorId,
        actor_name=
            modification.operatorName,
        description=
            (
                f"Statut de l'alerte modifié : {statut}."
            ),
        details=
            {
                "status":
                    statut,

                "comment":
                    modification.comment,
            },
        created_at=
            maintenant,
    )

    if (
        modification.comment
        and modification.comment.strip()
    ):
        commentaire_id = str(
            uuid.uuid4()
        )

        connexion.execute(
            """
            INSERT INTO company_comments (
                id,
                target_type,
                target_id,
                author_id,
                author_name,
                message,
                created_at
            )
            VALUES (?, 'ALERT', ?, ?, ?, ?, ?)
            """,
            (
                commentaire_id,
                alert_id,
                modification.operatorId,
                modification.operatorName,
                modification.comment.strip(),
                maintenant,
            ),
        )

    creer_audit_sql(
        connexion,
        customer_id=
            alerte["customer_id"],
        action=
            "ALERT_STATUS_CHANGED",
        actor_id=
            modification.operatorId,
        actor_name=
            modification.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "ALERT",
        resource_id=
            alert_id,
        description=
            (
                f"Statut d'alerte modifié vers {statut}."
            ),
        metadata=
            {
                "status":
                    statut,
            },
        created_at=
            maintenant,
    )

    connexion.commit()

    ligne = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    connexion.close()

    return alerte_entreprise_depuis_ligne(
        ligne
    )


@app.post("/api/company/alerts/{alert_id}/client-call")
def enregistrer_appel_client(
    alert_id:
        str,

    appel:
        AppelClientEntreprise,
):
    resultat = (
        appel.result
        .strip()
        .upper()
    )

    if resultat not in RESULTATS_APPEL_AUTORISES:
        raise HTTPException(
            status_code=422,
            detail="Résultat d'appel inconnu.",
        )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    identifiant = str(
        uuid.uuid4()
    )

    connexion.execute(
        """
        INSERT INTO client_calls (
            id,
            customer_id,
            alert_id,
            operator_id,
            result,
            comment,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            identifiant,
            alerte["customer_id"],
            alert_id,
            appel.operatorId,
            resultat,
            (
                appel.comment.strip()
                if appel.comment
                else None
            ),
            maintenant,
        ),
    )

    connexion.execute(
        """
        UPDATE company_alerts
        SET
            status = 'CLIENT_CONTACT',
            updated_at = ?
        WHERE id = ?
        """,
        (
            maintenant,
            alert_id,
        ),
    )

    creer_action_alerte_sql(
        connexion,
        alert_id=
            alert_id,
        type_action=
            "CLIENT_CALL",
        actor_type=
            "COMPANY",
        actor_id=
            appel.operatorId,
        actor_name=
            appel.operatorName,
        description=
            (
                f"Appel client : {resultat}."
            ),
        details=
            {
                "result":
                    resultat,

                "comment":
                    appel.comment,
            },
        created_at=
            maintenant,
    )

    creer_audit_sql(
        connexion,
        customer_id=
            alerte["customer_id"],
        action=
            "CLIENT_CALLED",
        actor_id=
            appel.operatorId,
        actor_name=
            appel.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "ALERT",
        resource_id=
            alert_id,
        description=
            "Tentative d'appel du client enregistrée.",
        metadata=
            {
                "result":
                    resultat,
            },
        created_at=
            maintenant,
    )

    connexion.commit()
    connexion.close()

    return {
        "id":
            identifiant,

        "customerId":
            alerte["customer_id"],

        "alertId":
            alert_id,

        "operatorId":
            appel.operatorId,

        "result":
            resultat,

        "comment":
            appel.comment,

        "createdAt":
            date_iso_depuis_timestamp(
                maintenant
            ),
    }


@app.post("/api/company/alerts/{alert_id}/dispatch")
def envoyer_intervenant(
    alert_id:
        str,

    affectation:
        AffectationIntervenant,
):
    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    agent = connexion.execute(
        """
        SELECT *
        FROM field_agents
        WHERE id = ?
        """,
        (
            affectation.agentId,
        ),
    ).fetchone()

    if agent is None:
        connexion.close()

        raise HTTPException(
            status_code=404,
            detail="Intervenant introuvable.",
        )

    if agent["status"] != "AVAILABLE":
        connexion.close()

        raise HTTPException(
            status_code=409,
            detail=(
                "Cet intervenant n'est pas disponible."
            ),
        )

    intervention_id = str(
        uuid.uuid4()
    )

    connexion.execute(
        """
        INSERT INTO interventions (
            id,
            alert_id,
            customer_id,
            site_id,
            agent_id,
            status,
            requested_at
        )
        VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?)
        """,
        (
            intervention_id,
            alert_id,
            alerte["customer_id"],
            alerte["site_id"],
            affectation.agentId,
            maintenant,
        ),
    )

    connexion.execute(
        """
        UPDATE field_agents
        SET
            status = 'DISPATCHED',
            current_intervention_id = ?
        WHERE id = ?
        """,
        (
            intervention_id,
            affectation.agentId,
        ),
    )

    connexion.execute(
        """
        UPDATE company_alerts
        SET
            status = 'AGENT_DISPATCHED',
            outcome = 'CONFIRMED',
            updated_at = ?
        WHERE id = ?
        """,
        (
            maintenant,
            alert_id,
        ),
    )

    creer_action_alerte_sql(
        connexion,
        alert_id=
            alert_id,
        type_action=
            "AGENT_DISPATCH",
        actor_type=
            "COMPANY",
        actor_id=
            affectation.operatorId,
        actor_name=
            affectation.operatorName,
        description=
            (
                f"Intervenant {agent['first_name']} "
                f"{agent['last_name']} affecté."
            ),
        details=
            {
                "agentId":
                    affectation.agentId,

                "comment":
                    affectation.comment,
            },
        created_at=
            maintenant,
    )

    creer_audit_sql(
        connexion,
        customer_id=
            alerte["customer_id"],
        action=
            "FIELD_AGENT_DISPATCHED",
        actor_id=
            affectation.operatorId,
        actor_name=
            affectation.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "ALERT",
        resource_id=
            alert_id,
        description=
            "Intervenant terrain envoyé.",
        metadata=
            {
                "agentId":
                    affectation.agentId,

                "interventionId":
                    intervention_id,
            },
        created_at=
            maintenant,
    )

    connexion.commit()

    ligne = connexion.execute(
        """
        SELECT *
        FROM interventions
        WHERE id = ?
        """,
        (
            intervention_id,
        ),
    ).fetchone()

    connexion.close()

    return intervention_depuis_ligne(
        ligne
    )


@app.post("/api/company/alerts/{alert_id}/emergency-escalation")
def demander_escalade_urgence(
    alert_id:
        str,

    demande:
        EscaladeUrgenceEntreprise,
):
    if not demande.reason.strip():
        raise HTTPException(
            status_code=422,
            detail=(
                "Une raison d'escalade est obligatoire."
            ),
        )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    identifiant = str(
        uuid.uuid4()
    )

    connexion.execute(
        """
        INSERT INTO emergency_escalations (
            id,
            alert_id,
            operator_id,
            status,
            reason,
            created_at
        )
        VALUES (?, ?, ?, 'REQUESTED', ?, ?)
        """,
        (
            identifiant,
            alert_id,
            demande.operatorId,
            demande.reason.strip(),
            maintenant,
        ),
    )

    connexion.execute(
        """
        UPDATE company_alerts
        SET
            status = 'ESCALATED',
            outcome = 'CONFIRMED',
            updated_at = ?
        WHERE id = ?
        """,
        (
            maintenant,
            alert_id,
        ),
    )

    creer_action_alerte_sql(
        connexion,
        alert_id=
            alert_id,
        type_action=
            "POLICE_ESCALATION",
        actor_type=
            "COMPANY",
        actor_id=
            demande.operatorId,
        actor_name=
            demande.operatorName,
        description=
            (
                "Demande d'escalade vers les services "
                "d'urgence enregistrée."
            ),
        details=
            {
                "reason":
                    demande.reason.strip(),
            },
        created_at=
            maintenant,
    )

    creer_audit_sql(
        connexion,
        customer_id=
            alerte["customer_id"],
        action=
            "POLICE_ESCALATION_REQUESTED",
        actor_id=
            demande.operatorId,
        actor_name=
            demande.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "ALERT",
        resource_id=
            alert_id,
        description=
            (
                "Escalade vers les services d'urgence demandée."
            ),
        metadata=
            {
                "reason":
                    demande.reason.strip(),
            },
        created_at=
            maintenant,
    )

    connexion.commit()

    ligne = connexion.execute(
        """
        SELECT *
        FROM emergency_escalations
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    connexion.close()

    return escalade_depuis_ligne(
        ligne
    )



# =========================================================================
# API ENTREPRISE : CLIENTS
# =========================================================================

@app.get("/api/company/customers")
def lister_clients_entreprise(
    search:
        str | None = None,

    status:
        str | None = None,
):
    clauses = []
    valeurs = []

    if status:
        clauses.append(
            "status = ?"
        )
        valeurs.append(
            status.upper()
        )

    if search:
        clauses.append(
            """
            (
                first_name LIKE ?
                OR last_name LIKE ?
                OR email LIKE ?
                OR phone LIKE ?
            )
            """
        )

        motif = (
            f"%{search}%"
        )

        valeurs.extend(
            [
                motif,
                motif,
                motif,
                motif,
            ]
        )

    where_sql = (
        "WHERE "
        + " AND ".join(
            clauses
        )
        if clauses
        else ""
    )

    connexion = get_connexion()

    lignes = connexion.execute(
        f"""
        SELECT *
        FROM customers
        {where_sql}
        ORDER BY last_name ASC, first_name ASC
        """,
        valeurs,
    ).fetchall()

    connexion.close()

    return [
        client_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


@app.get("/api/company/customers/{customer_id}")
def lire_fiche_client_entreprise(
    customer_id:
        str,
):
    recalculer_statuts_sites()

    connexion = get_connexion()

    client = verifier_client_existe(
        connexion,
        customer_id,
    )

    sites = connexion.execute(
        """
        SELECT *
        FROM monitored_sites
        WHERE customer_id = ?
        ORDER BY created_at ASC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    contacts = connexion.execute(
        """
        SELECT *
        FROM emergency_contacts
        WHERE customer_id = ?
        ORDER BY priority ASC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    alertes = connexion.execute(
        """
        SELECT *
        FROM company_alerts
        WHERE customer_id = ?
        ORDER BY created_at DESC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    tickets = connexion.execute(
        """
        SELECT *
        FROM support_tickets
        WHERE customer_id = ?
        ORDER BY created_at DESC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    commentaires = connexion.execute(
        """
        SELECT *
        FROM company_comments
        WHERE target_type = 'CUSTOMER'
          AND target_id = ?
        ORDER BY created_at DESC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    # ---------------------------------------------------------------------
    # HISTORIQUE GLOBAL CLIENT
    # ---------------------------------------------------------------------
    #
    # On agrège :
    #
    # - création / évolution des alertes ;
    # - actions entreprise / client / système ;
    # - tickets support.
    #
    # Chaque entrée respecte le type CustomerActivity du frontend.
    # ---------------------------------------------------------------------

    activites = []

    for alerte in alertes:
        activites.append(
            {
                "id":
                    f"alert-{alerte['id']}",

                "customerId":
                    customer_id,

                "category":
                    "ALERT",

                "title":
                    alerte["title"],

                "description":
                    (
                        f"Alerte {alerte['status']} "
                        f"- priorité {alerte['priority']}."
                    ),

                "actor":
                    "Système Atelier Maison",

                "createdAt":
                    date_iso_depuis_timestamp(
                        alerte["created_at"]
                    ),

                "_sort":
                    alerte["created_at"],
            }
        )

    actions = connexion.execute(
        """
        SELECT alert_actions.*
        FROM alert_actions
        JOIN company_alerts
          ON company_alerts.id = alert_actions.alert_id
        WHERE company_alerts.customer_id = ?
        ORDER BY alert_actions.created_at DESC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    for action in actions:
        categorie = (
            "CUSTOMER_ACTION"
            if action["actor_type"] == "CUSTOMER"
            else (
                "COMPANY_ACTION"
                if action["actor_type"] == "COMPANY"
                else "SYSTEM"
            )
        )

        activites.append(
            {
                "id":
                    f"action-{action['id']}",

                "customerId":
                    customer_id,

                "category":
                    categorie,

                "title":
                    action["type"],

                "description":
                    action["description"],

                "actor":
                    action["actor_name"],

                "createdAt":
                    date_iso_depuis_timestamp(
                        action["created_at"]
                    ),

                "_sort":
                    action["created_at"],
            }
        )

    for ticket in tickets:
        activites.append(
            {
                "id":
                    f"support-{ticket['id']}",

                "customerId":
                    customer_id,

                "category":
                    "SUPPORT",

                "title":
                    ticket["subject"],

                "description":
                    (
                        f"Ticket support {ticket['status']} "
                        f"- {ticket['category']}."
                    ),

                "actor":
                    "Support Atelier Maison",

                "createdAt":
                    date_iso_depuis_timestamp(
                        ticket["created_at"]
                    ),

                "_sort":
                    ticket["created_at"],
            }
        )

    activites.sort(
        key=lambda item:
            item["_sort"],
        reverse=True,
    )

    for activite in activites:
        activite.pop(
            "_sort",
            None,
        )

    connexion.close()

    statistiques = (
        calculer_statistiques_client(
            customer_id,
            "30D",
        )
    )

    return {
        "customer":
            client_depuis_ligne(
                client
            ),

        "sites":
            [
                site_depuis_ligne(
                    ligne
                )
                for ligne in sites
            ],

        "emergencyContacts":
            [
                contact_urgence_depuis_ligne(
                    ligne
                )
                for ligne in contacts
            ],

        "recentAlerts":
            [
                alerte_entreprise_depuis_ligne(
                    ligne
                )
                for ligne in alertes[:5]
            ],

        "alertHistory":
            [
                alerte_entreprise_depuis_ligne(
                    ligne
                )
                for ligne in alertes
            ],

        "activityHistory":
            activites,

        "supportTickets":
            [
                ticket_support_depuis_ligne(
                    ligne
                )
                for ligne in tickets
            ],

        "comments":
            [
                commentaire_depuis_ligne(
                    ligne
                )
                for ligne in commentaires
            ],

        "statistics":
            statistiques,
    }


@app.get("/api/company/customers/{customer_id}/alerts")
def lister_alertes_client(
    customer_id:
        str,
):
    connexion = get_connexion()

    verifier_client_existe(
        connexion,
        customer_id,
    )

    lignes = connexion.execute(
        """
        SELECT *
        FROM company_alerts
        WHERE customer_id = ?
        ORDER BY created_at DESC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    connexion.close()

    return [
        alerte_entreprise_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


@app.get("/api/company/customers/{customer_id}/activity")
def historique_activite_client(
    customer_id:
        str,
):
    connexion = get_connexion()

    verifier_client_existe(
        connexion,
        customer_id,
    )

    alertes = connexion.execute(
        """
        SELECT *
        FROM company_alerts
        WHERE customer_id = ?
        ORDER BY created_at DESC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    actions = connexion.execute(
        """
        SELECT alert_actions.*
        FROM alert_actions
        JOIN company_alerts
          ON company_alerts.id = alert_actions.alert_id
        WHERE company_alerts.customer_id = ?
        ORDER BY alert_actions.created_at DESC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    tickets = connexion.execute(
        """
        SELECT *
        FROM support_tickets
        WHERE customer_id = ?
        ORDER BY created_at DESC
        """,
        (
            customer_id,
        ),
    ).fetchall()

    connexion.close()

    activites = []

    for alerte in alertes:
        activites.append(
            {
                "id":
                    f"alert-{alerte['id']}",

                "customerId":
                    customer_id,

                "category":
                    "ALERT",

                "title":
                    alerte["title"],

                "description":
                    (
                        f"Alerte {alerte['status']} "
                        f"- priorité {alerte['priority']}."
                    ),

                "actor":
                    "Système Atelier Maison",

                "createdAt":
                    date_iso_depuis_timestamp(
                        alerte["created_at"]
                    ),

                "_sort":
                    alerte["created_at"],
            }
        )

    for action in actions:
        categorie = (
            "CUSTOMER_ACTION"
            if action["actor_type"] == "CUSTOMER"
            else (
                "COMPANY_ACTION"
                if action["actor_type"] == "COMPANY"
                else "SYSTEM"
            )
        )

        activites.append(
            {
                "id":
                    f"action-{action['id']}",

                "customerId":
                    customer_id,

                "category":
                    categorie,

                "title":
                    action["type"],

                "description":
                    action["description"],

                "actor":
                    action["actor_name"],

                "createdAt":
                    date_iso_depuis_timestamp(
                        action["created_at"]
                    ),

                "_sort":
                    action["created_at"],
            }
        )

    for ticket in tickets:
        activites.append(
            {
                "id":
                    f"support-{ticket['id']}",

                "customerId":
                    customer_id,

                "category":
                    "SUPPORT",

                "title":
                    ticket["subject"],

                "description":
                    (
                        f"Ticket support {ticket['status']} "
                        f"- {ticket['category']}."
                    ),

                "actor":
                    "Support Atelier Maison",

                "createdAt":
                    date_iso_depuis_timestamp(
                        ticket["created_at"]
                    ),

                "_sort":
                    ticket["created_at"],
            }
        )

    activites.sort(
        key=lambda item:
            item["_sort"],
        reverse=True,
    )

    for activite in activites:
        activite.pop(
            "_sort",
            None,
        )

    return activites


@app.get("/api/company/customers/{customer_id}/statistics")
def statistiques_client_entreprise(
    customer_id:
        str,

    period:
        str = "30D",
):
    return calculer_statistiques_client(
        customer_id,
        period.upper(),
    )


# =========================================================================
# API ENTREPRISE : COMMENTAIRES INTERNES
# =========================================================================

@app.get("/api/company/comments")
def lister_commentaires_entreprise(
    targetType:
        str,

    targetId:
        str,
):
    connexion = get_connexion()

    lignes = connexion.execute(
        """
        SELECT *
        FROM company_comments
        WHERE target_type = ?
          AND target_id = ?
        ORDER BY created_at ASC
        """,
        (
            targetType.upper(),
            targetId,
        ),
    ).fetchall()

    connexion.close()

    return [
        commentaire_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


@app.post("/api/company/comments")
def ajouter_commentaire_entreprise(
    commentaire:
        NouveauCommentaireEntreprise,
):
    target_type = (
        commentaire.targetType
        .strip()
        .upper()
    )

    if target_type not in {
        "ALERT",
        "CUSTOMER",
        "SUPPORT_TICKET",
    }:
        raise HTTPException(
            status_code=422,
            detail="Type de cible de commentaire inconnu.",
        )

    if not commentaire.message.strip():
        raise HTTPException(
            status_code=422,
            detail="Le commentaire ne peut pas être vide.",
        )

    maintenant = int(
        time.time()
    )

    identifiant = str(
        uuid.uuid4()
    )

    customer_id = None

    connexion = get_connexion()

    # ---------------------------------------------------------------
    # Validation de la cible + récupération du customer_id
    # pour le journal d'audit.
    # ---------------------------------------------------------------

    if target_type == "ALERT":
        alerte = verifier_alerte_entreprise_existe(
            connexion,
            commentaire.targetId,
        )

        customer_id = alerte[
            "customer_id"
        ]

    elif target_type == "CUSTOMER":
        verifier_client_existe(
            connexion,
            commentaire.targetId,
        )

        customer_id = (
            commentaire.targetId
        )

    else:
        ticket = verifier_ticket_support_existe(
            connexion,
            commentaire.targetId,
        )

        customer_id = ticket[
            "customer_id"
        ]

    connexion.execute(
        """
        INSERT INTO company_comments (
            id,
            target_type,
            target_id,
            author_id,
            author_name,
            message,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            identifiant,
            target_type,
            commentaire.targetId,
            commentaire.operatorId,
            commentaire.operatorName,
            commentaire.message.strip(),
            maintenant,
        ),
    )

    if target_type == "ALERT":
        creer_action_alerte_sql(
            connexion,
            alert_id=
                commentaire.targetId,
            type_action=
                "COMMENT_ADDED",
            actor_type=
                "COMPANY",
            actor_id=
                commentaire.operatorId,
            actor_name=
                commentaire.operatorName,
            description=
                "Commentaire interne ajouté à l'alerte.",
            details=
                {
                    "commentId":
                        identifiant,
                },
            created_at=
                maintenant,
        )

    creer_audit_sql(
        connexion,
        customer_id=
            customer_id,
        action=
            "COMMENT_CREATED",
        actor_id=
            commentaire.operatorId,
        actor_name=
            commentaire.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            target_type,
        resource_id=
            commentaire.targetId,
        description=
            "Commentaire interne ajouté.",
        metadata=
            {
                "commentId":
                    identifiant,
            },
        created_at=
            maintenant,
    )

    connexion.commit()

    ligne = connexion.execute(
        """
        SELECT *
        FROM company_comments
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    connexion.close()

    return commentaire_depuis_ligne(
        ligne
    )


# =========================================================================
# API ENTREPRISE : SUPPORT
# =========================================================================

@app.get("/api/company/support")
def lister_tickets_support(
    status:
        str | None = None,

    priority:
        str | None = None,

    customerId:
        str | None = None,

    search:
        str | None = None,
):
    clauses = []
    valeurs = []

    if status:
        clauses.append(
            "status = ?"
        )
        valeurs.append(
            status.upper()
        )

    if priority:
        clauses.append(
            "priority = ?"
        )
        valeurs.append(
            priority.upper()
        )

    if customerId:
        clauses.append(
            "customer_id = ?"
        )
        valeurs.append(
            customerId
        )

    if search:
        clauses.append(
            """
            (
                subject LIKE ?
                OR description LIKE ?
            )
            """
        )

        motif = (
            f"%{search}%"
        )

        valeurs.extend(
            [
                motif,
                motif,
            ]
        )

    where_sql = (
        "WHERE "
        + " AND ".join(
            clauses
        )
        if clauses
        else ""
    )

    connexion = get_connexion()

    lignes = connexion.execute(
        f"""
        SELECT *
        FROM support_tickets
        {where_sql}
        ORDER BY
            CASE priority
                WHEN 'CRITICAL' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'MEDIUM' THEN 3
                ELSE 4
            END ASC,
            created_at DESC
        """,
        valeurs,
    ).fetchall()

    connexion.close()

    return [
        ticket_support_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


@app.get("/api/company/support/{ticket_id}")
def lire_ticket_support(
    ticket_id:
        str,
):
    connexion = get_connexion()

    ticket = verifier_ticket_support_existe(
        connexion,
        ticket_id,
    )

    client = verifier_client_existe(
        connexion,
        ticket["customer_id"],
    )

    messages = connexion.execute(
        """
        SELECT *
        FROM support_messages
        WHERE ticket_id = ?
        ORDER BY created_at ASC
        """,
        (
            ticket_id,
        ),
    ).fetchall()

    commentaires = connexion.execute(
        """
        SELECT *
        FROM company_comments
        WHERE target_type = 'SUPPORT_TICKET'
          AND target_id = ?
        ORDER BY created_at ASC
        """,
        (
            ticket_id,
        ),
    ).fetchall()

    connexion.close()

    return {
        "ticket":
            ticket_support_depuis_ligne(
                ticket
            ),

        "customer":
            client_depuis_ligne(
                client
            ),

        "messages":
            [
                message_support_depuis_ligne(
                    ligne
                )
                for ligne in messages
            ],

        "comments":
            [
                commentaire_depuis_ligne(
                    ligne
                )
                for ligne in commentaires
            ],
    }


@app.post("/api/company/support/{ticket_id}/messages")
def ajouter_message_support(
    ticket_id:
        str,

    message:
        NouveauMessageSupport,
):
    if not message.message.strip():
        raise HTTPException(
            status_code=422,
            detail="Le message ne peut pas être vide.",
        )

    maintenant = int(
        time.time()
    )

    identifiant = str(
        uuid.uuid4()
    )

    connexion = get_connexion()

    ticket = verifier_ticket_support_existe(
        connexion,
        ticket_id,
    )

    connexion.execute(
        """
        INSERT INTO support_messages (
            id,
            ticket_id,
            author_type,
            author_id,
            author_name,
            message,
            internal,
            created_at
        )
        VALUES (?, ?, 'COMPANY', ?, ?, ?, ?, ?)
        """,
        (
            identifiant,
            ticket_id,
            message.operatorId,
            message.operatorName,
            message.message.strip(),
            (
                1
                if message.internal
                else 0
            ),
            maintenant,
        ),
    )

    connexion.execute(
        """
        UPDATE support_tickets
        SET updated_at = ?
        WHERE id = ?
        """,
        (
            maintenant,
            ticket_id,
        ),
    )

    creer_audit_sql(
        connexion,
        customer_id=
            ticket["customer_id"],
        action=
            "SUPPORT_TICKET_UPDATED",
        actor_id=
            message.operatorId,
        actor_name=
            message.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "SUPPORT_TICKET",
        resource_id=
            ticket_id,
        description=
            (
                "Note interne ajoutée au ticket support."
                if message.internal
                else "Message support envoyé."
            ),
        metadata=
            {
                "internal":
                    message.internal,
            },
        created_at=
            maintenant,
    )

    connexion.commit()

    ligne = connexion.execute(
        """
        SELECT *
        FROM support_messages
        WHERE id = ?
        """,
        (
            identifiant,
        ),
    ).fetchone()

    connexion.close()

    return message_support_depuis_ligne(
        ligne
    )


@app.put("/api/company/support/{ticket_id}/status")
def modifier_statut_ticket_support(
    ticket_id:
        str,

    modification:
        ModificationStatutSupport,
):
    statut = (
        modification.status
        .strip()
        .upper()
    )

    if statut not in STATUTS_SUPPORT_AUTORISES:
        raise HTTPException(
            status_code=422,
            detail="Statut support inconnu.",
        )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    ticket = verifier_ticket_support_existe(
        connexion,
        ticket_id,
    )

    resolved_at = (
        maintenant
        if statut in {
            "RESOLVED",
            "CLOSED",
        }
        else None
    )

    connexion.execute(
        """
        UPDATE support_tickets
        SET
            status = ?,
            updated_at = ?,
            resolved_at = ?
        WHERE id = ?
        """,
        (
            statut,
            maintenant,
            resolved_at,
            ticket_id,
        ),
    )

    creer_audit_sql(
        connexion,
        customer_id=
            ticket["customer_id"],
        action=
            "SUPPORT_TICKET_UPDATED",
        actor_id=
            modification.operatorId,
        actor_name=
            modification.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "SUPPORT_TICKET",
        resource_id=
            ticket_id,
        description=
            (
                f"Statut du ticket support modifié : {statut}."
            ),
        metadata=
            {
                "status":
                    statut,
            },
        created_at=
            maintenant,
    )

    connexion.commit()

    ligne = verifier_ticket_support_existe(
        connexion,
        ticket_id,
    )

    connexion.close()

    return ticket_support_depuis_ligne(
        ligne
    )


# =========================================================================
# API ENTREPRISE : INTERVENANTS / INTERVENTIONS
# =========================================================================

@app.get("/api/company/agents")
def lister_intervenants_entreprise():
    connexion = get_connexion()

    lignes = connexion.execute(
        """
        SELECT *
        FROM field_agents
        ORDER BY
            CASE status
                WHEN 'AVAILABLE' THEN 1
                WHEN 'DISPATCHED' THEN 2
                WHEN 'ON_SITE' THEN 3
                ELSE 4
            END ASC,
            last_name ASC,
            first_name ASC
        """
    ).fetchall()

    connexion.close()

    return [
        intervenant_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


@app.get("/api/company/interventions")
def lister_interventions_entreprise(
    customerId:
        str | None = None,
):
    connexion = get_connexion()

    if customerId:
        lignes = connexion.execute(
            """
            SELECT *
            FROM interventions
            WHERE customer_id = ?
            ORDER BY requested_at DESC
            """,
            (
                customerId,
            ),
        ).fetchall()

    else:
        lignes = connexion.execute(
            """
            SELECT *
            FROM interventions
            ORDER BY requested_at DESC
            """
        ).fetchall()

    connexion.close()

    return [
        intervention_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


# =========================================================================
# API ENTREPRISE : AUDIT
# =========================================================================

@app.get("/api/company/audit")
def lister_logs_audit(
    customerId:
        str | None = None,
):
    connexion = get_connexion()

    if customerId:
        lignes = connexion.execute(
            """
            SELECT *
            FROM audit_logs
            WHERE customer_id = ?
            ORDER BY created_at DESC
            """,
            (
                customerId,
            ),
        ).fetchall()

    else:
        lignes = connexion.execute(
            """
            SELECT *
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 1000
            """
        ).fetchall()

    connexion.close()

    return [
        audit_depuis_ligne(
            ligne
        )
        for ligne in lignes
    ]


# =========================================================================
# API ENTREPRISE : ACTIONS MATÉRIELLES AUDITÉES
# =========================================================================
#
# L'espace client peut continuer à utiliser les routes historiques :
#
#   /api/robot/command
#   /api/cameras/...
#   /api/equipements/...
#
# L'espace ENTREPRISE utilise ces wrappers lorsqu'une action est effectuée
# pendant le traitement d'une alerte.
#
# Cela permet de tracer automatiquement :
#
# - consultation d'une caméra ;
# - capture ;
# - déplacement du robot ;
# - activation/désactivation d'un équipement.
#
# Le frontend entreprise ne doit donc pas créer lui-même un AuditLog.
# =========================================================================

@app.post(
    "/api/company/alerts/{alert_id}/cameras/{camera_id}/view"
)
def enregistrer_vue_camera_entreprise(
    alert_id:
        str,

    camera_id:
        str,

    vue:
        NouvelleVueCameraEntreprise,
):
    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    ligne_camera = lire_equipement_sql(
        camera_id
    )

    categorie = (
        "MOBILE"
        if bool(
            ligne_camera["has_servo"]
        )
        else "FIXED"
    )

    kind = type_composant(
        ligne_camera["nom"],
        categorie,
    )

    if kind not in {
        "CAMERA",
        "ROBOT_CAMERA",
    }:
        connexion.close()

        raise HTTPException(
            status_code=400,
            detail=(
                "L'équipement indiqué n'est pas une caméra."
            ),
        )

    maintenant = int(
        time.time()
    )

    creer_action_alerte_sql(
        connexion,
        alert_id=
            alert_id,
        type_action=
            "CAMERA_VIEWED",
        actor_type=
            "COMPANY",
        actor_id=
            vue.operatorId,
        actor_name=
            vue.operatorName,
        description=
            (
                f"Caméra {camera_id} consultée."
            ),
        details=
            {
                "cameraId":
                    camera_id,
            },
        created_at=
            maintenant,
    )

    creer_audit_sql(
        connexion,
        customer_id=
            alerte["customer_id"],
        action=
            "CAMERA_VIEW_STARTED",
        actor_id=
            vue.operatorId,
        actor_name=
            vue.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "CAMERA",
        resource_id=
            camera_id,
        description=
            (
                "Consultation du flux caméra démarrée "
                f"depuis l'alerte {alert_id}."
            ),
        metadata=
            {
                "alertId":
                    alert_id,
            },
        created_at=
            maintenant,
    )

    connexion.commit()
    connexion.close()

    return {
        "ok":
            True,

        "streamUrl":
            (
                f"/api/cameras/"
                f"{camera_id}/stream"
            ),
    }


@app.post(
    "/api/company/alerts/{alert_id}/cameras/{camera_id}/screenshot"
)
def capture_camera_entreprise(
    alert_id:
        str,

    camera_id:
        str,

    capture:
        NouvelleCaptureCameraEntreprise,
):
    # On exécute d'abord la vraie capture.
    media = capture_camera(
        camera_id
    )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    creer_action_alerte_sql(
        connexion,
        alert_id=
            alert_id,
        type_action=
            "SCREENSHOT_TAKEN",
        actor_type=
            "COMPANY",
        actor_id=
            capture.operatorId,
        actor_name=
            capture.operatorName,
        description=
            (
                f"Capture réalisée avec la caméra {camera_id}."
            ),
        details=
            {
                "cameraId":
                    camera_id,

                "mediaId":
                    media["id"],
            },
        created_at=
            maintenant,
    )

    creer_audit_sql(
        connexion,
        customer_id=
            alerte["customer_id"],
        action=
            "SCREENSHOT_CREATED",
        actor_id=
            capture.operatorId,
        actor_name=
            capture.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "CAMERA",
        resource_id=
            camera_id,
        description=
            (
                "Capture caméra créée depuis une alerte entreprise."
            ),
        metadata=
            {
                "alertId":
                    alert_id,

                "mediaId":
                    media["id"],
            },
        created_at=
            maintenant,
    )

    connexion.commit()
    connexion.close()

    return media


@app.post(
    "/api/company/alerts/{alert_id}/robot-command"
)
def commander_robot_entreprise(
    alert_id:
        str,

    commande:
        NouvelleCommandeRobotEntreprise,
):
    # On cible le Raspberry mobile rattaché au site de cette alerte.
    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    if commande.robotId:
        # Le frontend entreprise fournit maintenant l'équipement exact.
        # On vérifie qu'il appartient bien au site de l'alerte avant
        # d'autoriser le pilotage.
        robot_ligne = connexion.execute(
            """
            SELECT
                composants.id,
                composants.nom,
                composants.ip_controleur
            FROM composants
            JOIN controleurs
              ON controleurs.ip = composants.ip_controleur
            JOIN site_controllers
              ON site_controllers.controller_ip = controleurs.ip
            WHERE site_controllers.site_id = ?
              AND controleurs.has_servo = 1
              AND composants.id = ?
              AND composants.nom IN ('robot', 'servo')
            LIMIT 1
            """,
            (
                alerte["site_id"],
                commande.robotId,
            ),
        ).fetchone()

        if robot_ligne is None:
            connexion.close()

            raise HTTPException(
                status_code=404,
                detail=(
                    "Le robot demandé n'appartient pas "
                    "au site de cette alerte."
                ),
            )

    else:
        # Compatibilité avec l'ancien frontend : recherche automatique du
        # composant ROBOT du site, puis SERVO en secours.
        robot_ligne = connexion.execute(
            """
            SELECT
                composants.id,
                composants.nom,
                composants.ip_controleur
            FROM site_controllers
            JOIN controleurs
              ON controleurs.ip = site_controllers.controller_ip
            LEFT JOIN composants
              ON composants.ip_controleur = controleurs.ip
            WHERE site_controllers.site_id = ?
              AND controleurs.has_servo = 1
              AND composants.nom IN ('robot', 'servo')
            ORDER BY
              CASE composants.nom WHEN 'robot' THEN 0 ELSE 1 END
            LIMIT 1
            """,
            (alerte["site_id"],),
        ).fetchone()

        if robot_ligne is None:
            connexion.close()

            raise HTTPException(
                status_code=404,
                detail=(
                    "Aucun robot mobile n'est rattaché "
                    "au site de cette alerte."
                ),
            )

    connexion.close()

    resultat = commander_robot(
        CommandeRobot(
            command=commande.command,
            speed=commande.speed,
            robotId=robot_ligne["id"],
        )
    )

    maintenant = int(time.time())

    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    creer_action_alerte_sql(
        connexion,
        alert_id=
            alert_id,
        type_action=
            "ROBOT_COMMAND",
        actor_type=
            "COMPANY",
        actor_id=
            commande.operatorId,
        actor_name=
            commande.operatorName,
        description=
            (
                f"Commande robot : "
                f"{commande.command.upper()} "
                f"à {commande.speed}%."
            ),
        details=
            {
                "command":
                    commande.command.upper(),

                "speed":
                    commande.speed,

                "robotId":
                    robot_ligne["id"],
            },
        created_at=
            maintenant,
    )

    creer_audit_sql(
        connexion,
        customer_id=
            alerte["customer_id"],
        action=
            "ROBOT_COMMAND_SENT",
        actor_id=
            commande.operatorId,
        actor_name=
            commande.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "ROBOT",
        resource_id=
            "mobile-controller",
        description=
            (
                "Commande robot envoyée depuis "
                f"l'alerte {alert_id}."
            ),
        metadata=
            {
                "alertId":
                    alert_id,

                "command":
                    commande.command.upper(),

                "speed":
                    commande.speed,

                "robotId":
                    robot_ligne["id"],
            },
        created_at=
            maintenant,
    )

    connexion.commit()
    connexion.close()

    return resultat


@app.put(
    "/api/company/alerts/{alert_id}/equipments/{equipment_id}/enabled"
)
def modifier_equipement_entreprise(
    alert_id:
        str,

    equipment_id:
        str,

    activation:
        ActivationEquipementEntreprise,
):
    # Réutilisation de la vraie route équipement.
    resultat = modifier_equipement(
        equipment_id,
        EtatActivation(
            enabled=
                activation.enabled,
        ),
    )

    maintenant = int(
        time.time()
    )

    connexion = get_connexion()

    alerte = verifier_alerte_entreprise_existe(
        connexion,
        alert_id,
    )

    action_audit = (
        "EQUIPMENT_ENABLED"
        if activation.enabled
        else "EQUIPMENT_DISABLED"
    )

    creer_audit_sql(
        connexion,
        customer_id=
            alerte["customer_id"],
        action=
            action_audit,
        actor_id=
            activation.operatorId,
        actor_name=
            activation.operatorName,
        actor_type=
            "COMPANY",
        resource_type=
            "EQUIPMENT",
        resource_id=
            equipment_id,
        description=
            (
                "Équipement activé depuis une alerte entreprise."
                if activation.enabled
                else "Équipement désactivé depuis une alerte entreprise."
            ),
        metadata=
            {
                "alertId":
                    alert_id,

                "enabled":
                    activation.enabled,
            },
        created_at=
            maintenant,
    )

    connexion.commit()
    connexion.close()

    return resultat


# =========================================================================
# LANCEMENT DU SERVEUR
# =========================================================================

if __name__ == "__main__":
    import uvicorn

    # 0.0.0.0 permet aux autres machines du LAN
    # d'accéder au serveur FastAPI.
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
    )
