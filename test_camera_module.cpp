// test_camera_module.cpp
// -----------------------------------------------------------------------
// Programme de TEST autonome pour vérifier que camera_module.h fonctionne
// correctement, avant de le donner à votre camarade.
//
// Tapez des commandes dans le terminal pendant que ça tourne :
//   on     -> allume la caméra
//   off    -> éteint la caméra
//   photo  -> sauvegarde la dernière image dans capture_test.jpg
//   etat   -> affiche l'état actuel (allumée/éteinte) + le JSON heartbeat
//   quit   -> quitte proprement
// -----------------------------------------------------------------------

#include "camera_module.h"

#include <iostream>
#include <fstream>
#include <thread>
#include <atomic>
#include <chrono>

int main() {

    if (!camera_module::camera_ouvrir()) {
        std::cerr << "test: impossible d'ouvrir la caméra, arrêt du programme" << std::endl;
        return 1;
    }

    std::cout << "test: caméra ouverte. Tapez une commande (on / off / photo / etat / quit) puis Entrée." << std::endl;

    std::atomic<bool> continuer{true};

    // -------------------------------------------------------------
    // Thread qui lit les commandes tapées au clavier, en parallèle
    // de la boucle de capture ci-dessous (sinon on ne pourrait pas
    // taper de commande pendant que la caméra tourne).
    // -------------------------------------------------------------
    std::thread lecteur_commandes([&continuer]() {
        std::string commande;

        while (continuer.load() && std::getline(std::cin, commande)) {

            if (commande == "on") {
                camera_module::camera_definir_activee(true);

            } else if (commande == "off") {
                camera_module::camera_definir_activee(false);

            } else if (commande == "photo") {
                auto image = camera_module::camera_derniere_image();

                if (image.empty()) {
                    std::cout << "test: pas d'image disponible (caméra éteinte, ou pas encore capturé une image)" << std::endl;
                } else {
                    std::ofstream fichier("capture_test.jpg", std::ios::binary);
                    fichier.write(reinterpret_cast<const char *>(image.data()), image.size());
                    fichier.close();
                    std::cout << "test: image enregistrée dans capture_test.jpg (" << image.size() << " octets)" << std::endl;
                }

            } else if (commande == "etat") {
                std::cout << "test: caméra "
                           << (camera_module::camera_est_activee() ? "ALLUMÉE" : "ÉTEINTE") << std::endl;
                std::cout << "test: JSON heartbeat -> " << camera_module::camera_composant_json() << std::endl;

            } else if (commande == "quit") {
                continuer = false;

            } else if (!commande.empty()) {
                std::cout << "test: commande inconnue \"" << commande << "\" (essayez on / off / photo / etat / quit)" << std::endl;
            }
        }
    });

    // -------------------------------------------------------------
    // Boucle de capture (comme le ferait la vraie boucle principale
    // du robot) : on appelle camera_boucle() en continu.
    // -------------------------------------------------------------
    while (continuer.load()) {
        camera_module::camera_boucle();
        std::this_thread::sleep_for(std::chrono::milliseconds(30)); // ~30 images/seconde
    }

    lecteur_commandes.join();
    camera_module::camera_fermer();

    std::cout << "test: programme terminé proprement." << std::endl;
    return 0;
}
