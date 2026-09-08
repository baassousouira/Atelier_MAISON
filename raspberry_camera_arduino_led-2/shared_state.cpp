#include "shared_state.h"

// Valeurs de départ : tout activé, surveillance armée par défaut.
std::atomic<bool> etat_armed{true};
std::atomic<bool> etat_camera_enabled{true};
std::atomic<bool> etat_photoresistance_enabled{true};
std::atomic<bool> etat_button_enabled{true};
std::atomic<bool> etat_led_enabled{true};

std::mutex mutex_derniere_image;
std::vector<unsigned char> derniere_image_jpeg;

void definir_derniere_image(const std::vector<unsigned char> &jpeg) {
    std::lock_guard<std::mutex> verrou(mutex_derniere_image);
    derniere_image_jpeg = jpeg;
}

std::vector<unsigned char> lire_derniere_image() {
    std::lock_guard<std::mutex> verrou(mutex_derniere_image);
    return derniere_image_jpeg; // copie volontaire, pour ne garder le verrou que le temps de copier
}
