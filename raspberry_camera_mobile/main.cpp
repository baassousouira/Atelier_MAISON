// main.cpp — Raspberry MOBILE : caméra activable/désactivable à distance
// -----------------------------------------------------------------------
// Volontairement simple : pas de détection de mouvement, pas d'Arduino,
// pas de LED, pas d'alertes. Juste une caméra que l'app peut allumer/
// éteindre (via le serveur central -> PUT /components/camera/enabled sur
// ce Raspberry, port 8001), avec un flux vidéo et une capture à la demande.
//
// Le déplacement du robot (servo/moteurs) est un sujet séparé : la route
// /robot/command existe déjà (api_locale.cpp) mais reste à relier au vrai
// code de pilotage.
// -----------------------------------------------------------------------

#include "./capture.h"
#include "./network.h"
#include "./shared_state.h"
#include "./api_locale.h"
#include "./config.h"

#include <opencv2/opencv.hpp>
#include <chrono>
#include <iostream>

int main() {

    // =====================================================================
    // CAMÉRA (mêmes primitives que sur le Raspberry fixe, cf. capture.cpp)
    // =====================================================================
    cv::VideoCapture cap;

    std::string pipeline =
        "libcamerasrc ! "
        "video/x-raw,width=640,height=480,format=RGB,framerate=30/1 ! "
        "videoconvert ! appsink";

    cap.open(pipeline, cv::CAP_GSTREAMER);
    open_capture(&cap);

    cv::Mat colorFrame(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC3);

    // =====================================================================
    // RÉSEAU + SERVEUR LOCAL
    // =====================================================================
    network_init();

    // Tourne en arrière-plan dans son propre thread, ne bloque jamais la
    // capture caméra ci-dessous.
    demarrer_api_locale();

    std::cout << "main: caméra mobile prête, pilotable depuis l'app (port 8001)" << std::endl;

    auto dernier_heartbeat = std::chrono::steady_clock::now() - std::chrono::seconds(HEARTBEAT_INTERVAL_SECONDS);
    auto dernier_sondage_armed = std::chrono::steady_clock::now() - std::chrono::seconds(ARMED_POLL_INTERVAL_SECONDS);

    // =====================================================================
    // BOUCLE PRINCIPALE
    // =====================================================================
    while (true) {

        capture_frame(&cap, &colorFrame);

        // On garde le capteur physique allumé en continu (rouvrir la
        // caméra à chaque bascule serait plus lent et plus fragile), mais
        // on n'expose l'image QUE si "camera" est activé : /camera/stream
        // et /camera/screenshot refusent de servir une image tant que
        // c'est désactivé (voir api_locale.cpp) — c'est ça qui donne
        // l'effet "caméra éteinte" côté app.
        if (etat_camera_enabled.load()) {
            std::vector<uchar> jpeg_courant;
            cv::imencode(".jpg", colorFrame, jpeg_courant);
            definir_derniere_image(jpeg_courant);
        }

        auto maintenant = std::chrono::steady_clock::now();

        // --- Heartbeat : TOUJOURS envoyé, même caméra désactivée ---
        auto depuis_dernier_heartbeat = std::chrono::duration_cast<std::chrono::seconds>(
            maintenant - dernier_heartbeat).count();

        if (depuis_dernier_heartbeat >= HEARTBEAT_INTERVAL_SECONDS) {
            dernier_heartbeat = maintenant;

            std::vector<EtatComposant> composants;
            composants.push_back({"camera", etat_camera_enabled.load(), false, 0.0f});
            composants.push_back({"servo", etat_servo_enabled.load(), false, 0.0f});

            if (!send_heartbeat(A_UN_SERVO, composants)) {
                std::cerr << "main: échec envoi heartbeat" << std::endl;
            }
        }

        // --- Sondage de secours de "armed" ---
        auto depuis_dernier_sondage = std::chrono::duration_cast<std::chrono::seconds>(
            maintenant - dernier_sondage_armed).count();

        if (depuis_dernier_sondage >= ARMED_POLL_INTERVAL_SECONDS) {
            dernier_sondage_armed = maintenant;
            bool nouvel_etat;
            if (lire_etat_armed(nouvel_etat)) {
                etat_armed = nouvel_etat;
            }
        }
    }

    network_cleanup();
    cap.release();
    return 0;
}
