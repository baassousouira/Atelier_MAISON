# Raspberry n°2 — Caméra fixe + détection de mouvement

## Fichiers
- `capture.h` / `capture.cpp` — capture caméra (fourni au départ, inchangé)
- `mouvement.h` / `mouvement.cpp` — détection de mouvement (fourni au départ, inchangé)
- `network.h` / `network.cpp` — **nouveau** : communication HTTP avec le serveur
- `gpio.h` / `gpio.cpp` — **nouveau** : pilotage de la LED d'acquittement
- `config.h` — **nouveau** : tous les réglages (IP du serveur, GPIO, seuils...)
- `main.cpp` — **modifié** : boucle principale + machine à états de l'alerte
- `makefile` — mis à jour avec les nouvelles bibliothèques

## IP retenues pour votre réseau
- Ce Raspberry (caméra fixe) : `192.168.1.4`
- Serveur (FastAPI) : `192.168.1.1`
- App / site web : `192.168.1.5`

Ces IP sont supposées **fixes** sur votre réseau local (configurez une IP statique
sur chaque appareil, ou une réservation DHCP sur votre switch/routeur, sinon
`SERVER_BASE_URL` dans `config.h` ne pointera plus vers le bon appareil).

## Installation des dépendances (sur le Raspberry)

```bash
sudo apt update
sudo apt install -y libopencv-dev libcurl4-openssl-dev libgpiod-dev
```

## Compilation

```bash
make
```

Pour compiler avec les fenêtres de debug (nécessite un écran/X11, à ne PAS
utiliser en usage réel headless) :

```bash
make clean
make CFLAGS="-Wall -DDEBUG_UI"
```

## Exécution

```bash
sudo ./capture
```

(`sudo` est nécessaire pour accéder aux GPIO sans configuration système
supplémentaire — sur certaines installations récentes de Raspberry Pi OS,
ajouter votre utilisateur au groupe `gpio` permet de s'en passer.)

## Vérifier que ça communique bien avec le serveur

1. Démarrez d'abord le serveur (voir le dossier `serveur/`)
2. Lancez `./capture` sur ce Raspberry
3. Faites un mouvement devant la caméra
4. Dans le terminal du Raspberry, vous devez voir :
   `main: mouvement confirmé, envoi de l'alerte au serveur`
5. Ouvrez la page web du serveur (`http://192.168.1.1:8000`) depuis un
   navigateur : un pop-up doit apparaître avec l'événement
6. Cliquez sur "Fausse alerte" ou "Vraie alerte" : la LED du Raspberry
   doit réagir en conséquence (clignote une fois / reste allumée)
