#ifndef CAMERA_MODULE_H
#define CAMERA_MODULE_H
// ============================================================================
// camera_module.h — Module de contrôle de la caméra (allumer / éteindre)
// ============================================================================
// À inclure UNE SEULE FOIS, dans un seul .cpp de ton programme (celui qui a
// la boucle principale du robot).
//
// Ce fichier s'occupe de :
//   - ouvrir la caméra
//   - capturer les images en continu (une fonction à appeler à chaque tour
//     de TA boucle principale, elle ne bloque jamais rien d'autre)
//   - activer/désactiver la caméra ("allumer"/"éteindre")
//   - fournir les données au format JSON attendu par le contrat défini dans
//     ROUTES_LOCALES_A_IMPLEMENTER.md et README_A_DONNER_AUX_CAMARADES.md
//
// Il n'ouvre PAS son propre serveur HTTP : pour éviter tout conflit avec le
// serveur que tu as déjà (port 8001, pour /robot/command etc.), tu branches
// toi-même ces fonctions dans TES routes existantes — exemples tout en bas.
// ============================================================================

#include <opencv2/opencv.hpp>
#include <mutex>
#include <atomic>
#include <vector>
#include <string>
#include <iostream>

namespace camera_module {

// --- État interne (ne pas toucher directement depuis l'extérieur) ---
static cv::VideoCapture camera_capture_interne;
static cv::Mat camera_derniere_frame_brute;
static std::atomic<bool> camera_activee{true};   // "enabled" : allumée par défaut
static std::mutex camera_mutex_image;
static std::vector<unsigned char> camera_derniere_image_jpeg_interne;

// ----------------------------------------------------------------------
// À appeler UNE FOIS au démarrage de ton programme.
// Retourne false si la caméra n'a pas pu être ouverte.
// ----------------------------------------------------------------------
inline bool camera_ouvrir() {
    std::string pipeline =
        "libcamerasrc ! "
        "video/x-raw,width=640,height=480,format=RGB,framerate=30/1 ! "
        "videoconvert ! appsink";

    camera_capture_interne.open(pipeline, cv::CAP_GSTREAMER);

    if (!camera_capture_interne.isOpened()) {
        std::cerr << "camera_module: impossible d'ouvrir la caméra" << std::endl;
        return false;
    }

    return true;
}

// ----------------------------------------------------------------------
// À appeler UNE FOIS avant de quitter ton programme.
// ----------------------------------------------------------------------
inline void camera_fermer() {
    camera_capture_interne.release();
}

// ----------------------------------------------------------------------
// À appeler À CHAQUE TOUR de ta boucle principale (ne bloque jamais).
// Capture une image ; si la caméra est "allumée", met à jour la dernière
// image disponible (utilisée ensuite par tes routes /camera/...).
// Si la caméra est "éteinte", on continue de lire le capteur physique
// (pour ne pas avoir à le rouvrir à chaque bascule, plus lent et plus
// fragile) mais on n'expose plus d'image récente aux routes HTTP.
// ----------------------------------------------------------------------
inline void camera_boucle() {
    if (!camera_capture_interne.read(camera_derniere_frame_brute)) {
        return; // lecture échouée ce tour-ci, on retentera au prochain
    }

    if (!camera_activee.load()) {
        return; // caméra "éteinte" : on ne met pas à jour l'image exposée
    }

    std::vector<unsigned char> jpeg;
    cv::imencode(".jpg", camera_derniere_frame_brute, jpeg);

    std::lock_guard<std::mutex> verrou(camera_mutex_image);
    camera_derniere_image_jpeg_interne = std::move(jpeg);
}

// ----------------------------------------------------------------------
// Active ou désactive la caméra ("allumer"/"éteindre").
// À appeler depuis ta route PUT /components/camera/enabled, après avoir
// lu le champ "enabled" du corps JSON reçu (voir extraire_bool_json plus bas).
// ----------------------------------------------------------------------
inline void camera_definir_activee(bool activee) {
    camera_activee = activee;
    std::cout << "camera_module: caméra " << (activee ? "ALLUMÉE" : "ÉTEINTE") << std::endl;
}

inline bool camera_est_activee() {
    return camera_activee.load();
}

// ----------------------------------------------------------------------
// Retourne une COPIE de la dernière image JPEG connue (vide si la caméra
// est éteinte ou si aucune image n'a encore été capturée).
// À utiliser dans tes routes GET /camera/stream et POST /camera/screenshot.
// ----------------------------------------------------------------------
inline std::vector<unsigned char> camera_derniere_image() {
    std::lock_guard<std::mutex> verrou(camera_mutex_image);
    return camera_derniere_image_jpeg_interne;
}

// ----------------------------------------------------------------------
// Construit le morceau JSON à inclure dans le tableau "components" du
// heartbeat, exactement au format attendu :
//   {"name":"camera","enabled":true}
// ----------------------------------------------------------------------
inline std::string camera_composant_json() {
    return std::string("{\"name\":\"camera\",\"enabled\":") +
           (camera_activee.load() ? "true" : "false") + "}";
}

// ----------------------------------------------------------------------
// Extrait un booléen d'un corps JSON simple, ex: {"enabled":false} ou
// {"armed":true}. Utilitaire pour lire ce que le serveur central envoie
// sur PUT /components/camera/enabled (ou PUT /system si besoin).
// ----------------------------------------------------------------------
inline bool extraire_bool_json(const std::string &corps, const std::string &champ, bool valeur_par_defaut) {
    std::string cle = "\"" + champ + "\"";
    size_t pos = corps.find(cle);
    if (pos == std::string::npos) return valeur_par_defaut;

    pos = corps.find(':', pos);
    if (pos == std::string::npos) return valeur_par_defaut;
    pos++;

    while (pos < corps.size() && corps[pos] == ' ') pos++;

    return corps.compare(pos, 4, "true") == 0;
}

} // namespace camera_module


