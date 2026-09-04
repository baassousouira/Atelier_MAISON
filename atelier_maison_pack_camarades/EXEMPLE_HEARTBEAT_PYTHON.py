"""
Exemple minimal d'envoi du heartbeat depuis un Raspberry en Python.

Ce fichier est un EXEMPLE D'INTÉGRATION :
les fonctions qui lisent l'état réel du matériel doivent être reliées
au code existant de votre Raspberry.
"""

import json
import time
from urllib import request as urllib_request


# -----------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------

# À vérifier sur le réseau utilisé le jour du test.
SERVER_BASE_URL = "http://192.168.1.1:8000"

# Intervalle demandé par le serveur central.
HEARTBEAT_INTERVAL_SECONDS = 5


# -----------------------------------------------------------------------
# À ADAPTER SUR CHAQUE RASPBERRY
# -----------------------------------------------------------------------

# Raspberry mobile : True
# Raspberry fixe  : False
HAS_SERVO = True


# -----------------------------------------------------------------------
# FONCTION D'ENVOI
# -----------------------------------------------------------------------

def send_heartbeat(components):
    """Envoie l'état réel du Raspberry au serveur central."""

    payload = {
        "has_servo": HAS_SERVO,
        "components": components,
    }

    data = json.dumps(payload).encode("utf-8")

    req = urllib_request.Request(
        url=f"{SERVER_BASE_URL}/api/controleurs/heartbeat",
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )

    with urllib_request.urlopen(req, timeout=3) as response:
        response.read()


# -----------------------------------------------------------------------
# BOUCLE
# -----------------------------------------------------------------------

while True:
    # IMPORTANT : cette liste doit être construite à partir des VRAIS états
    # de votre programme, pas laissée avec des valeurs fixes de démonstration.
    #
    # Exemple mobile :
    # components = [
    #     {"name": "camera", "enabled": CAMERA_ENABLED},
    #     {"name": "servo", "enabled": SERVO_ENABLED},
    # ]
    #
    # Exemple fixe :
    # components = [
    #     {"name": "camera", "enabled": CAMERA_ENABLED},
    #     {
    #         "name": "photoresistance",
    #         "enabled": PHOTORESISTANCE_ENABLED,
    #         "value": vraie_valeur_photoresistance,
    #     },
    #     {"name": "button", "enabled": BUTTON_ENABLED},
    #     {"name": "led", "enabled": LED_ENABLED},
    # ]

    components = []  # À REMPLACER par les vrais états de votre code.

    try:
        send_heartbeat(components)
    except Exception as exc:
        # Une perte du serveur ne doit pas arrêter définitivement
        # le programme du Raspberry.
        print(f"Heartbeat impossible : {exc}")

    time.sleep(HEARTBEAT_INTERVAL_SECONDS)
