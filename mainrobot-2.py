from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import keyboard
import threading
import time
import uvicorn

app = FastAPI()


# ---------------------------------------------------------
# Commande actuelle du robot
#
# Les valeurs de "command" utilisent maintenant les noms
# anglais attendus par ROUTES_LOCALES_A_IMPLEMENTER.md :
# FORWARD / BACKWARD / LEFT / RIGHT / STOP
# ---------------------------------------------------------

commande_robot = {
    "command": "STOP",
    "speed": 0
}

COMMANDES_VALIDES = [
    "FORWARD",
    "BACKWARD",
    "LEFT",
    "RIGHT",
    "STOP"
]


# ---------------------------------------------------------
# Format des commandes reçues en HTTP
# ---------------------------------------------------------

class CommandeRobot(BaseModel):
    command: str
    speed: int = 80


# ---------------------------------------------------------
# Fonction qui change la commande du robot
#
# IMPORTANT (rappel du fichier ROUTES_LOCALES_A_IMPLEMENTER.md) :
# "La route doit appeler le vrai code de pilotage/servo, pas
# seulement répondre ok."
#
# Pour l'instant, cette fonction se contente de mémoriser la
# commande et de l'afficher (comme avant) — c'est un point à
# compléter : il faut appeler ici le vrai code qui pilote les
# moteurs/servos (GPIO, PWM...) dès qu'il sera prêt.
# ---------------------------------------------------------

def changer_commande(command, speed=80):

    global commande_robot

    commande_robot["command"] = command
    commande_robot["speed"] = speed

    print("[robot] commande :", command, "- vitesse :", speed)

    # TODO : brancher ici le vrai pilotage physique, par exemple :
    # piloter_moteurs(command, speed)


# ---------------------------------------------------------
# API HTTP LOCALE (port 8001)
#
# Cette route est appelée par le SERVEUR CENTRAL (pas directement
# par le téléphone/l'app), d'après README_A_DONNER_AUX_CAMARADES.md :
# "Le navigateur React ne contacte jamais directement les Raspberry.
#  Le serveur central contacte les Raspberry quand il doit exécuter
#  une commande."
# ---------------------------------------------------------

@app.post("/robot/command")
def envoyer_commande(commande: CommandeRobot):

    if commande.command not in COMMANDES_VALIDES:
        raise HTTPException(
            status_code=400,
            detail=f"Commande inconnue, attendu l'une de : {COMMANDES_VALIDES}"
        )

    if not (0 <= commande.speed <= 100):
        raise HTTPException(
            status_code=400,
            detail="speed doit être compris entre 0 et 100"
        )

    changer_commande(
        commande.command,
        commande.speed
    )

    return {
        "ok": True
    }


# ---------------------------------------------------------
# Route bonus (non exigée par le contrat, mais pratique pour
# déboguer localement) : relit la dernière commande appliquée.
# ---------------------------------------------------------

@app.get("/robot/command")
def lire_commande():

    return {
        "command": commande_robot["command"],
        "speed": commande_robot["speed"]
    }


# ---------------------------------------------------------
# Contrôle avec les touches du clavier
#
# Reste utile pour tester le robot directement, sans passer par
# l'app/le serveur central. Attention : la bibliothèque "keyboard"
# a besoin d'un accès direct au clavier (droits root sur Linux, et
# un clavier réellement branché sur la machine qui exécute ce
# script) — ça ne fonctionnera pas via une simple connexion SSH
# sans clavier physique côté Raspberry.
# ---------------------------------------------------------

def controle_clavier():

    derniere_commande = "STOP"

    while True:

        # On regarde quelle touche est actuellement enfoncée

        if keyboard.is_pressed("down"):
            nouvelle_commande = "FORWARD"

        elif keyboard.is_pressed("up"):
            nouvelle_commande = "BACKWARD"

        elif keyboard.is_pressed("left"):
            nouvelle_commande = "LEFT"

        elif keyboard.is_pressed("right"):
            nouvelle_commande = "RIGHT"

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

    print("[robot] contrôle clavier activé")
    print("[robot] ↓ FORWARD   ↑ BACKWARD")
    print("[robot] ← LEFT      → RIGHT")
    print("[robot] aucune touche = STOP")


# ---------------------------------------------------------
# Lancement du serveur sur le PORT 8001, comme exigé par
# ROUTES_LOCALES_A_IMPLEMENTER.md ("chaque Raspberry doit
# écouter en HTTP sur le port 8001").
# ---------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
