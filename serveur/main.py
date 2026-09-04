# main.py
# -----------------------------------------------------------------------
# Serveur central du projet
#
# Ce serveur fait plusieurs choses :
#   1. Il reçoit les événements envoyés par les Raspberry.
#   2. Il stocke les événements dans une base SQLite.
#   3. Il sert la page web de surveillance.
#   4. Il renvoie aux Raspberry la décision prise sur la page web.
#   5. Il reçoit les commandes du servo envoyées par le PC.
#   6. Il permet à la Raspberry de récupérer la dernière commande du servo.
#   7. Il conserve l'historique des changements d'angle du servo.
#   8. Il reçoit et sert les captures caméra associées à chaque événement.
#
# Adresse du PC :
#   192.168.1.7
#
# Port du serveur :
#   8000
# -----------------------------------------------------------------------


import sqlite3
import time
import uuid

from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from pydantic import BaseModel


# =========================================================================
# CONFIGURATION
# =========================================================================

# Chemin de la base de données SQLite
CHEMIN_BASE = Path(__file__).parent / "evenements.db"

# Dossier contenant la page web
DOSSIER_STATIC = Path(__file__).parent / "static"


# =========================================================================
# BASE DE DONNÉES
# =========================================================================

def get_connexion():
    """
    Ouvre une connexion à la base SQLite.
    """

    connexion = sqlite3.connect(CHEMIN_BASE)

    # Permet d'utiliser le nom des colonnes
    connexion.row_factory = sqlite3.Row

    return connexion


def initialiser_base():
    """
    Crée les tables de la base SQLite si elles n'existent pas.
    """

    connexion = get_connexion()

    # ---------------------------------------------------------------------
    # Table des événements de surveillance
    # ---------------------------------------------------------------------

    connexion.execute("""
        CREATE TABLE IF NOT EXISTS evenements (
            id TEXT PRIMARY KEY,
            capteur TEXT NOT NULL,
            zone TEXT NOT NULL,
            horodatage INTEGER NOT NULL,
            decision TEXT NOT NULL DEFAULT 'en_attente',
            horodatage_decision INTEGER,
            image BLOB
        )
    """)

    # ---------------------------------------------------------------------
    # Migration : si la base existait déjà AVANT l'ajout de la colonne
    # "image" (donc créée par une version plus ancienne de ce fichier),
    # CREATE TABLE IF NOT EXISTS ne fait rien puisque la table existe déjà.
    # On ajoute la colonne manuellement dans ce cas, sans perdre les
    # événements déjà enregistrés.
    # ---------------------------------------------------------------------

    colonnes_existantes = [
        ligne["name"]
        for ligne in connexion.execute("PRAGMA table_info(evenements)").fetchall()
    ]

    if "image" not in colonnes_existantes:
        connexion.execute("ALTER TABLE evenements ADD COLUMN image BLOB")

    # ---------------------------------------------------------------------
    # Table de l'historique du servo
    #
    # Chaque ligne correspond à un changement d'angle.
    # ---------------------------------------------------------------------

    connexion.execute("""
        CREATE TABLE IF NOT EXISTS historique_servo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            angle INTEGER NOT NULL,
            horodatage INTEGER NOT NULL
        )
    """)

    connexion.commit()
    connexion.close()


