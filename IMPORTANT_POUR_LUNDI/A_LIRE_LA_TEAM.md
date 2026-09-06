# A LIRE LA TEAM

Salut, j'ai terminé la partie React + interface entreprise. Pour que l'intégration fonctionne lundi, j'ai besoin que chaque Raspberry respecte exactement le contrat réseau suivant.

**Serveur central prévu :** `192.168.1.1:8000`  
**Raspberry mobile :** `192.168.1.2`  
**Raspberry fixe :** `192.168.1.4`  
**API locale de chaque Raspberry :** port `8001`

Chaque Raspberry doit envoyer environ toutes les 5 secondes :

```http
POST http://192.168.1.1:8000/api/controleurs/heartbeat
```

Le fixe doit envoyer `has_servo:false`, le mobile `has_servo:true`.

Le heartbeat doit contenir les composants réellement présents avec les noms normalisés (`camera`, `motion_sensor`, `photoresistance`, `button`, `led`, `servo`, `robot`).

Pour une détection :

```http
POST http://192.168.1.1:8000/api/evenements
```

avec `capteur`, `zone`, `horodatage`. Ne mettez pas l'IP dans le JSON : FastAPI la récupère depuis la connexion.

J'ai également besoin que chaque Raspberry expose sur `0.0.0.0:8001` :

```text
PUT  /system
PUT  /components/{name}/enabled
GET  /camera/stream?name=camera
POST /camera/screenshot?name=camera
```

et le mobile :

```text
POST /robot/command
```

avec `FORWARD`, `BACKWARD`, `LEFT`, `RIGHT`, `STOP`, vitesse `0..100`.

`STOP` doit arrêter immédiatement les moteurs.

Il faut aussi que le programme ne plante pas si le serveur central est absent : heartbeat/event échoue → log → réessayer au cycle suivant.

Si possible, ajoutez aussi :

```text
GET /health
```

sur le port 8001 avec état du Raspberry et de `eth0`, car j'ai ajouté une page admin Infrastructure qui affiche ONLINE/OFFLINE et qui pourra plus tard afficher précisément câble branché/débranché. Attention : sans réseau de secours ou switch administrable, après retrait du câble on peut détecter la perte de communication mais pas toujours prouver physiquement la cause.

Je vous ai joint :
- `RASPBERRY_INTEGRATION_GLOBAL.md`
- votre fiche `RASPBERRY_FIXE.md` ou `RASPBERRY_MOBILE.md`
- `CONTRAT_HTTP_RASPBERRY_FASTAPI.md`
- `TESTS_AVANT_ET_PENDANT_LUNDI.md`

Merci de tester localement les routes du port 8001 avant lundi pour qu'on puisse consacrer la séance au branchement et au test complet :)
