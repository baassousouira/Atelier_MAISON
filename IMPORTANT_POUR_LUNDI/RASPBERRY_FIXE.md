# Atelier Maison — Raspberry FIXE — tâches exactes

> Cible réseau prévue : `192.168.1.4`  
> Rôle : contrôleur fixe du logement.

---

# 1. Ce que ce Raspberry doit représenter

Le Raspberry fixe doit déclarer uniquement les composants réellement installés.

Exemple attendu si votre montage contient caméra + PIR :

```text
Raspberry fixe
├── camera
└── motion_sensor
```

Si vous avez aussi :

```text
photoresistance
button
led
```

vous les ajoutez au heartbeat uniquement s'ils existent réellement.

---

# 2. Valeur obligatoire

Le heartbeat fixe doit contenir :

```json
{
  "has_servo": false,
  "components": []
}
```

`has_servo` doit rester :

```text
false
```

car FastAPI utilise cette valeur pour classer le contrôleur comme `FIXED`.

---

# 3. Exemple heartbeat complet

```json
{
  "has_servo": false,
  "components": [
    {
      "name": "camera",
      "enabled": true,
      "value": null
    },
    {
      "name": "motion_sensor",
      "enabled": true,
      "value": false
    },
    {
      "name": "photoresistance",
      "enabled": true,
      "value": 437
    }
  ]
}
```

N'envoyez que les composants présents.

---

# 4. Fonctions à avoir dans votre code

Les noms ci-dessous sont des noms de référence. Adaptez-les à votre projet.

```text
buildHeartbeatPayload()
sendHeartbeat()
sendEvent()
setSystemArmed()
setComponentEnabled()
cameraStream()
cameraScreenshot()
readNetworkState()
```

---

# 5. Boucle heartbeat

Pseudo-code :

```text
dernierHeartbeat = 0

boucle principale :
    lire capteurs

    si maintenant - dernierHeartbeat >= 5 s :
        payload = buildHeartbeatPayload()

        essayer :
            sendHeartbeat(payload)
        sauf erreur réseau :
            log erreur
            continuer

        dernierHeartbeat = maintenant
```

---

# 6. Mouvement

Lorsque le PIR passe dans l'état de détection :

```text
si système armé
et motion_sensor enabled
et détection réelle
```

envoyer :

```http
POST http://192.168.1.1:8000/api/evenements
```

```json
{
  "capteur": "motion_sensor",
  "zone": "salon",
  "horodatage": 1788680000
}
```

Ne pas envoyer plusieurs dizaines d'événements pour une seule présence continue.

Prévoir :

```text
anti-rebond / cooldown / détection de front
```

selon votre logique actuelle.

---

# 7. API locale obligatoire

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
GET  /health             recommandé
```

Le Raspberry fixe ne doit pas nécessairement implémenter :

```text
POST /robot/command
```

s'il ne possède aucun robot.

---

# 8. Activation/désactivation

Exemple :

```http
PUT /components/motion_sensor/enabled
```

```json
{
  "enabled": false
}
```

Après cela :

```text
- le PIR ne doit plus déclencher d'événement ;
- le heartbeat doit annoncer enabled=false.
```

Même logique pour la caméra.

---

# 9. Caméra fixe

Le stream doit fonctionner depuis une autre machine :

```text
http://192.168.1.4:8001/camera/stream?name=camera
```

La capture :

```http
POST http://192.168.1.4:8001/camera/screenshot?name=camera
```

doit renvoyer une vraie image JPEG.

---

# 10. Test final Raspberry fixe

```text
[ ] IP = 192.168.1.4 sur le réseau projet
[ ] has_servo=false
[ ] heartbeat fonctionne
[ ] camera déclarée
[ ] motion_sensor déclaré
[ ] autres capteurs déclarés seulement s'ils existent
[ ] mouvement envoie /api/evenements
[ ] /system fonctionne
[ ] /components/.../enabled fonctionne
[ ] stream caméra fonctionne depuis une autre machine
[ ] screenshot renvoie une image
[ ] programme survit si 192.168.1.1 est absent
```
