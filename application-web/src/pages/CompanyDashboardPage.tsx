// CompanyDashboardPage.tsx

// -----------------------------------------------------------------------
// DASHBOARD DU CENTRE DE SUPERVISION - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Cette page remplace l'ancien dashboard entreprise basé principalement
// sur les données de démonstration du SystemProvider.
//
// Le nouveau dashboard utilise maintenant CompanyProvider.
//
// Architecture :
//
// CompanyDashboardPage
//        ↓
// useCompany()
//        ↓
// CompanyProvider
//        ↓
// companyApi.ts
//        ↓
// FastAPI
//        ↓
// SQLite / Raspberry
//
// IMPORTANT :
//
// L'authentification réelle n'est toujours PAS mise en place.
//
// Le nom affiché pour l'opérateur provient donc encore de
// TEMPORARY_OPERATOR dans CompanyProvider.
//
// -----------------------------------------------------------------------

import {
  Activity,
  BellRing,
  CircleAlert,
  Clock3,
  Headphones,
  LogOut,
  Radio,
  RefreshCw,
  ShieldCheck,
  Siren,
  UserRoundCheck,
  Users,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
} from 'react'

import {
  useNavigate,
} from 'react-router-dom'


import {
  useCompany,
} from '../hooks/useCompany'

import type {
  CompanyAlert,
  CompanyAlertStatus,
  Priority,
  SupportTicket,
} from '../types/company'

import '../styles/dashboard.css'
import '../styles/company-dashboard.css'


// =========================================================================
// FORMATAGE
// =========================================================================

function formatDate(
  value:
    string | undefined,
): string {

  if (
    !value
  ) {

    return '—'
  }


  const date =
    new Date(
      value,
    )


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {

    return value
  }


  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  ).format(
    date,
  )
}


function alertStatusLabel(
  status:
    CompanyAlertStatus,
): string {

  const labels:
    Record<
      CompanyAlertStatus,
      string
    > = {

      NEW:
        'Nouvelle',

      IN_REVIEW:
        'En vérification',

      CLIENT_CONTACT:
        'Contact client',

      FALSE_ALARM:
        'Fausse alerte',

      CONFIRMED:
        'Confirmée',

      ESCALATED:
        'Escaladée',

      AGENT_DISPATCHED:
        'Intervenant envoyé',

      RESOLVED:
        'Résolue',
    }


  return labels[
    status
  ]
}


function priorityLabel(
  priority:
    Priority,
): string {

  const labels:
    Record<
      Priority,
      string
    > = {

      LOW:
        'Faible',

      MEDIUM:
        'Moyenne',

      HIGH:
        'Haute',

      CRITICAL:
        'Critique',
    }


  return labels[
    priority
  ]
}


function supportStatusLabel(
  status:
    SupportTicket['status'],
): string {

  const labels:
    Record<
      SupportTicket['status'],
      string
    > = {

      NEW:
        'Nouveau',

      IN_PROGRESS:
        'En cours',

      WAITING_CUSTOMER:
        'Attente client',

      RESOLVED:
        'Résolu',

      CLOSED:
        'Fermé',
    }


  return labels[
    status
  ]
}


// =========================================================================
// CONTENU DU DASHBOARD
// =========================================================================
//
// Le contenu utilise useCompany().
//
// Il doit donc obligatoirement être rendu sous <CompanyProvider>.
//
// CompanyProvider est maintenant monté une seule fois dans App.tsx.
// Toutes les pages entreprise partagent donc le même contexte.
// =========================================================================

