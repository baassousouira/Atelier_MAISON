// CompanyAlertsPage.tsx

// -----------------------------------------------------------------------
// CENTRE DE TRAITEMENT DES ALERTES - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Cette page constitue la console opérationnelle principale de l'espace
// Entreprise.
//
// Elle permet de :
//
// - consulter toutes les alertes ;
// - rechercher / filtrer les dossiers ;
// - ouvrir une alerte ;
// - prendre une alerte en charge ;
// - modifier son statut ;
// - consulter une caméra liée à l'alerte ;
// - demander une capture ;
// - commander le robot ;
// - enregistrer le résultat d'un appel client ;
// - affecter un intervenant ;
// - enregistrer une escalade vers les services d'urgence ;
// - consulter la timeline complète ;
// - ajouter des commentaires internes.
//
// IMPORTANT :
//
// L'authentification réelle n'est toujours PAS développée.
// CompanyProvider utilise encore TEMPORARY_OPERATOR.
//
// IMPORTANT AUSSI :
//
// "Escalader vers les services d'urgence" n'appelle pas réellement
// la police dans ce prototype.
//
// FastAPI enregistre uniquement l'escalade afin que le workflow puisse
// être testé sans déclencher un véritable appel d'urgence.
//
// -----------------------------------------------------------------------

import {
  ArrowLeft,
  BellRing,
  Camera,
  Check,
  CircleAlert,
  Clock3,
  Crosshair,
  Home,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Square,
  UserRoundCheck,
  Users,
  Video,
  X,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useNavigate,
} from 'react-router-dom'


import {
  useCompany,
} from '../hooks/useCompany'

import type {
  ClientCallResult,
  CompanyAlert,
  CompanyAlertStatus,
  FieldAgent,
  Priority,
} from '../types/company'

import '../styles/dashboard.css'
import '../styles/company-dashboard.css'
import '../styles/company-alerts.css'


// =========================================================================
// LABELS
// =========================================================================

const STATUS_OPTIONS:
  CompanyAlertStatus[] = [
    'NEW',
    'IN_REVIEW',
    'CLIENT_CONTACT',
    'FALSE_ALARM',
    'CONFIRMED',
    'ESCALATED',
    'AGENT_DISPATCHED',
    'RESOLVED',
  ]


const PRIORITY_OPTIONS:
  Priority[] = [
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL',
  ]


const CALL_RESULT_OPTIONS:
  ClientCallResult[] = [
    'ANSWERED',
    'NO_ANSWER',
    'UNAVAILABLE',
    'FALSE_ALARM_CONFIRMED',
    'SUSPICIOUS_SITUATION_CONFIRMED',
  ]


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


function callResultLabel(
  result:
    ClientCallResult,
): string {

  const labels:
    Record<
      ClientCallResult,
      string
    > = {

      ANSWERED:
        'Client joint',

      NO_ANSWER:
        'Pas de réponse',

      UNAVAILABLE:
        'Numéro indisponible',

      FALSE_ALARM_CONFIRMED:
        'Le client confirme une fausse alerte',

      SUSPICIOUS_SITUATION_CONFIRMED:
        'Le client confirme une situation suspecte',
    }


  return labels[
    result
  ]
}


function fieldAgentStatusLabel(
  agent:
    FieldAgent,
): string {

  const labels:
    Record<
      FieldAgent['status'],
      string
    > = {

      AVAILABLE:
        'Disponible',

      DISPATCHED:
        'En mission',

      ON_SITE:
        'Sur place',

      OFF_DUTY:
        'Hors service',
    }


  return labels[
    agent.status
  ]
}


// =========================================================================
// FORMATAGE DES DATES
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
        'medium',
    },
  ).format(
    date,
  )
}


// =========================================================================
// PAGE INTERNE
// =========================================================================
//
// Ce composant se trouve sous <CompanyProvider>.
// =========================================================================

