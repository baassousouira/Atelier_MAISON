# Atelier Maison — Raspberry MOBILE — tâches exactes

> Cible réseau prévue : `192.168.1.2`  
> Rôle : caméra mobile + déplacement robot.

---

# 1. Ce que ce Raspberry doit représenter

Structure minimale :

```text
Raspberry mobile
├── camera
├── robot
└── servo
```

Ne pas ajouter un composant absent.

---

# 2. Valeur obligatoire

Heartbeat :

```json
{
  "has_servo": true,
  "components": []
}
```

`has_servo=true` permet à FastAPI d'identifier le contrôleur comme `MOBILE`.

---

# 3. Exemple heartbeat

```json
{
  "has_servo": true,
  "components": [
    {
      "name": "camera",
      "enabled": true,
      "value": null
    },
    {
      "name": "robot",
      "enabled": true,
      "value": null
    },
    {
      "name": "servo",
      "enabled": true,
      "value": null
    }
  ]
}
```

---

# 4. Fonctions à avoir

Noms de référence :

```text
buildHeartbeatPayload()
sendHeartbeat()
setSystemArmed()
setComponentEnabled()

moveForward(speed)
moveBackward(speed)
turnLeft(speed)
turnRight(speed)
stopRobot()

handleRobotCommand()
cameraStream()
cameraScreenshot()
readNetworkState()
```

---

# 5. API locale obligatoire

Écoute :

```text
0.0.0.0:8001
```

Routes :

```text
PUT  /system
PUT  /components/{name}/enabled
GET  /camera/stream?name=camera
POST /camera/screenshot?name=camera
POST /robot/command
GET  /health
```

---

# 6. Route robot

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

Implémentation attendue :

```text
FORWARD  → moveForward(speed)
BACKWARD → moveBackward(speed)
LEFT     → turnLeft(speed)
RIGHT    → turnRight(speed)
STOP     → stopRobot()
```

Validation :

```text
0 <= speed <= 100
```

Une commande inconnue doit retourner une erreur.

---

# 7. STOP est prioritaire

`STOP` ne doit pas dépendre :

```text
- de la caméra ;
- du flux vidéo ;
- d'une nouvelle requête longue ;
- d'une boucle qui attend plusieurs secondes.
```

Le robot doit s'immobiliser immédiatement.

C'est le comportement de sécurité le plus important de la commande distante.

---

# 8. Activation du robot

Si :

```text
PUT /components/robot/enabled
```

reçoit :

```json
{
  "enabled": false
}
```

alors :

```text
1. appeler stopRobot() ;
2. enregistrer robotEnabled=false ;
3. refuser FORWARD/BACKWARD/LEFT/RIGHT tant qu'il est désactivé ;
4. autoriser STOP ;
5. heartbeat suivant → robot.enabled=false.
```

---

# 9. Caméra mobile

Test du flux :

```text
http://192.168.1.2:8001/camera/stream?name=camera
```

Test capture :

```http
POST http://192.168.1.2:8001/camera/screenshot?name=camera
```

---

# 10. Servo

Le servo doit apparaître dans le heartbeat :

```json
{
  "name": "servo",
  "enabled": true,
  "value": null
}
```

Si le servo a une valeur pertinente :

```text
angle courant
```

vous pouvez la mettre dans `value`.

Exemple :

```json
{
  "name": "servo",
  "enabled": true,
  "value": 90
}
```

---

# 11. Test final Raspberry mobile

```text
[ ] IP = 192.168.1.2 sur le réseau projet
[ ] has_servo=true
[ ] heartbeat fonctionne
[ ] camera déclarée
[ ] robot déclaré
[ ] servo déclaré
[ ] /system fonctionne
[ ] /components/.../enabled fonctionne
[ ] camera stream accessible depuis autre machine
[ ] screenshot JPEG
[ ] FORWARD
[ ] BACKWARD
[ ] LEFT
[ ] RIGHT
[ ] STOP immédiat
[ ] speed bornée entre 0 et 100
[ ] désactiver robot provoque STOP
[ ] le programme ne plante pas si FastAPI est absent
```
