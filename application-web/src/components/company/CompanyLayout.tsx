// CompanyLayout.tsx

// -----------------------------------------------------------------------
// LAYOUT COMMUN DE L'ESPACE ENTREPRISE - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Toutes les pages entreprise passent désormais par ce layout.
//
// Architecture :
//
// App.tsx
//   ↓
// <CompanyProvider>
//   ↓
// <CompanyLayout>
//   ├── Sidebar commune
//   ├── Topbar commune
//   └── <Outlet />
//        ├── Dashboard
//        ├── Alertes
//        ├── Clients
//        ├── Support
//        ├── Interventions
//        ├── Infrastructure
//        └── Audit
//
// Le CompanyProvider n'est donc plus recréé dans chaque page.
// Les données entreprise peuvent rester partagées lors de la navigation.
//
// IMPORTANT :
//
// Il n'existe toujours pas de vraie authentification.
// Le bouton "Se déconnecter" retourne simplement vers /connexion.
//
// -----------------------------------------------------------------------

import {
  BellRing,
  Headphones,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'

import type {
  LucideIcon,
} from 'lucide-react'

import {
  useEffect,
  useState,
} from 'react'

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  useCompany,
} from '../../hooks/useCompany'

import '../../styles/company-layout.css'


// =========================================================================
// TYPES
// =========================================================================

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


// =========================================================================
// NAVIGATION
// =========================================================================

const navigationItems:
  NavigationItem[] = [
    {
      label:
        "Vue d'ensemble",

      path:
        '/entreprise',

      icon:
        LayoutDashboard,

      end:
        true,
    },

    {
      label:
        'Alertes',

      path:
        '/entreprise/alertes',

      icon:
        BellRing,
    },

    {
      label:
        'Clients',

      path:
        '/entreprise/clients',

      icon:
        Users,
    },

    {
      label:
        'Support',

      path:
        '/entreprise/support',

      icon:
        Headphones,
    },

    {
      label:
        'Terrain',

      path:
        '/entreprise/interventions',

      icon:
        UserRoundCheck,
    },

    {
      label:
        'Infrastructure',

      path:
        '/entreprise/infrastructure',

      icon:
        Network,
    },

    {
      label:
        'Audit',

      path:
        '/entreprise/audit',

      icon:
        History,
    },
  ]


// =========================================================================
// TITRES DES PAGES
// =========================================================================

const pageTitles:
  Record<
    string,
    string
  > = {

    '/entreprise':
      "Vue d'ensemble",

    '/entreprise/alertes':
      'Centre d’alertes',

    '/entreprise/clients':
      'Dossiers clients',

    '/entreprise/support':
      'Support',

    '/entreprise/interventions':
      'Opérations terrain',

    '/entreprise/infrastructure':
      'Infrastructure réseau',

    '/entreprise/audit':
      'Journal d’audit',
  }


// =========================================================================
// RÉSOLUTION TITRE
// =========================================================================

function getPageTitle(
  pathname:
    string,
): string {

  return (
    pageTitles[
      pathname
    ]
    ??
    'Centre de supervision'
  )
}


// =========================================================================
// COMPOSANT
// =========================================================================

