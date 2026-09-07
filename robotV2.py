import requests
import lgpio
import time


# ---------------------------------------------------------
# Adresse du serveur PC
# ---------------------------------------------------------

URL = "http://192.168.1.1:8000/api/robot/command"


# ---------------------------------------------------------
# GPIO des servomoteurs
# ---------------------------------------------------------

SERVO_GAUCHE = 19
SERVO_DROIT = 23


# ---------------------------------------------------------
# Points d'arrêt trouvés pendant la calibration
# ---------------------------------------------------------

STOP_GAUCHE = 1537
STOP_DROIT = 1545


# ---------------------------------------------------------
# Vitesse du robot
#
# Plus la valeur est grande, plus le servo tourne vite.
# On commence volontairement doucement.
# ---------------------------------------------------------

VITESSE_MAX = 100


# ---------------------------------------------------------
# Ouverture du contrôleur GPIO
# ---------------------------------------------------------

gpio = lgpio.gpiochip_open(0)

lgpio.gpio_claim_output(gpio, SERVO_GAUCHE)
lgpio.gpio_claim_output(gpio, SERVO_DROIT)


# ---------------------------------------------------------
# Fonction permettant de commander un servo
#
# Un servo reçoit une impulsion toutes les 20 ms = 50 Hz.
# ---------------------------------------------------------

def servo(gpio_pin, pulse):

    # Conversion microsecondes -> pourcentage
    duty = (pulse / 20000) * 100

    lgpio.tx_pwm(
        gpio,
        gpio_pin,
        50,
        duty
    )


# ---------------------------------------------------------
# Arrêt des deux servomoteurs
# ---------------------------------------------------------

def stop():

    servo(SERVO_GAUCHE, STOP_GAUCHE)
    servo(SERVO_DROIT, STOP_DROIT)


# ---------------------------------------------------------
# Faire avancer le robot
#
# Les deux servos sont montés dans des directions opposées,
# donc on utilise des valeurs opposées.
# ---------------------------------------------------------

def avant(vitesse):

    servo(
        SERVO_GAUCHE,
        STOP_GAUCHE + vitesse
    )

    servo(
        SERVO_DROIT,
        STOP_DROIT - vitesse
    )


# ---------------------------------------------------------
# Faire reculer le robot
# ---------------------------------------------------------

def arriere(vitesse):

    servo(
        SERVO_GAUCHE,
        STOP_GAUCHE - vitesse
    )

    servo(
        SERVO_DROIT,
        STOP_DROIT + vitesse
    )


# ---------------------------------------------------------
# Tourner à gauche
# ---------------------------------------------------------

def gauche(vitesse):

    servo(
        SERVO_GAUCHE,
        STOP_GAUCHE - vitesse
    )

    servo(
        SERVO_DROIT,
        STOP_DROIT - vitesse
    )


# ---------------------------------------------------------
# Tourner à droite
# ---------------------------------------------------------

def droite(vitesse):

    servo(
        SERVO_GAUCHE,
        STOP_GAUCHE + vitesse
    )

    servo(
        SERVO_DROIT,
        STOP_DROIT + vitesse
    )


# ---------------------------------------------------------
# Appliquer une commande reçue du serveur
# ---------------------------------------------------------

def appliquer_commande(command, speed):

    # On limite la vitesse pour éviter une valeur trop grande

    if speed > VITESSE_MAX:
        speed = VITESSE_MAX

    if speed < 0:
        speed = 0


    if command == "AVANT":
        avant(speed)

    elif command == "ARRIERE":
        arriere(speed)

    elif command == "GAUCHE":
        gauche(speed)

    elif command == "DROITE":
        droite(speed)

    else:
        stop()


# ---------------------------------------------------------
# Programme principal
# ---------------------------------------------------------

print("===================================")
print(" Robot Raspberry")
print("===================================")
print("Serveur :", URL)
print("")


# Au démarrage, on arrête le robot

stop()


derniere_commande = ""


try:

    while True:

        try:

            # Demande HTTP au serveur

            reponse = requests.get(
                URL,
                timeout=0.3
            )


            # Transformation de la réponse en JSON

            donnees = reponse.json()


            commande = donnees["command"]
            vitesse = donnees["speed"]


            # On affiche uniquement si la commande change

            if commande != derniere_commande:

                print(
                    "[Raspberry] commande reçue :",
                    commande,
                    "- vitesse :",
                    vitesse
                )

                derniere_commande = commande


            # On applique la commande

            appliquer_commande(
                commande,
                vitesse
            )


        except Exception as erreur:

            # Si le serveur n'est plus accessible,
            # on arrête immédiatement les moteurs.

            print(
                "[Raspberry] erreur serveur :",
                erreur
            )

            stop()

            derniere_commande = "STOP"


        # Demande environ 20 fois par seconde

        time.sleep(0.05)


except KeyboardInterrupt:

    print("")
    print("[Raspberry] arrêt du programme")


finally:

    # Toujours arrêter les servomoteurs
    # lorsque le programme se termine.

    stop()

    lgpio.gpiochip_close(gpio)

    print("[Raspberry] servomoteurs arrêtés")
