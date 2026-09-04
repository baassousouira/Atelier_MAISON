#ifndef ARDUINO_H
#define ARDUINO_H
// Ce module gère la liaison série (USB) avec l'Arduino qui lit le bouton
// et la photorésistance. Il tourne DANS LE MÊME PROGRAMME que la caméra,
// puisque le bouton, la photorésistance ET la caméra sont maintenant
// sur le même Raspberry (Arduino relié en série, caméra en CSI, LED en GPIO).

#include <string>

// À appeler une seule fois au démarrage.
// port : ex "/dev/ttyACM0"  |  baudrate : ex 9600 (doit correspondre à
// Serial.begin(...) côté Arduino)
// Retourne true si le port a pu être ouvert.
bool arduino_init(const char *port, int baudrate);

// À appeler une seule fois avant de quitter le programme.
void arduino_cleanup();

// À appeler à CHAQUE tour de la boucle principale (ne bloque jamais :
// si aucune donnée n'est disponible, retourne immédiatement false).
// Si l'Arduino a envoyé un événement complet (une ligne JSON terminée),
// remplit capteur_out avec le nom du capteur ("bouton" ou
// "photoresistance") et retourne true.
bool arduino_lire_evenement(std::string &capteur_out);

#endif /* ARDUINO_H */
