#ifndef SHARED_STATE_H
#define SHARED_STATE_H
// Même principe que sur le Raspberry fixe (voir ce fichier là-bas pour le
// détail des explications) : état partagé entre la boucle caméra et le
// serveur HTTP local (port 8001), qui tournent dans deux threads différents.

#include <atomic>
#include <mutex>
#include <vector>

// --- Surveillance globale et composants de CE Raspberry ---
extern std::atomic<bool> etat_armed;
extern std::atomic<bool> etat_camera_enabled;
extern std::atomic<bool> etat_servo_enabled;

// --- Dernière image caméra (JPEG), pour /camera/stream et /camera/screenshot ---
extern std::mutex mutex_derniere_image;
extern std::vector<unsigned char> derniere_image_jpeg;

void definir_derniere_image(const std::vector<unsigned char> &jpeg);
std::vector<unsigned char> lire_derniere_image();

#endif /* SHARED_STATE_H */
