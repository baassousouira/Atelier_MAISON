# robotV2_compatible_main.py
# ---------------------------------------------------------------------------
# RASPBERRY MOBILE - ATELIER MAISON
# ---------------------------------------------------------------------------
#
# Compatible avec le nouveau serveur central main.py :
#
# Raspberry mobile (192.168.1.2)
#        |
#        | Ethernet
#        v
#      SWITCH
#        |
#        v
# FastAPI central (192.168.1.1:8000)
#
# Ce programme :
#   - pilote les deux servomoteurs du robot ;
#   - expose une API locale sur 0.0.0.0:8001 ;
#   - reçoit les commandes du serveur central ;
#   - envoie un heartbeat au serveur central toutes les 5 secondes ;
#   - permet au serveur central d'armer/désarmer le système ;
#   - permet d'activer/désactiver les composants robot / servo.
#
# IMPORTANT :
#   Le fichier robotV2.py d'origine ne contient aucun code caméra.
#   Les routes caméra ne sont donc PAS inventées ici.
#   Il faudra intégrer le fichier caméra de l'équipe pour exposer :
#       GET  /camera/stream?name=camera
#       POST /camera/screenshot?name=camera
# ---------------------------------------------------------------------------

import threading
import time

import lgpio
import requests
import uvicorn

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


# ===========================================================================
# CONFIGURATION RÉSEAU
# ===========================================================================

SERVEUR_CENTRAL = "http://192.168.1.1:8000"

URL_HEARTBEAT = (
    f"{SERVEUR_CENTRAL}/api/controleurs/heartbeat"
)

PORT_API_LOCALE = 8001

INTERVALLE_HEARTBEAT_SECONDES = 5
TIMEOUT_HTTP_SECONDES = 2


# ===========================================================================
# GPIO DES SERVOMOTEURS
# ===========================================================================

SERVO_GAUCHE = 19
SERVO_DROIT = 23

# Points d'arrêt trouvés pendant la calibration de l'équipe.
STOP_GAUCHE = 1537
STOP_DROIT = 1545

VITESSE_MAX = 100


# ===========================================================================
# ÉTAT LOCAL DU RASPBERRY
# ===========================================================================

# Le serveur central possède également son propre état "armed".
# Ici on garde une copie locale afin que le Raspberry puisse refuser
# les déplacements si le système a été désarmé.
systeme_arme = True

composants_actifs = {
    "robot": True,
    "servo": True,
}

commande_actuelle = {
    "command": "STOP",
    "speed": 0,
}

# Verrou pour éviter deux écritures GPIO simultanées.
verrou_gpio = threading.Lock()

# Permet d'arrêter proprement le thread heartbeat.
arret_programme = threading.Event()


# ===========================================================================
# INITIALISATION GPIO
# ===========================================================================

gpio = lgpio.gpiochip_open(0)

lgpio.gpio_claim_output(
    gpio,
    SERVO_GAUCHE,
)

lgpio.gpio_claim_output(
    gpio,
    SERVO_DROIT,
)


# ===========================================================================
# FONCTIONS SERVOMOTEURS
# ===========================================================================

def servo(
    gpio_pin: int,
    pulse: int,
):
    """
    Envoie une impulsion PWM au servomoteur.

    Un servo reçoit une impulsion toutes les 20 ms = 50 Hz.
    """
    duty = (
        pulse
        / 20000
    ) * 100

    lgpio.tx_pwm(
        gpio,
        gpio_pin,
        50,
        duty,
    )


def stop():
    """
    Arrête immédiatement les deux servomoteurs.
    """
    with verrou_gpio:
        servo(
            SERVO_GAUCHE,
            STOP_GAUCHE,
        )

        servo(
            SERVO_DROIT,
            STOP_DROIT,
        )

    commande_actuelle["command"] = "STOP"
    commande_actuelle["speed"] = 0


def avant(
    vitesse: int,
):
    """
    Fait avancer le robot.
    """
    with verrou_gpio:
        servo(
            SERVO_GAUCHE,
            STOP_GAUCHE + vitesse,
        )

        servo(
            SERVO_DROIT,
            STOP_DROIT - vitesse,
        )


