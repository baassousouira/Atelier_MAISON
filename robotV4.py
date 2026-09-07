# robotV3_compatible_serveur_central.py
# -----------------------------------------------------------------------------
# Raspberry mobile - Atelier Maison
# Compatible avec le serveur central FastAPI actuel.
#
# Flux de commande attendu :
# React -> serveur central :8000 -> Raspberry mobile :8001 -> GPIO
# -----------------------------------------------------------------------------

import threading
import time

import lgpio
import requests
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


# =============================================================================
# CONFIGURATION RÉSEAU
# =============================================================================

SERVEUR_CENTRAL = "http://192.168.1.1:8000"
HEARTBEAT_URL = f"{SERVEUR_CENTRAL}/api/controleurs/heartbeat"
PORT_API_LOCALE = 8001
INTERVALLE_HEARTBEAT = 5
TIMEOUT_HTTP = 2


# =============================================================================
# GPIO
# =============================================================================

SERVO_GAUCHE = 19
SERVO_DROIT = 23

STOP_GAUCHE = 1537
STOP_DROIT = 1545

VITESSE_MAX = 100


gpio = lgpio.gpiochip_open(0)
lgpio.gpio_claim_output(gpio, SERVO_GAUCHE)
lgpio.gpio_claim_output(gpio, SERVO_DROIT)


# =============================================================================
# ÉTAT LOCAL
# =============================================================================

systemArmed = True
robotEnabled = True
servoEnabled = True

# IMPORTANT : robotV3.py déclarait une caméra, mais ne contenait aucune API
# de flux/capture. On ne la déclare donc pas ici pour éviter un faux état
# "caméra disponible" dans React. Quand le code caméra sera fusionné, il faudra
# ajouter "camera" au heartbeat + /camera/stream + /camera/screenshot.

commandeActuelle = {
    "command": "STOP",
    "speed": 0,
}

verrou_gpio = threading.Lock()
arret_programme = threading.Event()


# =============================================================================
# MOTEURS
# =============================================================================

def servo(gpio_pin, pulse):
    duty = (pulse / 20000) * 100
    lgpio.tx_pwm(gpio, gpio_pin, 50, duty)


def stop():
    with verrou_gpio:
        servo(SERVO_GAUCHE, STOP_GAUCHE)
        servo(SERVO_DROIT, STOP_DROIT)

    commandeActuelle["command"] = "STOP"
    commandeActuelle["speed"] = 0


def avant(vitesse):
    with verrou_gpio:
        servo(SERVO_GAUCHE, STOP_GAUCHE + vitesse)
        servo(SERVO_DROIT, STOP_DROIT - vitesse)


def arriere(vitesse):
    with verrou_gpio:
        servo(SERVO_GAUCHE, STOP_GAUCHE - vitesse)
        servo(SERVO_DROIT, STOP_DROIT + vitesse)


def gauche(vitesse):
    with verrou_gpio:
        servo(SERVO_GAUCHE, STOP_GAUCHE - vitesse)
        servo(SERVO_DROIT, STOP_DROIT - vitesse)


def droite(vitesse):
    with verrou_gpio:
        servo(SERVO_GAUCHE, STOP_GAUCHE + vitesse)
        servo(SERVO_DROIT, STOP_DROIT + vitesse)


def appliquer_commande(command, speed):
    command = command.strip().upper()
    speed = max(0, min(int(speed), VITESSE_MAX))

    if command == "STOP":
        stop()
        return

    if not systemArmed or not robotEnabled or not servoEnabled:
        stop()
        raise HTTPException(
            status_code=409,
            detail="Robot ou servomoteurs désactivés.",
        )

    if command == "FORWARD":
        avant(speed)
    elif command == "BACKWARD":
        arriere(speed)
    elif command == "LEFT":
        gauche(speed)
    elif command == "RIGHT":
        droite(speed)
    else:
        stop()
        raise HTTPException(status_code=422, detail="Commande inconnue.")

    commandeActuelle["command"] = command
    commandeActuelle["speed"] = speed


