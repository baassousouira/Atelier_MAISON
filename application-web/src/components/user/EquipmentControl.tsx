import type {
  LucideIcon,
} from 'lucide-react'

import {
  Bot,
  Camera,
  ChevronRight,
  CircleDot,
  Lightbulb,
  RadioTower,
  Sun,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  useSystem,
} from '../../hooks/useSystem'

import type {
  Equipment,
  EquipmentKind,
} from '../../types/dashboard'

import '../../styles/equipment-control.css'

type EquipmentControlProps = {
  equipment: Equipment
  detailsPath: string
}

/*
  ============================================================
  ICÔNES SELON LE TYPE D'ÉQUIPEMENT
  ============================================================
*/

const equipmentIcons: Record<EquipmentKind, LucideIcon> = {
  CAMERA: Camera,
  ROBOT_CAMERA: Camera,
  MOTION_SENSOR: RadioTower,
  LED: Lightbulb,
  PHOTORESISTOR: Sun,
  ROBOT: Bot,
  BUTTON: CircleDot,
  SERVO: SlidersHorizontal,
  OTHER: CircleDot,
}


function EquipmentControl({
  equipment,
  detailsPath,
}: EquipmentControlProps) {
  const {
    toggleEquipment,
    serverConnection,
  } = useSystem()

  const Icon =
    equipmentIcons[equipment.kind]

  /*
    Une commande est impossible si :

    - l'équipement est hors ligne ;
    - il n'est pas contrôlable ;
    - le système central n'est pas connecté.
  */
  const commandUnavailable =
    equipment.status === 'OFFLINE' ||
    !equipment.controllable ||
    serverConnection.status !== 'CONNECTED'

  const isOnline =
    equipment.status === 'ONLINE'

  return (
    <article className="equipment-v2-card">
      {/*
        ========================================================
        EN-TÊTE

        Le bouton "Voir" est sur la même ligne
        que le titre et placé complètement à droite.
        ========================================================
      */}

      <header className="equipment-v2-header">
        <div className="equipment-v2-heading">
          <span
            className={
              `equipment-v2-main-icon ${
                equipment.enabled
                  ? 'is-enabled'
                  : 'is-disabled'
              }`
            }
          >
            <Icon
              aria-hidden="true"
            />
          </span>

          <div className="equipment-v2-title">
            <strong>
              {equipment.name}
            </strong>

            <span>
              {equipment.location}
            </span>
          </div>
        </div>

        <Link
          className="equipment-v2-details-button"
          to={detailsPath}
          aria-label={
            `Voir les détails de ${equipment.name}`
          }
        >
          <span>
            Voir
          </span>

          <ChevronRight
            aria-hidden="true"
          />
        </Link>
      </header>

      {/*
        ========================================================
        INFORMATIONS
        ========================================================
      */}

      <div className="equipment-v2-information">
        {/*
          Connexion.
        */}

        <div className="equipment-v2-info-item">
          {isOnline ? (
            <Wifi
              aria-hidden="true"
            />
          ) : (
            <WifiOff
              aria-hidden="true"
            />
          )}

          <div>
            <span>
              Connexion
            </span>

            <strong
              className={
                isOnline
                  ? 'is-online'
                  : 'is-offline'
              }
            >
              {isOnline
                ? 'En ligne'
                : 'Hors ligne'}
            </strong>
          </div>
        </div>

        {/*
          Dernière activité.
        */}

        <div className="equipment-v2-info-item">
          <CircleDot
            aria-hidden="true"
          />

          <div>
            <span>
              Dernière activité
            </span>

            <strong>
              {equipment.lastSeen}
            </strong>
          </div>
        </div>

        {/*
          Valeur spécifique du capteur.

          Exemple :
          luminosité = 62 %
        */}

        {equipment.value && (
          <div className="equipment-v2-value">
            <span>
              Valeur actuelle
            </span>

            <strong>
              {equipment.value}
            </strong>
          </div>
        )}
      </div>

      {/*
        ========================================================
        ACTIVATION

        Actif / Désactivé et toggle
        sont sur la même ligne.
        ========================================================
      */}

      <footer className="equipment-v2-footer">
        <div className="equipment-v2-activation">
          <div className="equipment-v2-activation-copy">
            <span
              className={
                `equipment-v2-state-dot ${
                  equipment.enabled
                    ? 'is-enabled'
                    : 'is-disabled'
                }`
              }
              aria-hidden="true"
            />

            <strong>
              {equipment.enabled
                ? 'Actif'
                : 'Désactivé'}
            </strong>
          </div>

          {equipment.controllable ? (
            <button
              className={
                `equipment-v2-toggle ${
                  equipment.enabled
                    ? 'is-enabled'
                    : ''
                }`
              }
              type="button"
              role="switch"
              aria-checked={
                equipment.enabled
              }
              aria-label={
                equipment.enabled
                  ? `Désactiver ${equipment.name}`
                  : `Activer ${equipment.name}`
              }
              disabled={
                commandUnavailable
              }
              onClick={() => {
                void toggleEquipment(
                  equipment.id,
                )
              }}
            >
              <span />
            </button>
          ) : (
            <span className="equipment-v2-readonly">
              Lecture seule
            </span>
          )}
        </div>

        {/*
          Message uniquement si
          la commande est indisponible.
        */}

        {commandUnavailable &&
          equipment.controllable && (
          <p className="equipment-v2-unavailable">
            {serverConnection.status !== 'CONNECTED'
              ? 'Commande indisponible tant que le système est déconnecté.'
              : 'Cet équipement est actuellement hors ligne.'}
          </p>
        )}
      </footer>
    </article>
  )
}

export default EquipmentControl