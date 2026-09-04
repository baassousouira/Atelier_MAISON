#ifndef GPIO_H
#define GPIO_H
// Ce module regroupe TOUT ce qui touche à la LED branchée sur le Raspberry.
// On utilise la bibliothèque "libgpiod", qui est la façon moderne et
// recommandée de piloter les broches GPIO sur Raspberry Pi (l'ancienne
// bibliothèque wiringPi n'est plus maintenue).

// À appeler UNE SEULE FOIS au démarrage.
// Ouvre l'accès au contrôleur GPIO et réserve la broche de la LED en sortie.
// Retourne true si tout s'est bien passé, false sinon (ex: broche déjà utilisée).
bool gpio_init();

// À appeler UNE SEULE FOIS avant de quitter le programme.
// Éteint la LED et libère proprement la broche.
void gpio_cleanup();

// Allume la LED et la LAISSE allumée (utilisé pour une VRAIE alerte).
void led_on();

// Éteint la LED.
void led_off();

// Allume la LED puis l'éteint après "duration_ms" millisecondes
// (utilisé pour une FAUSSE alerte : un seul flash pour dire "reçu").
void led_blink_once(int duration_ms);

#endif /* GPIO_H */
