import {
  useEffect,
  useMemo,
} from 'react'

import {
  Bookmark,
  BookmarkCheck,
  Bot,
  Clock3,
  Film,
  Image,
} from 'lucide-react'

import {
  Link,
  useSearchParams,
} from 'react-router-dom'

import CameraViewer
  from '../components/user/CameraViewer'

import {
  useSystem,
} from '../hooks/useSystem'


function UserCamerasPage() {
  const {
    equipment,
    media,
    toggleMediaSaved,
    isLoading,
  } = useSystem()


  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams()


  /*
    ============================================================
    CAMÉRAS FIXES DYNAMIQUES
    ============================================================

    Il n'existe plus de :

    camera-salon

    écrit dans cette page.

    Toutes les caméras de type CAMERA
    reçues du serveur sont automatiquement
    ajoutées.
  */

  const cameras =
    useMemo(
      () =>
        equipment
          .filter(
            (item) =>
              item.kind ===
              'CAMERA',
          )
          .sort(
            (
              first,
              second,
            ) =>
              (
                first.displayOrder ??
                999
              ) -
              (
                second.displayOrder ??
                999
              ),
          ),

      [
        equipment,
      ],
    )


  /*
    ============================================================
    CAMÉRA DEMANDÉE PAR L'URL
    ============================================================

    Exemple :

    /utilisateur/cameras?camera=abc123
  */

  const requestedCameraId =
    searchParams.get(
      'camera',
    )


  const requestedCamera =
    cameras.find(
      (camera) =>
        camera.id ===
        requestedCameraId,
    )


  /*
    Si aucune caméra n'est demandée,
    on prend la première disponible.
  */

  const selectedCamera =
    requestedCamera ??
    cameras[0] ??
    null


  /*
    ============================================================
    SYNCHRONISATION URL
    ============================================================
  */

  useEffect(
    () => {
      if (!selectedCamera) {
        return
      }

      if (
        requestedCameraId ===
        selectedCamera.id
      ) {
        return
      }

      setSearchParams(
        {
          camera:
            selectedCamera.id,
        },

        {
          replace: true,
        },
      )
    },

    [
      requestedCameraId,
      selectedCamera,
      setSearchParams,
    ],
  )


  /*
    ============================================================
    MÉDIAS DE LA CAMÉRA
    ============================================================
  */

  const selectedCameraMedia =
    selectedCamera
      ? media.filter(
          (item) =>
            item.cameraId ===
            selectedCamera.id,
        )
      : []


  /*
    S'il existe au moins une caméra robot,
    on affiche le raccourci vers le robot.
  */

  const hasRobotCamera =
    equipment.some(
      (item) =>
        item.kind ===
        'ROBOT_CAMERA',
    )


  return (
    <div className="user-page">
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">
            Vidéo fixe
          </p>

          <h1>
            {selectedCamera
              ? selectedCamera.name
              : 'Caméras'}
          </h1>

          <p>
            Consultez le direct, activez ou désactivez
            une caméra et gérez les médias associés.
          </p>
        </div>


        {hasRobotCamera && (
          <Link
            className="secondary-button"
            to="/utilisateur/robot"
          >
            <Bot
              aria-hidden="true"
            />

            Ouvrir le robot caméra
          </Link>
        )}
      </header>


      {/*
        ========================================================
        CHARGEMENT
        ========================================================
      */}

      {isLoading && (
        <div className="empty-state">
          <Image
            aria-hidden="true"
          />

          <strong>
            Chargement des caméras
          </strong>

          <span>
            Lecture de l'installation depuis le serveur.
          </span>
        </div>
      )}


      {/*
        ========================================================
        AUCUNE CAMÉRA
        ========================================================
      */}

      {!isLoading &&
        cameras.length ===
          0 && (
          <div className="empty-state">
            <Image
              aria-hidden="true"
            />

            <strong>
              Aucune caméra fixe
            </strong>

            <span>
              Le serveur ne connaît actuellement
              aucune caméra fixe pour cette installation.
            </span>
          </div>
        )}


      {/*
        ========================================================
        CAMÉRA ACTIVE
        ========================================================
      */}

      {!isLoading &&
        selectedCamera && (
          <>
            {/*
              ==================================================
              SÉLECTEUR DE CAMÉRA
              ==================================================

              Une caméra :
              le sélecteur n'est pas affiché.

              Plusieurs caméras :
              on permet de choisir.

              On évite de charger 20 flux vidéo
              simultanément.
            */}

            {cameras.length > 1 && (
              <div className="period-select">
                <span>
                  Caméra affichée
                </span>

                <select
                  value={
                    selectedCamera.id
                  }
                  onChange={
                    (event) => {
                      setSearchParams({
                        camera:
                          event.target
                            .value,
                      })
                    }
                  }
                >
                  {cameras.map(
                    (camera) => (
                      <option
                        key={
                          camera.id
                        }
                        value={
                          camera.id
                        }
                      >
                        {camera.name}
                        {' · '}
                        {camera.location}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}


            <CameraViewer
              cameraId={
                selectedCamera.id
              }
            />


            {/*
              ==================================================
              MÉDIAS
              ==================================================
            */}

            <section className="page-section">
              <div className="section-heading">
                <div>
                  <p className="page-eyebrow">
                    Conservation
                  </p>

                  <h2>
                    Médias de cette caméra
                  </h2>
                </div>

                <span className="section-note">
                  <Clock3
                    aria-hidden="true"
                  />

                  Suppression automatique après 48 h
                </span>
              </div>


              <div className="media-grid">
                {selectedCameraMedia.map(
                  (item) => (
                    <article
                      className="media-card"
                      key={
                        item.id
                      }
                    >
                      <div className="media-preview">
                        {item.kind ===
                        'VIDEO' ? (
                          <Film
                            aria-hidden="true"
                          />
                        ) : (
                          <Image
                            aria-hidden="true"
                          />
                        )}

                        <span>
                          {item.kind ===
                          'VIDEO'
                            ? 'Vidéo'
                            : 'Capture'}
                        </span>
                      </div>


                      <div className="media-card-body">
                        <div>
                          <strong>
                            {
                              item.cameraName
                            }
                          </strong>

                          <span>
                            {
                              item.createdAt
                            }
                          </span>
                        </div>


                        <p>
                          {item.saved
                            ? 'Conservation permanente demandée'
                            : `Expiration : ${item.expiresAt}`}
                        </p>


                        <button
                          className={
                            item.saved
                              ? 'saved-media-button'
                              : 'secondary-button'
                          }
                          type="button"
                          onClick={() => {
                            void toggleMediaSaved(
                              item.id,
                            )
                          }}
                        >
                          {item.saved ? (
                            <BookmarkCheck
                              aria-hidden="true"
                            />
                          ) : (
                            <Bookmark
                              aria-hidden="true"
                            />
                          )}

                          {item.saved
                            ? 'Sauvegardé'
                            : 'Sauvegarder'}
                        </button>
                      </div>
                    </article>
                  ),
                )}


                {selectedCameraMedia.length ===
                  0 && (
                  <div className="empty-state">
                    <Image
                      aria-hidden="true"
                    />

                    <strong>
                      Aucun média récent
                    </strong>

                    <span>
                      Les captures et vidéos
                      de cette caméra apparaîtront ici.
                    </span>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
    </div>
  )
}


export default UserCamerasPage