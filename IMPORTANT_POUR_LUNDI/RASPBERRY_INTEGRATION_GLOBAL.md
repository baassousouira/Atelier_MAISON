# Atelier Maison — Intégration Raspberry ↔ FastAPI ↔ React

> Objectif : arriver lundi avec chaque Raspberry prêt à être branché au réseau du projet.

---

# 1. Règle d'architecture à respecter

Le frontend React **ne communique jamais directement avec les Raspberry**.

Le chemin obligatoire est :

```text
React
  ↓
FastAPI central
  ↓
Raspberry
```

Pour les données remontantes :

```text
Raspberry
  ↓
FastAPI central
  ↓
React
```

Le switch ne contient aucune logique applicative. Il transporte les paquets.

---

# 2. Adresses prévues actuellement

```text
Serveur FastAPI central : 192.168.1.1:8000
Raspberry mobile        : 192.168.1.2
Raspberry fixe          : 192.168.1.4
API locale Raspberry    : port 8001
```

Masque attendu :

```text
255.255.255.0
```

---

# 3. Ce qui est serait cool d'avoir lundi

Chaque Raspberry doit remplir **deux rôles** :

## Rôle A — client du serveur central

Le Raspberry envoie :

```text
POST /api/controleurs/heartbeat
POST /api/evenements
```

vers :

```text
http://192.168.1.1:8000
```

## Rôle B — petit serveur HTTP local

FastAPI doit pouvoir appeler le Raspberry sur :

```text
http://IP_DU_RASPBERRY:8001
```

avec :

```text
PUT  /system
PUT  /components/{name}/enabled
GET  /camera/stream?name=camera
POST /camera/screenshot?name=camera
POST /robot/command            # Raspberry mobile uniquement
```

L'API locale doit écouter sur :

```text
0.0.0.0:8001
```

et non uniquement sur :

```text
127.0.0.1
```

---

# 4. Heartbeat obligatoire

Toutes les ~5 secondes, chaque Raspberry doit envoyer :

```http
POST http://192.168.1.1:8000/api/controleurs/heartbeat
Content-Type: application/json
```

Le serveur détermine lui-même l'adresse IP avec :

```text
request.client.host
```

Donc **ne pas mettre l'IP dans le JSON**.

## Format exact actuellement attendu par FastAPI

```json
{
  "has_servo": false,
  "components": [
    {
      "name": "camera",
      "enabled": true,
      "value": null
    }
  ]
}
```

Champs :

```text
has_servo : bool
components : tableau
components[].name : string
components[].enabled : bool
components[].value : string | int | float | bool | null
```

Le serveur considère un contrôleur `ONLINE` si son dernier heartbeat date de moins d'environ 15 secondes.

---

# 5. Noms de composants reconnus

Utiliser de préférence exactement ces noms techniques :

```text
camera
motion_sensor
photoresistance
light_sensor
button
bouton
led
servo
robot
```

Le backend normalise ensuite :

```text
camera + FIXED  → CAMERA
camera + MOBILE → ROBOT_CAMERA
motion_sensor   → MOTION_SENSOR
pir             → MOTION_SENSOR
photoresistance → PHOTORESISTOR
light_sensor    → PHOTORESISTOR
button/bouton   → BUTTON
led             → LED
servo           → SERVO
robot           → ROBOT
```

Éviter d'inventer d'autres noms sans coordination avec le backend.

---

# 6. Événement de détection

Lorsqu'un événement de surveillance doit remonter :

```http
POST http://192.168.1.1:8000/api/evenements
Content-Type: application/json
```

Payload actuel :

```json
{
  "capteur": "motion_sensor",
  "zone": "salon",
  "horodatage": 1788680000
}
```

L'IP n'est pas envoyée dans le JSON.

FastAPI fait :

```text
IP source
  ↓
site_controllers
  ↓
site
  ↓
client
```

Si le Raspberry est attribué à un site, FastAPI peut créer automatiquement une `CompanyAlert`.

---

# 7. API locale : état du système

Route :

```http
PUT /system
```

Body :

```json
{
  "armed": true
}
```

ou :

```json
{
  "armed": false
}
```

Le Raspberry doit réellement mettre à jour l'état de surveillance local.

Réponse recommandée :

```json
{
  "ok": true,
  "armed": true
}
```

L'important pour le serveur central est que l'action réussisse ou échoue réellement.

---

# 8. API locale : activation d'un composant

Route :

```http
PUT /components/{name}/enabled
```

