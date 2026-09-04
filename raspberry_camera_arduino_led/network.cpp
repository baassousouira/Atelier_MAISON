// network.cpp
// -----------------------------------------------------------------------
// Ce fichier contient tout le code qui communique en HTTP avec le serveur
// Python (FastAPI). On utilise la bibliothèque "libcurl", qui est LA
// bibliothèque standard en C/C++ pour faire des requêtes web (HTTP/HTTPS).
//
// CONTRAT attendu avec le serveur (à faire correspondre exactement côté
// Python, sinon les échanges ne fonctionneront pas) :
//
//   POST http://192.168.1.1:8000/api/evenements
//     corps envoyé   : {"capteur":"camera_fixe","zone":"salon","horodatage":1234567}
//     réponse attendue : {"id":"un-identifiant-unique"}
//
//   GET http://192.168.1.1:8000/api/evenements/{id}/decision
//     réponse attendue : {"decision":"en_attente"}  (ou "fausse_alerte" / "vraie_alerte")
// -----------------------------------------------------------------------

#include "network.h"      // nos propres déclarations (send_alert_event, poll_decision...)
#include "config.h"        // pour récupérer SERVER_BASE_URL
#include <curl/curl.h>      // la bibliothèque HTTP
#include <iostream>          // pour afficher des messages d'erreur dans le terminal
#include <ctime>              // pour générer l'horodatage (date/heure actuelle)

// -------------------------------------------------------------------
// FONCTION TECHNIQUE : write_callback
// -------------------------------------------------------------------
// Quand on fait une requête HTTP avec curl, la réponse du serveur arrive
// "petit bout par petit bout" (comme un flux). Cette fonction est appelée
// automatiquement par curl à chaque bout reçu, et notre travail est de
// recoller tous les bouts dans une simple std::string.
// C'est une fonction "callback" : on ne l'appelle jamais nous-mêmes,
// c'est curl qui l'appelle tout seul.
static size_t write_callback(void *contents, size_t size, size_t nmemb, void *userp) {
    // "contents" = pointeur vers les données reçues
    // "size * nmemb" = nombre d'octets reçus dans ce petit bout
    size_t total = size * nmemb;

    // On récupère notre std::string (passée via userp) pour y ajouter le morceau
    std::string *out = static_cast<std::string *>(userp);
    out->append(static_cast<char *>(contents), total);

    // curl exige qu'on retourne le nombre d'octets qu'on a bien traités
    return total;
}

// -------------------------------------------------------------------
// network_init / network_cleanup
// -------------------------------------------------------------------
// curl a besoin d'être "initialisé" une fois au démarrage du programme,
// et "nettoyé" une fois à la fin. C'est une contrainte de la bibliothèque.
void network_init() {
    curl_global_init(CURL_GLOBAL_DEFAULT);
}

void network_cleanup() {
    curl_global_cleanup();
}

// -------------------------------------------------------------------
// FONCTION TECHNIQUE : extract_json_field
// -------------------------------------------------------------------
// Le serveur nous répond en JSON (ex: {"id":"abcd1234"}).
// On pourrait utiliser une vraie bibliothèque JSON, mais pour un prototype
// où on lit toujours des réponses TRÈS simples (un seul champ, pas de
// tableau, pas d'imbrication), on peut se contenter d'une petite fonction
// "faite maison" qui cherche "champ": et récupère ce qu'il y a après.
// ATTENTION : cette fonction est volontairement simple, elle ne marcherait
// pas sur du JSON complexe (objets imbriqués, tableaux...).
static std::string extract_json_field(const std::string &body, const std::string &field) {
    // On cherche la clé, ex: "id"
    std::string key = "\"" + field + "\"";
    size_t pos = body.find(key);
    if (pos == std::string::npos) return "";  // champ pas trouvé -> chaîne vide

    // On cherche le ":" qui suit la clé
    pos = body.find(':', pos);
    if (pos == std::string::npos) return "";
    pos++; // on se place juste après le ":"

    // On saute les espaces et le guillemet ouvrant éventuel
    while (pos < body.size() && (body[pos] == ' ' || body[pos] == '"')) pos++;

    // On avance jusqu'à la fin de la valeur : soit un guillemet fermant,
    // soit une virgule (autre champ après), soit une accolade fermante (fin d'objet)
    size_t end = pos;
    while (end < body.size() && body[end] != '"' && body[end] != ',' && body[end] != '}') end++;

    // On extrait la sous-chaîne correspondant à la valeur
    return body.substr(pos, end - pos);
}