# =============================================================================
# API LOCALE DU RASPBERRY
# =============================================================================

app = FastAPI(title="Raspberry mobile Atelier Maison")


class CommandeRobot(BaseModel):
    command: str
    speed: int = 50


class EtatSysteme(BaseModel):
    armed: bool


class EtatActivation(BaseModel):
    enabled: bool


@app.get("/health")
def health():
    return {
        "ok": True,
        "controllerType": "MOBILE",
        "armed": systemArmed,
        "robotEnabled": robotEnabled,
        "servoEnabled": servoEnabled,
        "command": commandeActuelle,
    }


@app.post("/robot/command")
def recevoir_commande_robot(commande: CommandeRobot):
    commande_normalisee = commande.command.strip().upper()

    if commande_normalisee not in {
        "FORWARD",
        "BACKWARD",
        "LEFT",
        "RIGHT",
        "STOP",
    }:
        raise HTTPException(status_code=422, detail="Commande robot inconnue.")

    if not 0 <= commande.speed <= 100:
        raise HTTPException(
            status_code=422,
            detail="La vitesse doit être comprise entre 0 et 100.",
        )

    appliquer_commande(commande_normalisee, commande.speed)

    print(
        "[Robot] commande reçue :",
        commande_normalisee,
        "- vitesse :",
        commande.speed,
    )

    return {
        "ok": True,
        "command": commandeActuelle["command"],
        "speed": commandeActuelle["speed"],
    }


@app.put("/system")
def modifier_systeme(etat: EtatSysteme):
    global systemArmed

    systemArmed = etat.armed

    if not systemArmed:
        stop()

    return {
        "armed": systemArmed,
    }


@app.put("/components/{name}/enabled")
def modifier_composant(name: str, etat: EtatActivation):
    global robotEnabled
    global servoEnabled

    nom = name.strip().lower()

    if nom == "robot":
        robotEnabled = etat.enabled
    elif nom == "servo":
        servoEnabled = etat.enabled
    else:
        raise HTTPException(
            status_code=404,
            detail=f"Composant inconnu : {nom}",
        )

    if not robotEnabled or not servoEnabled:
        stop()

    return {
        "ok": True,
        "name": nom,
        "enabled": etat.enabled,
    }


# =============================================================================
# HEARTBEAT
# =============================================================================

def construire_heartbeat():
    return {
        "has_servo": True,
        "components": [
            {
                "name": "robot",
                "enabled": robotEnabled,
                "value": commandeActuelle["command"],
            },
            {
                "name": "servo",
                "enabled": servoEnabled,
                "value": commandeActuelle["speed"],
            },
        ],
    }


def boucle_heartbeat():
    dernier_etat = None

    while not arret_programme.is_set():
        try:
            reponse = requests.post(
                HEARTBEAT_URL,
                json=construire_heartbeat(),
                timeout=TIMEOUT_HTTP,
            )
            reponse.raise_for_status()

            if dernier_etat != "OK":
                print("[Heartbeat] serveur central connecté")

            dernier_etat = "OK"

        except requests.RequestException as erreur:
            if dernier_etat != "ERREUR":
                print("[Heartbeat] erreur :", erreur)

            dernier_etat = "ERREUR"
            stop()

        arret_programme.wait(INTERVALLE_HEARTBEAT)


@app.on_event("startup")
def demarrage():
    stop()

    thread = threading.Thread(
        target=boucle_heartbeat,
        daemon=True,
    )
    thread.start()

    print("===================================")
    print(" Robot Raspberry MOBILE")
    print("===================================")
    print("Serveur central :", SERVEUR_CENTRAL)
    print("API locale      : 0.0.0.0:8001")
    print("Heartbeat       :", HEARTBEAT_URL)


@app.on_event("shutdown")
def fermeture():
    arret_programme.set()
    stop()
    lgpio.gpiochip_close(gpio)
    print("[Robot] servomoteurs arrêtés")


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT_API_LOCALE,
    )
