// gpio.cpp
// -----------------------------------------------------------------------
// ATTENTION : il existe deux versions très différentes de libgpiod :
//   - la v1.x (l'ancienne), avec des fonctions comme gpiod_chip_open_by_name,
//     gpiod_line_request_output, gpiod_line_set_value...
//   - la v2.x (la nouvelle, installée par défaut sur les Raspberry Pi OS
//     récents comme Bookworm), avec une API totalement réécrite : plus
//     verbeuse, mais plus robuste. On passe par des objets "settings",
//     "line_config" et "request_config" avant de pouvoir réserver une broche.
//
// Votre système a la v2.x, donc ce fichier utilise cette API-là.
//
// Rappel de la logique métier (définie ensemble) :
//   - fausse alerte -> la LED clignote UNE FOIS (juste pour dire "reçu")
//   - vraie alerte  -> la LED RESTE ALLUMÉE (jusqu'à la prochaine action)
// -----------------------------------------------------------------------

#include "gpio.h"
#include "config.h"
#include <gpiod.h>
#include <iostream>
#include <thread>
#include <chrono>

// En v2, on ne manipule plus directement une "ligne" comme en v1.
// On passe par une "requête" (gpiod_line_request), qui représente la
// réservation d'une ou plusieurs broches, configurées ensemble.
static struct gpiod_chip *chip = nullptr;             // le contrôleur GPIO
static struct gpiod_line_request *requete = nullptr;  // la broche réservée (une fois demandée)

// Le numéro de broche (LED_GPIO_PIN, dans config.h) devient un "offset"
// dans le vocabulaire v2.
static const unsigned int broche_led = LED_GPIO_PIN;

bool gpio_init() {

    // 1) Ouvrir le contrôleur GPIO.
    // En v2, on ouvre par le CHEMIN du fichier périphérique : "/dev/gpiochip0"
    // (voir la mise à jour de GPIO_CHIP dans config.h)
    chip = gpiod_chip_open(GPIO_CHIP);
    if (!chip) {
        std::cerr << "gpio: impossible d'ouvrir " << GPIO_CHIP << std::endl;
        return false;
    }

    // 2) Décrire COMMENT on veut utiliser la broche ("les réglages") :
    // en sortie (OUTPUT), avec une valeur de départ INACTIVE (éteinte)
    struct gpiod_line_settings *reglages = gpiod_line_settings_new();
    if (!reglages) {
        std::cerr << "gpio: impossible de créer les réglages de ligne" << std::endl;
        return false;
    }
    gpiod_line_settings_set_direction(reglages, GPIOD_LINE_DIRECTION_OUTPUT);
    gpiod_line_settings_set_output_value(reglages, GPIOD_LINE_VALUE_INACTIVE);

    // 3) Associer ces réglages à NOTRE broche précise
    struct gpiod_line_config *config_ligne = gpiod_line_config_new();
    if (!config_ligne) {
        std::cerr << "gpio: impossible de créer la config de ligne" << std::endl;
        gpiod_line_settings_free(reglages);
        return false;
    }
    gpiod_line_config_add_line_settings(config_ligne, &broche_led, 1, reglages);

    // 4) Préparer la "requête" (avec une étiquette de debug, visible
    // ensuite avec la commande "gpioinfo" dans le terminal)
    struct gpiod_request_config *config_requete = gpiod_request_config_new();
    if (!config_requete) {
        std::cerr << "gpio: impossible de créer la config de requête" << std::endl;
        gpiod_line_config_free(config_ligne);
        gpiod_line_settings_free(reglages);
        return false;
    }
    gpiod_request_config_set_consumer(config_requete, "surveillance_led");

    // 5) Envoyer réellement la demande de réservation de la broche
    requete = gpiod_chip_request_lines(chip, config_requete, config_ligne);

    // Ces objets intermédiaires ne servent plus une fois la requête faite
    gpiod_request_config_free(config_requete);
    gpiod_line_config_free(config_ligne);
    gpiod_line_settings_free(reglages);

    if (!requete) {
        // Cas typique si la broche est déjà utilisée, ou droits insuffisants
        // (essayez "sudo", ou ajoutez votre utilisateur au groupe "gpio")
        std::cerr << "gpio: impossible de réserver la broche " << broche_led << std::endl;
        return false;
    }

    return true;
}

void gpio_cleanup() {
    if (requete) {
        gpiod_line_request_set_value(requete, broche_led, GPIOD_LINE_VALUE_INACTIVE);
        gpiod_line_request_release(requete);
        requete = nullptr;
    }
    if (chip) {
        gpiod_chip_close(chip);
        chip = nullptr;
    }
}

void led_on() {
    if (requete) gpiod_line_request_set_value(requete, broche_led, GPIOD_LINE_VALUE_ACTIVE);
}

void led_off() {
    if (requete) gpiod_line_request_set_value(requete, broche_led, GPIOD_LINE_VALUE_INACTIVE);
}

void led_blink_once(int duration_ms) {
    if (!requete) return;
    gpiod_line_request_set_value(requete, broche_led, GPIOD_LINE_VALUE_ACTIVE);
    std::this_thread::sleep_for(std::chrono::milliseconds(duration_ms));
    gpiod_line_request_set_value(requete, broche_led, GPIOD_LINE_VALUE_INACTIVE);
}
