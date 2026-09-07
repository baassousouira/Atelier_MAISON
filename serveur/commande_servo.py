import requests


# =========================================================================
# ADRESSE DU SERVEUR
# =========================================================================

# Le programme tourne sur le même PC que le serveur.
# 127.0.0.1 signifie "ce PC".
SERVEUR_URL = "http://192.168.1.1:8000/api/servo"

# =========================================================================
# PROGRAMME PRINCIPAL
# =========================================================================

while True:

    try:

        # On demande à l'utilisateur de choisir un angle
        angle = int(input("Angle du servo (0-180) : "))


        # Vérification de l'angle
        if 0 <= angle <= 180:

            # Création des données à envoyer au serveur
            donnees = {
                "angle": angle
            }


            # Envoi de l'angle au serveur avec une requête POST
            reponse = requests.post(
                SERVEUR_URL,
                json=donnees
            )


            # Vérification de la réponse du serveur
            if reponse.status_code == 200:

                print("Commande envoyée au serveur")

                # Affichage de la réponse du serveur
                print("Réponse :", reponse.json())

            else:

                print(
                    f"Erreur serveur : {reponse.status_code}"
                )


        else:

            # L'angle n'est pas compris entre 0 et 180
            print("L'angle doit être compris entre 0 et 180.")


    except ValueError:

        # L'utilisateur n'a pas entré un nombre
        print("Veuillez entrer un nombre.")


    except requests.exceptions.RequestException:

        # Le PC n'arrive pas à contacter le serveur
        print("Impossible de contacter le serveur.")