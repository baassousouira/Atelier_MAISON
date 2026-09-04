from gpiozero import Servo
from time import sleep
import socket


# On utilise le GPIO 18 pour controler le servo
servo = Servo(18)


# Adresse IP et port du PC qui fait tourner le serveur
SERVEUR_IP = "192.168.1.1"
SERVEUR_PORT = 5000


# Creation du socket UDP
# UDP permet d'envoyer des messages sans creer de connexion permanente
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

# On attend maximum 2 secondes pour avoir une reponse du serveur
sock.settimeout(2)


# Boucle principale du programme
while True:

    # On demande a l'utilisateur de choisir un angle
    angle = int(input("Angle (0-180) : "))


    # On verifie que l'angle est compris entre 0 et 180
    if 0 <= angle <= 180:

        # Conversion de l'angle en valeur comprise entre -1 et 1
        # C'est la valeur utilisee par gpiozero pour le servo
        position = (angle / 90) - 1

        # On fait tourner le servo jusqu'a la position demandee
        servo.value = position


        # Message qui sera envoye au serveur
        message = f"Angle demande : {angle}"


        # Envoi du message au serveur avec UDP
        sock.sendto(
            message.encode("utf-8"),
            (SERVEUR_IP, SERVEUR_PORT)
        )

        print(f"Envoye au serveur : {message}")


        # On attend l'acquittement du serveur
        try:

            # Reception de la reponse
            data, adresse_serveur = sock.recvfrom(1024)

            # Transformation des donnees recues en texte
            reponse = data.decode("utf-8")

            print(f"Reponse du serveur : {reponse}")


        # Si le serveur ne repond pas pendant 2 secondes
        except socket.timeout:
            print("Aucune reponse du serveur.")


        # Petite pause avant de demander un nouvel angle
        sleep(1)


    # Si l'utilisateur entre un angle incorrect
    else:
        print("Angle invalide")
