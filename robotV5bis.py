import requests
import lgpio
import time
import threading


# =========================================================
# ADRESSES DU SERVEUR
# =========================================================

# Serveur PC qui donne les commandes au robot
URL = "http://192.168.1.1:8000/api/robot/command"

# Route du heartbeat
# IMPORTANT :
# si ton serveur utilise une autre route, change uniquement cette ligne.
HEARTBEAT_URL = "http://192.168.1.1:8000/api/controleurs/heartbeat"

# Petit serveur C++ de la caméra mobile.
# Il sert le flux /camera/stream et les captures /camera/screenshot.
CAMERA_LOCAL_HEALTH_URL = "http://127.0.0.1:8001/health"


# =========================================================
# GPIO DES SERVOMOTEURS
# =========================================================

SERVO_GAUCHE = 19
SERVO_DROIT = 23


# =========================================================
# POINTS D'ARRET DES SERVOMOTEURS
# =========================================================

STOP_GAUCHE = 1537
STOP_DROIT = 1545


# =========================================================
# VITESSE MAXIMALE
# =========================================================

VITESSE_MAX = 100


# =========================================================
# ETAT DU ROBOT
# =========================================================

# Le robot est activé au démarrage
robotEnabled = True

# Le servo suit l'état logiciel du robot.
# L'état caméra est lu depuis le serveur C++ local sur :8001.
servoEnabled = True


# =========================================================
# OUVERTURE DU CONTROLEUR GPIO
# =========================================================

gpio = lgpio.gpiochip_open(0)

lgpio.gpio_claim_output(gpio, SERVO_GAUCHE)
lgpio.gpio_claim_output(gpio, SERVO_DROIT)


# =========================================================
# FONCTION SERVO
# =========================================================

def servo(gpio_pin, pulse):

    # Conversion :
    # microsecondes -> pourcentage du signal PWM

    duty = (pulse / 20000) * 100

    lgpio.tx_pwm(
        gpio,
        gpio_pin,
        50,
        duty
    )


# =========================================================
# ARRET DES SERVOMOTEURS
# =========================================================

def stop():

    servo(
        SERVO_GAUCHE,
        STOP_GAUCHE
    )

    servo(
        SERVO_DROIT,
        STOP_DROIT
    )


def couper_signal_servos():
    """
    Coupe le signal PWM envoyé aux deux servomoteurs.

    Cela éteint réellement la commande moteur côté GPIO. En revanche,
    si les servos sont alimentés directement en 5 V, leur alimentation
    électrique reste présente : pour couper aussi le 5 V il faut un
    relais ou un MOSFET commandé par le Raspberry.
    """
    try:
        lgpio.tx_pwm(
            gpio,
            SERVO_GAUCHE,
            0,
            0
        )

        lgpio.tx_pwm(
            gpio,
            SERVO_DROIT,
            0,
            0
        )

    except Exception as erreur:
        print(
            "[Robot] impossible de couper le PWM :",
            erreur
        )


# =========================================================
# AVANCER
# =========================================================

def avant(vitesse):

    servo(
        SERVO_GAUCHE,
        STOP_GAUCHE + vitesse
    )

    servo(
        SERVO_DROIT,
        STOP_DROIT - vitesse
    )


# =========================================================
# RECULER
# =========================================================

def arriere(vitesse):

    servo(
        SERVO_GAUCHE,
        STOP_GAUCHE - vitesse
    )

    servo(
        SERVO_DROIT,
        STOP_DROIT + vitesse
    )


# =========================================================
# TOURNER A GAUCHE
# =========================================================

def gauche(vitesse):

    servo(
        SERVO_GAUCHE,
        STOP_GAUCHE - vitesse
    )

    servo(
        SERVO_DROIT,
        STOP_DROIT - vitesse
    )


# =========================================================
# TOURNER A DROITE
# =========================================================

def droite(vitesse):

    servo(
        SERVO_GAUCHE,
        STOP_GAUCHE + vitesse
    )

    servo(
        SERVO_DROIT,
        STOP_DROIT + vitesse
    )


# =========================================================
# CONSTRUIRE LE HEARTBEAT
# =========================================================

