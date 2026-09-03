"""
Serveur UDP minimal - base de depart
-------------------------------------
Pour chaque message recu, affiche son contenu et renvoie a
l'expediteur "acquittement " suivi du contenu recu. Continue a
ecouter indefiniment (UDP est sans connexion : rien n'oblige le
serveur a "fermer" quoi que ce soit quand un client dit au revoir,
contrairement a TCP).

Toujours AUCUNE gestion de heartbeat ou de multiplexage au-dela de
ce simple accuse de reception : c'est a vous de concevoir la suite.
"""

import socket

# --- Configuration ---
HOST = "0.0.0.0"
PORT = 5000

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((HOST, PORT))

print(f"Serveur UDP en ecoute sur {HOST}:{PORT}")

# --- Boucle principale ---
while True:
    data, adresse_client = sock.recvfrom(1024)
    message = data.decode("utf-8")
    print(f"Recu de {adresse_client} : {message}")

    reponse = f"acquittement {message}"
    sock.sendto(reponse.encode("utf-8"), adresse_client)

    if message == "au revoir":
        # Rappel : en UDP il n'y a pas de connexion a fermer. On note
        # juste ici que cet echange particulier est termine, mais le
        # serveur continue d'ecouter pour tout le monde, y compris ce
        # meme client s'il renvoie un nouveau message plus tard.
        print(f"Fin d'echange avec {adresse_client}")
