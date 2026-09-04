# Raspberry unique : caméra fixe + Arduino (bouton + photorésistance) + LED

D'après votre montage photo, tout est regroupé sur UN SEUL Raspberry :
- caméra branchée en CSI (ruban)
- Arduino branché en USB (lit le bouton + la photorésistance, câblés sur la breadboard)
- LED câblée directement sur le GPIO du Raspberry (PAS sur l'Arduino)

Ce dossier remplace à la fois `raspberry_camera_fixe/` et
`raspberry_arduino_bouton_photores/` d'avant : il n'y a plus qu'**un seul
programme C++** (`main.cpp`) qui gère les 3 capteurs et l'unique LED.

## Fichiers

- `capture.h/cpp`, `mouvement.h/cpp` — inchangés (fournis au départ)
- `network.h/cpp` — inchangé (communication avec le serveur)
- `gpio.h/cpp` — inchangé (pilotage de la LED, déjà pensé pour être
  déclenché quel que soit le capteur à l'origine de l'alerte)
- `arduino.h/cpp` — **nouveau** : lit en continu, sans jamais bloquer, les
  événements envoyés par l'Arduino en série (bouton / photorésistance)
- `main.cpp` — **modifié** : la boucle principale vérifie maintenant à
  chaque tour à la fois la caméra ET l'Arduino ; n'importe lequel des 3
  capteurs peut déclencher une alerte, qui suit ensuite exactement le
  même chemin (serveur → décision → LED)
- `config.h` — mis à jour : `CAPTEUR_NAME` renommé `CAPTEUR_NAME_CAMERA`,
  ajout de `ARDUINO_PORT` et `ARDUINO_BAUDRATE`
- `photoresEtBoutton.ino` — **simplifié** : ne gère plus de LED (elle
  n'est plus sur l'Arduino), envoie juste les événements par événement
  (pas en continu)

## Ce qui est supprimé / ne sert plus

- `lecture_et_envoi.py` et `readDataServer.py` (du dossier précédent) :
  **plus besoin**, tout est maintenant dans `main.cpp`, sur le même
  Raspberry que la caméra. Ne les lancez plus, ils feraient doublon.

## À vérifier avant de compiler

**Le numéro de broche GPIO de la LED** (`LED_GPIO_PIN` dans `config.h`,
actuellement 17) — je n'ai pas pu le confirmer avec certitude juste sur
la photo. Pour le vérifier vous-même :

```bash
pinout
```

Cette commande (normalement déjà installée sur Raspberry Pi OS) affiche
un schéma de tous les GPIO avec leur numéro. Comparez avec la broche
physique où le fil de la LED est branché sur votre carte, et ajustez
`LED_GPIO_PIN` si besoin.

**Le port série de l'Arduino** (`ARDUINO_PORT`, actuellement
`/dev/ttyACM0`) — vérifiez avec :
```bash
ls /dev/tty*
```
avant et après avoir branché l'Arduino, pour repérer lequel apparaît.

## Compilation et test

```bash
sudo apt install -y libopencv-dev libcurl4-openssl-dev libgpiod-dev
make
sudo ./capture
```

Testez chaque capteur un par un (appuyez sur le bouton, cachez la
photorésistance, faites un mouvement devant la caméra) : dans le
terminal, vous devez voir à chaque fois `main: événement détecté (...)`,
avec le bon nom de capteur entre parenthèses.
