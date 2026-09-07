import type {
  LucideIcon,
} from 'lucide-react'

import {
  ArrowLeft,
  Bot,
  Camera,
  CircleDot,
  CircleGauge,
  Clock3,
  Lightbulb,
  MapPin,
  Power,
  Radar,
  SlidersHorizontal,
  ShieldCheck,
  SunMedium,
  Video,
  Wifi,
  WifiOff,
} from 'lucide-react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  useSystem,
} from '../hooks/useSystem'

import type {
  EquipmentKind,
} from '../types/dashboard'


/*
  ============================================================
  ICÔNES
  ============================================================
*/

const equipmentIcons:
  Record<
    EquipmentKind,
    LucideIcon
  > = {
    CAMERA:
      Camera,

    ROBOT_CAMERA:
      Video,

    MOTION_SENSOR:
      Radar,

    LED:
      Lightbulb,

    PHOTORESISTOR:
      SunMedium,

    ROBOT:
      Bot,

    BUTTON:
      CircleDot,

    SERVO:
      SlidersHorizontal,

    OTHER:
      CircleDot,
  }


/*
  ============================================================
  NOMS DES TYPES
  ============================================================
*/

const kindLabels:
  Record<
    EquipmentKind,
    string
  > = {
    CAMERA:
      'Caméra de surveillance',

    ROBOT_CAMERA:
      'Caméra mobile',

    MOTION_SENSOR:
      'Capteur de mouvement',

    LED:
      "Signal d'alerte",

    PHOTORESISTOR:
      'Capteur de luminosité',

    ROBOT:
      'Robot mobile',

    BUTTON:
      'Bouton physique',

    SERVO:
      'Servomoteur',

    OTHER:
      'Équipement',
  }


/*
  ============================================================
  DESCRIPTIONS
  ============================================================

  Elles sont volontairement génériques.

  On n'écrit plus :

  salon
  entrée
  robot 01

  puisque l'emplacement réel
  vient du serveur.
*/

const kindDescriptions:
  Record<
    EquipmentKind,
    string
  > = {
    CAMERA:
      'Permet de surveiller une zone en vidéo et de réaliser des captures lorsque la caméra est activée.',

    ROBOT_CAMERA:
      'Fournit le retour vidéo associé à un robot mobile.',

    MOTION_SENSOR:
      'Détecte les mouvements dans sa zone et transmet ses détections à la logique de surveillance lorsqu’il est activé.',

    LED:
      "Produit un signal lumineux local lorsque le système ou une règle d'alerte demande son activation.",

    PHOTORESISTOR:
      'Mesure la luminosité de sa zone afin que le système puisse utiliser cette information dans la surveillance.',

    ROBOT:
      'Permet de déplacer un module mobile de surveillance à distance.',

    BUTTON:
      'Bouton physique déclaré par le contrôleur et pris en compte par la logique locale lorsqu’il est activé.',

    SERVO:
      'Servomoteur permettant le mouvement ou l’orientation de la partie mobile du système.',

    OTHER:
      'Composant déclaré par le Raspberry mais sans type spécialisé dans l’interface.',
  }


const detectionKinds:
  EquipmentKind[] = [
    'CAMERA',
    'ROBOT_CAMERA',
    'MOTION_SENSOR',
    'PHOTORESISTOR',
  ]


