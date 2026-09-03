// gpio.cpp
// -----------------------------------------------------------------------
// Gestion de la LED d'acquittement.
//
// Logique :
//   - fausse alerte -> la LED clignote une fois
//   - vraie alerte  -> la LED reste allumée
// -----------------------------------------------------------------------

#include "gpio.h"
#include "config.h"

#include <gpiod.h>

#include <iostream>
#include <thread>
#include <chrono>

// Contrôleur GPIO
static struct gpiod_chip *chip = nullptr;

// Demande GPIO utilisée pour contrôler la LED
static struct gpiod_line_request *led_request = nullptr;


// -----------------------------------------------------------------------
// INITIALISATION
// -----------------------------------------------------------------------

bool gpio_init()
{
    // Ouvre le contrôleur GPIO
    chip = gpiod_chip_open(GPIO_CHIP);

    if (!chip)
    {
        std::cerr << "gpio: impossible d'ouvrir "
                  << GPIO_CHIP << std::endl;

        return false;
    }


    // ---------------------------------------------------------------
    // Création des paramètres de la broche
    // ---------------------------------------------------------------

    struct gpiod_line_settings *settings =
        gpiod_line_settings_new();

    if (!settings)
    {
        std::cerr << "gpio: impossible de créer les paramètres GPIO"
                  << std::endl;

        gpiod_chip_close(chip);
        chip = nullptr;

        return false;
    }


    // On configure la broche comme une SORTIE
    if (gpiod_line_settings_set_direction(
            settings,
            GPIOD_LINE_DIRECTION_OUTPUT) < 0)
    {
        std::cerr << "gpio: impossible de configurer la broche en sortie"
                  << std::endl;

        gpiod_line_settings_free(settings);
        gpiod_chip_close(chip);
        chip = nullptr;

        return false;
    }


    // Valeur initiale : LED éteinte
    if (gpiod_line_settings_set_output_value(
            settings,
            GPIOD_LINE_VALUE_INACTIVE) < 0)
    {
        std::cerr << "gpio: impossible de définir la valeur initiale"
                  << std::endl;

        gpiod_line_settings_free(settings);
        gpiod_chip_close(chip);
        chip = nullptr;

        return false;
    }


    // ---------------------------------------------------------------
    // Création de la configuration de la ligne
    // ---------------------------------------------------------------

    struct gpiod_line_config *line_config =
        gpiod_line_config_new();

    if (!line_config)
    {
        std::cerr << "gpio: impossible de créer la configuration"
                  << std::endl;

        gpiod_line_settings_free(settings);
        gpiod_chip_close(chip);
        chip = nullptr;

        return false;
    }


    // Ajoute notre GPIO à la configuration
    unsigned int offset = LED_GPIO_PIN;

    if (gpiod_line_config_add_line_settings(
            line_config,
            &offset,
            1,
            settings) < 0)
    {
        std::cerr << "gpio: impossible d'ajouter le GPIO "
                  << LED_GPIO_PIN << std::endl;

        gpiod_line_config_free(line_config);
        gpiod_line_settings_free(settings);
        gpiod_chip_close(chip);
        chip = nullptr;

        return false;
    }


    // Les paramètres ne sont plus nécessaires après ajout
    gpiod_line_settings_free(settings);


    // ---------------------------------------------------------------
    // Création de la demande GPIO
    // ---------------------------------------------------------------

    struct gpiod_request_config *request_config =
        gpiod_request_config_new();

    if (!request_config)
    {
        std::cerr << "gpio: impossible de créer la demande GPIO"
                  << std::endl;

        gpiod_line_config_free(line_config);
        gpiod_chip_close(chip);
        chip = nullptr;

        return false;
    }


    // Nom donné à notre programme lors de la réservation du GPIO
    gpiod_request_config_set_consumer(
        request_config,
        "surveillance_led"
    );


    // Demande effectivement le GPIO
    led_request =
        gpiod_chip_request_lines(
            chip,
            request_config,
            line_config
        );


    // Les configurations ne sont plus nécessaires
    gpiod_request_config_free(request_config);
    gpiod_line_config_free(line_config);


    if (!led_request)
    {
        std::cerr << "gpio: impossible de réserver le GPIO "
                  << LED_GPIO_PIN << std::endl;

        gpiod_chip_close(chip);
        chip = nullptr;

        return false;
    }


    std::cout << "gpio: LED initialisée sur GPIO "
              << LED_GPIO_PIN << std::endl;

    return true;
}


// -----------------------------------------------------------------------
// NETTOYAGE
// -----------------------------------------------------------------------

void gpio_cleanup()
{
    if (led_request)
    {
        // On éteint la LED avant de quitter
        gpiod_line_request_set_value(
            led_request,
            LED_GPIO_PIN,
            GPIOD_LINE_VALUE_INACTIVE
        );

        // Libère la réservation du GPIO
        gpiod_line_request_release(led_request);

        led_request = nullptr;
    }


    if (chip)
    {
        gpiod_chip_close(chip);
        chip = nullptr;
    }
}


// -----------------------------------------------------------------------
// LED ALLUMÉE
// -----------------------------------------------------------------------

void led_on()
{
    if (!led_request)
        return;

    gpiod_line_request_set_value(
        led_request,
        LED_GPIO_PIN,
        GPIOD_LINE_VALUE_ACTIVE
    );
}


// -----------------------------------------------------------------------
// LED ÉTEINTE
// -----------------------------------------------------------------------

void led_off()
{
    if (!led_request)
        return;

    gpiod_line_request_set_value(
        led_request,
        LED_GPIO_PIN,
        GPIOD_LINE_VALUE_INACTIVE
    );
}


// -----------------------------------------------------------------------
// UN CLIGNOTEMENT
// -----------------------------------------------------------------------

void led_blink_once(int duration_ms)
{
    if (!led_request)
        return;


    // Allume la LED
    led_on();


    // Attend la durée demandée
    std::this_thread::sleep_for(
        std::chrono::milliseconds(duration_ms)
    );


    // Éteint la LED
    led_off();
}
