#ifndef SHARED_STATE_H
#define SHARED_STATE_H
// Ce fichier centralise l'état PARTAGÉ entre la boucle principale (caméra,
// dans main.cpp) et le serveur HTTP local (port 8001, api_locale.cpp), qui
// tournent dans deux threads différents.
//
// On utilise des std::atomic<bool> pour les drapeaux simples (activer/
// désactiver un composant) : une variable atomique garantit qu'une
// lecture/écriture depuis deux threads différents ne "casse" jamais rien,
// sans avoir besoin d'un mutex pour un simple booléen.
//
// Pour la dernière image caméra (plus volumineuse, un std::vector), on
// utilise un vrai mutex classique.

#include <atomic>
#include <mutex>
#include <vector>

// --- Surveillance globale et état de chaque composant ---
// Modifiés par le serveur local (PUT /system et PUT /components/{name}/enabled),
// lus par la boucle principale (pour savoir si elle doit agir) ET par le
// heartbeat (pour signaler l'état réel au serveur central).
extern std::atomic<bool> etat_armed;
extern std::atomic<bool> etat_camera_enabled;
extern std::atomic<bool> etat_photoresistance_enabled;
extern std::atomic<bool> etat_button_enabled;
extern std::atomic<bool> etat_led_enabled;

// --- Dernière image caméra (JPEG), pour /camera/stream et /camera/screenshot ---
extern std::mutex mutex_derniere_image;
extern std::vector<unsigned char> derniere_image_jpeg;

// Met à jour la dernière image connue (appelé depuis la boucle principale,
// à chaque tour) — thread-safe.
void definir_derniere_image(const std::vector<unsigned char> &jpeg);

// Récupère une COPIE de la dernière image connue — thread-safe.
std::vector<unsigned char> lire_derniere_image();

#endif /* SHARED_STATE_H */
