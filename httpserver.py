"""
Serveur HTTP FastAPI
--------------------
Le serveur reçoit les commandes envoyées par la Raspberry.

Routes utilisées :

POST /api/servo
    Reçoit un angle de servo.

POST /api/evenements
    Reçoit un événement de détection.

GET /api/evenements/{id}/decision
    Permet de récupérer la décision concernant un événement.
"""

from fastapi import FastAPI
import uuid
import time


# Création du serveur FastAPI
app = FastAPI()


# Dictionnaire qui contient les événements reçus
evenements = {}


# ---------------------------------------------------------
# SERVO
# ---------------------------------------------------------

@app.post("/api/servo")
def recevoir_angle(data: dict):

    # Récupération de l'angle envoyé par la Raspberry
    angle = data["angle"]

    # Affichage dans le terminal du serveur
    print(f"Angle reçu : {angle}")

    # Réponse envoyée à la Raspberry
    return {
        "message": "Angle reçu",
        "angle": angle
    }


# ---------------------------------------------------------
# EVENEMENTS
# ---------------------------------------------------------

@app.post("/api/evenements")
def recevoir_evenement(data: dict):

    # Création d'un identifiant unique pour l'événement
    event_id = str(uuid.uuid4())

    # Récupération des informations envoyées
    capteur = data.get("capteur")
    zone = data.get("zone")
    horodatage = data.get("horodatage", int(time.time()))

    # Affichage de l'événement dans le terminal
    print("Nouvel événement reçu :")
    print(f"  Capteur : {capteur}")
    print(f"  Zone : {zone}")
    print(f"  Horodatage : {horodatage}")
    print(f"  ID : {event_id}")

    # On sauvegarde l'événement
    evenements[event_id] = {
        "capteur": capteur,
        "zone": zone,
        "horodatage": horodatage,
        "decision": "en_attente"
    }

    # On renvoie l'identifiant à la Raspberry
    return {
        "id": event_id
    }


# ---------------------------------------------------------
# DECISION
# ---------------------------------------------------------

@app.get("/api/evenements/{event_id}/decision")
def recuperer_decision(event_id: str):

    # Vérification que l'événement existe
    if event_id not in evenements:
        return {
            "decision": "erreur"
        }

    # Récupération de la décision
    decision = evenements[event_id]["decision"]

    print(f"Demande de décision pour {event_id} : {decision}")

    return {
        "decision": decision
    }