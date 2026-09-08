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

// -------------------------------------------------------------------
// Un composant à signaler dans le heartbeat (ex: caméra, photorésistance...)
// -------------------------------------------------------------------
struct EtatComposant {
    std::string nom;             // "camera", "photoresistance", "button", "led"
    bool actif;                   // enabled : ce composant est-il activé côté app ?
    bool a_une_valeur = false;    // true si "valeur" doit être inclus (ex: photorésistance)
    float valeur = 0.0f;
};

/*
 * Envoie l'état de ce Raspberry au serveur central (POST /api/controleurs/heartbeat),
 * à appeler environ toutes les 5 secondes, MÊME quand la surveillance est
 * désarmée ou qu'un composant est désactivé (sinon le serveur croirait le
 * Raspberry hors ligne).
 */
bool send_heartbeat(bool a_un_servo, const std::vector<EtatComposant> &composants);

/*
 * Demande au serveur si la surveillance est actuellement armée
 * (GET /api/armed). Retourne true si la requête a réussi ; armed_out
 * contient alors la vraie valeur.
 */
bool lire_etat_armed(bool &armed_out);

#endif /* NETWORK_H */
