# Où intégrer les modifications dans le dépôt actuel

Ce document se base sur les fichiers déjà présents dans votre dépôt.

## 1. `files/network.cpp`

Ce fichier sait déjà :

- envoyer un événement avec `POST /api/evenements` ;
- lire la décision avec `GET /api/evenements/{id}/decision` ;
- utiliser `libcurl`.

À ajouter ici ou dans un fichier réseau voisin :

- une fonction d'envoi du heartbeat ;
- un appel périodique à cette fonction toutes les ~5 secondes.

L'exemple `EXEMPLE_HEARTBEAT_CPP.cpp` montre la requête à ajouter.

## 2. `files/config.h`

Ce fichier contient déjà :

```cpp
#define SERVER_BASE_URL "http://192.168.1.1:8000"
```

Gardez ce principe : l'adresse du serveur doit rester dans un fichier de configuration et non dispersée dans tout le code.

L'adresse `192.168.1.1` doit cependant être vérifiée sur le réseau réel utilisé.

## 3. `servoV2.py`

Le fichier actuel :

- pilote le servo avec `gpiozero.Servo(18)` ;
- demande l'angle avec `input()` ;
- envoie ensuite un message UDP au PC.

Pour l'intégration avec l'application, il faut remplacer le pilotage manuel `input()` par une fonction réutilisable appelée par la route locale :

```text
POST /robot/command
```

Le Raspberry mobile doit recevoir les commandes venant de FastAPI au lieu d'attendre une saisie clavier locale.

Le code de pilotage du servo existant peut être conservé ; c'est la source de la commande qui change.

## 4. `photoresEtBoutton/readDataArduino.py`

Ce fichier lit déjà le JSON série envoyé par l'Arduino :

```python
data = json.loads(ligne)
```

mais il ne fait actuellement que :

```python
print(data)
```

Il faut conserver en mémoire la dernière vraie valeur reçue afin de l'inclure dans le heartbeat :

```json
{
  "name": "photoresistance",
  "enabled": true,
  "value": valeur_reelle
}
```

Le bouton peut également être remonté avec `value` si vous souhaitez afficher son état.

## 5. Caméra C++

Les fichiers `capture.cpp`, `mouvement.cpp` et `main.cpp` réalisent déjà la capture/détection locale.

Il manque encore une exposition réseau du vrai flux pour :

```text
GET /camera/stream?name=camera
```

et une capture ponctuelle pour :

```text
POST /camera/screenshot?name=camera
```

Il faut relier ces routes à vos fonctions de capture existantes, pas recréer une fausse caméra.

## 6. Règle importante pour l'activation

Quand le serveur envoie :

```json
{ "enabled": false }
```

le code du composant doit réellement tenir compte de cet état.

Exemple caméra :

```cpp
if (system_armed && camera_enabled) {
    // lancer/analyser les images
}
```

Le heartbeat doit continuer même lorsque `system_armed == false` ou `camera_enabled == false`.
