// api_locale.cpp
// -----------------------------------------------------------------------
// Implémente les routes exigées par ROUTES_LOCALES_A_IMPLEMENTER.md :
//   PUT  /system                         -> armer/désarmer la surveillance
//   PUT  /components/{name}/enabled      -> activer/désactiver un composant
//   GET  /camera/stream?name=camera      -> flux vidéo MJPEG
//   POST /camera/screenshot?name=camera  -> capture ponctuelle JPEG
//
// Ce Raspberry est le "fixe" (caméra + photorésistance + bouton + LED,
// pas de servo) : la route POST /robot/command, réservée au Raspberry
// mobile, n'est PAS implémentée ici.
//
// httplib (bibliothèque "header-only", un seul fichier httplib.h, aucune
// dépendance à installer) gère son serveur dans ses propres threads
// internes. On le lance depuis un std::thread séparé pour ne jamais
// bloquer la boucle principale (caméra + capteurs), qui continue de
// tourner en parallèle, dans le thread principal du programme.
// -----------------------------------------------------------------------

#include "api_locale.h"
#include "shared_state.h"

#include "httplib.h"

#include <iostream>
#include <thread>
#include <chrono>
#include <string>

// -------------------------------------------------------------------
// Petite fonction utilitaire : extrait un booléen d'un corps JSON simple
// du type {"armed":true} ou {"enabled":false}. Même principe "fait
// maison" que dans network.cpp/arduino.cpp, pour rester cohérent et ne
// pas ajouter de dépendance supplémentaire juste pour ça.
// -------------------------------------------------------------------
static bool extraire_bool_json(const std::string &corps, const std::string &champ, bool valeur_par_defaut) {
    std::string cle = "\"" + champ + "\"";
    size_t pos = corps.find(cle);
    if (pos == std::string::npos) return valeur_par_defaut;

    pos = corps.find(':', pos);
    if (pos == std::string::npos) return valeur_par_defaut;
    pos++;

    while (pos < corps.size() && corps[pos] == ' ') pos++;

    // On regarde si les 4 prochains caractères sont "true"
    return corps.compare(pos, 4, "true") == 0;
}

void demarrer_api_locale() {

    std::thread([]() {
        httplib::Server serveur;

        // -----------------------------------------------------------
        // PUT /system  { "armed": true|false }
        // -----------------------------------------------------------
        serveur.Put("/system", [](const httplib::Request &req, httplib::Response &res) {
            bool nouvel_etat = extraire_bool_json(req.body, "armed", etat_armed.load());
            etat_armed = nouvel_etat;

            std::cout << "[api-locale] PUT /system -> armed = "
                       << (nouvel_etat ? "true" : "false") << std::endl;

            res.set_content("{\"ok\":true}", "application/json");
        });

        // -----------------------------------------------------------
        // PUT /components/{name}/enabled  { "enabled": true|false }
        // -----------------------------------------------------------
        serveur.Put(R"(/components/([a-zA-Z_]+)/enabled)",
            [](const httplib::Request &req, httplib::Response &res) {

                std::string nom = req.matches[1];
                bool valeur = extraire_bool_json(req.body, "enabled", true);

                if (nom == "camera") {
                    etat_camera_enabled = valeur;
                } else if (nom == "photoresistance") {
                    etat_photoresistance_enabled = valeur;
                } else if (nom == "button") {
                    etat_button_enabled = valeur;
                } else if (nom == "led") {
                    etat_led_enabled = valeur;
                } else {
                    // Composant inconnu sur ce Raspberry : 404 comme demandé
                    res.status = 404;
                    res.set_content("{\"detail\":\"composant inconnu\"}", "application/json");
                    return;
                }

                std::cout << "[api-locale] PUT /components/" << nom << "/enabled -> "
                           << (valeur ? "true" : "false") << std::endl;

                res.set_content("{\"ok\":true}", "application/json");
            }
        );

        // -----------------------------------------------------------
        // POST /camera/screenshot?name=camera
        // -----------------------------------------------------------
        serveur.Post("/camera/screenshot", [](const httplib::Request & /*req*/, httplib::Response &res) {
            std::vector<unsigned char> image = lire_derniere_image();

            if (image.empty()) {
                // Cas rare : appelé avant que la première image n'ait été
                // capturée (juste au démarrage du programme)
                res.status = 503;
                res.set_content("{\"detail\":\"pas encore d'image disponible\"}", "application/json");
                return;
            }

            res.set_content(reinterpret_cast<const char *>(image.data()), image.size(), "image/jpeg");
        });

        // -----------------------------------------------------------
        // GET /camera/stream?name=camera  (flux vidéo au format MJPEG)
        // -----------------------------------------------------------
        serveur.Get("/camera/stream", [](const httplib::Request & /*req*/, httplib::Response &res) {
            res.set_chunked_content_provider(
                "multipart/x-mixed-replace; boundary=frame",
                [](size_t /*offset*/, httplib::DataSink &sink) {

                    // Tant que le client (le serveur central, qui relaie à
                    // React) reste connecté, on lui envoie la dernière
                    // image connue, encadrée par le "boundary" attendu par
                    // le format MJPEG standard.
                    while (sink.is_writable()) {
                        std::vector<unsigned char> image = lire_derniere_image();

                        if (!image.empty()) {
                            std::string entete =
                                "--frame\r\n"
                                "Content-Type: image/jpeg\r\n"
                                "Content-Length: " + std::to_string(image.size()) + "\r\n\r\n";

                            if (!sink.write(entete.data(), entete.size())) break;
                            if (!sink.write(reinterpret_cast<const char *>(image.data()), image.size())) break;
                            if (!sink.write("\r\n", 2)) break;
                        }

                        // ~10 images/seconde pour le flux : largement
                        // suffisant pour de la surveillance, et ça évite
                        // de saturer le réseau/le CPU pour rien.
                        std::this_thread::sleep_for(std::chrono::milliseconds(100));
                    }

                    return true;
                }
            );
        });

        std::cout << "[api-locale] serveur HTTP local démarré sur le port 8001" << std::endl;

        if (!serveur.listen("0.0.0.0", 8001)) {
            std::cerr << "[api-locale] échec du démarrage du serveur local sur le port 8001"
                       << " (déjà utilisé par un autre programme ?)" << std::endl;
        }

    }).detach(); // le thread tourne en arrière-plan pour toute la durée du programme
}
