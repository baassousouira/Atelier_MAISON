// EXEMPLE_HEARTBEAT_CPP.cpp
// -----------------------------------------------------------------------
// Exemple d'ajout d'un heartbeat dans un programme C++ utilisant libcurl.
//
// Votre dépôt utilise déjà libcurl dans files/network.cpp.
// Cette logique peut donc être intégrée dans ce fichier plutôt que de
// créer un deuxième système HTTP complètement différent.
// -----------------------------------------------------------------------

#include <curl/curl.h>
#include <string>
#include <iostream>

// À vérifier sur le réseau utilisé le jour du test.
#define SERVER_BASE_URL "http://192.168.1.1:8000"


bool send_heartbeat(const std::string& json_payload) {
    CURL* curl = curl_easy_init();

    if (!curl) {
        return false;
    }

    std::string url =
        std::string(SERVER_BASE_URL)
        + "/api/controleurs/heartbeat";

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(
        headers,
        "Content-Type: application/json"
    );

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_payload.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 3L);

    CURLcode result = curl_easy_perform(curl);

    long http_code = 0;
    curl_easy_getinfo(
        curl,
        CURLINFO_RESPONSE_CODE,
        &http_code
    );

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    return (
        result == CURLE_OK
        && http_code >= 200
        && http_code < 300
    );
}


// Exemple de JSON MOBILE :
//
// std::string payload =
//     "{"
//     "\"has_servo\":true,"
//     "\"components\":["
//         "{\"name\":\"camera\",\"enabled\":true},"
//         "{\"name\":\"servo\",\"enabled\":true}"
//     "]"
//     "}";
//
// IMPORTANT : les booléens et valeurs doivent venir de l'état réel
// du programme, pas rester codés en dur.