function CompanyDashboardContent() {

  const navigate =
    useNavigate()


  // ---------------------------------------------------------------------
  // AUTHENTIFICATION
  // ---------------------------------------------------------------------
  //
  // La vraie authentification entreprise n'est volontairement pas encore
  // mise en place.
  //
  // Le dashboard utilise donc currentOperator fourni par CompanyProvider.
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // DONNÉES ENTREPRISE
  // ---------------------------------------------------------------------

  const {
    currentOperator,

    connectionStatus,

    dashboardStatistics,
    refreshDashboard,

    alerts,
    refreshAlerts,

    supportTickets,
    refreshSupportTickets,

    fieldAgents,
    refreshFieldAgents,

    interventions,
    refreshInterventions,

    loading,

    error,
    feedback,

    clearError,
    clearFeedback,
  } =
    useCompany()


  // =====================================================================
  // CHARGEMENT GLOBAL
  // =====================================================================
  //
  // Cette fonction sert :
  //
  // - au premier affichage ;
  // - au bouton "Actualiser".
  //
  // Promise.all() permet de charger les différents blocs en parallèle.
  // =====================================================================

  const refreshAll =
    useCallback(
      async (): Promise<void> => {

        await Promise.all(
          [
            refreshDashboard(),
            refreshAlerts(),
            refreshSupportTickets(),
            refreshFieldAgents(),
            refreshInterventions(),
          ],
        )
      },
      [
        refreshDashboard,
        refreshAlerts,
        refreshSupportTickets,
        refreshFieldAgents,
        refreshInterventions,
      ],
    )


  // =====================================================================
  // PREMIER CHARGEMENT
  // =====================================================================

  useEffect(
    () => {

      void refreshAll()
    },
    [
      refreshAll,
    ],
  )


  // =====================================================================
  // DONNÉES DÉRIVÉES
  // =====================================================================

  const recentAlerts =
    alerts.slice(
      0,
      5,
    )


  const recentSupportTickets =
    supportTickets.slice(
      0,
      5,
    )


  const availableAgents =
    fieldAgents.filter(
      (
        agent,
      ) =>
        agent.status ===
          'AVAILABLE',
    ).length


  const busyAgents =
    fieldAgents.filter(
      (
        agent,
      ) =>
        agent.status ===
          'DISPATCHED'
        ||
        agent.status ===
          'ON_SITE',
    ).length


  const activeInterventions =
    interventions.filter(
      (
        intervention,
      ) =>
        intervention.status !==
          'COMPLETED'
        &&
        intervention.status !==
          'CANCELLED',
    ).length


  const isRefreshing =
    loading.dashboard
    ||
    loading.alerts
    ||
    loading.support
    ||
    loading.agents
    ||
    loading.interventions


  // =====================================================================
  // RETOUR À L'ÉCRAN DE CONNEXION
  // =====================================================================
  //
  // Il ne s'agit pas encore d'une vraie déconnexion de session.
  //
  // Tant que l'authentification sécurisée n'est pas développée, ce bouton
  // ramène simplement vers l'écran de connexion du prototype.
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


  // =====================================================================
  // RENDU
  // =====================================================================

  return (
    <main
      className="company-portal"
    >

      {/* ================================================================
          BARRE SUPÉRIEURE
          ================================================================ */}

      <header
        className="company-topbar"
      >
        <div
          className="dashboard-brand"
        >
          <span
            className="dashboard-logo"
          >
            AM
          </span>

          <div>
            <strong>
              Atelier Maison
            </strong>

            <span>
              Centre de supervision
            </span>
          </div>
        </div>


        <div
          className="company-topbar-actions"
        >
          <div
            className="company-operator"
          >
            <span>
              Opérateur
            </span>

            <strong>
              {
                currentOperator.operatorName
              }
            </strong>
          </div>


          <button
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
        </div>
      </header>


      <section
        className="company-content"
      >

        {/* ==============================================================
            TITRE + CONNEXION
            ============================================================== */}

        <div
          className="company-heading-row"
        >
          <div>
            <p
              className="dashboard-eyebrow"
            >
              Supervision opérationnelle
            </p>

            <h1>
              Centre de surveillance
            </h1>

            <p>
              Suivi des alertes, des clients, des interventions
              et de l&apos;état général du parc Atelier Maison.
            </p>
          </div>


          <div
            className="company-heading-actions"
          >

            <div
              className={
                (
                  'company-connection-pill '
                  +
                  (
                    connectionStatus ===
                      'CONNECTED'
                      ? 'is-online'
                      : 'is-offline'
                  )
                )
              }
            >
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
                        ? 'Connexion en cours'
                        : connectionStatus ===
                            'UNKNOWN'
                          ? 'Connexion non vérifiée'
                          : 'Serveur inaccessible'
                  }
                </strong>

                <small>
                  API entreprise
                </small>
              </span>
            </div>


            <button
              className="company-refresh-button"
              type="button"
              disabled={
                isRefreshing
              }
              onClick={
                () =>
                  void refreshAll()
              }
            >
              <RefreshCw
                aria-hidden="true"
                className={
                  isRefreshing
                    ? 'is-spinning'
                    : undefined
                }
              />

              Actualiser
            </button>
          </div>
        </div>


        {/* ==============================================================
            FEEDBACK / ERREUR
            ============================================================== */}

        {
          feedback && (
            <div
              className={
                (
                  'company-feedback '
                  +
                  `is-${feedback.type.toLowerCase()}`
                )
              }
              role="status"
            >
              <ShieldCheck
                aria-hidden="true"
              />

              <span>
                {
                  feedback.message
                }
              </span>

              <button
                type="button"
                onClick={
                  clearFeedback
                }
              >
                Fermer
              </button>
            </div>
          )
        }


        {
          error && (
            <div
              className="company-feedback is-error"
              role="alert"
            >
              <CircleAlert
                aria-hidden="true"
              />

              <span>
                {
                  error
                }
              </span>

              <button
                type="button"
                onClick={
                  clearError
                }
              >
                Fermer
              </button>
            </div>
          )
        }


        {/* ==============================================================
            INDICATEURS PRINCIPAUX
            ============================================================== */}

        <div
          className="company-metrics company-metrics-main"
        >

          <article>
            <BellRing
              aria-hidden="true"
            />

            <span>
              Alertes actives
            </span>

            <strong>
              {
                dashboardStatistics
                  ?.activeAlerts
                ??
                '—'
              }
            </strong>

            <small>
              {
                dashboardStatistics
                  ?.criticalAlerts
                ??
                '—'
              }
              {' '}
              critiques
            </small>
          </article>


          <article>
            <Siren
              aria-hidden="true"
            />

            <span>
              À prendre en charge
            </span>

            <strong>
              {
                dashboardStatistics
                  ?.alertsWaitingForOperator
                ??
                '—'
              }
            </strong>

            <small>
              Dossiers sans opérateur
            </small>
          </article>


          <article>
            <Users
              aria-hidden="true"
            />

            <span>
              Clients surveillés
            </span>

            <strong>
              {
                dashboardStatistics
                  ?.monitoredCustomers
                ??
                '—'
              }
            </strong>

            <small>
              {
                dashboardStatistics
                  ?.monitoredSites
                ??
                '—'
              }
              {' '}
              sites
            </small>
          </article>


          <article>
            <Radio
              aria-hidden="true"
            />

            <span>
              Équipements en ligne
            </span>

            <strong>
              {
                dashboardStatistics
                  ?.onlineEquipments
                ??
                '—'
              }
            </strong>

            <small>
              {
                dashboardStatistics
                  ?.offlineEquipments
                ??
                '—'
              }
              {' '}
              hors ligne
            </small>
          </article>


          <article>
            <UserRoundCheck
              aria-hidden="true"
            />

            <span>
              Intervenants disponibles
            </span>

            <strong>
              {
                dashboardStatistics
                  ?.availableAgents
                ??
                availableAgents
              }
            </strong>

            <small>
              {
                busyAgents
              }
              {' '}
              mobilisés
            </small>
          </article>


          <article>
            <Headphones
              aria-hidden="true"
            />

            <span>
              Tickets support ouverts
            </span>

            <strong>
              {
                dashboardStatistics
                  ?.openSupportTickets
                ??
                '—'
              }
            </strong>

            <small>
              Assistance client
            </small>
          </article>
        </div>


        {/* ==============================================================
            GRILLE OPÉRATIONNELLE
            ============================================================== */}

        <div
          className="company-operations-grid"
        >

          {/* ------------------------------------------------------------
              ALERTES RÉCENTES
              ------------------------------------------------------------ */}

          <section
            className="company-panel company-panel-large"
          >
            <div
              className="company-panel-heading"
            >
              <div>
                <p
                  className="dashboard-eyebrow"
                >
                  Priorité opérationnelle
                </p>

                <h2>
                  Alertes récentes
                </h2>
              </div>

              <span>
                Les cinq derniers dossiers reçus par le centre.
              </span>
            </div>


            {
              loading.alerts
              &&
              alerts.length ===
                0
                ? (
                  <div
                    className="company-empty-state"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className="is-spinning"
                    />

                    Chargement des alertes...
                  </div>
                )
                : recentAlerts.length ===
                    0
                  ? (
                    <div
                      className="company-empty-state"
                    >
                      <ShieldCheck
                        aria-hidden="true"
                      />

                      <strong>
                        Aucune alerte
                      </strong>

                      <span>
                        Aucune alerte entreprise n&apos;est
                        actuellement enregistrée.
                      </span>
                    </div>
                  )
                  : (
                    <div
                      className="company-alert-list"
                    >
                      {
                        recentAlerts.map(
                          (
                            alert:
                              CompanyAlert,
                          ) => (
                            <article
                              className="company-alert-row"
                              key={
                                alert.id
                              }
                            >
                              <div
                                className={
                                  (
                                    'company-priority-indicator '
                                    +
                                    `is-${alert.priority.toLowerCase()}`
                                  )
                                }
                                aria-hidden="true"
                              />

                              <div
                                className="company-alert-main"
                              >
                                <div
                                  className="company-alert-title-row"
                                >
                                  <strong>
                                    {
                                      alert.title
                                    }
                                  </strong>

                                  <span
                                    className={
                                      (
                                        'company-badge '
                                        +
                                        `is-${alert.priority.toLowerCase()}`
                                      )
                                    }
                                  >
                                    {
                                      priorityLabel(
                                        alert.priority,
                                      )
                                    }
                                  </span>
                                </div>

                                <span>
                                  {
                                    alert.description
                                  }
                                </span>

                                <small>
                                  {
                                    alert.sourceSensor
                                  }
                                  {' · '}
                                  {
                                    formatDate(
                                      alert.createdAt,
                                    )
                                  }
                                </small>
                              </div>

                              <span
                                className={
                                  (
                                    'company-status-badge '
                                    +
                                    `is-${alert.status.toLowerCase()}`
                                  )
                                }
                              >
                                {
                                  alertStatusLabel(
                                    alert.status,
                                  )
                                }
                              </span>
                            </article>
                          ),
                        )
                      }
                    </div>
                  )
            }
          </section>


          {/* ------------------------------------------------------------
              ÉTAT OPÉRATIONNEL
              ------------------------------------------------------------ */}

          <section
            className="company-panel"
          >
            <div
              className="company-panel-heading"
            >
              <div>
                <p
                  className="dashboard-eyebrow"
                >
                  Ressources
                </p>

                <h2>
                  État opérationnel
                </h2>
              </div>
            </div>


            <div
              className="company-operational-list"
            >
              <article>
                <UserRoundCheck
                  aria-hidden="true"
                />

                <div>
                  <span>
                    Intervenants disponibles
                  </span>

                  <strong>
                    {
                      availableAgents
                    }
                  </strong>
                </div>
              </article>


              <article>
                <Wrench
                  aria-hidden="true"
                />

                <div>
                  <span>
                    Interventions actives
                  </span>

                  <strong>
                    {
                      dashboardStatistics
                        ?.activeInterventions
                      ??
                      activeInterventions
                    }
                  </strong>
                </div>
              </article>


              <article>
                <Clock3
                  aria-hidden="true"
                />

                <div>
                  <span>
                    Temps moyen de prise en charge
                  </span>

                  <strong>
                    {
                      dashboardStatistics
                        ?.averageAlertTakeoverTimeSeconds
                      !== null
                      &&
                      dashboardStatistics
                        ?.averageAlertTakeoverTimeSeconds
                      !== undefined
                        ? (
                          `${Math.round(
                            dashboardStatistics
                              .averageAlertTakeoverTimeSeconds,
                          )} s`
                        )
                        : '—'
                    }
                  </strong>
                </div>
              </article>


              <article>
                <Activity
                  aria-hidden="true"
                />

                <div>
                  <span>
                    État du serveur
                  </span>

                  <strong>
                    {
                      connectionStatus ===
                        'CONNECTED'
                        ? 'Opérationnel'
                        : 'À vérifier'
                    }
                  </strong>
                </div>
              </article>
            </div>
          </section>


          {/* ------------------------------------------------------------
              SUPPORT
              ------------------------------------------------------------ */}

          <section
            className="company-panel"
          >
            <div
              className="company-panel-heading"
            >
              <div>
                <p
                  className="dashboard-eyebrow"
                >
                  Assistance
                </p>

                <h2>
                  Support récent
                </h2>
              </div>
            </div>


            {
              recentSupportTickets.length ===
                0
                ? (
                  <div
                    className="company-empty-state"
                  >
                    <Headphones
                      aria-hidden="true"
                    />

                    <strong>
                      Aucun ticket
                    </strong>

                    <span>
                      Aucun ticket support n&apos;est actuellement
                      enregistré.
                    </span>
                  </div>
                )
                : (
                  <div
                    className="company-support-list"
                  >
                    {
                      recentSupportTickets.map(
                        (
                          ticket,
                        ) => (
                          <article
                            key={
                              ticket.id
                            }
                          >
                            <div>
                              <strong>
                                {
                                  ticket.subject
                                }
                              </strong>

                              <span>
                                {
                                  ticket.category
                                }
                                {' · '}
                                {
                                  formatDate(
                                    ticket.createdAt,
                                  )
                                }
                              </span>
                            </div>

                            <span
                              className="company-support-status"
                            >
                              {
                                supportStatusLabel(
                                  ticket.status,
                                )
                              }
                            </span>
                          </article>
                        ),
                      )
                    }
                  </div>
                )
            }
          </section>
        </div>


        {/* ==============================================================
            INFORMATION TECHNIQUE
            ============================================================== */}

        <section
          className="company-panel company-dashboard-note"
        >
          <ShieldCheck
            aria-hidden="true"
          />

          <div>
            <strong>
              Console reliée au serveur central
            </strong>

            <span>
              Les données affichées ici proviennent maintenant des
              routes entreprise de FastAPI. Les commandes sensibles
              caméra, robot et équipements seront journalisées dans
              les timelines et les logs d&apos;audit.
            </span>
          </div>
        </section>
      </section>
    </main>
  )
}


// =========================================================================
// PAGE EXPORTÉE
// =========================================================================
//
// CompanyProvider est maintenant monté une seule fois dans App.tsx,
// autour du layout entreprise.
// =========================================================================

function CompanyDashboardPage() {

  return (
    <CompanyDashboardContent />
  )
}


export default CompanyDashboardPage
