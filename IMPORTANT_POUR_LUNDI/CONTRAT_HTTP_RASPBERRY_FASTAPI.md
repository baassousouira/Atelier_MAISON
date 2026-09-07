# Atelier Maison — Contrat HTTP entre Raspberry et FastAPI

Ce document est la référence courte des routes.

---

# Raspberry → FastAPI central

Base :

```text
http://192.168.1.1:8000
```

## Heartbeat

```http
POST /api/controleurs/heartbeat
Content-Type: application/json
```

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

Réponse : HTTP 2xx attendue.

## Événement

```http
POST /api/evenements
Content-Type: application/json
```

```json
{
  "capteur": "motion_sensor",
  "zone": "salon",
  "horodatage": 1788680000
}
```

---

# FastAPI central → Raspberry local

Base :

```text
http://{controller_ip}:8001
```

## Système

```http
PUT /system
```

```json
{
  "armed": true
}
```

## Activation composant

```http
PUT /components/{name}/enabled
```

```json
{
  "enabled": true
}
```

## Caméra

```http
GET /camera/stream?name=camera
```

Réponse : flux image/MJPEG.

```http
POST /camera/screenshot?name=camera
```

Réponse : `image/jpeg`.

## Robot mobile

```http
POST /robot/command
```

```json
{
  "command": "STOP",
  "speed": 0
}
```

Commandes :

```text
FORWARD
BACKWARD
LEFT
RIGHT
STOP
```

---

# Diagnostic recommandé

```http
GET /health
```

Exemple :

```json
{
  "ok": true,
  "controllerType": "FIXED",
  "network": {
    "interface": "eth0",
    "medium": "RJ45",
    "physicalLinkState": "CONNECTED",
    "linkSpeedMbps": 100
  }
}
```

Ce endpoint de diagnostic est recommandé pour la prochaine évolution backend.