def lire_etat_camera_locale():
    """
    Lit l'état réel du petit serveur C++ de la caméra mobile.

    Si le serveur caméra n'est pas lancé, on ne prétend pas que la caméra
    est active : le heartbeat l'indique comme indisponible.
    """
    try:
        reponse = requests.get(
            CAMERA_LOCAL_HEALTH_URL,
            timeout=0.4
        )

        reponse.raise_for_status()
        donnees = reponse.json()

        return (
            bool(donnees.get("cameraEnabled", False)),
            "READY" if donnees.get("hasFrame", False) else "NO_FRAME"
        )

    except Exception:
        return False, "SERVER_OFFLINE"


def buildHeartbeatPayload():

    """
    Construit le message que le Raspberry envoie
    au serveur toutes les 5 secondes.

    has_servo = true permet au serveur de reconnaitre
    ce Raspberry comme contrôleur MOBILE.
    """
    camera_enabled, camera_value = lire_etat_camera_locale()

    payload = {
        "has_servo": True,

        "components": [

            {
                "name": "camera",
                "enabled": camera_enabled,
                "value": camera_value
            },

            {
                "name": "robot",
                "enabled": robotEnabled,
                "value": "ON" if robotEnabled else "OFF"
            },

            {
                "name": "servo",
                "enabled": servoEnabled,
                "value": "PWM_ACTIVE" if servoEnabled else "PWM_DISABLED"
            }

        ]
    }

    return payload


# =========================================================
# ENVOYER LE HEARTBEAT
# =========================================================

def sendHeartbeat():

    """
    Envoie le heartbeat au serveur.

    Une erreur réseau ne fait PAS planter le programme.
    """

    try:

        payload = buildHeartbeatPayload()

        reponse = requests.post(
            HEARTBEAT_URL,
            json=payload,
            timeout=1
        )

        print(
            "[Heartbeat] envoyé - HTTP",
            reponse.status_code
        )

    except Exception as erreur:

        # Le robot continue de fonctionner même
        # si le serveur de heartbeat est indisponible.

        print(
            "[Heartbeat] serveur inaccessible :",
            erreur
        )


# =========================================================
# BOUCLE HEARTBEAT
# =========================================================

def heartbeatLoop():

    """
    Envoie un heartbeat toutes les 5 secondes.

    Cette fonction tourne dans un thread séparé afin de
    ne pas bloquer la commande des moteurs.
    """

    while True:

        sendHeartbeat()

        # Attente de 5 secondes
        time.sleep(5)


# =========================================================
# ACTIVER / DESACTIVER LE SYSTEME
# =========================================================

def setSystemArmed(enabled):

    global robotEnabled
    global servoEnabled

    robotEnabled = enabled
    servoEnabled = enabled

    if not robotEnabled:
        couper_signal_servos()
        print("[Robot] désactivé -> PWM coupé")

    else:
        stop()
        print("[Robot] activé")


# =========================================================
# ACTIVER / DESACTIVER UN COMPOSANT
# =========================================================

def setComponentEnabled(name, enabled):

    global robotEnabled
    global servoEnabled

    if name == "robot":
        setSystemArmed(enabled)

    elif name == "servo":
        servoEnabled = enabled

        if not servoEnabled:
            couper_signal_servos()
        elif robotEnabled:
            stop()

        print(
            "[Servo] enabled =",
            servoEnabled
        )


# =========================================================
# APPLIQUER UNE COMMANDE
# =========================================================

