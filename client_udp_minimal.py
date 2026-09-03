"""
Client UDP minimal - base de depart
-------------------------------------
Sequence d'echange de demonstration : envoie "bonjour", puis
"message 1" a "message 10" (une pause d'1 seconde entre chaque),
puis "au revoir". A chaque envoi, on attend la reponse du serveur
avant de continuer.

Toujours pas de gestion de perte au-dela du timeout : si la reponse
n'arrive jamais, on l'affiche et on passe au message suivant. A vous
de decider si c'est le comportement souhaite (reessayer ? abandonner
toute la sequence ?).
"""

import socket
import time

# --- Configuration ---
SERVEUR_IP = "127.0.0.1"   # a remplacer par l'adresse reelle du serveur
SERVEUR_PORT = 5000
DELAI_ENTRE_MESSAGES = 1.0  # en secondes

# --- Creation du socket ---
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.settimeout(2.0)  # evite un blocage infini si rien ne repond

# --- Construction de la sequence de messages a envoyer ---
messages = ["bonjour"] + [f"message {i}" for i in range(1, 11)] + ["au revoir"]

# --- Boucle d'envoi ---
for message in messages:
    sock.sendto(message.encode("utf-8"), (SERVEUR_IP, SERVEUR_PORT))
    print(f"Envoye : {message}")

    try:
        data, adresse_serveur = sock.recvfrom(1024)
        reponse = data.decode("utf-8")
        print(f"Recu de {adresse_serveur} : {reponse}")
    except socket.timeout:
        print("Aucune reponse recue dans le delai imparti.")

    time.sleep(DELAI_ENTRE_MESSAGES)

sock.close()