Exemple :

```http
PUT /components/camera/enabled
```

Body :

```json
{
  "enabled": false
}
```

Le composant doit réellement être considéré comme désactivé.

Le heartbeat suivant doit annoncer :

```json
{
  "name": "camera",
  "enabled": false,
  "value": null
}
```

Ne pas faire une fausse réponse `200 OK` sans appliquer l'état.

---

# 9. API locale : flux caméra

Route :

```http
GET /camera/stream?name=camera
```

Réponse conseillée pour le prototype :

```text
multipart/x-mixed-replace; boundary=frame
```

avec images JPEG successives.

FastAPI relaie ensuite ce flux vers React.

React n'ouvre jamais :

```text
http://192.168.1.2:8001/...
```

directement.

---

# 10. API locale : capture caméra

Route :

```http
POST /camera/screenshot?name=camera
```

Réponse recommandée :

```http
HTTP/1.1 200 OK
Content-Type: image/jpeg
```

Body :

```text
octets JPEG
```

Le serveur central stocke ensuite le média.

En cas de caméra absente/désactivée :

```text
4xx ou 5xx explicite
```

et non une image vide avec `200`.

---

# 11. API locale : robot

Uniquement sur le Raspberry mobile :

```http
POST /robot/command
Content-Type: application/json
```

Payload :

```json
{
  "command": "FORWARD",
  "speed": 50
}
```

Commandes obligatoires :

```text
FORWARD
BACKWARD
LEFT
RIGHT
STOP
```

`speed` :

```text
0 à 100
```

La commande la plus importante est :

```text
STOP
```

Elle doit arrêter immédiatement les moteurs.

Réponse recommandée :

```json
{
  "ok": true,
  "command": "FORWARD",
  "speed": 50
}
```

---

# 12. Erreurs réseau à gérer

Le programme Raspberry ne doit jamais planter parce que le serveur FastAPI n'est pas joignable.

Pseudo-code :

```text
toutes les 5 secondes :
    essayer envoyer heartbeat

    si succès :
        continuer

    si échec :
        afficher/loguer l'erreur
        NE PAS quitter le programme
        attendre le cycle suivant
```

Même logique pour les événements.

---

# 13. Timeout / non-blocage

L'envoi HTTP d'un heartbeat ne doit pas bloquer indéfiniment la lecture des capteurs.

Prévoir un timeout réseau raisonnable.

Le Raspberry doit continuer :

```text
lecture capteurs
contrôle local
sécurité STOP robot
```

même si FastAPI est temporairement indisponible.

---

# 14. Séparation des responsabilités dans vos fichiers

Même si vos noms de fichiers diffèrent, votre code devrait avoir ces responsabilités.

```text
configuration réseau
    ↓
heartbeat
    ↓
événements
    ↓
API locale
    ↓
drivers matériel
```