def arriere(
    vitesse: int,
):
    """
    Fait reculer le robot.
    """
    with verrou_gpio:
        servo(
            SERVO_GAUCHE,
            STOP_GAUCHE - vitesse,
        )

        servo(
            SERVO_DROIT,
            STOP_DROIT + vitesse,
        )


def gauche(
    vitesse: int,
):
    """
    Fait tourner le robot vers la gauche.
    """
    with verrou_gpio:
        servo(
            SERVO_GAUCHE,
            STOP_GAUCHE - vitesse,
        )

        servo(
            SERVO_DROIT,
            STOP_DROIT - vitesse,
        )


def droite(
    vitesse: int,
):
    """
    Fait tourner le robot vers la droite.
    """
    with verrou_gpio:
        servo(
            SERVO_GAUCHE,
            STOP_GAUCHE + vitesse,
        )

        servo(
            SERVO_DROIT,
            STOP_DROIT + vitesse,
        )


def appliquer_commande(
    command: str,
    speed: int,
):
    """
    Applique une commande reçue du serveur central.

    Le nouveau main.py utilise :
        FORWARD
        BACKWARD
        LEFT
        RIGHT
        STOP

    et non plus :
        AVANT
        ARRIERE
        GAUCHE
        DROITE
    """
    command = (
        command
        .strip()
        .upper()
    )

    speed = max(
        0,
        min(
            int(speed),
            VITESSE_MAX,
        ),
    )

    # Sécurité :
    # impossible de déplacer le robot si le système ou ses composants
    # sont désactivés.
    mouvement_autorise = (
        systeme_arme
        and composants_actifs["robot"]
        and composants_actifs["servo"]
    )

    if not mouvement_autorise:
        stop()
        return

    if command == "FORWARD":
        avant(
            speed
        )

    elif command == "BACKWARD":
        arriere(
            speed
        )

    elif command == "LEFT":
        gauche(
            speed
        )

    elif command == "RIGHT":
        droite(
            speed
        )

    else:
        stop()

        return

    commande_actuelle["command"] = command
    commande_actuelle["speed"] = speed


# ===========================================================================
# MODÈLES HTTP DE L'API LOCALE
# ===========================================================================

class EtatSysteme(BaseModel):
    armed: bool


class EtatActivation(BaseModel):
    enabled: bool


class CommandeRobot(BaseModel):
    command: str
    speed: int = 50


# ===========================================================================
# API LOCALE DU RASPBERRY MOBILE
# ===========================================================================

app = FastAPI(
    title="Raspberry mobile Atelier Maison"
)


@app.get("/health")
def health():
    """
    Permet au serveur central de vérifier que l'API locale répond.
    """
    return {
        "ok": True,
        "controllerType": "MOBILE",
        "armed": systeme_arme,
        "components": {
            "robot": composants_actifs["robot"],
            "servo": composants_actifs["servo"],
        },
        "robot": commande_actuelle.copy(),
    }


@app.put("/system")
def modifier_systeme(
    etat: EtatSysteme,
):
    """
    Route appelée par le serveur central lors d'un armement/désarmement.
    """
    global systeme_arme

    systeme_arme = etat.armed

    if not systeme_arme:
        stop()

    print(
        "[Raspberry mobile] système :",
        "ARMÉ"
        if systeme_arme
        else "DÉSARMÉ",
    )

    return {
        "armed": systeme_arme,
    }


@app.put(
    "/components/{name}/enabled"
)
def modifier_composant(
    name: str,
    etat: EtatActivation,
):
    """
    Active ou désactive un composant déclaré dans le heartbeat.
    """
    nom = (
        name
        .strip()
        .lower()
    )

    if nom not in composants_actifs:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Composant inconnu : {nom}"
            ),
        )

    composants_actifs[nom] = etat.enabled

    # Si le robot ou les servos sont coupés, arrêt immédiat.
    if (
        nom in {
            "robot",
            "servo",
        }
        and not etat.enabled
    ):
        stop()

    print(
        f"[Raspberry mobile] composant {nom} : "
        f"{'ACTIF' if etat.enabled else 'DÉSACTIVÉ'}"
    )

    return {
        "ok": True,
        "name": nom,
        "enabled": etat.enabled,
    }


