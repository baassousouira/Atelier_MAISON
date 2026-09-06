// NetworkIncidentModal.tsx

// -----------------------------------------------------------------------
// POPUP DE COUPURE RÉELLE
// -----------------------------------------------------------------------
//
// Cette popup est créée uniquement lorsqu'une vraie anomalie réseau
// est détectée :
//
//   - FastAPI ne répond plus ;
//   - ou un Raspberry ne transmet plus son heartbeat.
//
// Le bouton "Vérifier à nouveau" relance réellement une vérification.
//
// Le bouton de fermeture masque seulement la popup.
// Il ne prétend jamais que la connexion est revenue.
// -----------------------------------------------------------------------

import {
  useState,
} from 'react'

import {
  RefreshCw,
  ShieldAlert,
  WifiOff,
  X,
} from 'lucide-react'

import {
  useSystem,
} from '../hooks/useSystem'

import '../styles/system-connection.css'


function NetworkIncidentModal() {

  const {
    networkIncident,
    serverConnection,
    restoreConnection,
    dismissNetworkIncident,
  } = useSystem()


  // ---------------------------------------------------------------------
  // ÉTAT LOCAL DE LA NOUVELLE TENTATIVE
  // ---------------------------------------------------------------------
  //
  // Cela permet :
  //
  // - d'empêcher plusieurs clics simultanés ;
  // - d'afficher "Vérification en cours..." ;
  // - de faire tourner l'icône pendant la recherche.
  // ---------------------------------------------------------------------

  const [
    isRetrying,
    setIsRetrying,
  ] =
    useState(
      false,
    )


  // Pas d'incident, ou incident volontairement fermé :
  // aucune popup.

  if (
    !networkIncident
    ||
    networkIncident.dismissed
  ) {

    return null
  }


  // CHECKING signifie aussi que le serveur central
  // n'est pas encore confirmé comme connecté.

  const centralServerOffline =
    serverConnection.status !==
    'CONNECTED'


  // ---------------------------------------------------------------------
  // NOUVELLE RECHERCHE
  // ---------------------------------------------------------------------

  async function handleRetry():
    Promise<void> {

    if (
      isRetrying
    ) {

      return
    }


    setIsRetrying(
      true,
    )


    try {

      // Cette fonction du SystemProvider va :
      //
      // 1. relancer GET /health ;
      // 2. si FastAPI répond, relire les données ;
      // 3. remettre l'état CONNECTED si tout fonctionne ;
      // 4. laisser l'incident actif sinon.

      await restoreConnection()

    } finally {

      setIsRetrying(
        false,
      )
    }
  }


  return (

    <div
      className="network-modal-backdrop"
      role="presentation"
    >

      <section
        className="network-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="network-modal-title"
      >

        {/*
          ============================================================
          FERMETURE
          ============================================================

          La croix ferme uniquement la fenêtre.

          Elle est positionnée en haut à droite grâce au CSS.
        */}

        <button
          type="button"
          className="network-modal-close"
          aria-label="Fermer l’alerte"
          onClick={
            dismissNetworkIncident
          }
        >

          <X
            aria-hidden="true"
          />

        </button>


        <div
          className="network-modal-icon"
        >

          <WifiOff
            aria-hidden="true"
          />

        </div>


        <p
          className="network-modal-eyebrow"
        >
          Alerte technique
        </p>


        <h2
          id="network-modal-title"
        >

          {
            centralServerOffline
              ? (
                  'Connexion au serveur central interrompue'
                )
              : (
                  'Connexion à un équipement du système interrompue'
                )
          }

        </h2>


        <p
          className="network-modal-description"
        >

          {
            centralServerOffline
              ? (
                  "L'application ne reçoit plus les données de FastAPI. "
                  + 'Les commandes distantes sont suspendues '
                  + "jusqu'au rétablissement de la liaison."
                )
              : (
                  'Le serveur central répond, mais au moins '
                  + "un Raspberry n'envoie plus son heartbeat. "
                  + 'Les équipements associés sont considérés hors ligne.'
                )
          }

        </p>


        <div
          className="network-modal-reason"
        >

          <ShieldAlert
            aria-hidden="true"
          />


          <div>

            <strong>
              Cause détectée
            </strong>

            <span>
              {networkIncident.reason}
            </span>

          </div>

        </div>


        {/*
          ============================================================
          NOUVELLE VÉRIFICATION
          ============================================================

          Ce bouton ne change pas seulement l'interface :
          il relance réellement les requêtes vers FastAPI.
        */}

        <button
          className="network-retry-button"
          type="button"
          disabled={isRetrying}
          onClick={() => {
            void handleRetry()
          }}
        >

          <RefreshCw
            className={
              isRetrying
                ? 'is-spinning'
                : undefined
            }
            aria-hidden="true"
          />

          {
            isRetrying
              ? (
                  'Vérification en cours...'
                )
              : (
                  'Vérifier à nouveau'
                )
          }

        </button>

      </section>

    </div>
  )
}


export default NetworkIncidentModal