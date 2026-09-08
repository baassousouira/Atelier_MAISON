// camera_server_mobile.cpp
// -----------------------------------------------------------------------
// RASPBERRY MOBILE - SERVEUR CAMERA SAFEPLACE
// -----------------------------------------------------------------------
//
// Ce programme est indépendant du programme Python de déplacement.
//
// Python :
//   - GET /api/robot/command vers le serveur central ;
//   - pilote les servomoteurs ;
//   - envoie le heartbeat.
//
// Ce programme C++ :
//   - ouvre la caméra ;
//   - maintient la dernière frame JPEG ;
//   - expose sur le port 8001 :
//       GET  /health
//       GET  /camera/stream
//       POST /camera/screenshot
//       PUT  /components/camera/enabled
//
// Le serveur central FastAPI reste l'unique API utilisée par React.
// -----------------------------------------------------------------------

#include "camera_module.h"
#include "httplib.h"

#include <atomic>
#include <chrono>
#include <csignal>
#include <iostream>
#include <string>
#include <thread>

namespace {

std::atomic<bool> continuer{true};

void gerer_signal(int) {
    continuer = false;
}

std::string bool_json(bool value) {
    return value ? "true" : "false";
}

} // namespace

int main() {
    std::signal(SIGINT, gerer_signal);
    std::signal(SIGTERM, gerer_signal);

    if (!camera_module::camera_ouvrir()) {
        std::cerr
            << "[Camera mobile] impossible d'ouvrir la caméra"
            << std::endl;
        return 1;
    }

    // La capture doit tourner indépendamment des requêtes HTTP.
    std::thread capture_thread([]() {
        while (continuer.load()) {
            camera_module::camera_boucle();
            std::this_thread::sleep_for(
                std::chrono::milliseconds(30)
            );
        }
    });

    httplib::Server serveur;

    // ------------------------------------------------------------------
    // HEALTH
    // ------------------------------------------------------------------
    serveur.Get("/health", [](const httplib::Request &, httplib::Response &res) {
        const bool enabled = camera_module::camera_est_activee();
        const bool has_frame = !camera_module::camera_derniere_image().empty();

        const std::string json =
            std::string("{")
            + "\"ok\":true,"
            + "\"controllerType\":\"MOBILE\","
            + "\"cameraEnabled\":" + bool_json(enabled) + ","
            + "\"hasFrame\":" + bool_json(has_frame)
            + "}";

        res.set_content(json, "application/json");
    });

    // ------------------------------------------------------------------
    // ACTIVER / DESACTIVER LA CAMERA
    // ------------------------------------------------------------------
    serveur.Put(
        "/components/camera/enabled",
        [](const httplib::Request &req, httplib::Response &res) {
            const bool enabled = camera_module::extraire_bool_json(
                req.body,
                "enabled",
                true
            );

            camera_module::camera_definir_activee(enabled);

            const std::string json =
                std::string("{\"ok\":true,\"enabled\":")
                + bool_json(enabled)
                + "}";

            res.set_content(json, "application/json");
        }
    );

    // ------------------------------------------------------------------
    // SCREENSHOT
    // ------------------------------------------------------------------
    serveur.Post(
        "/camera/screenshot",
        [](const httplib::Request &, httplib::Response &res) {
            const auto image = camera_module::camera_derniere_image();

            if (image.empty()) {
                res.status = 503;
                res.set_content(
                    "{\"detail\":\"caméra désactivée ou aucune image disponible\"}",
                    "application/json"
                );
                return;
            }

            res.set_content(
                reinterpret_cast<const char *>(image.data()),
                image.size(),
                "image/jpeg"
            );
        }
    );

    // ------------------------------------------------------------------
    // FLUX MJPEG
    // ------------------------------------------------------------------
    serveur.Get(
        "/camera/stream",
        [](const httplib::Request &, httplib::Response &res) {
            if (!camera_module::camera_est_activee()) {
                res.status = 409;
                res.set_content(
                    "{\"detail\":\"caméra désactivée\"}",
                    "application/json"
                );
                return;
            }

            res.set_chunked_content_provider(
                "multipart/x-mixed-replace; boundary=frame",
                [](size_t, httplib::DataSink &sink) {
                    while (
                        continuer.load()
                        && sink.is_writable()
                    ) {
                        const auto image =
                            camera_module::camera_derniere_image();

                        if (!image.empty()) {
                            const std::string header =
                                "--frame\r\n"
                                "Content-Type: image/jpeg\r\n"
                                "Content-Length: "
                                + std::to_string(image.size())
                                + "\r\n\r\n";

                            if (!sink.write(header.data(), header.size())) {
                                break;
                            }

                            if (!sink.write(
                                reinterpret_cast<const char *>(image.data()),
                                image.size()
                            )) {
                                break;
                            }

                            if (!sink.write("\r\n", 2)) {
                                break;
                            }
                        }

                        std::this_thread::sleep_for(
                            std::chrono::milliseconds(100)
                        );
                    }

                    return true;
                }
            );
        }
    );

    std::cout
        << "[Camera mobile] serveur actif sur 0.0.0.0:8001"
        << std::endl;

    // listen() est bloquant : le thread de capture continue en parallèle.
    serveur.listen("0.0.0.0", 8001);

    continuer = false;

    if (capture_thread.joinable()) {
        capture_thread.join();
    }

    camera_module::camera_fermer();

    std::cout
        << "[Camera mobile] arrêt propre"
        << std::endl;

    return 0;
}
