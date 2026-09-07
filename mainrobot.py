from fastapi import FastAPI
from pydantic import BaseModel
import keyboard
import threading
import time

app = FastAPI()


# ---------------------------------------------------------
# Commande actuelle du robot
# ---------------------------------------------------------

commande_robot = {
    "command": "STOP",
    "speed": 0
}


# ---------------------------------------------------------
# Format des commandes reçues en HTTP
# ---------------------------------------------------------

class CommandeRobot(BaseModel):
    command: str
    speed: int = 80


# ---------------------------------------------------------
# Fonction qui change la commande du robot
# ---------------------------------------------------------

def changer_commande(command, speed=80):

    global commande_robot

    commande_robot["command"] = command
    commande_robot["speed"] = speed

    print("[serveur] commande robot :", command,
          "- vitesse :", speed)


# ---------------------------------------------------------
# API HTTP
#
# Le téléphone pourra utiliser cette même API plus tard.
# ---------------------------------------------------------

@app.post("/api/robot/command")
def envoyer_commande(commande: CommandeRobot):

    commandes_valides = [
        "AVANT",
        "ARRIERE",
        "GAUCHE",
        "DROITE",
        "STOP"
    ]

    if commande.command not in commandes_valides:
        return {
            "ok": False,
            "message": "Commande inconnue"
        }

    changer_commande(
        commande.command,
        commande.speed
    )

    return {
        "ok": True,
        "command": commande.command,
        "speed": commande.speed
    }


# ---------------------------------------------------------
# La Raspberry utilise cette route pour récupérer
# la dernière commande.
# ---------------------------------------------------------

@app.get("/api/robot/command")
def lire_commande():

    return {
        "command": commande_robot["command"],
        "speed": commande_robot["speed"]
    }


# ---------------------------------------------------------
# Contrôle avec les touches du clavier
# ---------------------------------------------------------

def controle_clavier():

    derniere_commande = "STOP"

    while True:

        # On regarde quelle touche est actuellement enfoncée

        if keyboard.is_pressed("down"):
            nouvelle_commande = "AVANT"

        elif keyboard.is_pressed("up"):
            nouvelle_commande = "ARRIERE"

        elif keyboard.is_pressed("left"):
            nouvelle_commande = "GAUCHE"

        elif keyboard.is_pressed("right"):
            nouvelle_commande = "DROITE"

        else:
            nouvelle_commande = "STOP"


        # On affiche seulement lorsque la commande change.
        # Cela évite d'avoir des centaines de lignes dans le terminal.

        if nouvelle_commande != derniere_commande:

            if nouvelle_commande == "STOP":
                changer_commande("STOP", 0)
            else:
                changer_commande(nouvelle_commande, 80)

            derniere_commande = nouvelle_commande


        # Petite pause pour ne pas utiliser 100% du processeur

        time.sleep(0.03)


# ---------------------------------------------------------
# Lancement du contrôle clavier dans un thread
# ---------------------------------------------------------

@app.on_event("startup")
def demarrer_clavier():

    thread = threading.Thread(
        target=controle_clavier,
        daemon=True
    )

    thread.start()

    print("[serveur] contrôle clavier activé")
    print("[serveur] ↑ AVANT")
    print("[serveur] ↓ ARRIERE")
    print("[serveur] ← GAUCHE")
    print("[serveur] → DROITE")
    print("[serveur] aucune touche = STOP")
