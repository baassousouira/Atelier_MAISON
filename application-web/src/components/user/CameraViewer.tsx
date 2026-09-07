import {
  useState,
} from 'react'

import {
  Camera,
  EyeOff,
  Power,
  Radio,
  Save,
  WifiOff,
} from 'lucide-react'

import {
  useSystem,
} from '../../hooks/useSystem'


type CameraViewerProps = {
  cameraId: string

  compact?: boolean

  /*
    Facultatif.

    Normalement l'URL du flux
    vient directement de :

    equipment.streamUrl

    Mais on garde cette propriété
    pour permettre un remplacement ponctuel.
  */
  streamUrl?: string
}


function CameraViewer({
  cameraId,
  compact = false,
  streamUrl,
}: CameraViewerProps) {
  const {
    equipment,
    takeScreenshot,
    toggleEquipment,
    serverConnection,
  } = useSystem()


  // On mémorise l'URL précise qui a échoué. Si l'URL change, la nouvelle
  // ressource peut être retentée automatiquement sans useEffect.
  const [
    failedStreamUrl,
    setFailedStreamUrl,
  ] = useState<string | null>(null)


  /*
    ============================================================
    CAMÉRA
    ============================================================

    On cherche simplement la caméra
    reçue du serveur grâce à son ID.
  */

  const camera =
    equipment.find(
      (item) =>
        item.id ===
        cameraId,
    )


  /*
    ============================================================
    URL DU FLUX
    ============================================================

    Priorité :

    1. streamUrl fourni explicitement ;
    2. streamUrl contenu dans Equipment.

    En mode réel,
    c'est normalement le serveur
    qui fournit cette URL.
  */

  const resolvedStreamUrl =
    streamUrl ??
    camera?.streamUrl




  /*
    Si la caméra n'existe plus
    dans les données du serveur,
    on ne rend rien.
  */

  if (!camera) {
    return null
  }


  const isAvailable =
    serverConnection.status ===
      'CONNECTED' &&
    camera.status ===
      'ONLINE' &&
    camera.enabled


  const canDisplayStream =
    isAvailable &&
    Boolean(
      resolvedStreamUrl,
    ) &&
    failedStreamUrl !==
      resolvedStreamUrl


  const serverDisconnected =
    serverConnection.status ===
    'DISCONNECTED'


  return (
    <article
      className={
        `camera-viewer ${
          compact
            ? 'is-compact'
            : ''
        }`
      }
    >
      <div
        className={
          `camera-screen ${
            !isAvailable
              ? 'is-unavailable'
              : ''
          }`
        }
      >
        {/*
          ======================================================
          FLUX MJPEG
          ======================================================

          Pour un flux MJPEG,
          la balise <img> suffit.

          Si vous utilisez WebRTC plus tard,
          ce bloc pourra être remplacé.
        */}

        {canDisplayStream &&
          resolvedStreamUrl && (
          <img
            className="camera-live-image"
            src={
              resolvedStreamUrl
            }
            alt={
              `Vidéo en direct de ${camera.name}`
            }
            onError={() => {
              setFailedStreamUrl(
                resolvedStreamUrl ?? null,
              )
            }}
          />
        )}


        <div className="camera-screen-bar">
          <span
            className={
              `live-label ${
                isAvailable
                  ? 'is-live'
                  : ''
              }`
            }
          >
            <Radio
              aria-hidden="true"
            />

            {isAvailable
              ? 'En direct'
              : 'Indisponible'}
          </span>

          <span>
            {camera.location}
          </span>
        </div>


        {/*
          ======================================================
          PLACEHOLDER
          ======================================================
        */}

        {!canDisplayStream && (
          <div className="camera-screen-placeholder">
            {serverDisconnected ? (
              <WifiOff
                aria-hidden="true"
              />
            ) : isAvailable ? (
              <Camera
                aria-hidden="true"
              />
            ) : (
              <EyeOff
                aria-hidden="true"
              />
            )}


            <strong>
              {serverDisconnected
                ? 'Connexion au système interrompue'
                : isAvailable
                  ? failedStreamUrl === resolvedStreamUrl
                    ? 'Flux vidéo inaccessible'
                    : 'Flux vidéo en attente'
                  : camera.status ===
                      'OFFLINE'
                    ? 'Caméra hors ligne'
                    : 'Caméra désactivée'}
            </strong>


            <span>
              {serverDisconnected
                ? 'La vidéo est suspendue tant que la connexion au système n’est pas rétablie.'
                : isAvailable
                  ? failedStreamUrl === resolvedStreamUrl
                    ? 'Le serveur a fourni un flux mais le navigateur ne parvient pas à le charger.'
                    : 'Aucune URL de flux n’a encore été fournie pour cette caméra.'
                  : camera.status ===
                      'OFFLINE'
                    ? 'La caméra ne répond pas actuellement.'
                    : 'Activez la caméra pour consulter son image.'}
            </span>
          </div>
        )}


        <div className="camera-screen-footer">
          <span>
            Direct
          </span>

          <span>
            Dernier contact :
            {' '}
            {camera.lastSeen}
          </span>
        </div>
      </div>


      {/*
        ========================================================
        CONTRÔLES CAMÉRA
        ========================================================
      */}

      <div className="camera-viewer-toolbar">
        <div>
          <strong>
            {camera.name}
          </strong>

          <span>
            <i
              className={
                `status-dot ${
                  camera.status ===
                  'ONLINE'
                    ? 'is-online'
                    : 'is-offline'
                }`
              }
            />

            {camera.status ===
            'ONLINE'
              ? camera.enabled
                ? 'Connectée et active'
                : 'Connectée · désactivée'
              : 'Hors ligne'}
          </span>
        </div>


        <div className="camera-toolbar-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={
              !isAvailable
            }
            onClick={() => {
              void takeScreenshot(
                camera.id,
              )
            }}
          >
            <Save
              aria-hidden="true"
            />

            Capturer
          </button>


          <button
            className={
              camera.enabled
                ? 'danger-button'
                : 'primary-button'
            }
            type="button"
            disabled={
              camera.status ===
                'OFFLINE' ||
              serverConnection.status !==
                'CONNECTED'
            }
            onClick={() => {
              void toggleEquipment(
                camera.id,
              )
            }}
          >
            <Power
              aria-hidden="true"
            />

            {camera.enabled
              ? 'Désactiver'
              : 'Activer'}
          </button>
        </div>
      </div>
    </article>
  )
}


export default CameraViewer