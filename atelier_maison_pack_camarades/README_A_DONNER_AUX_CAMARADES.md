# Atelier Maison — intégration Raspberry ↔ serveur central

Ce document décrit **le contrat à respecter côté Raspberry** pour que l'application React puisse récupérer les vrais états et envoyer des commandes.

## 1. Architecture à respecter

```text
Application React
      ↓
Serveur central FastAPI (port 8000)
      ↓
Switch / réseau local
      ↓
Raspberry
      ↓
Caméra / servo / capteurs / LED / bouton
```

Le navigateur React **ne contacte jamais directement les Raspberry**.

Le serveur central contacte les Raspberry quand il doit exécuter une commande.

## 2. Les deux Raspberry actuels

### Raspberry mobile — 192.168.1.2

Il est classé `MOBILE` car il possède/contrôle un servomoteur.

```python
HAS_SERVO = True
```

Composants actuellement attendus :

```text
camera
servo
```

### Raspberry fixe — 192.168.1.4

Il est classé `FIXED` car il ne possède pas de servomoteur.

```python
HAS_SERVO = False
```

Composants actuellement attendus :

```text
camera
photoresistance
button
led
```

## 3. Heartbeat obligatoire

Chaque Raspberry doit envoyer son état au serveur central **environ toutes les 5 secondes** :

```text
POST http://IP_DU_SERVEUR:8000/api/controleurs/heartbeat
Content-Type: application/json
```

Le serveur déduit automatiquement l'IP du Raspberry à partir de la connexion réseau. Il n'est donc pas nécessaire d'envoyer l'IP dans le JSON.

### Exemple mobile

```json
{
  "has_servo": true,
  "components": [
    { "name": "camera", "enabled": true },
    { "name": "servo", "enabled": true }
  ]
}
```

### Exemple fixe

```json
{
  "has_servo": false,
  "components": [
    { "name": "camera", "enabled": true },
    { "name": "photoresistance", "enabled": true, "value": 632 },
    { "name": "button", "enabled": true },
    { "name": "led", "enabled": true }
  ]
}
```

`632` est uniquement un exemple de format. Il faut envoyer la **vraie valeur mesurée**.

## 4. ONLINE / OFFLINE

Le Raspberry n'envoie pas `ONLINE` ou `OFFLINE`.

Le serveur central le calcule :

```text
dernier heartbeat reçu depuis ≤ 15 s → ONLINE
aucun heartbeat depuis > 15 s       → OFFLINE
```

Le heartbeat doit donc continuer même lorsque :

- la surveillance globale est désactivée ;
- la caméra est désactivée ;
- un capteur est désactivé.

Sinon le serveur croirait à tort que le Raspberry est hors ligne.

## 5. API locale obligatoire sur les Raspberry

Chaque Raspberry doit écouter en HTTP sur le port :

```text
8001
```

Le serveur central appellera ensuite ces routes.

Voir `ROUTES_LOCALES_A_IMPLEMENTER.md` pour le détail exact.

## 6. Événements de surveillance

Le code caméra fixe possède déjà la logique réseau pour envoyer :

```text
POST http://IP_DU_SERVEUR:8000/api/evenements
```

avec :

```json
{
  "capteur": "camera_fixe",
  "zone": "salon",
  "horodatage": 1234567890
}
```

Le serveur répond :

```json
{
  "id": "identifiant-unique"
}
```

Le Raspberry peut ensuite lire la décision avec :

```text
GET /api/evenements/{id}/decision
```

## 7. Signification de `enabled`

`enabled` ne signifie pas que le Raspberry est connecté.

Exemple :

```text
status = ONLINE
camera.enabled = false
```

signifie :

> le Raspberry répond correctement, mais la caméra a été volontairement désactivée.

Lorsqu'un composant est désactivé, son algorithme doit réellement en tenir compte.

Par exemple :

```python
if CAMERA_ENABLED and SYSTEM_ARMED:
    analyser_camera()
```

Il ne faut pas simplement changer une variable affichée sans modifier le comportement réel.

## 8. Surveillance globale `armed`

Le serveur central peut envoyer :

```json
{
  "armed": false
}
```

Quand `armed == false` :

- les algorithmes de surveillance ne doivent plus créer de nouvelles alertes ;
- l'API locale du Raspberry doit continuer à fonctionner ;
- le heartbeat doit continuer à être envoyé ;
- les états des composants doivent continuer à être remontés.

## 9. Adresse du serveur central

Le dépôt actuel utilise :

```text
192.168.1.1:8000
```

mais l'adresse IPv4 du PC serveur doit être **vérifiée sur le réseau utilisé le jour du test**. Si elle change, il faut modifier uniquement la configuration réseau côté Raspberry.
