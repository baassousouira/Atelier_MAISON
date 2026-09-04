// gpio.cpp
// -----------------------------------------------------------------------
// Ce fichier pilote la LED d'acquittement branchée sur ce Raspberry.
// Rappel de la logique métier (définie ensemble) :
//   - fausse alerte -> la LED clignote UNE FOIS (juste pour dire "reçu")
//   - vraie alerte  -> la LED RESTE ALLUMÉE (jusqu'à la prochaine action)
// -----------------------------------------------------------------------

#include "gpio.h"
#include "config.h"     // pour GPIO_CHIP et LED_GPIO_PIN
#include <gpiod.h>       // bibliothèque GPIO moderne pour Raspberry Pi
#include <iostream>
#include <thread>          // pour std::this_thread::sleep_for (attendre X millisecondes)
#include <chrono>

// Ces deux pointeurs représentent respectivement :
// - "chip"     : le contrôleur GPIO du Raspberry (il n'y en a qu'un seul en général)
// - "led_line" : la broche précise reliée à la LED
// On les garde en variables "statiques" (visibles uniquement dans ce fichier)
// car on en a besoin dans plusieurs fonctions (init, on, off, cleanup...).
static struct gpiod_chip *chip = nullptr;
static struct gpiod_line *led_line = nullptr;

bool gpio_init() {
    // On ouvre le contrôleur GPIO par son nom (défini dans config.h, en général "gpiochip0")
    chip = gpiod_chip_open_by_name(GPIO_CHIP);
    if (!chip) {
        std::cerr << "gpio: impossible d'ouvrir " << GPIO_CHIP << std::endl;
        return false;
    }

    // On récupère la broche précise (le numéro est en numérotation BCM, cf. config.h)
    led_line = gpiod_chip_get_line(chip, LED_GPIO_PIN);
    if (!led_line) {
        std::cerr << "gpio: impossible d'accéder à la broche " << LED_GPIO_PIN << std::endl;
        return false;
    }

    // On "réserve" cette broche en sortie (output), avec une valeur initiale de 0 (éteinte).
    // Le premier argument texte ("surveillance_led") sert juste d'étiquette de debug,
    // visible par exemple avec la commande "gpioinfo" dans le terminal.
    if (gpiod_line_request_output(led_line, "surveillance_led", 0) < 0) {
        std::cerr << "gpio: impossible de réserver la broche en sortie" << std::endl;
        return false;
    }

    return true; // tout s'est bien passé
}

void gpio_cleanup() {
    // On éteint la LED avant de quitter, par propreté
    if (led_line) {
        gpiod_line_set_value(led_line, 0);
        gpiod_line_release(led_line); // on "rend" la broche, pour qu'un autre programme puisse l'utiliser
    }
    if (chip) {
        gpiod_chip_close(chip);
    }
}

void led_on() {
    // On vérifie que la broche a bien été initialisée avant de l'utiliser
    // (sécurité : évite un plantage si gpio_init() a échoué plus tôt)
    if (led_line) gpiod_line_set_value(led_line, 1); // 1 = allumé
}

void led_off() {
    if (led_line) gpiod_line_set_value(led_line, 0); // 0 = éteint
}

void led_blink_once(int duration_ms) {
    if (!led_line) return;

    gpiod_line_set_value(led_line, 1); // on allume

    // On "met en pause" le programme pendant duration_ms millisecondes.
    // Note : pendant ce temps, le programme ne fait RIEN d'autre (pas de
    // capture caméra). Pour un flash court (quelques centaines de ms),
    // ce n'est pas gênant pour un prototype.
    std::this_thread::sleep_for(std::chrono::milliseconds(duration_ms));

    gpiod_line_set_value(led_line, 0); // puis on éteint
}