@app.post("/robot/command")
def commander_robot(
    commande: CommandeRobot,
):
    """
    Reçoit directement une commande du serveur central.

    Flux :
        React
          -> FastAPI central
          -> switch
          -> Raspberry mobile :8001
          -> GPIO
    """
    commande_normalisee = (
        commande.command
        .strip()
        .upper()
    )

    commandes_autorisees = {
        "FORWARD",
        "BACKWARD",
        "LEFT",
        "RIGHT",
        "STOP",
    }

    if (
        commande_normalisee
        not in commandes_autorisees
    ):
        raise HTTPException(
            status_code=422,
            detail="Commande robot inconnue.",
        )

    if not (
        0
        <= commande.speed
        <= VITESSE_MAX
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "La vitesse doit être comprise entre 0 et 100."
            ),
        )

    appliquer_commande(
        commande_normalisee,
        commande.speed,
    )

    print(
        "[Raspberry mobile] commande :",
        commande_normalisee,
        "- vitesse :",
        commande.speed,
    )

    return {
        "ok": True,
        "command": commande_actuelle["command"],
        "speed": commande_actuelle["speed"],
    }


# ===========================================================================
# HEARTBEAT VERS LE SERVEUR CENTRAL
# ===========================================================================

def construire_heartbeat():
    """
    Construit exactement le JSON attendu par le nouveau main.py.
    """
    return {
        "has_servo": True,
        "components": [
            {
                "name": "robot",
                "enabled": composants_actifs["robot"],
                "value": commande_actuelle["command"],
            },
            {
                "name": "servo",
                "enabled": composants_actifs["servo"],
                "value": commande_actuelle["speed"],
            },
        ],
    }


def boucle_heartbeat():
    """
    Envoie un heartbeat environ toutes les 5 secondes.

    FastAPI central récupère lui-même l'adresse IP source du Raspberry.
    """
    dernier_etat = None

    while not arret_programme.is_set():
        try:
            reponse = requests.post(
                URL_HEARTBEAT,
                json=construire_heartbeat(),
                timeout=TIMEOUT_HTTP_SECONDES,
            )

            reponse.raise_for_status()

            if dernier_etat != "OK":
                print(
                    "[Raspberry mobile] serveur central connecté"
                )

            dernier_etat = "OK"

        except requests.RequestException as erreur:
            if dernier_etat != "ERREUR":
                print(
                    "[Raspberry mobile] heartbeat impossible :",
                    erreur,
                )

            dernier_etat = "ERREUR"

            # Sécurité conservée par rapport au fichier d'origine :
            # si le serveur central devient inaccessible, le robot s'arrête.
            stop()

        arret_programme.wait(
            INTERVALLE_HEARTBEAT_SECONDES
        )


# ===========================================================================
# DÉMARRAGE / ARRÊT
# ===========================================================================

@app.on_event("startup")
def demarrage():
    """
    Arrêt moteur au démarrage puis lancement du heartbeat en arrière-plan.
    """
    stop()

    thread = threading.Thread(
        target=boucle_heartbeat,
        daemon=True,
    )

    thread.start()

    print("")
    print("========================================")
    print(" Raspberry mobile - Atelier Maison")
    print("========================================")
    print(
        "Serveur central :",
        SERVEUR_CENTRAL,
    )
    print(
        "API locale      :",
        f"0.0.0.0:{PORT_API_LOCALE}",
    )
    print(
        "Heartbeat       :",
        f"{INTERVALLE_HEARTBEAT_SECONDES} s",
    )
    print("")


@app.on_event("shutdown")
def fermeture():
    """
    Arrête le robot et ferme proprement le GPIO.
    """
    arret_programme.set()

    stop()

    lgpio.gpiochip_close(
        gpio
    )

    print(
        "[Raspberry mobile] servomoteurs arrêtés"
    )


# ===========================================================================
# LANCEMENT
# ===========================================================================

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT_API_LOCALE,
    )