function CompanyAlertsContent() {

  const navigate =
    useNavigate()


  const {
    currentOperator,

    alerts,
    selectedAlert,

    refreshAlerts,
    openAlert,
    clearSelectedAlert,

    takeAlert,
    changeAlertStatus,

    registerCall,
    dispatchAgent,
    escalateAlert,
    addAlertComment,

    openAlertCamera,
    takeAlertScreenshot,
    sendAlertRobotCommand,

    fieldAgents,
    refreshFieldAgents,

    loading,
    error,
    feedback,

    clearError,
    clearFeedback,
  } =
    useCompany()


  // =====================================================================
  // FILTRES
  // =====================================================================

  const [
    search,
    setSearch,
  ] =
    useState(
      '',
    )


  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<
      CompanyAlertStatus | ''
    >(
      '',
    )


  const [
    priorityFilter,
    setPriorityFilter,
  ] =
    useState<
      Priority | ''
    >(
      '',
    )


  // =====================================================================
  // ÉTAT CONSOLE ALERTE
  // =====================================================================

  const [
    streamUrl,
    setStreamUrl,
  ] =
    useState<
      string | null
    >(
      null,
    )


  const [
    robotSpeed,
    setRobotSpeed,
  ] =
    useState(
      50,
    )


  const [
    newComment,
    setNewComment,
  ] =
    useState(
      '',
    )


  // =====================================================================
  // MODALES
  // =====================================================================

  const [
    callModalOpen,
    setCallModalOpen,
  ] =
    useState(
      false,
    )


  const [
    callResult,
    setCallResult,
  ] =
    useState<
      ClientCallResult
    >(
      'ANSWERED',
    )


  const [
    callComment,
    setCallComment,
  ] =
    useState(
      '',
    )


  const [
    dispatchModalOpen,
    setDispatchModalOpen,
  ] =
    useState(
      false,
    )


  const [
    selectedAgentId,
    setSelectedAgentId,
  ] =
    useState(
      '',
    )


  const [
    dispatchComment,
    setDispatchComment,
  ] =
    useState(
      '',
    )


  const [
    escalationModalOpen,
    setEscalationModalOpen,
  ] =
    useState(
      false,
    )


  const [
    escalationReason,
    setEscalationReason,
  ] =
    useState(
      '',
    )


  // =====================================================================
  // CHARGEMENT INITIAL
  // =====================================================================

  const loadAlerts =
    useCallback(
      async (): Promise<void> => {

        await refreshAlerts(
          {
            search:
              search.trim()
                || undefined,

            status:
              statusFilter
                || undefined,

            priority:
              priorityFilter
                || undefined,
          },
        )
      },
      [
        priorityFilter,
        refreshAlerts,
        search,
        statusFilter,
      ],
    )


  useEffect(
    () => {

      void refreshAlerts()
      void refreshFieldAgents()
    },
    [
      refreshAlerts,
      refreshFieldAgents,
    ],
  )


  // =====================================================================
  // QUAND ON FERME / CHANGE D'ALERTE
  // =====================================================================

  useEffect(
    () => {

      // Une URL de flux appartient toujours à une alerte précise.
      // On évite donc d'afficher le flux de l'ancien dossier lorsque
      // selectedAlert change.
      setStreamUrl(
        null,
      )

      setNewComment(
        '',
      )
    },
    [
      selectedAlert
        ?.alert.id,
    ],
  )


  // =====================================================================
  // ALERTES TRIÉES
  // =====================================================================

  const sortedAlerts =
    useMemo(
      () =>
        [
          ...alerts,
        ].sort(
          (
            a,
            b,
          ) =>
            new Date(
              b.createdAt,
            ).getTime()
            -
            new Date(
              a.createdAt,
            ).getTime(),
        ),
      [
        alerts,
      ],
    )


  // =====================================================================
  // TIMELINE TRIÉE
  // =====================================================================

  const sortedActions =
    useMemo(
      () => {

        if (
          !selectedAlert
        ) {

          return []
        }


        return [
          ...selectedAlert.actions,
        ].sort(
          (
            a,
            b,
          ) =>
            new Date(
              a.createdAt,
            ).getTime()
            -
            new Date(
              b.createdAt,
            ).getTime(),
        )
      },
      [
        selectedAlert,
      ],
    )


  // =====================================================================
  // INTERVENANTS DISPONIBLES
  // =====================================================================

  const availableAgents =
    fieldAgents.filter(
      (
        agent,
      ) =>
        agent.status ===
          'AVAILABLE',
    )


  // =====================================================================
  // OUVRIR UNE ALERTE
  // =====================================================================

  async function handleOpenAlert(
    alert:
      CompanyAlert,
  ) {

    await openAlert(
      alert.id,
    )
  }


  // =====================================================================
  // CAMÉRA
  // =====================================================================

  async function handleOpenCamera() {

    const alertDetail =
      selectedAlert


    if (
      !alertDetail
      ||
      !alertDetail.alert.cameraId
    ) {

      return
    }


    const url =
      await openAlertCamera(
        alertDetail.alert.id,
        alertDetail.alert.cameraId,
      )


    setStreamUrl(
      url,
    )
  }


  async function handleScreenshot() {

    const alertDetail =
      selectedAlert


    if (
      !alertDetail
      ||
      !alertDetail.alert.cameraId
    ) {

      return
    }


    await takeAlertScreenshot(
      alertDetail.alert.id,
      alertDetail.alert.cameraId,
    )
  }


  // =====================================================================
  // ROBOT
  // =====================================================================

  async function sendRobot(
    command:
      string,
  ) {

    if (
      !selectedAlert
    ) {

      return
    }


    await sendAlertRobotCommand(
      selectedAlert.alert.id,
      command,
      robotSpeed,
    )
  }


  // =====================================================================
  // COMMENTAIRE
  // =====================================================================

  async function handleAddComment() {

    if (
      !selectedAlert
      ||
      newComment.trim() ===
        ''
    ) {

      return
    }


    await addAlertComment(
      selectedAlert.alert.id,
      newComment.trim(),
    )


    setNewComment(
      '',
    )
  }


  // =====================================================================
  // APPEL CLIENT
  // =====================================================================

  async function handleSaveCall() {

    if (
      !selectedAlert
    ) {

      return
    }


    await registerCall(
      selectedAlert.alert.id,
      callResult,
      callComment.trim()
        || undefined,
    )


    setCallModalOpen(
      false,
    )

    setCallComment(
      '',
    )
  }


  // =====================================================================
  // AFFECTATION INTERVENANT
  // =====================================================================

  async function handleDispatch() {

    if (
      !selectedAlert
      ||
      !selectedAgentId
    ) {

      return
    }


    await dispatchAgent(
      selectedAlert.alert.id,
      selectedAgentId,
      dispatchComment.trim()
        || undefined,
    )


    setDispatchModalOpen(
      false,
    )

    setSelectedAgentId(
      '',
    )

    setDispatchComment(
      '',
    )


    await refreshFieldAgents()
  }


  // =====================================================================
  // ESCALADE URGENCE
  // =====================================================================

  async function handleEscalation() {

    if (
      !selectedAlert
      ||
      escalationReason.trim() ===
        ''
    ) {

      return
    }


    await escalateAlert(
      selectedAlert.alert.id,
      escalationReason.trim(),
    )


    setEscalationModalOpen(
      false,
    )

    setEscalationReason(
      '',
    )
  }


  // =====================================================================
  // RENDU
  // =====================================================================

  return (
    <main
      className="company-alerts-page"
    >

      {/* ================================================================
          BARRE SUPÉRIEURE
          ================================================================ */}

      <header
        className="company-alerts-topbar"
      >
        <button
          type="button"
          className="company-alerts-back"
          onClick={
            () =>
              navigate(
                -1,
              )
          }
        >
          <ArrowLeft
            aria-hidden="true"
          />

          Retour
        </button>


        <div>
          <BellRing
            aria-hidden="true"
          />

          <span>
            <strong>
              Centre d&apos;alertes
            </strong>

            <small>
              {
                currentOperator.operatorName
              }
            </small>
          </span>
        </div>


        <button
          type="button"
          className="company-alerts-refresh"
          disabled={
            loading.alerts
          }
          onClick={
            () =>
              void loadAlerts()
          }
        >
          <RefreshCw
            aria-hidden="true"
            className={
              loading.alerts
                ? 'is-spinning'
                : undefined
            }
          />

          Actualiser
        </button>
      </header>


      <div
        className="company-alerts-shell"
      >

        {/* ==============================================================
            COLONNE LISTE
            ============================================================== */}

        <section
          className="company-alerts-list-panel"
        >

          <div
            className="company-alerts-title"
          >
            <div>
              <p
                className="dashboard-eyebrow"
              >
                Supervision
              </p>

              <h1>
                Alertes
              </h1>

              <p>
                Traitez les événements reçus par les sites surveillés.
              </p>
            </div>

            <span
              className="company-alert-count"
            >
              {
                alerts.length
              }
            </span>
          </div>


          {/* ------------------------------------------------------------
              FILTRES
              ------------------------------------------------------------ */}

          <div
            className="company-alert-filters"
          >
            <label
              className="company-search-field"
            >
              <Search
                aria-hidden="true"
              />

              <input
                type="search"
                placeholder="Client, capteur, zone..."
                value={
                  search
                }
                onChange={
                  (
                    event,
                  ) =>
                    setSearch(
                      event.target.value,
                    )
                }
                onKeyDown={
                  (
                    event,
                  ) => {

                    if (
                      event.key ===
                        'Enter'
                    ) {

                      void loadAlerts()
                    }
                  }
                }
              />
            </label>


            <select
              aria-label="Filtrer par statut"
              value={
                statusFilter
              }
              onChange={
                (
                  event,
                ) => {

                  const value =
                    STATUS_OPTIONS.find(
                      (
                        status,
                      ) =>
                        status ===
                          event.target.value,
                    )
                    ??
                    ''


                  setStatusFilter(
                    value,
                  )
                }
              }
            >
              <option
                value=""
              >
                Tous les statuts
              </option>

              {
                STATUS_OPTIONS.map(
                  (
                    status,
                  ) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {
                        alertStatusLabel(
                          status,
                        )
                      }
                    </option>
                  ),
                )
              }
            </select>


            <select
              aria-label="Filtrer par priorité"
              value={
                priorityFilter
              }
              onChange={
                (
                  event,
                ) => {

                  const value =
                    PRIORITY_OPTIONS.find(
                      (
                        priority,
                      ) =>
                        priority ===
                          event.target.value,
                    )
                    ??
                    ''


                  setPriorityFilter(
                    value,
                  )
                }
              }
            >
              <option
                value=""
              >
                Toutes les priorités
              </option>

              {
                PRIORITY_OPTIONS.map(
                  (
                    priority,
                  ) => (
                    <option
                      key={
                        priority
                      }
                      value={
                        priority
                      }
                    >
                      {
                        priorityLabel(
                          priority,
                        )
                      }
                    </option>
                  ),
                )
              }
            </select>


            <button
              type="button"
              onClick={
                () =>
                  void loadAlerts()
              }
            >
              Appliquer
            </button>
          </div>


          {/* ------------------------------------------------------------
              FEEDBACK
              ------------------------------------------------------------ */}

          {
            feedback && (
              <div
                className={
                  (
                    'company-alert-feedback '
                    +
                    `is-${feedback.type.toLowerCase()}`
                  )
                }
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
                  <X
                    aria-hidden="true"
                  />
                </button>
              </div>
            )
          }


          {
            error && (
              <div
                className="company-alert-feedback is-error"
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
                  <X
                    aria-hidden="true"
                  />
                </button>
              </div>
            )
          }


          {/* ------------------------------------------------------------
              LISTE
              ------------------------------------------------------------ */}

          <div
            className="company-alert-cards"
          >
            {
              loading.alerts
              &&
              alerts.length ===
                0
                ? (
                  <div
                    className="company-alert-empty"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className="is-spinning"
                    />

                    Chargement...
                  </div>
                )
                : sortedAlerts.length ===
                    0
                  ? (
                    <div
                      className="company-alert-empty"
                    >
                      <ShieldCheck
                        aria-hidden="true"
                      />

                      <strong>
                        Aucune alerte
                      </strong>

                      <span>
                        Aucun dossier ne correspond aux filtres actuels.
                      </span>
                    </div>
                  )
                  : (
                    sortedAlerts.map(
                      (
                        alert,
                      ) => {

                        const selected =
                          selectedAlert
                            ?.alert.id ===
                          alert.id


                        return (
                          <button
                            type="button"
                            className={
                              (
                                'company-alert-card '
                                +
                                (
                                  selected
                                    ? 'is-selected'
                                    : ''
                                )
                              )
                            }
                            key={
                              alert.id
                            }
                            onClick={
                              () =>
                                void handleOpenAlert(
                                  alert,
                                )
                            }
                          >
                            <span
                              className={
                                (
                                  'company-alert-priority-bar '
                                  +
                                  `is-${alert.priority.toLowerCase()}`
                                )
                              }
                            />

                            <span
                              className="company-alert-card-body"
                            >
                              <span
                                className="company-alert-card-top"
                              >
                                <strong>
                                  {
                                    alert.title
                                  }
                                </strong>

                                <small>
                                  {
                                    formatDate(
                                      alert.createdAt,
                                    )
                                  }
                                </small>
                              </span>

                              <span
                                className="company-alert-card-description"
                              >
                                {
                                  alert.description
                                }
                              </span>

                              <span
                                className="company-alert-card-meta"
                              >
                                <span>
                                  {
                                    alert.sourceSensor
                                  }
                                </span>

                                <span
                                  className={
                                    (
                                      'company-alert-chip '
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

                                <span
                                  className="company-alert-chip"
                                >
                                  {
                                    alertStatusLabel(
                                      alert.status,
                                    )
                                  }
                                </span>
                              </span>
                            </span>
                          </button>
                        )
                      },
                    )
                  )
            }
          </div>
        </section>


        {/* ==============================================================
            CONSOLE DÉTAIL
            ============================================================== */}

        <section
          className="company-alert-console"
        >
          {
            loading.alertDetail
            &&
            !selectedAlert
              ? (
                <div
                  className="company-alert-console-empty"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className="is-spinning"
                  />

                  Chargement du dossier...
                </div>
              )
              : !selectedAlert
                ? (
                  <div
                    className="company-alert-console-empty"
                  >
                    <Crosshair
                      aria-hidden="true"
                    />

                    <strong>
                      Sélectionnez une alerte
                    </strong>

                    <span>
                      La console d&apos;intervention apparaîtra ici.
                    </span>
                  </div>
                )
                : (
                  <>
                    {/* --------------------------------------------------
                        EN-TÊTE DOSSIER
                        -------------------------------------------------- */}

                    <div
                      className="company-alert-detail-header"
                    >
                      <div>
                        <div
                          className="company-alert-detail-badges"
                        >
                          <span
                            className={
                              (
                                'company-alert-chip '
                                +
                                `is-${selectedAlert.alert.priority.toLowerCase()}`
                              )
                            }
                          >
                            {
                              priorityLabel(
                                selectedAlert.alert.priority,
                              )
                            }
                          </span>

                          <span
                            className="company-alert-chip"
                          >
                            {
                              alertStatusLabel(
                                selectedAlert.alert.status,
                              )
                            }
                          </span>
                        </div>

                        <h2>
                          {
                            selectedAlert.alert.title
                          }
                        </h2>

                        <p>
                          {
                            selectedAlert.alert.description
                          }
                        </p>
                      </div>


                      <button
                        type="button"
                        className="company-alert-close"
                        aria-label="Fermer la fiche"
                        onClick={
                          clearSelectedAlert
                        }
                      >
                        <X
                          aria-hidden="true"
                        />
                      </button>
                    </div>


                    {/* --------------------------------------------------
                        IDENTITÉ / SITE
                        -------------------------------------------------- */}

                    <div
                      className="company-alert-detail-grid"
                    >
                      <article>
                        <Users
                          aria-hidden="true"
                        />

                        <span>
                          Client
                        </span>

                        <strong>
                          {
                            selectedAlert.customer.firstName
                          }
                          {' '}
                          {
                            selectedAlert.customer.lastName
                          }
                        </strong>

                        <small>
                          {
                            selectedAlert.customer.phone
                          }
                        </small>
                      </article>


                      <article>
                        <Home
                          aria-hidden="true"
                        />

                        <span>
                          Site
                        </span>

                        <strong>
                          {
                            selectedAlert.site.name
                          }
                        </strong>

                        <small>
                          {
                            selectedAlert.site.address
                          }
                          {' · '}
                          {
                            selectedAlert.site.city
                          }
                        </small>
                      </article>


                      <article>
                        <Clock3
                          aria-hidden="true"
                        />

                        <span>
                          Détection
                        </span>

                        <strong>
                          {
                            selectedAlert.alert.sourceSensor
                          }
                        </strong>

                        <small>
                          {
                            formatDate(
                              selectedAlert.alert.createdAt,
                            )
                          }
                        </small>
                      </article>
                    </div>


                    {/* --------------------------------------------------
                        ACTIONS PRINCIPALES
                        -------------------------------------------------- */}

                    <div
                      className="company-alert-main-actions"
                    >
                      {
                        selectedAlert.alert.status ===
                          'NEW'
                          &&
                          (
                            <button
                              type="button"
                              className="is-primary"
                              disabled={
                                loading.action
                              }
                              onClick={
                                () =>
                                  void takeAlert(
                                    selectedAlert.alert.id,
                                  )
                              }
                            >
                              <UserRoundCheck
                                aria-hidden="true"
                              />

                              Prendre en charge
                            </button>
                          )
                      }


                      <button
                        type="button"
                        onClick={
                          () =>
                            setCallModalOpen(
                              true,
                            )
                        }
                      >
                        <Phone
                          aria-hidden="true"
                        />

                        Appeler le client
                      </button>


                      <button
                        type="button"
                        onClick={
                          () =>
                            setDispatchModalOpen(
                              true,
                            )
                        }
                      >
                        <UserRoundCheck
                          aria-hidden="true"
                        />

                        Envoyer un intervenant
                      </button>


                      <button
                        type="button"
                        className="is-danger"
                        onClick={
                          () =>
                            setEscalationModalOpen(
                              true,
                            )
                        }
                      >
                        <Siren
                          aria-hidden="true"
                        />

                        Escalader
                      </button>
                    </div>


                    {/* --------------------------------------------------
                        STATUT
                        -------------------------------------------------- */}

                    <section
                      className="company-alert-section"
                    >
                      <div
                        className="company-alert-section-heading"
                      >
                        <div>
                          <ShieldCheck
                            aria-hidden="true"
                          />

                          <span>
                            <strong>
                              Statut du dossier
                            </strong>

                            <small>
                              Le changement est enregistré dans la timeline.
                            </small>
                          </span>
                        </div>
                      </div>


                      <div
                        className="company-alert-status-actions"
                      >
                        {
                          STATUS_OPTIONS.map(
                            (
                              status,
                            ) => (
                              <button
                                key={
                                  status
                                }
                                type="button"
                                className={
                                  (
                                    selectedAlert.alert.status ===
                                      status
                                      ? 'is-current'
                                      : ''
                                  )
                                }
                                disabled={
                                  loading.action
                                  ||
                                  selectedAlert.alert.status ===
                                    status
                                }
                                onClick={
                                  () =>
                                    void changeAlertStatus(
                                      selectedAlert.alert.id,
                                      status,
                                    )
                                }
                              >
                                {
                                  alertStatusLabel(
                                    status,
                                  )
                                }
                              </button>
                            ),
                          )
                        }
                      </div>
                    </section>


                    {/* --------------------------------------------------
                        CAMÉRA
                        -------------------------------------------------- */}

                    <section
                      className="company-alert-section"
                    >
                      <div
                        className="company-alert-section-heading"
                      >
                        <div>
                          <Video
                            aria-hidden="true"
                          />

                          <span>
                            <strong>
                              Caméra liée à l&apos;alerte
                            </strong>

                            <small>
                              Toute consultation est journalisée.
                            </small>
                          </span>
                        </div>
                      </div>


                      {
                        !selectedAlert.alert.cameraId
                          ? (
                            <div
                              className="company-alert-section-empty"
                            >
                              <Camera
                                aria-hidden="true"
                              />

                              <span>
                                Aucune caméra n&apos;est encore associée
                                à cette alerte.
                              </span>
                            </div>
                          )
                          : (
                            <>
                              <div
                                className="company-camera-actions"
                              >
                                <button
                                  type="button"
                                  onClick={
                                    () =>
                                      void handleOpenCamera()
                                  }
                                >
                                  <Video
                                    aria-hidden="true"
                                  />

                                  Ouvrir le direct
                                </button>

                                <button
                                  type="button"
                                  onClick={
                                    () =>
                                      void handleScreenshot()
                                  }
                                >
                                  <Camera
                                    aria-hidden="true"
                                  />

                                  Prendre une capture
                                </button>
                              </div>


                              {
                                streamUrl && (
                                  <div
                                    className="company-camera-frame"
                                  >
                                    <img
                                      src={
                                        streamUrl
                                      }
                                      alt="Flux caméra de l'alerte"
                                    />
                                  </div>
                                )
                              }
                            </>
                          )
                      }
                    </section>


                    {/* --------------------------------------------------
                        ROBOT
                        -------------------------------------------------- */}

                    <section
                      className="company-alert-section"
                    >
                      <div
                        className="company-alert-section-heading"
                      >
                        <div>
                          <Crosshair
                            aria-hidden="true"
                          />

                          <span>
                            <strong>
                              Contrôle du robot
                            </strong>

                            <small>
                              Chaque commande est transmise au serveur central.
                            </small>
                          </span>
                        </div>
                      </div>


                      <div
                        className="company-robot-control"
                      >
                        <button
                          type="button"
                          className="robot-forward"
                          onClick={
                            () =>
                              void sendRobot(
                                'FORWARD',
                              )
                          }
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          className="robot-left"
                          onClick={
                            () =>
                              void sendRobot(
                                'LEFT',
                              )
                          }
                        >
                          ←
                        </button>

                        <button
                          type="button"
                          className="robot-stop"
                          onClick={
                            () =>
                              void sendRobot(
                                'STOP',
                              )
                          }
                        >
                          <Square
                            aria-hidden="true"
                          />
                        </button>

                        <button
                          type="button"
                          className="robot-right"
                          onClick={
                            () =>
                              void sendRobot(
                                'RIGHT',
                              )
                          }
                        >
                          →
                        </button>

                        <button
                          type="button"
                          className="robot-backward"
                          onClick={
                            () =>
                              void sendRobot(
                                'BACKWARD',
                              )
                          }
                        >
                          ↓
                        </button>
                      </div>


                      <label
                        className="company-robot-speed"
                      >
                        <span>
                          Vitesse
                        </span>

                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={
                            robotSpeed
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              setRobotSpeed(
                                Number(
                                  event.target.value,
                                ),
                              )
                          }
                        />

                        <strong>
                          {
                            robotSpeed
                          }
                          %
                        </strong>
                      </label>
                    </section>


                    {/* --------------------------------------------------
                        TIMELINE
                        -------------------------------------------------- */}

                    <section
                      className="company-alert-section"
                    >
                      <div
                        className="company-alert-section-heading"
                      >
                        <div>
                          <Clock3
                            aria-hidden="true"
                          />

                          <span>
                            <strong>
                              Timeline
                            </strong>

                            <small>
                              Historique opérationnel de l&apos;alerte.
                            </small>
                          </span>
                        </div>
                      </div>


                      {
                        sortedActions.length ===
                          0
                          ? (
                            <div
                              className="company-alert-section-empty"
                            >
                              Aucun historique.
                            </div>
                          )
                          : (
                            <div
                              className="company-alert-timeline"
                            >
                              {
                                sortedActions.map(
                                  (
                                    action,
                                  ) => (
                                    <article
                                      key={
                                        action.id
                                      }
                                    >
                                      <span
                                        className="company-timeline-dot"
                                      />

                                      <div>
                                        <strong>
                                          {
                                            action.description
                                          }
                                        </strong>

                                        <span>
                                          {
                                            action.actorName
                                          }
                                          {' · '}
                                          {
                                            formatDate(
                                              action.createdAt,
                                            )
                                          }
                                        </span>

                                        <small>
                                          {
                                            action.type
                                          }
                                        </small>
                                      </div>
                                    </article>
                                  ),
                                )
                              }
                            </div>
                          )
                      }
                    </section>


                    {/* --------------------------------------------------
                        COMMENTAIRES
                        -------------------------------------------------- */}

                    <section
                      className="company-alert-section"
                    >
                      <div
                        className="company-alert-section-heading"
                      >
                        <div>
                          <MessageSquareText
                            aria-hidden="true"
                          />

                          <span>
                            <strong>
                              Commentaires internes
                            </strong>

                            <small>
                              Notes visibles uniquement par l&apos;entreprise.
                            </small>
                          </span>
                        </div>
                      </div>


                      <div
                        className="company-alert-comments"
                      >
                        {
                          selectedAlert.comments.length ===
                            0
                            ? (
                              <div
                                className="company-alert-section-empty"
                              >
                                Aucun commentaire interne.
                              </div>
                            )
                            : (
                              selectedAlert.comments.map(
                                (
                                  comment,
                                ) => (
                                  <article
                                    key={
                                      comment.id
                                    }
                                  >
                                    <strong>
                                      {
                                        comment.authorName
                                      }
                                    </strong>

                                    <p>
                                      {
                                        comment.message
                                      }
                                    </p>

                                    <small>
                                      {
                                        formatDate(
                                          comment.createdAt,
                                        )
                                      }
                                    </small>
                                  </article>
                                ),
                              )
                            )
                        }


                        <div
                          className="company-add-comment"
                        >
                          <textarea
                            value={
                              newComment
                            }
                            placeholder="Ajouter une note interne..."
                            onChange={
                              (
                                event,
                              ) =>
                                setNewComment(
                                  event.target.value,
                                )
                            }
                          />

                          <button
                            type="button"
                            disabled={
                              loading.action
                              ||
                              newComment.trim() ===
                                ''
                            }
                            onClick={
                              () =>
                                void handleAddComment()
                            }
                          >
                            Ajouter
                          </button>
                        </div>
                      </div>
                    </section>
                  </>
                )
          }
        </section>
      </div>


      {/* ================================================================
          MODALE APPEL CLIENT
          ================================================================ */}

      {
        callModalOpen
        &&
        selectedAlert
        &&
        (
          <div
            className="company-modal-backdrop"
          >
            <div
              className="company-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="call-modal-title"
            >
              <div
                className="company-modal-heading"
              >
                <div>
                  <Phone
                    aria-hidden="true"
                  />

                  <span>
                    <strong
                      id="call-modal-title"
                    >
                      Appeler le client
                    </strong>

                    <small>
                      {
                        selectedAlert.customer.firstName
                      }
                      {' '}
                      {
                        selectedAlert.customer.lastName
                      }
                    </small>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={
                    () =>
                      setCallModalOpen(
                        false,
                      )
                  }
                >
                  <X
                    aria-hidden="true"
                  />
                </button>
              </div>


              <a
                className="company-phone-link"
                href={
                  `tel:${selectedAlert.customer.phone}`
                }
              >
                <Phone
                  aria-hidden="true"
                />

                {
                  selectedAlert.customer.phone
                }
              </a>


              <label>
                Résultat de l&apos;appel

                <select
                  value={
                    callResult
                  }
                  onChange={
                    (
                      event,
                    ) => {

                      const value =
                        CALL_RESULT_OPTIONS.find(
                          (
                            result,
                          ) =>
                            result ===
                              event.target.value,
                        )


                      if (
                        value
                      ) {

                        setCallResult(
                          value,
                        )
                      }
                    }
                  }
                >
                  {
                    CALL_RESULT_OPTIONS.map(
                      (
                        result,
                      ) => (
                        <option
                          key={
                            result
                          }
                          value={
                            result
                          }
                        >
                          {
                            callResultLabel(
                              result,
                            )
                          }
                        </option>
                      ),
                    )
                  }
                </select>
              </label>


              <label>
                Commentaire

                <textarea
                  placeholder="Résumé de l'appel..."
                  value={
                    callComment
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setCallComment(
                        event.target.value,
                      )
                  }
                />
              </label>


              <div
                className="company-modal-actions"
              >
                <button
                  type="button"
                  onClick={
                    () =>
                      setCallModalOpen(
                        false,
                      )
                  }
                >
                  Annuler
                </button>

                <button
                  type="button"
                  className="is-primary"
                  onClick={
                    () =>
                      void handleSaveCall()
                  }
                >
                  <Check
                    aria-hidden="true"
                  />

                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )
      }


      {/* ================================================================
          MODALE INTERVENANT
          ================================================================ */}

      {
        dispatchModalOpen
        &&
        selectedAlert
        &&
        (
          <div
            className="company-modal-backdrop"
          >
            <div
              className="company-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dispatch-modal-title"
            >
              <div
                className="company-modal-heading"
              >
                <div>
                  <UserRoundCheck
                    aria-hidden="true"
                  />

                  <span>
                    <strong
                      id="dispatch-modal-title"
                    >
                      Envoyer un intervenant
                    </strong>

                    <small>
                      {
                        selectedAlert.site.name
                      }
                    </small>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={
                    () =>
                      setDispatchModalOpen(
                        false,
                      )
                  }
                >
                  <X
                    aria-hidden="true"
                  />
                </button>
              </div>


              {
                availableAgents.length ===
                  0
                  ? (
                    <div
                      className="company-modal-empty"
                    >
                      Aucun intervenant disponible.
                    </div>
                  )
                  : (
                    <div
                      className="company-agent-options"
                    >
                      {
                        availableAgents.map(
                          (
                            agent,
                          ) => (
                            <label
                              key={
                                agent.id
                              }
                              className={
                                (
                                  selectedAgentId ===
                                    agent.id
                                    ? 'is-selected'
                                    : ''
                                )
                              }
                            >
                              <input
                                type="radio"
                                name="agent"
                                value={
                                  agent.id
                                }
                                checked={
                                  selectedAgentId ===
                                    agent.id
                                }
                                onChange={
                                  () =>
                                    setSelectedAgentId(
                                      agent.id,
                                    )
                                }
                              />

                              <span>
                                <strong>
                                  {
                                    agent.firstName
                                  }
                                  {' '}
                                  {
                                    agent.lastName
                                  }
                                </strong>

                                <small>
                                  {
                                    agent.area
                                  }
                                  {' · '}
                                  {
                                    fieldAgentStatusLabel(
                                      agent,
                                    )
                                  }
                                </small>
                              </span>
                            </label>
                          ),
                        )
                      }
                    </div>
                  )
              }


              <label>
                Note pour l&apos;intervention

                <textarea
                  placeholder="Informations utiles à l'intervenant..."
                  value={
                    dispatchComment
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setDispatchComment(
                        event.target.value,
                      )
                  }
                />
              </label>


              <div
                className="company-modal-actions"
              >
                <button
                  type="button"
                  onClick={
                    () =>
                      setDispatchModalOpen(
                        false,
                      )
                  }
                >
                  Annuler
                </button>

                <button
                  type="button"
                  className="is-primary"
                  disabled={
                    selectedAgentId ===
                      ''
                  }
                  onClick={
                    () =>
                      void handleDispatch()
                  }
                >
                  Affecter
                </button>
              </div>
            </div>
          </div>
        )
      }


      {/* ================================================================
          MODALE ESCALADE
          ================================================================ */}

      {
        escalationModalOpen
        &&
        selectedAlert
        &&
        (
          <div
            className="company-modal-backdrop"
          >
            <div
              className="company-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="escalation-modal-title"
            >
              <div
                className="company-modal-heading is-danger"
              >
                <div>
                  <Siren
                    aria-hidden="true"
                  />

                  <span>
                    <strong
                      id="escalation-modal-title"
                    >
                      Escalader l&apos;alerte
                    </strong>

                    <small>
                      Action sensible
                    </small>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={
                    () =>
                      setEscalationModalOpen(
                        false,
                      )
                  }
                >
                  <X
                    aria-hidden="true"
                  />
                </button>
              </div>


              <div
                className="company-escalation-warning"
              >
                <CircleAlert
                  aria-hidden="true"
                />

                <p>
                  Dans ce prototype, cette action n&apos;appelle pas
                  réellement les forces de l&apos;ordre. Elle enregistre
                  une demande d&apos;escalade dans le dossier et dans
                  les logs d&apos;audit.
                </p>
              </div>


              <label>
                Motif de l&apos;escalade

                <textarea
                  placeholder="Décrivez les éléments justifiant l'escalade..."
                  value={
                    escalationReason
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setEscalationReason(
                        event.target.value,
                      )
                  }
                />
              </label>


              <div
                className="company-modal-actions"
              >
                <button
                  type="button"
                  onClick={
                    () =>
                      setEscalationModalOpen(
                        false,
                      )
                  }
                >
                  Annuler
                </button>

                <button
                  type="button"
                  className="is-danger"
                  disabled={
                    escalationReason.trim() ===
                      ''
                  }
                  onClick={
                    () =>
                      void handleEscalation()
                  }
                >
                  <Siren
                    aria-hidden="true"
                  />

                  Confirmer l&apos;escalade
                </button>
              </div>
            </div>
          </div>
        )
      }
    </main>
  )
}


// =========================================================================
// PAGE EXPORTÉE
// =========================================================================
//
// CompanyProvider est monté une seule fois dans App.tsx autour du layout entreprise.
//
// Nous le déplacerons au niveau du layout entreprise lorsque toutes
// les pages seront prêtes.
// =========================================================================

function CompanyAlertsPage() {

  return (
    <CompanyAlertsContent />
  )
}


export default CompanyAlertsPage
