// main.cpp
// -----------------------------------------------------------------------
// Programme principal du Raspberry : caméra fixe + bouton + photorésistance
// (via Arduino) + LED d'acquittement.
//
// IMPORTANT : les 3 capteurs sont INDÉPENDANTS les uns des autres. Une
// alerte caméra en cours de traitement ne bloque plus le bouton ou la
// photorésistance, et inversement — chacun a son propre "état" (struct
// SuiviCapteur ci-dessous), suivi séparément.
//
// Seule ressource partagée entre les 3 : l'unique LED physique. Règle
// retenue : si une alerte est confirmée "vraie" quelque part, la LED
// reste allumée tant qu'au moins une alerte réelle est active, même si
// un autre capteur reçoit entre-temps une "fausse alerte" (qui, dans ce
// cas, ne fait pas clignoter la LED pour ne pas l'éteindre par erreur).
// -----------------------------------------------------------------------

#include "./capture.h"
#include "./mouvement.h"
#include "./network.h"
#include "./gpio.h"
#include "./arduino.h"
#include "./config.h"

#include <opencv2/opencv.hpp>
#include <chrono>
#include <iostream>
#include <sstream>

// Pour réafficher les fenêtres de debug (PC avec écran) :
//     make CFLAGS="-Wall -DDEBUG_UI"

enum class EtatAlerte {
    NORMAL,               // surveillance active pour CE capteur
    EN_ATTENTE_DECISION,  // événement envoyé, on attend la réponse de l'app/du site
    EN_PAUSE               // décision traitée, pause avant de pouvoir redéclencher CE capteur
};

// Regroupe tout ce qu'il faut suivre pour UN capteur donné. Chaque
// capteur (caméra, bouton, photorésistance) a sa propre instance de
// cette structure, totalement indépendante des deux autres.
struct SuiviCapteur {
    EtatAlerte etat = EtatAlerte::NORMAL;
    std::string event_id;
    std::chrono::steady_clock::time_point debut_attente;
    std::chrono::steady_clock::time_point dernier_sondage;   // dernière fois qu'on a interrogé le serveur pour CE capteur
    std::chrono::steady_clock::time_point fin_pause;
    bool pause_suite_a_vraie_alerte = false;                  // pour savoir, à la fin de la pause, s'il faut décrémenter le compteur d'alertes réelles actives
};