function UserEquipmentDetailPage() {
  const {
    equipmentId,
  } =
    useParams()


  const {
    equipment,
    toggleEquipment,
    activeDetectionSourceIds,
    serverConnection,
    isLoading,
  } =
    useSystem()


  /*
    ============================================================
    ÉQUIPEMENT
    ============================================================
  */

  const item =
    equipment.find(
      (
        equipmentItem,
      ) =>
        equipmentItem.id ===
        equipmentId,
    )


  /*
    ============================================================
    CHARGEMENT
    ============================================================
  */

  if (isLoading) {
    return (
      <div className="user-page">
        <section className="equipment-not-found">
          <strong>
            Chargement de l'équipement
          </strong>

          <span>
            Lecture des données depuis le serveur central.
          </span>
        </section>
      </div>
    )
  }


  /*
    ============================================================
    INTROUVABLE
    ============================================================
  */

  if (!item) {
    return (
      <div className="user-page">
        <Link
          className="equipment-back-link"
          to="/utilisateur/equipements"
        >
          <ArrowLeft
            aria-hidden="true"
          />

          Retour aux équipements
        </Link>

        <section className="equipment-not-found">
          <strong>
            Équipement introuvable
          </strong>

          <span>
            Cet équipement n'existe pas
            ou n'est plus associé à cette installation.
          </span>
        </section>
      </div>
    )
  }


  const Icon =
    equipmentIcons[
      item.kind
    ]


  const canControl =
    item.controllable &&
    item.status ===
      'ONLINE' &&
    serverConnection.status ===
      'CONNECTED'


  const participatesInDetection =
    detectionKinds.includes(
      item.kind,
    )


  const currentlyUsedByDetection =
    activeDetectionSourceIds
      .includes(
        item.id,
      )


  /*
    ============================================================
    ÉQUIPEMENT PARENT
    ============================================================

    Cette relation vient désormais
    des données du serveur.
  */

  const parentEquipment =
    item.parentDeviceId
      ? equipment.find(
          (
            candidate,
          ) =>
            candidate.id ===
            item.parentDeviceId,
        ) ??
        null
      : null


  /*
    ============================================================
    CAMÉRA DU MÊME GROUPE
    ============================================================
  */

  const cameraInSameGroup =
    equipment.find(
      (
        candidate,
      ) =>
        candidate.groupId ===
          item.groupId &&
        candidate.kind ===
          'CAMERA',
    )


  /*
    Pour une photorésistance :

    priorité à parentDeviceId.

    Sinon :
    première caméra du même groupe.
  */

  const associatedFixedCamera =
    item.kind ===
    'PHOTORESISTOR'
      ? parentEquipment?.kind ===
        'CAMERA'
        ? parentEquipment
        : cameraInSameGroup ??
          null
      : null


  /*
    ============================================================
    PAGE SPÉCIALISÉE
    ============================================================
  */

  let dedicatedPage:
    string |
    null = null


  let dedicatedPageLabel:
    string |
    null = null


  /*
    Caméra fixe.
  */

  if (
    item.kind ===
    'CAMERA'
  ) {
    dedicatedPage =
      `/utilisateur/cameras?camera=${encodeURIComponent(
        item.id,
      )}`

    dedicatedPageLabel =
      'Ouvrir la caméra'
  }


  /*
    Photorésistance :
    redirection vers sa caméra.
  */

  if (
    item.kind ===
      'PHOTORESISTOR' &&
    associatedFixedCamera
  ) {
    dedicatedPage =
      `/utilisateur/cameras?camera=${encodeURIComponent(
        associatedFixedCamera.id,
      )}`

    dedicatedPageLabel =
      'Voir la caméra associée'
  }


  /*
    Robot.
  */

  if (
    item.kind === 'ROBOT' ||
    item.kind === 'SERVO'
  ) {
    dedicatedPage =
      `/utilisateur/robot?robot=${encodeURIComponent(
        item.id,
      )}`

    dedicatedPageLabel =
      'Ouvrir le pilotage'
  }


  /*
    Caméra robot.
  */

  if (
    item.kind ===
    'ROBOT_CAMERA'
  ) {
    const robot =
      parentEquipment?.kind ===
      'SERVO'
        ? parentEquipment
        : equipment.find(
            (
              candidate,
            ) =>
              candidate.kind ===
                'SERVO' &&
              candidate.groupId ===
                item.groupId,
          ) ??
          null


    if (robot) {
      dedicatedPage =
        `/utilisateur/robot?robot=${encodeURIComponent(
          robot.id,
        )}`

      dedicatedPageLabel =
        'Ouvrir le pilotage'
    }
  }


  return (
    <div className="user-page">
      <Link
        className="equipment-back-link"
        to="/utilisateur/equipements"
      >
        <ArrowLeft
          aria-hidden="true"
        />

        Retour aux équipements
      </Link>


      <header className="equipment-detail-hero">
        <span className="equipment-detail-icon">
          <Icon
            aria-hidden="true"
          />
        </span>


        <div>
          <p className="page-eyebrow">
            {
              kindLabels[
                item.kind
              ]
            }
          </p>

          <h1>
            {item.name}
          </h1>

          <p>
            {
              kindDescriptions[
                item.kind
              ]
            }
          </p>
        </div>


        <button
          className={
            `equipment-main-toggle ${
              item.enabled
                ? 'is-enabled'
                : ''
            }`
          }
          type="button"
          disabled={
            !canControl
          }
          onClick={() => {
            void toggleEquipment(
              item.id,
            )
          }}
        >
          <Power
            aria-hidden="true"
          />

          {item.enabled
            ? 'Désactiver'
            : 'Activer'}
        </button>
      </header>


      {/*
        ========================================================
        CONNEXION
        ========================================================
      */}

      {serverConnection.status !==
        'CONNECTED' && (
        <div className="equipment-detail-warning">
          <WifiOff
            aria-hidden="true"
          />

          <span>
            Les commandes sont indisponibles
            tant que la connexion avec le système
            n'est pas rétablie.
          </span>
        </div>
      )}


      <div className="equipment-detail-grid">
        {/*
          ======================================================
          ÉTAT
          ======================================================
        */}

        <section className="equipment-detail-card">
          <div className="equipment-detail-card-heading">
            <h2>
              État
            </h2>
          </div>

          <div className="equipment-detail-state">
            <div>
              {item.status ===
              'ONLINE' ? (
                <Wifi
                  aria-hidden="true"
                />
              ) : (
                <WifiOff
                  aria-hidden="true"
                />
              )}

              <span>
                <small>
                  Connexion
                </small>

                <strong>
                  {item.status ===
                  'ONLINE'
                    ? 'En ligne'
                    : 'Hors ligne'}
                </strong>
              </span>
            </div>


            <div>
              <Power
                aria-hidden="true"
              />

              <span>
                <small>
                  Fonctionnement
                </small>

                <strong>
                  {item.enabled
                    ? 'Actif'
                    : 'Désactivé'}
                </strong>
              </span>
            </div>
          </div>
        </section>


        {/*
          ======================================================
          INFORMATIONS
          ======================================================
        */}

        <section className="equipment-detail-card">
          <div className="equipment-detail-card-heading">
            <h2>
              Informations
            </h2>
          </div>

          <div className="equipment-detail-info-list">
            <div>
              <MapPin
                aria-hidden="true"
              />

              <span>
                <small>
                  Emplacement
                </small>

                <strong>
                  {item.location}
                </strong>
              </span>
            </div>


            <div>
              <Clock3
                aria-hidden="true"
              />

              <span>
                <small>
                  Dernier contact
                </small>

                <strong>
                  {item.lastSeen}
                </strong>
              </span>
            </div>


            {item.value && (
              <div>
                <CircleGauge
                  aria-hidden="true"
                />

                <span>
                  <small>
                    Mesure actuelle
                  </small>

                  <strong>
                    {item.value}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </section>


        {/*
          ======================================================
          PARTICIPATION À LA DÉTECTION
          ======================================================
        */}

        {participatesInDetection && (
          <section className="equipment-detail-card equipment-detail-detection-card">
            <div className="equipment-detail-card-heading">
              <h2>
                Utilisation par la surveillance
              </h2>
            </div>

            <div className="detection-state-row">
              <ShieldCheck
                aria-hidden="true"
              />

              <div>
                <strong>
                  {currentlyUsedByDetection
                    ? 'Pris en compte'
                    : 'Ignoré actuellement'}
                </strong>

                <span>
                  {currentlyUsedByDetection
                    ? "Cet équipement est actif et disponible. Ses données peuvent donc être utilisées automatiquement par la logique de surveillance."
                    : "Cet équipement n'est actuellement pas utilisé par la logique de surveillance."}
                </span>
              </div>
            </div>
          </section>
        )}


        {/*
          ======================================================
          CAMÉRA ASSOCIÉE À LA PHOTORÉSISTANCE
          ======================================================
        */}

        {associatedFixedCamera && (
          <section className="equipment-detail-card equipment-detail-detection-card">
            <div className="equipment-detail-card-heading">
              <h2>
                Équipement associé
              </h2>
            </div>

            <div className="detection-state-row">
              <Camera
                aria-hidden="true"
              />

              <div>
                <strong>
                  {
                    associatedFixedCamera.name
                  }
                </strong>

                <span>
                  Ce capteur est associé à la caméra
                  située dans le même groupe de surveillance.
                </span>
              </div>
            </div>
          </section>
        )}


        {/*
          ======================================================
          CONTRÔLE AVANCÉ
          ======================================================
        */}

        {dedicatedPage &&
          dedicatedPageLabel && (
          <section className="equipment-detail-card equipment-detail-action-card">
            <div>
              <h2>
                Contrôle avancé
              </h2>

              <p>
                Accédez à l'écran associé
                pour utiliser les fonctions complémentaires.
              </p>
            </div>

            <Link
              className="primary-button"
              to={
                dedicatedPage
              }
            >
              {
                dedicatedPageLabel
              }
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}


export default UserEquipmentDetailPage