// vite.config.ts

// -----------------------------------------------------------------------
// CONFIGURATION VITE - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Ce fichier a notamment deux rôles :
//
// 1. rendre l'application React accessible depuis les autres appareils
//    du réseau, notamment le téléphone ;
//
// 2. servir de relais entre le téléphone et le serveur FastAPI.
//
// Architecture :
//
// Téléphone
//      |
//      | http://192.168.137.1:5173
//      v
// Vite sur le PC
//      |
//      | proxy /api
//      v
// FastAPI
// http://192.168.1.1:8000
//
// Le téléphone n'a donc pas besoin de savoir comment accéder directement
// au réseau Ethernet 192.168.1.x.
// -----------------------------------------------------------------------

import {
  defineConfig,
  loadEnv,
} from 'vite'

import react from '@vitejs/plugin-react'


export default defineConfig(
  ({
    mode,
  }) => {

    // =====================================================================
    // LECTURE DES VARIABLES .ENV
    // =====================================================================
    //
    // Le troisième argument '' indique à Vite que nous voulons également
    // lire les variables qui ne commencent PAS par VITE_.
    //
    // Cela permet à vite.config.ts de lire :
    //
    // API_PROXY_TARGET=http://192.168.1.1:8000
    //
    // sans exposer cette variable au JavaScript du navigateur.
    // =====================================================================

    const env =
      loadEnv(
        mode,
        '.',
        '',
      )


    const apiProxyTarget =
      env.API_PROXY_TARGET
        ?.trim()


    // =====================================================================
    // VÉRIFICATION CONFIGURATION
    // =====================================================================

    if (
      !apiProxyTarget
    ) {

      throw new Error(
        (
          'API_PROXY_TARGET est absente. '
          + 'Vérifie application-web/.env.local.'
        ),
      )
    }


    // =====================================================================
    // CONFIGURATION VITE
    // =====================================================================

    return {

      // -------------------------------------------------------------------
      // REACT
      // -------------------------------------------------------------------

      plugins: [
        react(),
      ],


      // -------------------------------------------------------------------
      // SERVEUR DE DÉVELOPPEMENT
      // -------------------------------------------------------------------

      server: {

        // ---------------------------------------------------------------
        // 0.0.0.0
        // ---------------------------------------------------------------
        //
        // Vite écoute sur toutes les interfaces réseau du PC.
        //
        // Le site peut donc être ouvert :
        //
        // depuis le PC :
        //   http://localhost:5173
        //
        // depuis le téléphone :
        //   http://192.168.137.1:5173
        //
        // ---------------------------------------------------------------

        host:
          '0.0.0.0',


        // On garde explicitement le port utilisé par le projet.
        port:
          5173,


        // Si le port 5173 est déjà occupé,
        // Vite génère une erreur au lieu d'utiliser silencieusement 5174.
        strictPort:
          true,


        // =================================================================
        // PROXY VERS FASTAPI
        // =================================================================
        //
        // Lorsqu'un navigateur demande :
        //
        //   GET /api/system
        //
        // la requête arrive d'abord ici sur Vite.
        //
        // Vite la transmet ensuite vers :
        //
        //   http://192.168.1.1:8000/api/system
        //
        //
        // IMPORTANT :
        //
        // C'est le PC qui effectue la connexion avec FastAPI.
        //
        // Le téléphone reste uniquement connecté au PC.
        // =================================================================

        proxy: {

          '/api': {

            target:
              apiProxyTarget,


            // Modifie l'en-tête Host pour correspondre
            // au serveur de destination.
            changeOrigin:
              true,


            // -------------------------------------------------------------
            // LOGS DU PROXY
            // -------------------------------------------------------------
            //
            // Contrairement aux console.log() de systemApi.ts,
            // ceux-ci apparaissent DIRECTEMENT dans le terminal
            // VS Code où npm run dev est lancé.
            // -------------------------------------------------------------

            configure(
              proxy,
            ) {

              // -----------------------------------------------------------
              // REQUÊTE ENVOYÉE
              // -----------------------------------------------------------

              proxy.on(
                'proxyReq',
                (
                  _proxyReq,
                  req,
                ) => {

                  console.log(
                    (
                      '[VITE → FASTAPI] '
                      + `${req.method} `
                      + `${req.url}`
                    ),
                  )
                },
              )


              // -----------------------------------------------------------
              // RÉPONSE REÇUE
              // -----------------------------------------------------------

              proxy.on(
                'proxyRes',
                (
                  proxyRes,
                  req,
                ) => {

                  console.log(
                    (
                      '[VITE ← FASTAPI] '
                      + `${req.method} `
                      + `${req.url} `
                      + `→ ${proxyRes.statusCode}`
                    ),
                  )
                },
              )


              // -----------------------------------------------------------
              // ERREUR RÉSEAU
              // -----------------------------------------------------------

              proxy.on(
                'error',
                (
                  error,
                  req,
                ) => {

                  console.error(
                    (
                      '[VITE ✗ FASTAPI] '
                      + `${req.method} `
                      + `${req.url} `
                      + `→ ${error.message}`
                    ),
                  )
                },
              )
            },
          },
        },
      },
    }
  },
)