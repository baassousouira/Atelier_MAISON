import {
  useState,
} from 'react'

import type {
  LucideIcon,
} from 'lucide-react'

import {
  Activity,
  BellRing,
  Bot,
  Camera,
  Cpu,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import NetworkIncidentModal
  from '../NetworkIncidentModal'

import {
  useSystem,
} from '../../hooks/useSystem'

import '../../styles/user-dashboard.css'

type NavigationItem = {
  label:
    string

  path:
    string

  icon:
    LucideIcon

  end?:
    boolean
}

/*
  ============================================================
  NAVIGATION
  ============================================================
*/
const navigationItems:
  NavigationItem[] = [
    {
      label:
        "Vue d'ensemble",

      path:
        '/utilisateur',

      icon:
        LayoutDashboard,

      end:
        true,
    },

    {
      label:
        'Alertes',

      path:
        '/utilisateur/alertes',

      icon:
        BellRing,
    },

    {
      label:
        'Caméra fixe',

      path:
        '/utilisateur/cameras',

      icon:
        Camera,
    },

    {
      label:
        'Robot caméra',

      path:
        '/utilisateur/robot',

      icon:
        Bot,
    },

    {
      label:
        'Équipements',

      path:
        '/utilisateur/equipements',

      icon:
        Cpu,
    },

    {
      label:
        'Statistiques',

      path:
        '/utilisateur/statistiques',

      icon:
        Activity,
    },

    {
      label:
        'Historique',

      path:
        '/utilisateur/historique',

      icon:
        History,
    },
  ]

/*
  Titres correspondant
  aux routes fixes.
*/
const pageTitles:
  Record<
    string,
    string
  > = {
    '/utilisateur':
      "Vue d'ensemble",

    '/utilisateur/alertes':
      'Alertes de sécurité',

    '/utilisateur/cameras':
      'Caméra fixe',

    '/utilisateur/robot':
      'Robot caméra',

    '/utilisateur/equipements':
      'Équipements',

    '/utilisateur/statistiques':
      'Statistiques',

    '/utilisateur/historique':
      'Historique',
  }

/*
  Les fiches détaillées utilisent
  une URL dynamique :

  /utilisateur/equipements/:equipmentId

  Elles ne peuvent donc pas être
  présentes directement dans pageTitles.
*/
function getPageTitle(
  pathname: string,
) {
  if (
    pathname.startsWith(
      '/utilisateur/equipements/',
    )
  ) {
    return "Détail de l'équipement"
  }

  return (
    pageTitles[
      pathname
    ] ??
    'Atelier Maison'
  )
}

function UserLayout() {
  /*
    ============================================================
    ÉTAT DU SYSTÈME
    ============================================================
  */
  const {
    feedback,

    clearFeedback,

    serverConnection,

    restoreConnection,
  } = useSystem()

  /*
    Menu mobile.
  */
  const [
    isMenuOpen,
    setIsMenuOpen,
  ] =
    useState(false)

  /*
    URL courante.
  */
  const location =
    useLocation()

  /*
    Navigation programmatique.
  */
  const navigate =
    useNavigate()

  /*
    ============================================================
    DÉCONNEXION
    ============================================================
  */
  function handleLogout() {
    // Aucune session locale n'est simulée.
    // On revient simplement à la page d'entrée du prototype.
    navigate(
      '/connexion',
      {
        replace:
          true,
      },
    )
  }

  return (
    <div className="portal-shell">
      {/*
        ========================================================
        FOND DU MENU MOBILE
        ========================================================
      */}
      {isMenuOpen && (
        <button
          className="portal-backdrop"
          type="button"
          aria-label="Fermer le menu"
          onClick={() =>
            setIsMenuOpen(
              false,
            )
          }
        />
      )}

      {/*
        ========================================================
        SIDEBAR
        ========================================================
      */}
      <aside
        className={
          `portal-sidebar ${
            isMenuOpen
              ? 'is-open'
              : ''
          }`
        }
      >
        <div className="portal-sidebar-heading">
          {/*
            Logo.
          */}
          <NavLink
            className="portal-brand"
            to="/utilisateur"
            onClick={() =>
              setIsMenuOpen(
                false,
              )
            }
          >
            <span
              className="portal-brand-mark"
              aria-hidden="true"
            >
              AM
            </span>

            <span>
              <strong>
                Atelier Maison
              </strong>

              <small>
                Espace particulier
              </small>
            </span>
          </NavLink>

          {/*
            Fermeture du menu mobile.
          */}
          <button
            className="portal-sidebar-close"
            type="button"
            aria-label="Fermer le menu"
            onClick={() =>
              setIsMenuOpen(
                false,
              )
            }
          >
            <X
              aria-hidden="true"
            />
          </button>
        </div>

        {/*
          ======================================================
          MENU
          ======================================================
        */}
        <nav
          className="portal-navigation"
          aria-label="Navigation principale"
        >
          <p>
            Navigation
          </p>

          {navigationItems.map(
            (item) => {
              const Icon =
                item.icon

              return (
                <NavLink
                  key={
                    item.path
                  }
                  className={({
                    isActive,
                  }) =>
                    `portal-navigation-link ${
                      isActive
                        ? 'is-active'
                        : ''
                    }`
                  }
                  end={
                    item.end
                  }
                  to={
                    item.path
                  }
                  onClick={() =>
                    setIsMenuOpen(
                      false,
                    )
                  }
                >
                  <Icon
                    aria-hidden="true"
                  />

                  <span>
                    {
                      item.label
                    }
                  </span>
                </NavLink>
              )
            },
          )}
        </nav>

        {/*
          ======================================================
          ÉTAT GLOBAL DU SYSTÈME
          ======================================================

          IMPORTANT :

          Le particulier n'a pas besoin
          de connaître l'architecture matérielle.

          On n'affiche donc plus :

          "3 Raspberry opérationnels"

          mais simplement :

          "Système connecté"
        */}
        <div className="portal-connection-card">
          <div>
            <span
              className={
                `connection-pulse ${
                  serverConnection.status ===
                  'DISCONNECTED'
                    ? 'is-disconnected'
                    : ''
                }`
              }
              aria-hidden="true"
            />

            <strong>
              {serverConnection.status ===
              'CONNECTED'
                ? 'Système connecté'

                : serverConnection.status ===
                  'CHECKING'
                  ? 'Connexion en cours'

                  : 'Système inaccessible'}
            </strong>
          </div>

          <span>
            {serverConnection.status ===
            'DISCONNECTED' ? (
              <WifiOff
                aria-hidden="true"
              />
            ) : (
              <Wifi
                aria-hidden="true"
              />
            )}

            Dernier contact :
            {' '}
            {
              serverConnection.lastContact
            }
          </span>
        </div>

        {/*
          ======================================================
          DÉCONNEXION
          ======================================================
        */}
        <button
          className="portal-logout"
          type="button"
          onClick={
            handleLogout
          }
        >
          <LogOut
            aria-hidden="true"
          />

          Se déconnecter
        </button>
      </aside>

      {/*
        ========================================================
        CONTENU PRINCIPAL
        ========================================================
      */}
      <main className="portal-main">
        {/*
          ======================================================
          BARRE SUPÉRIEURE
          ======================================================
        */}
        <header className="portal-topbar">
          <button
            className="portal-menu-button"
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={
              isMenuOpen
            }
            onClick={() =>
              setIsMenuOpen(
                true,
              )
            }
          >
            <Menu
              aria-hidden="true"
            />
          </button>

          <div className="portal-location">
            <span>
              Maison principale
            </span>

            <strong>
              {
                getPageTitle(
                  location.pathname,
                )
              }
            </strong>
          </div>

          {/*
            Profil connecté.
          */}
          <div className="portal-user">
            <div>
              <strong>
                Utilisateur
              </strong>

              <span>
                Compte particulier
              </span>
            </div>

            <span
              className="portal-avatar"
              aria-hidden="true"
            >
              {
                'U'
              }
            </span>
          </div>
        </header>

        {/*
          ======================================================
          CONTENU DES PAGES
          ======================================================
        */}
        <div className="portal-content">
          {/*
            ====================================================
            BANNIÈRE PERSISTANTE EN CAS DE COUPURE
            ====================================================

            Même si l'utilisateur a déjà répondu
            à la popup d'incident,
            le système reste marqué comme inaccessible
            jusqu'au véritable rétablissement.
          */}
          {serverConnection.status ===
            'DISCONNECTED' && (
            <div
              className="system-offline-banner"
              role="alert"
            >
              <div>
                <WifiOff
                  aria-hidden="true"
                />

                <span>
                  Connexion au système interrompue :
                  les commandes à distance sont
                  temporairement suspendues.
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  void restoreConnection()
                }
              >
                Réessayer
              </button>
            </div>
          )}

          {/*
            ====================================================
            MESSAGE APRÈS UNE ACTION
            ====================================================
          */}
          {feedback && (
            <div
              className="portal-feedback"
              role="status"
            >
              <ShieldCheck
                aria-hidden="true"
              />

              <span>
                {feedback}
              </span>

              <button
                type="button"
                aria-label="Fermer le message"
                onClick={
                  clearFeedback
                }
              >
                <X
                  aria-hidden="true"
                />
              </button>
            </div>
          )}

          {/*
            React Router remplace Outlet
            par la page correspondant
            à l'adresse actuelle.
          */}
          <Outlet />
        </div>
      </main>

      {/*
        ========================================================
        POPUP GLOBALE DE COUPURE
        ========================================================

        Elle est placée ici afin de fonctionner
        depuis toutes les pages :

        - dashboard ;
        - caméra ;
        - robot ;
        - équipements ;
        - statistiques ;
        - historique.
      */}
      <NetworkIncidentModal />
    </div>
  )
}

export default UserLayout