// -------------------------------------------------------------------
// send_alert_event : envoie l'événement de détection au serveur
// -------------------------------------------------------------------
bool send_alert_event(const std::string &capteur, const std::string &zone, std::string &event_id_out) {
    // On crée un "handle" curl : un objet qui représente une requête HTTP
    CURL *curl = curl_easy_init();
    if (!curl) {
        std::cerr << "network: impossible d'initialiser curl" << std::endl;
        return false;
    }

    // On récupère la date/heure actuelle (nombre de secondes depuis 1970,
    // c'est le format "horodatage Unix", standard et facile à comparer)
    std::time_t horodatage = std::time(nullptr);

    // On construit le corps JSON à la main (pas besoin de bibliothèque JSON
    // pour un objet aussi simple, on colle juste les morceaux de texte)
    std::string json_payload =
        "{\"capteur\":\"" + capteur + "\","
        "\"zone\":\"" + zone + "\","
        "\"horodatage\":" + std::to_string(horodatage) + "}";

    // On construit l'URL complète à appeler : ex http://192.168.1.1:8000/api/evenements
    std::string url = std::string(SERVER_BASE_URL) + "/api/evenements";

    // C'est ici que write_callback va déposer la réponse du serveur
    std::string response_body;

    // On précise qu'on envoie du JSON (sinon FastAPI ne saura pas comment
    // interpréter le corps de la requête)
    struct curl_slist *headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    // Configuration de la requête :
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());                 // où on envoie
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_payload.c_str()); // quoi on envoie (le fait de définir POSTFIELDS suffit à faire un POST)
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);              // avec quel en-tête
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);    // comment récupérer la réponse
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_body);        // où stocker la réponse
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);                      // abandonner après 5 secondes si pas de réponse

    // On envoie réellement la requête (tout ce qui précède ne fait que la préparer)
    CURLcode res = curl_easy_perform(curl);

    bool ok = false;

    if (res != CURLE_OK) {
        // Erreur "basse couche" : serveur injoignable, câble débranché, DNS, etc.
        std::cerr << "network: échec envoi événement (" << curl_easy_strerror(res) << ")" << std::endl;
    } else {
        // La requête a bien voyagé, on vérifie maintenant le code HTTP retourné
        long http_code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);

        if (http_code >= 200 && http_code < 300) {
            // Code 2xx = succès. On extrait l'identifiant de l'événement.
            event_id_out = extract_json_field(response_body, "id");
            ok = !event_id_out.empty();
            if (!ok) {
                std::cerr << "network: réponse du serveur sans champ 'id' exploitable : " << response_body << std::endl;
            }
        } else {
            // Le serveur a répondu mais avec une erreur (ex: 500, 422...)
            std::cerr << "network: le serveur a répondu un code " << http_code << std::endl;
        }
    }

    // Nettoyage : on libère la mémoire utilisée par cette requête
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    return ok;
}

// -------------------------------------------------------------------
// poll_decision : demande au serveur où en est un événement
// -------------------------------------------------------------------
std::string poll_decision(const std::string &event_id) {
    CURL *curl = curl_easy_init();
    if (!curl) return "erreur";

    // URL du type http://192.168.1.1:8000/api/evenements/abcd1234/decision
    std::string url = std::string(SERVER_BASE_URL) + "/api/evenements/" + event_id + "/decision";
    std::string response_body;

    // Ici pas besoin de POSTFIELDS : sans ça, curl fait un GET par défaut
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_body);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);

    CURLcode res = curl_easy_perform(curl);

    std::string decision = "erreur"; // valeur par défaut en cas de souci

    if (res == CURLE_OK) {
        decision = extract_json_field(response_body, "decision");
        if (decision.empty()) decision = "erreur";
    } else {
        std::cerr << "network: échec interrogation décision (" << curl_easy_strerror(res) << ")" << std::endl;
    }

    curl_easy_cleanup(curl);
    return decision;
}
