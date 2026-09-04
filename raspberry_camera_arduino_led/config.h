#ifndef CONFIG_H
#define CONFIG_H
// Ce fichier regroupe TOUS les réglages du programme.
// L'intérêt : si une IP ou un réglage change, on ne modifie qu'ici,
// pas besoin de fouiller dans tout le code.

// ----------------------------------------------------------------------
// RÉSEAU
// ----------------------------------------------------------------------
// Adresse IP + port du serveur Python (FastAPI) sur le réseau local.
// D'après votre schéma : Raspberry caméra = 192.168.1.4, Serveur = 192.168.1.1
// C'est donc VERS cette adresse que ce Raspberry va envoyer ses événements.
#define SERVER_BASE_URL "http://192.168.1.1:8000"

// ----------------------------------------------------------------------
// IDENTITÉ DES CAPTEURS DE CE RASPBERRY
// ----------------------------------------------------------------------
// Ce Raspberry gère maintenant TROIS capteurs à la fois : la caméra
// (détection de mouvement par image), et le bouton + la photorésistance
// lus par l'Arduino relié en série. Les trois partagent la même LED
// d'acquittement et la même zone.
#define CAPTEUR_NAME_CAMERA "camera_fixe"
// (les noms "bouton" et "photoresistance" viennent directement de
// l'Arduino dans le JSON qu'il envoie, pas besoin de les redéfinir ici)
#define ZONE_NAME    "salon"          // pièce/zone surveillée par ce Raspberry (à adapter à votre maquette)

// ----------------------------------------------------------------------
// LIAISON SÉRIE AVEC L'ARDUINO (bouton + photorésistance)
// ----------------------------------------------------------------------
// Port sur lequel l'Arduino apparaît une fois branché en USB.
// Vérifiez avec "ls /dev/tty*" avant/après avoir branché l'Arduino pour
// voir lequel apparaît (souvent /dev/ttyACM0, parfois /dev/ttyUSB0).
#define ARDUINO_PORT "/dev/ttyACM0"
#define ARDUINO_BAUDRATE 9600   // doit correspondre à Serial.begin(9600) dans le .ino

// ----------------------------------------------------------------------
// GPIO (LED d'acquittement)
// ----------------------------------------------------------------------
// GPIO_CHIP : chemin du périphérique GPIO du Raspberry (avec libgpiod v2,
// il faut le CHEMIN complet, pas juste le nom -> quasi toujours "/dev/gpiochip0")
// LED_GPIO_PIN : numéro de broche en numérotation BCM (PAS le numéro physique
// de la broche sur la carte -> à vérifier avec un plan de brochage Raspberry Pi 4)
#define GPIO_CHIP    "/dev/gpiochip0"
#define LED_GPIO_PIN 17

// ----------------------------------------------------------------------
// LOGIQUE DE DÉTECTION
// ----------------------------------------------------------------------
// Nombre d'images CONSÉCUTIVES avec un mouvement suffisant avant de considérer
// que c'est une vraie détection (et pas juste un pixel qui a bougé/du bruit).
// Avec ~30 images/seconde, 5 images ~= 1/6 de seconde de mouvement continu.
#define CONSECUTIVE_FRAMES_TRIGGER 5

// Une fois l'alerte envoyée, le programme "interroge" le serveur toutes les
// POLL_INTERVAL_MS millisecondes pour savoir si l'utilisateur a répondu
// (fausse alerte / vraie alerte) sur l'app ou le site web.
#define POLL_INTERVAL_MS 1000

// Si personne ne répond dans ce délai (en secondes), on abandonne l'attente
// et on repart en surveillance normale (pour ne pas rester bloqué indéfiniment).
#define POLL_TIMEOUT_SECONDS 30

// Après avoir traité une alerte (fausse ou vraie), on met la détection en
// pause pendant ce temps (en secondes) avant de pouvoir en redéclencher une
// nouvelle. Ça évite de spammer le serveur si le mouvement continue.
#define ALERT_COOLDOWN_SECONDS 15

#endif /* CONFIG_H */
