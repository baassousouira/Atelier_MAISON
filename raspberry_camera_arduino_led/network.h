#ifndef NETWORK_H
#define NETWORK_H
// Ce module regroupe TOUT ce qui parle au serveur en HTTP.
// Le reste du programme (main.cpp) n'a pas besoin de savoir COMMENT
// on parle au serveur (curl, JSON...), juste QUOI lui dire.

#include <string>
#include <vector>

// À appeler UNE SEULE FOIS au tout début du programme.
// Prépare la bibliothèque réseau (libcurl) pour qu'elle puisse être utilisée.
void network_init();

// À appeler UNE SEULE FOIS juste avant de quitter le programme.
// Libère proprement les ressources réseau.
void network_cleanup();

// Envoie au serveur l'information "un mouvement a été détecté".
// - capteur / zone : qui a détecté quoi (voir config.h)
// - event_id_out : rempli avec l'identifiant que le serveur nous renvoie,
//   dont on aura besoin ensuite pour savoir ce que l'utilisateur a décidé
// Retourne true si l'envoi a réussi, false sinon (ex: serveur injoignable).
bool send_alert_event(const std::string &capteur, const std::string &zone, std::string &event_id_out);

// Demande au serveur : "où en est-on avec cet événement ?"
// Retourne une chaîne parmi :
//   "en_attente"    -> personne n'a encore répondu sur l'app/le site
//   "fausse_alerte" -> l'utilisateur a dit que ce n'était rien
//   "vraie_alerte"  -> l'utilisateur a confirmé une vraie intrusion
//   "erreur"        -> problème réseau, on n'a pas pu savoir
std::string poll_decision(const std::string &event_id);

/*
 * Envoie une image (capture caméra actuelle) associée à un événement,
 * pour que l'utilisateur puisse voir ce qui se passe avant de décider.
 * (POST /api/evenements/{id}/image, en multipart/form-data)
 * Retourne true si l'envoi a réussi.
 */
bool send_snapshot(const std::string &event_id, const std::vector<unsigned char> &jpeg_data);

#endif /* NETWORK_H */