function CompanyLayout() {

  const location =
    useLocation()


  const navigate =
    useNavigate()


  const {
    currentOperator,

    connectionStatus,
    checkCompanyConnection,
  } =
    useCompany()


  const [
    isMenuOpen,
    setIsMenuOpen,
  ] =
    useState(
      false,
    )


  // =====================================================================
  // VÉRIFICATION DU BACKEND ENTREPRISE
  // =====================================================================
  //
  // On effectue cette vérification au niveau du layout commun afin qu'elle
  // ne dépende plus du dashboard.
  // =====================================================================

  useEffect(
    () => {

      void checkCompanyConnection()
    },
    [
      checkCompanyConnection,
    ],
  )


  // =====================================================================
  // REFERMER LE MENU MOBILE APRÈS UNE NAVIGATION
  // =====================================================================

  useEffect(
    () => {

      setIsMenuOpen(
        false,
      )
    },
    [
      location.pathname,
    ],
  )


  // =====================================================================
  // RETOUR À LA PAGE D'ENTRÉE
  // =====================================================================

  function handleLogout() {

    navigate(
      '/connexion',
      {
        replace:
          true,
      },
    )
  }


  return (
    <div
      className="company-workspace"
    >

      {/* ================================================================
          BACKDROP MOBILE
          ================================================================ */}

      {
        isMenuOpen
        &&
        (
          <button
            type="button"
            className="company-workspace-backdrop"
            aria-label="Fermer le menu"
            onClick={
              () =>
                setIsMenuOpen(
                  false,
                )
            }
          />
        )
      }


      {/* ================================================================
          SIDEBAR
          ================================================================ */}

      <aside
        className={
          (
            'company-workspace-sidebar '
            +
            (
              isMenuOpen
                ? 'is-open'
                : ''
            )
          )
        }
      >

        <div
          className="company-workspace-sidebar-heading"
        >
          <NavLink
            className="company-workspace-brand"
            to="/entreprise"
          >
            <span
              className="company-workspace-brand-mark"
              aria-hidden="true"
            >
              AM
            </span>

            <span>
              <strong>
                Atelier Maison
              </strong>

              <small>
                Centre de supervision
              </small>
            </span>
          </NavLink>


          <button
            type="button"
            className="company-workspace-sidebar-close"
            aria-label="Fermer le menu"
            onClick={
              () =>
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


        <nav
          className="company-workspace-navigation"
          aria-label="Navigation entreprise"
        >
          <p>
            Supervision
          </p>

          {
            navigationItems.map(
              (
                item,
              ) => {

                const Icon =
                  item.icon


                return (
                  <NavLink
                    key={
                      item.path
                    }
                    className={
                      (
                        {
                          isActive,
                        },
                      ) =>
                        (
                          'company-workspace-navigation-link '
                          +
                          (
                            isActive
                              ? 'is-active'
                              : ''
                          )
                        )
                    }
                    end={
                      item.end
                    }
                    to={
                      item.path
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
            )
          }
        </nav>


        <div
          className="company-workspace-connection"
        >
          <div>
            {
              connectionStatus ===
                'CONNECTED'
                ? (
                  <Wifi
                    aria-hidden="true"
                  />
                )
                : (
                  <WifiOff
                    aria-hidden="true"
                  />
                )
            }

            <span>
              <strong>
                {
                  connectionStatus ===
                    'CONNECTED'
                    ? 'Serveur connecté'
                    : connectionStatus ===
                        'CHECKING'
                      ? 'Vérification...'
                      : connectionStatus ===
                          'UNKNOWN'
                        ? 'Non vérifié'
                        : 'Serveur inaccessible'
                }
              </strong>

              <small>
                API entreprise
              </small>
            </span>
          </div>


          <button
            type="button"
            onClick={
              () =>
                void checkCompanyConnection()
            }
          >
            Vérifier
          </button>
        </div>


        <div
          className="company-workspace-operator"
        >
          <span
            className="company-workspace-operator-avatar"
            aria-hidden="true"
          >
            O
          </span>

          <span>
            <strong>
              {
                currentOperator.operatorName
              }
            </strong>

            <small>
              Opérateur temporaire
            </small>
          </span>
        </div>


        <button
          type="button"
          className="company-workspace-logout"
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


      {/* ================================================================
          ZONE PRINCIPALE
          ================================================================ */}

      <div
        className="company-workspace-main"
      >

        {/* ==============================================================
            TOPBAR COMMUNE
            ============================================================== */}

        <header
          className="company-workspace-topbar"
        >
          <button
            type="button"
            className="company-workspace-menu-button"
            aria-label="Ouvrir le menu"
            aria-expanded={
              isMenuOpen
            }
            onClick={
              () =>
                setIsMenuOpen(
                  true,
                )
            }
          >
            <Menu
              aria-hidden="true"
            />
          </button>


          <div
            className="company-workspace-page-title"
          >
            <span>
              Centre de surveillance
            </span>

            <strong>
              {
                getPageTitle(
                  location.pathname,
                )
              }
            </strong>
          </div>


          <div
            className="company-workspace-topbar-status"
          >
            <span
              className={
                (
                  'company-workspace-status-dot '
                  +
                  (
                    connectionStatus ===
                      'CONNECTED'
                      ? 'is-connected'
                      : 'is-disconnected'
                  )
                )
              }
              aria-hidden="true"
            />

            <span>
              {
                connectionStatus ===
                  'CONNECTED'
                  ? 'Opérationnel'
                  : connectionStatus ===
                      'CHECKING'
                    ? 'Connexion...'
                    : 'À vérifier'
              }
            </span>

            <ShieldCheck
              aria-hidden="true"
            />
          </div>
        </header>


        {/* ==============================================================
            CONTENU DES PAGES
            ============================================================== */}

        <div
          className="company-workspace-content"
        >
          {
            connectionStatus ===
              'CONNECTED'
              ? (
                <Outlet />
              )
              : (
                <section
                  className="company-server-state"
                  aria-live="polite"
                >
                  <div
                    className={
                      (
                        'company-server-state-icon '
                        +
                        (
                          connectionStatus ===
                            'CHECKING'
                            ||
                          connectionStatus ===
                            'UNKNOWN'
                            ? 'is-checking'
                            : 'is-offline'
                        )
                      )
                    }
                  >
                    {
                      connectionStatus ===
                        'CHECKING'
                        ||
                      connectionStatus ===
                        'UNKNOWN'
                        ? (
                          <RefreshCw
                            aria-hidden="true"
                            className="is-spinning"
                          />
                        )
                        : (
                          <WifiOff
                            aria-hidden="true"
                          />
                        )
                    }
                  </div>

                  <div
                    className="company-server-state-copy"
                  >
                    <p
                      className="dashboard-eyebrow"
                    >
                      Serveur central
                    </p>

                    <h1>
                      {
                        connectionStatus ===
                          'CHECKING'
                          ||
                        connectionStatus ===
                          'UNKNOWN'
                          ? 'Vérification de la connexion'
                          : 'Serveur central inaccessible'
                      }
                    </h1>

                    <p>
                      {
                        connectionStatus ===
                          'CHECKING'
                          ||
                        connectionStatus ===
                          'UNKNOWN'
                          ? (
                            'La console vérifie la disponibilité '
                            + 'de l’API entreprise.'
                          )
                          : (
                            'Les données de supervision ne peuvent pas '
                            + 'être récupérées pour le moment. '
                            + 'Aucune valeur à zéro n’est affichée afin '
                            + 'de ne pas confondre absence de données et '
                            + 'absence de connexion.'
                          )
                      }
                    </p>
                  </div>

                  {
                    connectionStatus ===
                      'DISCONNECTED'
                      &&
                      (
                        <button
                          type="button"
                          className="company-server-state-retry"
                          onClick={
                            () =>
                              void checkCompanyConnection()
                          }
                        >
                          <RefreshCw
                            aria-hidden="true"
                          />

                          Réessayer
                        </button>
                      )
                  }
                </section>
              )
          }
        </div>
      </div>
    </div>
  )
}


export default CompanyLayout
