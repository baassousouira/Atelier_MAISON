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
HEARTBEAT_URL = "http://192.168.1.1:8000/api/heartbeat"


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

# La caméra et le servo sont déclarés disponibles
cameraEnabled = True
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

def buildHeartbeatPayload():

    """
    Construit le message que le Raspberry envoie
    au serveur toutes les 5 secondes.

    has_servo = true permet au serveur de reconnaitre
    ce Raspberry comme contrôleur MOBILE.
    """

    payload = {
        "has_servo": True,

        "components": [

            {
                "name": "camera",
                "enabled": cameraEnabled,
                "value": None
            },

            {
                "name": "robot",
                "enabled": robotEnabled,
                "value": None
            },

            {
                "name": "servo",
                "enabled": servoEnabled,
                "value": None
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

    robotEnabled = enabled

    # Si le robot est désactivé :
    # arrêt immédiat des servomoteurs.

    if not robotEnabled:

        stop()

        print("[Robot] désactivé -> STOP")


# =========================================================
# ACTIVER / DESACTIVER UN COMPOSANT
# =========================================================

def setComponentEnabled(name, enabled):

    global robotEnabled
    global cameraEnabled
    global servoEnabled

    if name == "robot":

        robotEnabled = enabled

        if not robotEnabled:

            # STOP obligatoire lorsque le robot
            # est désactivé.

            stop()

            print("[Robot] désactivé -> STOP")

        else:

            print("[Robot] activé")

    elif name == "camera":

        cameraEnabled = enabled

        print(
            "[Camera] enabled =",
            cameraEnabled
        )

    elif name == "servo":

        servoEnabled = enabled

        # Si le servo est désactivé,
        # on arrête le robot.

        if not servoEnabled:

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
    # STOP toujours autorisé
    # -----------------------------------------------------

    if command == "STOP":

        stop()

        return


    # -----------------------------------------------------
    # Les autres commandes sont interdites
    # si le robot est désactivé.
    # -----------------------------------------------------

    if not robotEnabled:

        stop()

        print(
            "[Robot] commande refusée : robot désactivé"
        )

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

            stop()

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

    # Toujours arrêter les servomoteurs
    # lorsque le programme se termine.

    stop()

    lgpio.gpiochip_close(gpio)

    print(
        "[Raspberry] servomoteurs arrêtés"
    )

