#ifndef CONFIG_H
#define CONFIG_H
// Réglages du Raspberry MOBILE (caméra sur le robot).
// D'après la classification de votre camarade : IP 192.168.1.2, HAS_SERVO=true,
// composants attendus : camera + servo.

// Adresse du serveur central FastAPI
#define SERVER_BASE_URL "http://192.168.1.1:8000"

// Ce Raspberry a un servo (contrairement au Raspberry fixe)
#define A_UN_SERVO true

// Fréquence du heartbeat et du sondage de secours pour "armed" (secondes)
#define HEARTBEAT_INTERVAL_SECONDS 5
#define ARMED_POLL_INTERVAL_SECONDS 5

#endif /* CONFIG_H */
