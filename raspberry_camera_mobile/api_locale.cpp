// api_locale.cpp
// -----------------------------------------------------------------------
// Routes locales (port 8001) pour le Raspberry MOBILE, d'après
// ROUTES_LOCALES_A_IMPLEMENTER.md :
//   PUT  /system                    -> armer/désarmer
//   PUT  /components/{name}/enabled -> activer/désactiver "camera" ou "servo"
//   GET  /camera/stream              -> flux vidéo MJPEG
//   POST /camera/screenshot          -> capture ponctuelle JPEG
//   POST /robot/command              -> déplacement du robot (réservé,
//                                        à brancher sur le vrai code servo)
// -----------------------------------------------------------------------

#include "api_locale.h"
#include "shared_state.h"

#include "httplib.h"

#include <iostream>
#include <thread>
#include <chrono>
#include <string>

static bool extraire_bool_json(const std::string &corps, const std::string &champ, bool valeur_par_defaut) {
    std::string cle = "\"" + champ + "\"";
    size_t pos = corps.find(cle);
    if (pos == std::string::npos) return valeur_par_defaut;
    pos = corps.find(':', pos);
    if (pos == std::string::npos) return valeur_par_defaut;
    pos++;
    while (pos < corps.size() && corps[pos] == ' ') pos++;
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
                } else if (nom == "servo") {
                    etat_servo_enabled = valeur;
                } else {
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

            if (!etat_camera_enabled.load()) {
                res.status = 503;
                res.set_content("{\"detail\":\"caméra désactivée\"}", "application/json");
                return;
            }

            std::vector<unsigned char> image = lire_derniere_image();

            if (image.empty()) {
                res.status = 503;
                res.set_content("{\"detail\":\"pas encore d'image disponible\"}", "application/json");
                return;
            }

            res.set_content(reinterpret_cast<const char *>(image.data()), image.size(), "image/jpeg");
        });

        // -----------------------------------------------------------
        // GET /camera/stream?name=camera  (flux MJPEG)
        // -----------------------------------------------------------
        serveur.Get("/camera/stream", [](const httplib::Request & /*req*/, httplib::Response &res) {

            if (!etat_camera_enabled.load()) {
                res.status = 503;
                res.set_content("{\"detail\":\"caméra désactivée\"}", "application/json");
                return;
            }

            res.set_chunked_content_provider(
                "multipart/x-mixed-replace; boundary=frame",
                [](size_t /*offset*/, httplib::DataSink &sink) {
                    while (sink.is_writable()) {

                        // Si la caméra est désactivée EN COURS DE STREAM,
                        // on arrête proprement plutôt que de continuer à
                        // envoyer une image figée indéfiniment.
                        if (!etat_camera_enabled.load()) break;

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

                        std::this_thread::sleep_for(std::chrono::milliseconds(100));
                    }
                    return true;
                }
            );
        });

        // -----------------------------------------------------------
        // POST /robot/command  { "command": "...", "speed": ... }
        // -----------------------------------------------------------
        // RÉSERVÉ : la route existe (pour ne pas renvoyer "connexion
        // refusée" si l'app l'appelle), mais elle n'est pas encore reliée
        // au vrai pilotage du servo/moteur. À compléter avec le code de
        // votre camarade dès qu'il est prêt à être appelé en fonction, et
        // pas seulement en script interactif (input()).
        serveur.Post("/robot/command", [](const httplib::Request & /*req*/, httplib::Response &res) {
            std::cout << "[api-locale] POST /robot/command reçu, mais pas encore branché au pilotage réel" << std::endl;
            res.status = 501; // "Not Implemented"
            res.set_content("{\"detail\":\"pilotage du robot pas encore branché sur cette route\"}", "application/json");
        });

        std::cout << "[api-locale] serveur HTTP local démarré sur le port 8001" << std::endl;

        if (!serveur.listen("0.0.0.0", 8001)) {
            std::cerr << "[api-locale] échec du démarrage du serveur local sur le port 8001" << std::endl;
        }

    }).detach();
}