// ============================================================================
// EXEMPLES D'INTÉGRATION — à copier dans TON code, pas du code actif ici.
// (exemples donnés avec httplib, adapte selon ton propre serveur HTTP)
// ============================================================================
/*

// --- Dans ta boucle principale (main.cpp) ---
camera_module::camera_ouvrir();
while (true) {
    camera_module::camera_boucle();
    // ... le reste de ta boucle (pilotage moteurs, etc.) ...
}
camera_module::camera_fermer();


// --- Ta route PUT /components/camera/enabled ---
serveur.Put("/components/camera/enabled", [](const httplib::Request &req, httplib::Response &res) {
    bool valeur = camera_module::extraire_bool_json(req.body, "enabled", true);
    camera_module::camera_definir_activee(valeur);
    res.set_content("{\"ok\":true}", "application/json");
});


// --- Ta route POST /camera/screenshot ---
serveur.Post("/camera/screenshot", [](const httplib::Request &, httplib::Response &res) {
    auto image = camera_module::camera_derniere_image();
    if (image.empty()) {
        res.status = 503;
        res.set_content("{\"detail\":\"caméra éteinte ou pas encore d'image\"}", "application/json");
        return;
    }
    res.set_content(reinterpret_cast<const char*>(image.data()), image.size(), "image/jpeg");
});


// --- Ta route GET /camera/stream (flux MJPEG) ---
serveur.Get("/camera/stream", [](const httplib::Request &, httplib::Response &res) {
    res.set_chunked_content_provider(
        "multipart/x-mixed-replace; boundary=frame",
        [](size_t, httplib::DataSink &sink) {
            while (sink.is_writable()) {
                auto image = camera_module::camera_derniere_image();
                if (!image.empty()) {
                    std::string entete = "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                                          + std::to_string(image.size()) + "\r\n\r\n";
                    if (!sink.write(entete.data(), entete.size())) break;
                    if (!sink.write(reinterpret_cast<const char*>(image.data()), image.size())) break;
                    if (!sink.write("\r\n", 2)) break;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            return true;
        }
    );
});


// --- Dans TON heartbeat, ajouter la caméra au tableau "components" ---
// (à côté de tes autres composants, ex: servo, moteurs...)
std::string tous_les_composants = "[" + camera_module::camera_composant_json() + ", ...autres...]";

*/

#endif // CAMERA_MODULE_H
