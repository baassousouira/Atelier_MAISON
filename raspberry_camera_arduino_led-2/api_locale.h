#ifndef API_LOCALE_H
#define API_LOCALE_H
// Serveur HTTP local, exposé sur le port 8001, tel que défini dans
// ROUTES_LOCALES_A_IMPLEMENTER.md — c'est par ce port que le serveur
// central (et donc l'app React) commande ce Raspberry directement.

// Démarre le serveur HTTP local dans un thread séparé. Retourne
// IMMÉDIATEMENT : le serveur tourne en arrière-plan, ça ne bloque jamais
// la boucle principale de la caméra.
void demarrer_api_locale();

#endif /* API_LOCALE_H */