# =========================================================================
# FORMAT DES DONNÉES
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
    Décision prise depuis la page web.
    """

    decision: str


# =========================================================================
# FORMAT D'UNE COMMANDE SERVO
# =========================================================================

class CommandeServo(BaseModel):
    """
    Données reçues lorsque le PC veut commander le servo.

    Exemple :

    {
        "angle": 90
    }
    """

    angle: int


# =========================================================================
# CRÉATION DU SERVEUR
# =========================================================================

app = FastAPI(
    title="Serveur de surveillance à domicile"
)


# =========================================================================
# COMMANDE DU SERVO
# =========================================================================

# Cette variable contient le dernier angle demandé.
#
# Au démarrage, on considère que le servo doit être à 90 degrés.
angle_servo = 90


# =========================================================================
# ROUTE SERVO 1 : LE PC ENVOIE UN ANGLE
# =========================================================================

@app.post("/api/servo")
def commander_servo(commande: CommandeServo):

    global angle_servo

    # ---------------------------------------------------------------------
    # Vérification de l'angle
    # ---------------------------------------------------------------------

    if commande.angle < 0 or commande.angle > 180:

        raise HTTPException(
            status_code=400,
            detail="L'angle doit être compris entre 0 et 180"
        )

    # ---------------------------------------------------------------------
    # On vérifie si l'angle a réellement changé.
    #
    # Par exemple :
    #
    # Servo actuel = 45°
    # Nouvelle commande = 45°
    #
    # Dans ce cas, on ne crée pas une nouvelle ligne dans l'historique.
    # ---------------------------------------------------------------------

    ancien_angle = angle_servo

    # On sauvegarde le nouvel angle.
    angle_servo = commande.angle

    # ---------------------------------------------------------------------
    # Si l'angle est différent, on l'ajoute dans l'historique.
    # ---------------------------------------------------------------------

    if angle_servo != ancien_angle:

        # Heure actuelle sous forme de timestamp Unix
        horodatage = int(time.time())

        # Ouverture de la base de données
        connexion = get_connexion()

        # Ajout du changement dans la table historique_servo
        connexion.execute(
            """
            INSERT INTO historique_servo
            (angle, horodatage)
            VALUES (?, ?)
            """,
            (
                angle_servo,
                horodatage
            )
        )

        connexion.commit()
        connexion.close()

        print(
            f"[serveur] nouvelle commande servo : "
            f"{angle_servo} degrés"
        )

    else:

        print(
            f"[serveur] commande servo : "
            f"{angle_servo} degrés "
            f"(aucun changement)"
        )

    # Réponse envoyée au programme du PC
    return {
        "ok": True,
        "angle": angle_servo
    }


# =========================================================================
# ROUTE SERVO 2 : LA RASPBERRY DEMANDE L'ANGLE
# =========================================================================

@app.get("/api/servo")
def lire_commande_servo():

    # La Raspberry vient chercher la dernière commande.
    return {
        "angle": angle_servo
    }


# =========================================================================
# ROUTE SERVO 3 : RÉCUPÉRER L'HISTORIQUE DU SERVO
# =========================================================================

@app.get("/api/servo/historique")
def historique_servo():

    # On ouvre la base de données.
    connexion = get_connexion()

    # On récupère tous les changements d'angle.
    #
    # DESC signifie que le plus récent est affiché en premier.
    lignes = connexion.execute(
        """
        SELECT *
        FROM historique_servo
        ORDER BY horodatage DESC
        """
    ).fetchall()

    connexion.close()

    # On transforme les résultats SQLite
    # en dictionnaires utilisables par JavaScript.
    return [
        dict(ligne)
        for ligne in lignes
    ]


# =========================================================================
# INITIALISATION DE LA BASE
# =========================================================================

# On crée les tables si elles n'existent pas encore.
initialiser_base()


# =========================================================================
# DOSSIER STATIC
# =========================================================================

# Permet au serveur de fournir les fichiers présents
# dans le dossier "static".
app.mount(
    "/static",
    StaticFiles(directory=DOSSIER_STATIC),
    name="static"
)


# =========================================================================
# PAGE D'ACCUEIL
# =========================================================================

@app.get("/")
def page_accueil():

    # Renvoie la page index.html.
    return FileResponse(
        DOSSIER_STATIC / "index.html"
    )


# =========================================================================
# ROUTE 1 : RÉCEPTION D'UN ÉVÉNEMENT
# =========================================================================

@app.post("/api/evenements")
def creer_evenement(evenement: NouvelEvenement):

    # Création d'un identifiant unique.
    identifiant = str(uuid.uuid4())

    connexion = get_connexion()

    connexion.execute(
        """
        INSERT INTO evenements
        (id, capteur, zone, horodatage, decision)
        VALUES (?, ?, ?, ?, 'en_attente')
        """,
        (
            identifiant,
            evenement.capteur,
            evenement.zone,
            evenement.horodatage
        )
    )

    connexion.commit()
    connexion.close()

    print(
        f"[serveur] nouvel événement reçu : "
        f"{evenement.capteur} / {evenement.zone} "
        f"(id={identifiant})"
    )

    # On renvoie l'identifiant au Raspberry.
    return {
        "id": identifiant
    }


# =========================================================================
# ROUTE 2 : RÉCUPÉRER LA DÉCISION D'UN ÉVÉNEMENT
# =========================================================================

@app.get("/api/evenements/{identifiant}/decision")
def lire_decision(identifiant: str):

    connexion = get_connexion()

    ligne = connexion.execute(
        "SELECT decision FROM evenements WHERE id = ?",
        (identifiant,)
    ).fetchone()

    connexion.close()

    # Si l'événement n'existe pas.
    if ligne is None:

        raise HTTPException(
            status_code=404,
            detail="événement introuvable"
        )

    return {
        "decision": ligne["decision"]
    }


# =========================================================================
# ROUTE 3 : ENVOYER UNE DÉCISION
# =========================================================================

@app.post("/api/evenements/{identifiant}/decision")
def repondre_evenement(
    identifiant: str,
    reponse: Decision
):

    # Vérification de la décision.
    if reponse.decision not in (
        "fausse_alerte",
        "vraie_alerte"
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "decision doit être "
                "'fausse_alerte' ou 'vraie_alerte'"
            )
        )

    connexion = get_connexion()

    # On vérifie que l'événement existe.
    ligne = connexion.execute(
        "SELECT id FROM evenements WHERE id = ?",
        (identifiant,)
    ).fetchone()

    if ligne is None:

        connexion.close()

        raise HTTPException(
            status_code=404,
            detail="événement introuvable"
        )

    # Mise à jour de la décision.
    connexion.execute(
        """
        UPDATE evenements
        SET decision = ?,
            horodatage_decision = ?
        WHERE id = ?
        """,
        (
            reponse.decision,
            int(time.time()),
            identifiant
        )
    )

    connexion.commit()
    connexion.close()

    print(
        f"[serveur] décision reçue pour "
        f"{identifiant} : {reponse.decision}"
    )

    return {
        "ok": True
    }


# =========================================================================
# ROUTE 3bis : RECEVOIR LA CAPTURE CAMÉRA D'UN ÉVÉNEMENT
# =========================================================================

@app.post("/api/evenements/{identifiant}/image")
async def recevoir_capture(
    identifiant: str,
    fichier: UploadFile = File(...)
):
    """
    Appelée par le Raspberry (send_snapshot côté C++) juste après avoir
    signalé un événement, avec l'image caméra du moment.
    L'image est stockée directement dans la base SQLite (colonne "image",
    de type BLOB = "Binary Large OBject", le type SQL pour des données
    binaires comme une image).
    """

    contenu = await fichier.read()  # lit tout le contenu binaire du fichier envoyé

    connexion = get_connexion()

    resultat = connexion.execute(
        "UPDATE evenements SET image = ? WHERE id = ?",
        (contenu, identifiant)
    )

    connexion.commit()
    lignes_modifiees = resultat.rowcount
    connexion.close()

    if lignes_modifiees == 0:
        raise HTTPException(status_code=404, detail="événement introuvable")

    return {
        "ok": True
    }


# =========================================================================
# ROUTE 3ter : RÉCUPÉRER LA CAPTURE CAMÉRA D'UN ÉVÉNEMENT
# =========================================================================

@app.get("/api/evenements/{identifiant}/image")
def lire_capture(identifiant: str):
    """
    Appelée par la page web (balise <img>) pour afficher la photo
    associée à une alerte, lue directement depuis la colonne "image"
    de la base. 404 si l'événement n'existe pas ou n'a pas de photo.
    """

    connexion = get_connexion()

    ligne = connexion.execute(
        "SELECT image FROM evenements WHERE id = ?",
        (identifiant,)
    ).fetchone()

    connexion.close()

    if ligne is None or ligne["image"] is None:
        raise HTTPException(
            status_code=404,
            detail="pas de capture pour cet événement"
        )

    return Response(content=ligne["image"], media_type="image/jpeg")


# =========================================================================
# ROUTE 4 : LISTER LES ÉVÉNEMENTS
# =========================================================================

@app.get("/api/evenements")
def lister_evenements(
    decision: str | None = None
):

    connexion = get_connexion()

    # On sélectionne les colonnes explicitement, SANS "image" : une
    # réponse JSON ne peut pas contenir de données binaires, et ce
    # serait de toute façon inutilement lourd de renvoyer la photo à
    # chaque fois qu'on liste l'historique. L'image reste accessible
    # via sa route dédiée (/api/evenements/{id}/image).

    if decision is not None:

        lignes = connexion.execute(
            """
            SELECT id, capteur, zone, horodatage, decision, horodatage_decision
            FROM evenements
            WHERE decision = ?
            ORDER BY horodatage DESC
            """,
            (decision,)
        ).fetchall()

    else:

        # Sinon on récupère tout l'historique.
        lignes = connexion.execute(
            """
            SELECT id, capteur, zone, horodatage, decision, horodatage_decision
            FROM evenements
            ORDER BY horodatage DESC
            """
        ).fetchall()

    connexion.close()

    # Conversion des résultats SQL en dictionnaires.
    return [
        dict(ligne)
        for ligne in lignes
    ]


# =========================================================================
# ROUTE 5 : SUPPRIMER UN ÉVÉNEMENT
# =========================================================================

@app.delete("/api/evenements/{identifiant}")
def supprimer_evenement(identifiant: str):

    connexion = get_connexion()

    connexion.execute(
        "DELETE FROM evenements WHERE id = ?",
        (identifiant,)
    )

    connexion.commit()
    connexion.close()

    return {
        "ok": True
    }


# =========================================================================
# ROUTE 6 : VIDER L'HISTORIQUE DES ÉVÉNEMENTS
# =========================================================================

@app.delete("/api/evenements")
def vider_historique():

    connexion = get_connexion()

    connexion.execute(
        "DELETE FROM evenements"
    )

    connexion.commit()
    connexion.close()

    return {
        "ok": True
    }


# =========================================================================
# LANCEMENT DU SERVEUR
# =========================================================================

if __name__ == "__main__":

    import uvicorn

    # 0.0.0.0 permet aux autres appareils du réseau
    # de communiquer avec le serveur.
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )
