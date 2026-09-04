# Routes HTTP à implémenter sur les Raspberry

Le serveur central suppose que chaque Raspberry expose une petite API HTTP sur le port `8001`.

## Routes communes aux deux Raspberry

### 1. Modifier l'état global de surveillance

```text
PUT /system
Content-Type: application/json
```

Corps :

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

Réponse recommandée :

```json
{
  "ok": true
}
```

Le code local doit conserver cet état dans une variable, par exemple :

```python
SYSTEM_ARMED = True
```

et les algorithmes de détection doivent réellement le vérifier.

---

### 2. Activer ou désactiver un composant

```text
PUT /components/{name}/enabled
Content-Type: application/json
```

Exemple :

```text
PUT /components/camera/enabled
```

Corps :

```json
{
  "enabled": false
}
```

Réponse recommandée :

```json
{
  "ok": true
}
```

Le heartbeat suivant doit renvoyer l'état réel mis à jour :

```json
{
  "name": "camera",
  "enabled": false
}
```

Si le composant n'existe pas, renvoyer un code HTTP `404`.

---

## Route uniquement sur le Raspberry mobile 192.168.1.2

### 3. Commande du système mobile

```text
POST /robot/command
Content-Type: application/json
```

Corps :

```json
{
  "command": "LEFT",
  "speed": 40
}
```

Commandes prévues :

```text
FORWARD
BACKWARD
LEFT
RIGHT
STOP
```

`speed` est compris entre `0` et `100`.

Réponse recommandée :

```json
{
  "ok": true
}
```

La route doit appeler le vrai code de pilotage/servo, pas seulement répondre `ok`.

---

## Routes caméra sur chaque Raspberry possédant une caméra

### 4. Flux vidéo

```text
GET /camera/stream?name=camera
```

Cette route doit renvoyer le vrai flux vidéo.

Le serveur central relaie ensuite ce flux à React.

Le format peut par exemple être un flux MJPEG :

```text
Content-Type: multipart/x-mixed-replace; boundary=frame
```

Le format exact doit correspondre à ce que votre code caméra peut réellement produire.

---

### 5. Capture d'image

```text
POST /camera/screenshot?name=camera
```

La réponse doit être directement l'image, par exemple :

```text
Content-Type: image/jpeg
```

ou :

```text
Content-Type: image/png
```

Le serveur central enregistre ensuite cette image dans son propre dossier `media`.
