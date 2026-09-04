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


# =========================================================================
# BASE DE DONNÉES
# =========================================================================

def get_connexion():
    """
    Ouvre une connexion SQLite.

    row_factory permet d'utiliser le nom des colonnes :
        ligne["capteur"]
    au lieu de leur position.
    """
    connexion = sqlite3.connect(CHEMIN_BASE)
    connexion.row_factory = sqlite3.Row
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
                    if composant.enabled
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
# SYSTÈME MOBILE / ROBOT
# =========================================================================

@app.post("/api/robot/command")
def commander_robot(
    commande: CommandeRobot,
):
    """
    Le serveur choisit le contrôleur has_servo=1 le plus récemment vu.

    Cette route correspond à l'API utilisée par le frontend React.
    """
    commandes_autorisees = {
        "FORWARD",
        "BACKWARD",
        "LEFT",
        "RIGHT",
        "STOP",
    }

    commande_normalisee = (
        commande.command
        .strip()
        .upper()
    )

    if (
        commande_normalisee
        not in commandes_autorisees
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "Commande robot inconnue."
            ),
        )

    if not (
        0
        <= commande.speed
        <= 100
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "La vitesse doit être "
                "comprise entre 0 et 100."
            ),
        )

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
            detail=(
                "Aucun système mobile "
                "n'est enregistré."
            ),
        )

    if statut_controleur(
        controleur["derniere_vue"]
    ) != "ONLINE":
        raise HTTPException(
            status_code=503,
            detail=(
                "Le système mobile "
                "est hors ligne."
            ),
        )

    envoyer_json_au_raspberry(
        controleur["ip"],
        "/robot/command",
        "POST",
        {
            "command":
                commande_normalisee,

            "speed":
                commande.speed,
        },
    )

    return {
        "ok":
            True,
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
):
    """
    Appelée lorsqu'un Raspberry signale une détection.
    """
    identifiant = str(
        uuid.uuid4()
    )

    connexion = get_connexion()

    connexion.execute(
        """
        INSERT INTO evenements (
            id,
            capteur,
            zone,
            horodatage,
            decision
        )
        VALUES (?, ?, ?, ?, 'en_attente')
        """,
        (
            identifiant,
            evenement.capteur,
            evenement.zone,
            evenement.horodatage,
        ),
    )

    connexion.commit()
    connexion.close()

    print(
        "[serveur] nouvel événement reçu : "
        f"{evenement.capteur} / "
        f"{evenement.zone} "
        f"(id={identifiant})"
    )

    return {
        "id":
            identifiant,
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
    Enregistre fausse_alerte ou vraie_alerte.
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
        SELECT id
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
            int(
                time.time()
            ),
            identifiant,
        ),
    )

    connexion.commit()
    connexion.close()

    print(
        "[serveur] décision reçue pour "
        f"{identifiant} : "
        f"{reponse.decision}"
    )

    return {
        "ok":
            True,
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
