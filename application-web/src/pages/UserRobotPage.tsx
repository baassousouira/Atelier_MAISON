import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  Camera,
  Gauge,
  Square,
  Wifi,
  WifiOff,
} from 'lucide-react'

import {
  useSearchParams,
} from 'react-router-dom'

import CameraViewer
  from '../components/user/CameraViewer'

import {
  useSystem,
} from '../hooks/useSystem'


function UserRobotPage() {
  const {
    equipment,
    sendRobotCommand,
    takeScreenshot,
    serverConnection,
    isLoading,
  } = useSystem()


  const [
    speed,
    setSpeed,
  ] =
    useState(40)


  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams()


  /*
    ============================================================
    LISTE DYNAMIQUE DES SYSTÈMES MOBILES
    ============================================================

    Aucun ID de robot
    n'est codé en dur.

    Un ensemble est mobile lorsqu'il contient un SERVO.
    Le servomoteur sert donc ici de représentant du système mobile.
  */

  const robots =
    useMemo(
      () =>
        equipment
          .filter(
            (item) =>
              item.kind ===
              'SERVO',
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
    ROBOT DEMANDÉ DANS L'URL
    ============================================================
  */

  const requestedRobotId =
    searchParams.get(
      'robot',
    )


  const requestedRobot =
    robots.find(
      (robot) =>
        robot.id ===
        requestedRobotId,
    )


  const robot =
    requestedRobot ??
    robots[0] ??
    null


  /*
    ============================================================
    SYNCHRONISER URL
    ============================================================
  */

  useEffect(
    () => {
      if (!robot) {
        return
      }

      if (
        requestedRobotId ===
        robot.id
      ) {
        return
      }

      setSearchParams(
        {
          robot:
            robot.id,
        },

        {
          replace: true,
        },
      )
    },

    [
      requestedRobotId,
      robot,
      setSearchParams,
    ],
  )


  /*
    ============================================================
    CAMÉRA ASSOCIÉE AU ROBOT
    ============================================================

    Méthode principale :

    même groupId que le servomoteur qui caractérise l'ensemble MOBILE.

    parentDeviceId reste supporté si le serveur le fournit plus tard.
  */

  const camera =
    robot
      ? equipment.find(
          (item) =>
            item.kind ===
              'ROBOT_CAMERA' &&
            item.parentDeviceId ===
              robot.id,
        ) ??
        equipment.find(
          (item) =>
            item.kind ===
              'ROBOT_CAMERA' &&
            item.groupId ===
              robot.groupId,
        ) ??
        null
      : null


  /*
    ============================================================
    DISPONIBILITÉ PILOTAGE
    ============================================================
  */

  const canMove =
    Boolean(
      serverConnection.status ===
        'CONNECTED' &&
      robot &&
      robot.status ===
        'ONLINE' &&
      robot.enabled &&
      camera &&
      camera.status ===
        'ONLINE' &&
      camera.enabled,
    )


  const canUseCamera =
    Boolean(
      serverConnection.status ===
        'CONNECTED' &&
      camera &&
      camera.status ===
        'ONLINE' &&
      camera.enabled,
    )


  /*
    ============================================================
    COMMANDE SIMPLE
    ============================================================
  */

  function command(
    apiCommand:
      | 'FORWARD'
      | 'BACKWARD'
      | 'LEFT'
      | 'RIGHT',
  ) {
    if (
      !canMove ||
      !robot
    ) {
      return
    }

    void sendRobotCommand(
      robot.id,

      apiCommand,

      speed,
    )
  }


  return (
    <div className="user-page">
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">
            Caméra mobile
          </p>

          <h1>
            {robot
              ? `Piloter ${robot.name.toLowerCase()}`
              : 'Piloter le robot'}
          </h1>

          <p>
            Consultez le direct et contrôlez
            les déplacements depuis le même écran.
          </p>
        </div>


        <span
          className={
            `page-status ${
              canMove
                ? 'is-success'
                : 'is-warning'
            }`
          }
        >
          {canMove ? (
            <Wifi
              aria-hidden="true"
            />
          ) : (
            <WifiOff
              aria-hidden="true"
            />
          )}

          {canMove
            ? 'Prêt à piloter'
            : 'Pilotage indisponible'}
        </span>
      </header>


      {/*
        ========================================================
        CHARGEMENT
        ========================================================
      */}

      {isLoading && (
        <div className="empty-state">
          <Bot
            aria-hidden="true"
          />

          <strong>
            Chargement du robot
          </strong>

          <span>
            Lecture de l'installation depuis le serveur.
          </span>
        </div>
      )}


      {/*
        ========================================================
        AUCUN ROBOT
        ========================================================
      */}

      {!isLoading &&
        robots.length ===
          0 && (
          <div className="empty-state">
            <Bot
              aria-hidden="true"
            />

            <strong>
              Aucun robot mobile
            </strong>

            <span>
              Aucun équipement de type ROBOT
              n'est actuellement déclaré par le serveur.
            </span>
          </div>
        )}


      {!isLoading &&
        robot && (
          <>
            {/*
              ==================================================
              SÉLECTEUR SI PLUSIEURS ROBOTS
              ==================================================
            */}

            {robots.length > 1 && (
              <div className="period-select">
                <span>
                  Robot piloté
                </span>

                <select
                  value={
                    robot.id
                  }
                  onChange={
                    (event) => {
                      setSearchParams({
                        robot:
                          event.target
                            .value,
                      })
                    }
                  }
                >
                  {robots.map(
                    (
                      robotItem,
                    ) => (
                      <option
                        key={
                          robotItem.id
                        }
                        value={
                          robotItem.id
                        }
                      >
                        {
                          robotItem.name
                        }
                        {' · '}
                        {
                          robotItem.location
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}


            {/*
              ==================================================
              ROBOT SANS CAMÉRA
              ==================================================
            */}

            {!camera && (
              <div className="empty-state">
                <Camera
                  aria-hidden="true"
                />

                <strong>
                  Caméra mobile absente
                </strong>

                <span>
                  Ce robot n'a aucune caméra
                  mobile associée.
                </span>
              </div>
            )}


            {/*
              ==================================================
              ESPACE DE PILOTAGE
              ==================================================
            */}

            {camera && (
              <div className="robot-workspace">
                <div className="robot-live-panel">
                  <CameraViewer
                    cameraId={
                      camera.id
                    }
                    compact
                  />
                </div>


                {/*
                  ================================================
                  TÉLÉMÉTRIE
                  ================================================

                  IMPORTANT :

                  aucune photorésistance ici.

                  Le capteur de luminosité appartient
                  à la caméra fixe.
                */}

                <div className="robot-telemetry-grid robot-telemetry-grid-compact">
                  <article>
                    <Gauge
                      aria-hidden="true"
                    />

                    <span>
                      <small>
                        Vitesse choisie
                      </small>

                      <strong>
                        {speed} %
                      </strong>
                    </span>
                  </article>


                  <article>
                    <Bot
                      aria-hidden="true"
                    />

                    <span>
                      <small>
                        État du robot
                      </small>

                      <strong>
                        {canMove
                          ? 'Disponible'
                          : 'À vérifier'}
                      </strong>
                    </span>
                  </article>
                </div>


                {/*
                  ================================================
                  CONTRÔLE
                  ================================================
                */}

                <section className="robot-command-console">
                  <div className="command-console-heading">
                    <span>
                      <Bot
                        aria-hidden="true"
                      />
                    </span>

                    <div>
                      <p>
                        Contrôle manuel
                      </p>

                      <h2>
                        Déplacement
                      </h2>
                    </div>
                  </div>


                  <p className="command-help">
                    Chaque appui envoie une commande courte.
                    Le robot s&apos;arrête automatiquement
                    si aucune nouvelle commande n&apos;est reçue.
                  </p>


                  <div className="speed-control">
                    <div>
                      <label htmlFor="robot-speed">
                        Vitesse
                      </label>

                      <strong>
                        {speed} %
                      </strong>
                    </div>

                    <input
                      id="robot-speed"
                      type="range"
                      min="20"
                      max="80"
                      step="10"
                      value={
                        speed
                      }
                      disabled={
                        !canMove
                      }
                      onChange={
                        (event) => {
                          setSpeed(
                            Number(
                              event.target
                                .value,
                            ),
                          )
                        }
                      }
                    />

                    <div className="speed-labels">
                      <span>
                        Précise
                      </span>

                      <span>
                        Rapide
                      </span>
                    </div>
                  </div>


                  <div
                    className="direction-pad"
                    aria-label="Commandes directionnelles"
                  >
                    <button
                      className="direction-up"
                      type="button"
                      aria-label="Faire avancer le robot"
                      disabled={
                        !canMove
                      }
                      onClick={() =>
                        command(
                          'FORWARD',
                        )
                      }
                    >
                      <ArrowUp
                        aria-hidden="true"
                      />

                      <span>
                        Avancer
                      </span>
                    </button>


                    <button
                      className="direction-left"
                      type="button"
                      aria-label="Tourner à gauche"
                      disabled={
                        !canMove
                      }
                      onClick={() =>
                        command(
                          'LEFT',
                        )
                      }
                    >
                      <ArrowLeft
                        aria-hidden="true"
                      />

                      <span>
                        Gauche
                      </span>
                    </button>


                    <button
                      className="direction-stop"
                      type="button"
                      aria-label="Arrêter immédiatement le robot"
                      disabled={
                        serverConnection.status !==
                        'CONNECTED'
                      }
                      onClick={() => {
                        void sendRobotCommand(
                          robot.id,

                          'STOP',

                          0,
                        )
                      }}
                    >
                      <Square
                        aria-hidden="true"
                      />

                      <span>
                        Arrêt
                      </span>
                    </button>


                    <button
                      className="direction-right"
                      type="button"
                      aria-label="Tourner à droite"
                      disabled={
                        !canMove
                      }
                      onClick={() =>
                        command(
                          'RIGHT',
                        )
                      }
                    >
                      <ArrowRight
                        aria-hidden="true"
                      />

                      <span>
                        Droite
                      </span>
                    </button>


                    <button
                      className="direction-down"
                      type="button"
                      aria-label="Faire reculer le robot"
                      disabled={
                        !canMove
                      }
                      onClick={() =>
                        command(
                          'BACKWARD',
                        )
                      }
                    >
                      <ArrowDown
                        aria-hidden="true"
                      />

                      <span>
                        Reculer
                      </span>
                    </button>
                  </div>


                  <div className="robot-secondary-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={
                        !canUseCamera
                      }
                      onClick={() => {
                        void takeScreenshot(
                          camera.id,
                        )
                      }}
                    >
                      <Camera
                        aria-hidden="true"
                      />

                      Capturer l&apos;image
                    </button>


                    {/* Demi-tour retiré : aucune commande API dédiée n'est définie. */}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
    </div>
  )
}


export default UserRobotPage