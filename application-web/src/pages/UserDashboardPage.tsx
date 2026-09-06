import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  Bot,
  Camera,
  Cpu,
  Power,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import MetricCard
  from '../components/user/MetricCard'

import {
  useSystem,
} from '../hooks/useSystem'


function UserDashboardPage() {
  const {
    activeAlert,
    equipment,
    isArmed,
    serverConnection,
    statistics,
    toggleSecuritySystem,
  } =
    useSystem()


  /*
    ============================================================
    COMPTEURS
    ============================================================
  */

  const onlineCount =
    equipment.filter(
      (item) =>
        item.status ===
        'ONLINE',
    ).length


  const hasActiveAlert =
    activeAlert?.status ===
    'ACTIVE'


  const systemConnected =
    serverConnection.status ===
    'CONNECTED'


  // Aucun nom de compte n'est inventé tant que l'authentification réelle
  // n'existe pas côté serveur.
  const greeting = 'Bonjour'


  /*
    ============================================================
    CAMÉRAS ET ROBOTS DYNAMIQUES
    ============================================================

    Aucun ID fixe.
  */

  const fixedCameras =
    equipment.filter(
      (item) =>
        item.kind ===
        'CAMERA',
    )


  // Le système mobile est identifié par la présence du servomoteur.
  const robots =
    equipment.filter(
      (item) =>
        item.kind ===
        'SERVO',
    )


  const firstCamera =
    fixedCameras[0]


  const firstRobot =
    robots[0]


  const latestMotionPoint =
    statistics
      .motionActivity[
        statistics
          .motionActivity
          .length -
        1
      ]


  return (
    <div className="user-page dashboard-page">
      {/*
        ========================================================
        EN-TÊTE
        ========================================================
      */}

      <header className="page-heading">
        <div>
          <p className="page-eyebrow">
            Vue d’ensemble
          </p>

          <h1>
            {greeting}
          </h1>

          <p>
            Consultez l’état de votre logement
            et accédez rapidement à chaque équipement.
          </p>
        </div>


        <button
          className={
            `system-power ${
              isArmed
                ? 'is-armed'
                : 'is-disarmed'
            }`
          }
          type="button"
          disabled={
            !systemConnected
          }
          onClick={() => {
            void toggleSecuritySystem()
          }}
        >
          <Power
            aria-hidden="true"
          />

          <span>
            <small>
              Surveillance
            </small>

            <strong>
              {isArmed
                ? 'Activée'
                : 'Désactivée'}
            </strong>
          </span>
        </button>
      </header>


      {/*
        ========================================================
        PROTECTION
        ========================================================
      */}

      <section
        className={
          `protection-hero ${
            isArmed
              ? 'is-armed'
              : 'is-disarmed'
          }`
        }
      >
        <span className="protection-hero-icon">
          <ShieldCheck
            aria-hidden="true"
          />
        </span>

        <div>
          <span>
            {isArmed
              ? 'Protection active'
              : 'Protection inactive'}
          </span>

          <h2>
            {isArmed
              ? 'Votre logement est actuellement surveillé'
              : 'Les détections automatiques sont suspendues'}
          </h2>

          <p>
            {!systemConnected
              ? 'La connexion avec le système est interrompue. Les commandes à distance sont suspendues jusqu’au rétablissement de la liaison.'
              : isArmed
                ? 'Les équipements actifs participent automatiquement à la surveillance.'
                : 'Vous pouvez toujours consulter vos équipements et réactiver la surveillance lorsque vous le souhaitez.'}
          </p>
        </div>


        <button
          type="button"
          disabled={
            !systemConnected
          }
          onClick={() => {
            void toggleSecuritySystem()
          }}
        >
          {isArmed
            ? 'Désactiver'
            : 'Activer'}
        </button>
      </section>


      {/*
        ========================================================
        ALERTE ACTIVE
        ========================================================

        Plus aucune demande
        d'autorisation vidéo.
      */}

      {hasActiveAlert &&
        activeAlert && (
        <section className="overview-alert">
          <span className="overview-alert-icon">
            <AlertTriangle
              aria-hidden="true"
            />
          </span>

          <div>
            <span>
              Alerte active
            </span>

            <h2>
              {
                activeAlert.title
              }
            </h2>

            <p>
              {
                activeAlert.location
              }

              {' · '}

              {
                activeAlert.detectedAt
              }

              {'. '}

              Consultez les informations
              et le direct associé.
            </p>
          </div>

          <Link to="/utilisateur/alertes">
            Consulter

            <ArrowRight
              aria-hidden="true"
            />
          </Link>
        </section>
      )}


      {/*
        ========================================================
        INDICATEURS
        ========================================================
      */}

      <section
        className="overview-metrics"
        aria-labelledby="metrics-title"
      >
        <div className="section-heading section-heading-compact">
          <div>
            <p className="page-eyebrow">
              Aujourd’hui
            </p>

            <h2 id="metrics-title">
              État en un coup d’œil
            </h2>
          </div>
        </div>


        <div
          className="metric-grid"
          aria-label="Indicateurs principaux"
        >
          <MetricCard
            icon={
              Activity
            }
            label="Mouvements"
            value={
              String(
                latestMotionPoint
                  ?.detections ??
                0,
              )
            }
            detail="Dernière période disponible"
            tone="teal"
          />


          <MetricCard
            icon={
              BellRing
            }
            label="Alertes actives"
            value={
              hasActiveAlert
                ? '1'
                : '0'
            }
            detail={
              hasActiveAlert
                ? 'Alerte en cours'
                : 'Aucune urgence'
            }
            tone="red"
          />


          <MetricCard
            icon={
              Cpu
            }
            label="Équipements"
            value={
              systemConnected
                ? `${onlineCount}/${equipment.length}`
                : '—'
            }
            detail={
              systemConnected
                ? 'Installation disponible'
                : 'Connexion interrompue'
            }
            tone="blue"
          />


          <MetricCard
            icon={
              systemConnected
                ? Wifi
                : WifiOff
            }
            label="Connexion"
            value={
              systemConnected
                ? 'Active'
                : 'Coupée'
            }
            detail={
              `Dernier contact : ${serverConnection.lastContact}`
            }
            tone="purple"
          />
        </div>
      </section>


      {/*
        ========================================================
        ACCÈS RAPIDES
        ========================================================
      */}

      <section className="overview-components">
        <div className="section-heading">
          <div>
            <p className="page-eyebrow">
              Accès rapides
            </p>

            <h2>
              Contrôler mon installation
            </h2>
          </div>
        </div>


        <div className="component-card-grid">
          {/*
            ====================================================
            CAMÉRAS
            ====================================================
          */}

          <Link
            className="component-card component-card-camera"
            to={
              firstCamera
                ? `/utilisateur/cameras?camera=${encodeURIComponent(
                    firstCamera.id,
                  )}`
                : '/utilisateur/cameras'
            }
          >
            <span className="component-card-icon">
              <Camera
                aria-hidden="true"
              />
            </span>

            <div>
              <span>
                Vidéo fixe
              </span>

              <h3>
                {fixedCameras.length ===
                  0
                  ? 'Aucune caméra fixe'
                  : fixedCameras.length ===
                      1
                    ? firstCamera?.name
                    : `${fixedCameras.length} caméras fixes`}
              </h3>

              <p>
                Consulter le direct,
                activer ou désactiver une caméra
                et gérer ses médias.
              </p>
            </div>

            <ArrowRight
              aria-hidden="true"
            />
          </Link>


          {/*
            ====================================================
            ROBOTS
            ====================================================
          */}

          <Link
            className="component-card component-card-robot"
            to={
              firstRobot
                ? `/utilisateur/robot?robot=${encodeURIComponent(
                    firstRobot.id,
                  )}`
                : '/utilisateur/robot'
            }
          >
            <span className="component-card-icon">
              <Bot
                aria-hidden="true"
              />
            </span>

            <div>
              <span>
                Caméra mobile
              </span>

              <h3>
                {robots.length ===
                  0
                  ? 'Aucun robot'
                  : robots.length ===
                      1
                    ? firstRobot?.name
                    : `${robots.length} robots mobiles`}
              </h3>

              <p>
                Voir le direct et déplacer
                un robot depuis le même écran.
              </p>
            </div>

            <ArrowRight
              aria-hidden="true"
            />
          </Link>


          {/*
            ====================================================
            ÉQUIPEMENTS
            ====================================================
          */}

          <Link
            className="component-card"
            to="/utilisateur/equipements"
          >
            <span className="component-card-icon">
              <Cpu
                aria-hidden="true"
              />
            </span>

            <div>
              <span>
                Installation
              </span>

              <h3>
                Mes équipements
              </h3>

              <p>
                Gérer toutes les caméras,
                les capteurs,
                les alertes locales
                et les robots
                depuis un seul espace.
              </p>
            </div>

            <ArrowRight
              aria-hidden="true"
            />
          </Link>


          {/*
            ====================================================
            STATISTIQUES
            ====================================================
          */}

          <Link
            className="component-card"
            to="/utilisateur/statistiques"
          >
            <span className="component-card-icon">
              <Activity
                aria-hidden="true"
              />
            </span>

            <div>
              <span>
                Analyse
              </span>

              <h3>
                Statistiques détaillées
              </h3>

              <p>
                Visualiser les mouvements,
                les alertes et la disponibilité
                de l’installation.
              </p>
            </div>

            <ArrowRight
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>
    </div>
  )
}


export default UserDashboardPage