int main() {
    // =====================================================================
    // INITIALISATION CAMÉRA (inchangé)
    // =====================================================================
    cv::VideoCapture cap;

    std::string pipeline =
        "libcamerasrc ! "
        "video/x-raw,width=640,height=480,format=RGB,framerate=30/1 ! "
        "videoconvert ! appsink";

    cap.open(pipeline, cv::CAP_GSTREAMER);
    open_capture(&cap);

    cv::Mat colorFrame(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC3);
    cv::Mat gray(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC1);
    cv::Mat motionMask(CAPTURE_HEIGHT, CAPTURE_WIDTH, CV_8UC1);

    MotionBuffer mb;
    motion_init(mb, 6, cv::Size(CAPTURE_WIDTH, CAPTURE_HEIGHT));
    int threshold_pixel = 20;

    // =====================================================================
    // INITIALISATION DES MODULES
    // =====================================================================
    if (!gpio_init()) {
        std::cerr << "main: échec initialisation GPIO, la LED ne fonctionnera pas" << std::endl;
    }
    network_init();

    if (!arduino_init(ARDUINO_PORT, ARDUINO_BAUDRATE)) {
        std::cerr << "main: échec liaison Arduino, seule la caméra sera active" << std::endl;
    }

#ifdef DEBUG_UI
    cv::namedWindow("capture", 1);
    cv::namedWindow("mouvement", 1);
    cv::createTrackbar("Seuil", "mouvement", &threshold_pixel, 200);
#endif

    // =====================================================================
    // UN SUIVI D'ÉTAT INDÉPENDANT PAR CAPTEUR
    // =====================================================================
    SuiviCapteur suivi_camera;
    SuiviCapteur suivi_bouton;
    SuiviCapteur suivi_photoresistance;

    int frames_mouvement_consecutifs = 0;

    // Compteur PARTAGÉ (contrairement au reste) : nombre d'alertes
    // actuellement confirmées "vraies", tous capteurs confondus. Tant
    // qu'il est > 0, la LED doit rester allumée quoi qu'il arrive par
    // ailleurs (fausse alerte sur un autre capteur = pas de clignotement).
    int alertes_reelles_actives = 0;

    auto t_prev = std::chrono::high_resolution_clock::now();

    // =====================================================================
    // FONCTION RÉUTILISÉE POUR LES 3 CAPTEURS (évite de tripler le code)
    // =====================================================================
    // "declenchement" : true si CE capteur vient de détecter quelque
    // chose de nouveau à CE tour de boucle (calculé avant l'appel).
    auto traiter_capteur = [&](SuiviCapteur &s, const std::string &nom, bool declenchement) {

        switch (s.etat) {

        case EtatAlerte::NORMAL: {
            if (!declenchement) break;

            std::cout << "main: événement détecté (" << nom << "), envoi au serveur" << std::endl;

            if (send_alert_event(nom, ZONE_NAME, s.event_id)) {
                s.etat = EtatAlerte::EN_ATTENTE_DECISION;
                s.debut_attente = std::chrono::steady_clock::now();
                s.dernier_sondage = s.debut_attente;

                // Capture de l'image caméra ACTUELLE, quel que soit le
                // capteur à l'origine (la caméra tourne en continu ici)
                std::vector<uchar> donnees_jpeg;
                cv::imencode(".jpg", colorFrame, donnees_jpeg);
                if (!send_snapshot(s.event_id, donnees_jpeg)) {
                    std::cerr << "main: (" << nom << ") échec envoi capture (alerte valide sans image)" << std::endl;
                }
            } else {
                std::cerr << "main: (" << nom << ") échec envoi événement, nouvelle tentative au prochain déclenchement" << std::endl;
            }
            break;
        }

        case EtatAlerte::EN_ATTENTE_DECISION: {
            auto maintenant = std::chrono::steady_clock::now();

            auto attente_ecoulee = std::chrono::duration_cast<std::chrono::seconds>(
                maintenant - s.debut_attente).count();

            if (attente_ecoulee >= POLL_TIMEOUT_SECONDS) {
                std::cerr << "main: (" << nom << ") personne n'a répondu à temps, on repart en surveillance" << std::endl;
                s.etat = EtatAlerte::NORMAL;
                break;
            }

            // On ne sonde le serveur qu'une fois par POLL_INTERVAL_MS,
            // SANS AUCUN sleep() ici : un sleep bloquerait la caméra ET
            // les 2 autres capteurs pendant ce temps, ce qu'on veut
            // justement éviter.
            auto depuis_dernier_sondage = std::chrono::duration_cast<std::chrono::milliseconds>(
                maintenant - s.dernier_sondage).count();

            if (depuis_dernier_sondage < POLL_INTERVAL_MS) break;
            s.dernier_sondage = maintenant;

            std::string decision = poll_decision(s.event_id);

            if (decision == "fausse_alerte") {
                if (alertes_reelles_actives == 0) {
                    std::cout << "main: (" << nom << ") fausse alerte confirmée, la LED clignote une fois" << std::endl;
                    led_blink_once(300);
                } else {
                    std::cout << "main: (" << nom << ") fausse alerte confirmée, mais LED maintenue allumée (alerte réelle en cours ailleurs)" << std::endl;
                }
                s.pause_suite_a_vraie_alerte = false;
                s.etat = EtatAlerte::EN_PAUSE;
                s.fin_pause = maintenant + std::chrono::seconds(ALERT_COOLDOWN_SECONDS);

            } else if (decision == "vraie_alerte") {
                std::cout << "main: (" << nom << ") alerte confirmée comme réelle, la LED reste allumée" << std::endl;
                led_on();
                alertes_reelles_actives++;
                s.pause_suite_a_vraie_alerte = true;
                s.etat = EtatAlerte::EN_PAUSE;
                s.fin_pause = maintenant + std::chrono::seconds(ALERT_COOLDOWN_SECONDS);

            } else if (decision == "erreur") {
                std::cerr << "main: (" << nom << ") erreur réseau pendant l'attente de décision, nouvel essai..." << std::endl;
            }
            // "en_attente" : rien à faire, on retentera au prochain sondage
            break;
        }

        case EtatAlerte::EN_PAUSE:
            if (std::chrono::steady_clock::now() >= s.fin_pause) {
                if (s.pause_suite_a_vraie_alerte) {
                    alertes_reelles_actives--;
                    if (alertes_reelles_actives <= 0) {
                        alertes_reelles_actives = 0;
                        led_off();
                        std::cout << "main: (" << nom << ") fin de pause, plus aucune alerte réelle active, LED éteinte" << std::endl;
                    } else {
                        std::cout << "main: (" << nom << ") fin de pause (LED maintenue allumée par une autre alerte réelle en cours)" << std::endl;
                    }
                } else {
                    std::cout << "main: (" << nom << ") fin de pause, détection réarmée" << std::endl;
                }
                s.etat = EtatAlerte::NORMAL;
            }
            break;
        }
    };

    // =====================================================================
    // BOUCLE PRINCIPALE
    // =====================================================================
    while (true) {

        capture_frame(&cap, &colorFrame);
        RGBtoBW(&colorFrame, &gray);

        motion_push_gray(mb, gray);
        bool masque_valide = motion_compute_mask(mb, motionMask, threshold_pixel);

        cv::Point centroid = compute_centroid_keep_last(motionMask, mb);
        cv::Scalar meanRGB = compute_mean_rgb_keep_last(colorFrame, motionMask, mb);
        draw_cross(colorFrame, centroid, cv::Scalar(0, 255, 0));

        int surface_mouvement = cv::countNonZero(motionMask);

        // --- Détection caméra : on ne fait avancer le compteur que si ce
        // capteur est bien en surveillance normale (sinon ça n'a pas de
        // sens d'accumuler pendant qu'une alerte caméra est déjà en cours) ---
        bool declenchement_camera = false;
        if (suivi_camera.etat == EtatAlerte::NORMAL) {
            if (masque_valide && surface_mouvement >= MOTION_AREA_MIN) {
                frames_mouvement_consecutifs++;
            } else {
                frames_mouvement_consecutifs = 0;
            }
            if (frames_mouvement_consecutifs >= CONSECUTIVE_FRAMES_TRIGGER) {
                declenchement_camera = true;
                frames_mouvement_consecutifs = 0;
            }
        } else {
            frames_mouvement_consecutifs = 0;
        }

        // --- Lecture Arduino (jamais bloquante) ---
        std::string capteur_arduino;
        bool evenement_arduino = arduino_lire_evenement(capteur_arduino);

        bool declenchement_bouton = false;
        bool declenchement_photoresistance = false;

        if (evenement_arduino) {
            if (capteur_arduino == "bouton") {
                if (suivi_bouton.etat == EtatAlerte::NORMAL) {
                    declenchement_bouton = true;
                } else {
                    std::cout << "[arduino] événement (bouton) reçu mais ignoré : ce capteur a déjà une alerte en cours" << std::endl;
                }
            } else if (capteur_arduino == "photoresistance") {
                if (suivi_photoresistance.etat == EtatAlerte::NORMAL) {
                    declenchement_photoresistance = true;
                } else {
                    std::cout << "[arduino] événement (photoresistance) reçu mais ignoré : ce capteur a déjà une alerte en cours" << std::endl;
                }
            }
        }

        // --- Les 3 capteurs sont traités INDÉPENDAMMENT : aucun ne
        // bloque les 2 autres ---
        traiter_capteur(suivi_camera, CAPTEUR_NAME_CAMERA, declenchement_camera);
        traiter_capteur(suivi_bouton, "bouton", declenchement_bouton);
        traiter_capteur(suivi_photoresistance, "photoresistance", declenchement_photoresistance);

#ifdef DEBUG_UI
        auto t_now = std::chrono::high_resolution_clock::now();
        double dt = std::chrono::duration_cast<std::chrono::microseconds>(t_now - t_prev).count() / 1e6;
        if (dt <= 0) dt = 1e-6;
        double fps = 1.0 / dt;
        t_prev = t_now;

        std::ostringstream oss_info;
        oss_info << "FPS: " << int(fps)
                  << "  cam:" << int(suivi_camera.etat)
                  << " bouton:" << int(suivi_bouton.etat)
                  << " photo:" << int(suivi_photoresistance.etat);
        cv::putText(colorFrame, oss_info.str(), cv::Point(10, 60),
                    cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(255, 255, 0), 2);

        cv::imshow("capture", colorFrame);
        cv::imshow("mouvement", motionMask);

        if (cv::waitKey(1) >= 0)
            break;
#endif
    }

    gpio_cleanup();
    network_cleanup();
    arduino_cleanup();
    cap.release();
#ifdef DEBUG_UI
    cv::destroyAllWindows();
#endif

    return 0;
}
