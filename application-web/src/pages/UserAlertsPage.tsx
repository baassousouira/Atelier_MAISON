import {
  useState,
} from 'react'

import {
  AlertTriangle,
  Camera,
  Clock3,
  Eye,
  MapPin,
  Radio,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  useSystem,
} from '../hooks/useSystem'


function UserAlertsPage() {
  const {
    activeAlert,
    equipment,
    serverConnection,
    isLoading,
  } =
    useSystem()


  // URL du flux ayant échoué. Une nouvelle URL sera automatiquement
  // retentée sans devoir réinitialiser un booléen dans un useEffect.
  const [
    failedStreamUrl,
    setFailedStreamUrl,
  ] = useState<string | null>(null)


  /*
    ============================================================
    CAMÉRA ASSOCIÉE À L'ALERTE
    ============================================================

    cameraId vient directement du serveur.

    Aucun ID fixe n'est utilisé.
  */

  const alertCamera =
    activeAlert?.cameraId
      ? equipment.find(
          (item) =>
            item.id ===
            activeAlert.cameraId,
        ) ??
        null
      : null


  const alertStreamUrl =
    alertCamera?.streamUrl


  /*
    ============================================================
    DISPONIBILITÉ
    ============================================================
  */

  const cameraAvailable =
    Boolean(
      activeAlert &&
      alertCamera &&
      serverConnection.status ===
        'CONNECTED' &&
      alertCamera.status ===
        'ONLINE' &&
      alertCamera.enabled,
    )




  /*
    ============================================================
    LIEN VERS LA BONNE PAGE
    ============================================================
  */

  const cameraDetailsLink =
    alertCamera
      ? alertCamera.kind ===
        'ROBOT_CAMERA'
        ? alertCamera.parentDeviceId
          ? `/utilisateur/robot?robot=${encodeURIComponent(
              alertCamera.parentDeviceId,
            )}`
          : '/utilisateur/robot'
        : `/utilisateur/cameras?camera=${encodeURIComponent(
            alertCamera.id,
          )}`
      : null


  return (
    <div className="user-page">
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">
            Sécurité
          </p>

          <h1>
            Alertes
          </h1>

          <p>
            Consultez les événements détectés
            et le direct de la zone concernée.
          </p>
        </div>


        {activeAlert && (
          <span className="page-status is-warning">
            <AlertTriangle
              aria-hidden="true"
            />

            Alerte active
          </span>
        )}
      </header>


      {/*
        ========================================================
        CHARGEMENT
        ========================================================
      */}

      {isLoading && (
        <div className="empty-state">
          <AlertTriangle
            aria-hidden="true"
          />

          <strong>
            Chargement des alertes
          </strong>

          <span>
            Lecture des données depuis le serveur central.
          </span>
        </div>
      )}


      {/*
        ========================================================
        AUCUNE ALERTE
        ========================================================
      */}

      {!isLoading &&
        !activeAlert && (
          <div className="empty-state">
            <ShieldCheck
              aria-hidden="true"
            />

            <strong>
              Aucune alerte active
            </strong>

            <span>
              Le serveur ne signale actuellement
              aucun événement nécessitant votre attention.
            </span>
          </div>
        )}


      {/*
        ========================================================
        ALERTE
        ========================================================
      */}

      {!isLoading &&
        activeAlert && (
          <div className="alert-workspace">
            <section className="alert-detail-card">
              <div className="alert-notification-header">
                <div className="alert-detail-heading">
                  <span>
                    <AlertTriangle
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <p>
                      Alerte
                      {' · '}
                      {
                        activeAlert.id
                      }
                    </p>

                    <h2>
                      {
                        activeAlert.title
                      }
                    </h2>
                  </div>
                </div>
              </div>


              <p className="alert-detail-description">
                {
                  activeAlert.description
                }
              </p>


              {/*
                =================================================
                DIRECT
                =================================================

                Aucune autorisation supplémentaire.

                Si l'utilisateur possède
                les droits de son compte,
                la caméra est accessible.
              */}

              {alertCamera && (
                <div className="alert-live-preview">
                  <div className="alert-live-preview-screen">
                    {cameraAvailable &&
                    alertStreamUrl &&
                    failedStreamUrl !== alertStreamUrl ? (
                      <img
                        src={
                          alertStreamUrl
                        }
                        alt={
                          `Direct de ${alertCamera.name}`
                        }
                        onError={() => {
                          setFailedStreamUrl(
                            alertStreamUrl ?? null,
                          )
                        }}
                      />
                    ) : (
                      <div className="alert-live-placeholder">
                        {serverConnection.status ===
                        'DISCONNECTED' ? (
                          <WifiOff
                            aria-hidden="true"
                          />
                        ) : (
                          <Camera
                            aria-hidden="true"
                          />
                        )}

                        <strong>
                          {serverConnection.status ===
                          'DISCONNECTED'
                            ? 'Connexion interrompue'
                            : !cameraAvailable
                              ? 'Caméra indisponible'
                              : failedStreamUrl === alertStreamUrl
                                ? 'Flux vidéo inaccessible'
                                : 'Direct en attente'}
                        </strong>

                        <span>
                          {serverConnection.status ===
                          'DISCONNECTED'
                            ? 'Le direct sera rétabli dès que la communication avec le système sera disponible.'
                            : !cameraAvailable
                              ? "La caméra associée à cette alerte n'est pas disponible actuellement."
                              : failedStreamUrl === alertStreamUrl
                                ? 'Le navigateur ne parvient pas à charger le flux fourni par le serveur.'
                                : "Le serveur n'a pas encore fourni d'URL de flux pour cette caméra."}
                        </span>
                      </div>
                    )}


                    {cameraAvailable && (
                      <span className="alert-live-badge">
                        <Radio
                          aria-hidden="true"
                        />

                        Direct
                      </span>
                    )}


                    <span className="alert-live-location">
                      {
                        alertCamera.location
                      }
                    </span>
                  </div>


                  <div className="alert-live-preview-footer">
                    <div>
                      <span>
                        <Camera
                          aria-hidden="true"
                        />

                        Caméra associée
                      </span>

                      <strong>
                        {
                          alertCamera.name
                        }
                      </strong>
                    </div>


                    {cameraDetailsLink && (
                      <Link
                        className="alert-live-view-button"
                        to={
                          cameraDetailsLink
                        }
                      >
                        <Eye
                          aria-hidden="true"
                        />

                        Voir
                      </Link>
                    )}
                  </div>
                </div>
              )}


              {/*
                =================================================
                INFORMATIONS
                =================================================
              */}

              <div className="alert-facts">
                <div>
                  <MapPin
                    aria-hidden="true"
                  />

                  <span>
                    <small>
                      Zone concernée
                    </small>

                    <strong>
                      {
                        activeAlert.location
                      }
                    </strong>
                  </span>
                </div>


                <div>
                  <Clock3
                    aria-hidden="true"
                  />

                  <span>
                    <small>
                      Détection
                    </small>

                    <strong>
                      {
                        activeAlert.detectedAt
                      }
                    </strong>
                  </span>
                </div>


                {activeAlert.confidence !== undefined && (
                  <div>
                    <ShieldCheck aria-hidden="true" />

                    <span>
                      <small>Indice de détection</small>

                      <strong>
                        {activeAlert.confidence}
                        {' %'}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </section>


            {/*
              ==================================================
              SUIVI
              ==================================================
            */}

            <aside className="alert-side-card">
              <h2>
                Suivi de l'alerte
              </h2>

              <ol>
                <li className="is-complete">
                  Événement détecté
                </li>

                <li className="is-complete">
                  Alerte créée
                </li>

                <li className="is-current">
                  Surveillance en cours
                </li>

                <li>
                  Clôture de l'alerte
                </li>
              </ol>
            </aside>
          </div>
        )}
    </div>
  )
}


export default UserAlertsPage