Dans votre fichier réseau actuel (par exemple `network.cpp` si c'est celui qui envoie déjà `/api/evenements`) :

```text
- conserver POST /api/evenements ;
- ajouter/fiabiliser POST /api/controleurs/heartbeat ;
- gérer timeout et erreurs ;
- ne pas envoyer l'IP dans le JSON.
```

Dans le fichier qui gère les capteurs :

```text
- exposer l'état courant de chaque composant ;
- exposer enabled ;
- exposer value ;
- fournir ces valeurs au heartbeat.
```

Dans le fichier qui gère l'API HTTP locale :

```text
- écouter sur port 8001 ;
- implémenter /system ;
- implémenter /components/{name}/enabled ;
- implémenter caméra ;
- implémenter robot si mobile.
```

Dans le fichier moteur/robot :

```text
- FORWARD ;
- BACKWARD ;
- LEFT ;
- RIGHT ;
- STOP ;
- vitesse 0..100.
```

---

# 15. Supervision "câble branché / débranché"

La page React Infrastructure distingue :

```text
ONLINE/OFFLINE
```

de :

```text
CONNECTED/DISCONNECTED/UNKNOWN
```

C'est volontaire.

Un Raspberry OFFLINE peut être :

```text
éteint
planté
service arrêté
câble débranché
switch inaccessible
```

Donc **OFFLINE ne prouve pas à lui seul que le câble a été retiré**.

## Minimum lundi

Avec le heartbeat actuel :

```text
Raspberry actif → ONLINE
heartbeat perdu → OFFLINE
```

React affichera déjà visuellement la perte de communication.

## Pour une vraie télémétrie Ethernet plus tard

Préparer idéalement une fonction locale capable de lire :

```text
interface : eth0
carrier   : 0 ou 1
speed     : 100 / 1000 Mb/s si disponible
```

Sous Linux, les informations peuvent notamment être lues dans :

```text
/sys/class/net/eth0/carrier
/sys/class/net/eth0/speed
```

Mais attention :

> si le câble est retiré et que la seule communication était ce câble, le Raspberry ne peut plus transmettre son nouvel état au serveur par cette même liaison.

Pour connaître avec certitude l'état physique après coupure il faut par exemple :

```text
- un switch administrable ;
ou
- une liaison Wi-Fi de secours ;
ou
- une autre source de télémétrie.
```

Le frontend est déjà prévu pour recevoir plus tard :

```text
networkInterface
networkMedium
physicalLinkState
localApiStatus
linkSpeedMbps
```

mais le backend central doit encore être adapté pour les exploiter.

---

# 16. Endpoint local de diagnostic recommandé

Même s'il n'est pas encore obligatoire dans le `main.py` actuel, préparez :

```http
GET /health
```

Réponse recommandée :

```json
{
  "ok": true,
  "controllerType": "FIXED",
  "network": {
    "interface": "eth0",
    "medium": "RJ45",
    "physicalLinkState": "CONNECTED",
    "linkSpeedMbps": 100
  },
  "components": [
    {
      "name": "camera",
      "enabled": true
    }
  ]
}
```

Pour le mobile :

```json
{
  "ok": true,
  "controllerType": "MOBILE",
  "network": {
    "interface": "eth0",
    "medium": "RJ45",
    "physicalLinkState": "CONNECTED",
    "linkSpeedMbps": 100
  },
  "components": [
    {
      "name": "camera",
      "enabled": true
    },
    {
      "name": "robot",
      "enabled": true
    },
    {
      "name": "servo",
      "enabled": true
    }
  ]
}
```

Ce endpoint sera utile lorsque le backend central sera découpé et enrichi.

---

# 17. Test local obligatoire avant lundi

Sur chaque Raspberry, tester d'abord depuis le Raspberry lui-même :

```bash
curl http://127.0.0.1:8001/health
```

Puis depuis une autre machine du même réseau :

```bash
curl http://192.168.1.X:8001/health
```

Si la deuxième commande échoue mais la première fonctionne :

```text
l'API écoute probablement seulement sur localhost
ou
le pare-feu bloque le port 8001.
```

---

# 18. Résultat attendu lundi

Une fois branché :

```text
Raspberry
   ↓ heartbeat
FastAPI
   ↓
GET /api/company/controllers
   ↓
React Infrastructure
```

La page doit pouvoir afficher :

```text
Raspberry fixe
192.168.1.4
ONLINE
camera ONLINE
motion_sensor ONLINE

Raspberry mobile
192.168.1.2
ONLINE
camera ONLINE
robot ONLINE
servo ONLINE
```

Puis si un Raspberry cesse de communiquer :

```text
ONLINE
  ↓
OFFLINE
```

et la page doit le montrer visuellement.

---

# 19. Ne pas faire

Ne pas :

```text
- faire contacter le Raspberry directement par React ;
- coder les IP Raspberry dans React ;
- mettre customerId dans le Raspberry ;
- envoyer l'IP dans le heartbeat ;
- répondre OK à une commande matériel non exécutée ;
- laisser une requête réseau bloquer toute la boucle matérielle ;
- arrêter le programme si FastAPI est indisponible ;
- changer les noms de composants sans prévenir le backend.
```

---

# 20. Checklist de fin

Avant lundi, chaque camarade doit pouvoir répondre OUI à :

```text
[ ] mon Raspberry possède l'IP attendue
[ ] il peut ping 192.168.1.1 quand le réseau projet est disponible
[ ] heartbeat prêt toutes les ~5 s
[ ] heartbeat contient has_servo
[ ] heartbeat contient tous les composants réels
[ ] noms des composants normalisés
[ ] POST /api/evenements prêt
[ ] API locale écoute sur 0.0.0.0:8001
[ ] PUT /system fonctionne
[ ] PUT /components/{name}/enabled fonctionne
[ ] flux caméra fonctionne
[ ] screenshot fonctionne
[ ] robot mobile : FORWARD fonctionne
[ ] robot mobile : STOP fonctionne immédiatement
[ ] les erreurs réseau ne font pas planter le programme
[ ] GET /health local préparé si possible
```