def appliquer_commande(command, speed):

    """
    Applique une commande au robot.

    Les commandes du cahier des charges sont :

    FORWARD
    BACKWARD
    LEFT
    RIGHT
    STOP
    """

    # -----------------------------------------------------
    # Limitation de la vitesse
    # -----------------------------------------------------

    if speed > VITESSE_MAX:

        speed = VITESSE_MAX

    if speed < 0:

        speed = 0


    # -----------------------------------------------------
    # Robot éteint : aucun PWM ne doit repartir, même sur STOP.
    # -----------------------------------------------------

    if not robotEnabled or not servoEnabled:

        couper_signal_servos()

        return


    # -----------------------------------------------------
    # STOP : arrêt neutre, robot toujours allumé.
    # -----------------------------------------------------

    if command == "STOP":

        stop()

        return


    # -----------------------------------------------------
    # COMMANDES DEPLACEMENT
    # -----------------------------------------------------

    if command == "FORWARD":

        avant(speed)


    elif command == "BACKWARD":

        arriere(speed)


    elif command == "LEFT":

        gauche(speed)


    elif command == "RIGHT":

        droite(speed)


    # -----------------------------------------------------
    # Compatibilité avec les anciennes commandes
    # françaises utilisées dans ton programme.
    # -----------------------------------------------------

    elif command == "AVANT":

        avant(speed)


    elif command == "ARRIERE":

        arriere(speed)


    elif command == "GAUCHE":

        gauche(speed)


    elif command == "DROITE":

        droite(speed)


    # -----------------------------------------------------
    # Commande inconnue
    # -----------------------------------------------------

    else:

        print(
            "[Robot] commande inconnue :",
            command
        )

        stop()


# =========================================================
# PROGRAMME PRINCIPAL
# =========================================================

print("===================================")
print(" Robot Raspberry MOBILE")
print("===================================")

print("Serveur commandes :", URL)
print("Serveur heartbeat :", HEARTBEAT_URL)

print("GPIO servo gauche :", SERVO_GAUCHE)
print("GPIO servo droit  :", SERVO_DROIT)

print("")


# =========================================================
# ARRET DE SECURITE AU DEMARRAGE
# =========================================================

stop()


# =========================================================
# DEMARRAGE DU HEARTBEAT
# =========================================================

heartbeat_thread = threading.Thread(
    target=heartbeatLoop,
    daemon=True
)

heartbeat_thread.start()

print("[Heartbeat] démarré - intervalle : 5 secondes")


# =========================================================
# DERNIERE COMMANDE
# =========================================================

derniere_commande = ""


# =========================================================
# BOUCLE PRINCIPALE DU ROBOT
# =========================================================

try:

    while True:

        try:

            # -------------------------------------------------
            # Demande HTTP au serveur
            # -------------------------------------------------

            reponse = requests.get(
                URL,
                timeout=0.3
            )


            # -------------------------------------------------
            # Transformation en JSON
            # -------------------------------------------------

            donnees = reponse.json()


            commande = donnees["command"]
            vitesse = donnees["speed"]
            enabled = bool(donnees.get("enabled", True))


            # -------------------------------------------------
            # Synchronisation marche / arrêt depuis Safeplace
            # -------------------------------------------------

            if enabled != robotEnabled:

                setSystemArmed(
                    enabled
                )


            # -------------------------------------------------
            # Affichage uniquement si la commande change
            # -------------------------------------------------

            if commande != derniere_commande:

                print(
                    "[Raspberry] commande reçue :",
                    commande,
                    "- vitesse :",
                    vitesse
                )

                derniere_commande = commande


            # -------------------------------------------------
            # Application de la commande
            # -------------------------------------------------

            appliquer_commande(
                commande,
                vitesse
            )


        except Exception as erreur:

            # -------------------------------------------------
            # Si le serveur de commande n'est plus accessible
            # -------------------------------------------------
            #
            # SECURITE :
            # on arrête immédiatement les moteurs.
            # -------------------------------------------------

            print(
                "[Raspberry] erreur serveur :",
                erreur
            )

            couper_signal_servos()

            derniere_commande = "STOP"


        # -----------------------------------------------------
        # Environ 20 contrôles par seconde
        # -----------------------------------------------------

        time.sleep(0.05)


# =========================================================
# ARRET AVEC CTRL+C
# =========================================================

except KeyboardInterrupt:

    print("")
    print("[Raspberry] arrêt du programme")


# =========================================================
# NETTOYAGE
# =========================================================

finally:

    # Toujours couper le signal PWM lorsque le programme se termine.

    couper_signal_servos()

    lgpio.gpiochip_close(gpio)

    print(
        "[Raspberry] servomoteurs arrêtés"
    )

