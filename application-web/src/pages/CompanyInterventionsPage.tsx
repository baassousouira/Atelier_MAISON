// CompanyInterventionsPage.tsx

// -----------------------------------------------------------------------
// INTERVENANTS & INTERVENTIONS TERRAIN - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Cette page regroupe la supervision des équipes terrain.
//
// Elle permet actuellement de :
//
// - consulter les intervenants ;
// - connaître leur statut ;
// - voir leur zone d'intervention ;
// - consulter les interventions en cours ;
// - consulter l'historique des interventions ;
// - retrouver le client et l'alerte liés à une mission.
//
// Les données proviennent de :
//
// GET /api/company/agents
// GET /api/company/interventions
// GET /api/company/customers
// GET /api/company/alerts
//
// IMPORTANT :
//
// Le backend actuel permet déjà de créer une intervention lorsqu'un
// opérateur affecte un agent depuis une alerte.
//
// Il ne possède PAS encore de route dédiée permettant depuis React de
// faire passer manuellement une intervention de REQUESTED à ARRIVED ou
// COMPLETED.
//
// Cette page n'invente donc pas ces changements d'état.
//
// -----------------------------------------------------------------------

import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Home,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  UserRoundCheck,
  Users,
  Wrench,
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
  CompanyAlert,
  Customer,
  FieldAgent,
  Intervention,
} from '../types/company'

import '../styles/dashboard.css'
import '../styles/company-dashboard.css'
import '../styles/company-interventions.css'


// =========================================================================
// TYPES LOCAUX D'AFFICHAGE
// =========================================================================

type PageTab =
  | 'AGENTS'
  | 'INTERVENTIONS'


type InterventionFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'COMPLETED'


// =========================================================================
// LABELS
// =========================================================================

function agentStatusLabel(
  status:
    FieldAgent['status'],
): string {

  const labels:
    Record<
      string,
      string
    > = {

      AVAILABLE:
        'Disponible',

      DISPATCHED:
        'Affecté',

      ON_SITE:
        'Sur place',

      OFF_DUTY:
        'Hors service',
    }


  return (
    labels[
      status
    ]
    ??
    status
  )
}


function interventionStatusLabel(
  status:
    Intervention['status'],
): string {

  const labels:
    Record<
      string,
      string
    > = {

      REQUESTED:
        'Demandée',

      ACCEPTED:
        'Acceptée',

      EN_ROUTE:
        'En route',

      ARRIVED:
        'Sur place',

      ON_SITE:
        'Sur place',

      COMPLETED:
        'Terminée',

      CANCELLED:
        'Annulée',
    }


  return (
    labels[
      status
    ]
    ??
    status
  )
}


// =========================================================================
// DATE
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


// =========================================================================
// ÉTAT ACTIF D'UNE INTERVENTION
// =========================================================================

function isActiveIntervention(
  intervention:
    Intervention,
): boolean {

  return (
    intervention.status !==
      'COMPLETED'
    &&
    intervention.status !==
      'CANCELLED'
  )
}


// =========================================================================
// COMPOSANT INTERNE
// =========================================================================

function CompanyInterventionsContent() {

  const navigate =
    useNavigate()


  const {
    currentOperator,

    fieldAgents,
    refreshFieldAgents,

    interventions,
    refreshInterventions,

    customers,
    refreshCustomers,

    alerts,
    refreshAlerts,

    loading,
    error,
    feedback,

    clearError,
    clearFeedback,
  } =
    useCompany()


  // =====================================================================
  // ONGLET
  // =====================================================================

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<
      PageTab
    >(
      'AGENTS',
    )


  // =====================================================================
  // RECHERCHE
  // =====================================================================

  const [
    search,
    setSearch,
  ] =
    useState(
      '',
    )


  // =====================================================================
  // FILTRE INTERVENTIONS
  // =====================================================================

  const [
    interventionFilter,
    setInterventionFilter,
  ] =
    useState<
      InterventionFilter
    >(
      'ALL',
    )


  // =====================================================================
  // SÉLECTION
  // =====================================================================

  const [
    selectedAgentId,
    setSelectedAgentId,
  ] =
    useState<
      string | null
    >(
      null,
    )


  const [
    selectedInterventionId,
    setSelectedInterventionId,
  ] =
    useState<
      string | null
    >(
      null,
    )


  // =====================================================================
  // CHARGEMENT GLOBAL
  // =====================================================================

  const refreshAll =
    useCallback(
      async (): Promise<void> => {

        await Promise.all(
          [
            refreshFieldAgents(),
            refreshInterventions(),
            refreshCustomers(),
            refreshAlerts(),
          ],
        )
      },
      [
        refreshAlerts,
        refreshCustomers,
        refreshFieldAgents,
        refreshInterventions,
      ],
    )


  useEffect(
    () => {

      void refreshAll()
    },
    [
      refreshAll,
    ],
  )


  // =====================================================================
  // DICTIONNAIRES DE RÉSOLUTION
  // =====================================================================
  //
  // Les interventions renvoyées par le backend contiennent les IDs.
  //
  // Ces Maps permettent d'afficher :
  //
  // customerId -> Prénom Nom
  // alertId    -> titre alerte
  // agentId    -> intervenant
  // =====================================================================

  const customersById =
    useMemo(
      () => {

        const result =
          new Map<
            string,
            Customer
          >()


        customers.forEach(
          (
            customer,
          ) => {

            result.set(
              customer.id,
              customer,
            )
          },
        )


        return result
      },
      [
        customers,
      ],
    )


  const alertsById =
    useMemo(
      () => {

        const result =
          new Map<
            string,
            CompanyAlert
          >()


        alerts.forEach(
          (
            alert,
          ) => {

            result.set(
              alert.id,
              alert,
            )
          },
        )


        return result
      },
      [
        alerts,
      ],
    )


  const agentsById =
    useMemo(
      () => {

        const result =
          new Map<
            string,
            FieldAgent
          >()


        fieldAgents.forEach(
          (
            agent,
          ) => {

            result.set(
              agent.id,
              agent,
            )
          },
        )


        return result
      },
      [
        fieldAgents,
      ],
    )


  // =====================================================================
  // STATISTIQUES AGENTS
  // =====================================================================

  const availableAgents =
    fieldAgents.filter(
      (
        agent,
      ) =>
        agent.status ===
          'AVAILABLE',
    ).length


  const dispatchedAgents =
    fieldAgents.filter(
      (
        agent,
      ) =>
        agent.status ===
          'DISPATCHED',
    ).length


  const onSiteAgents =
    fieldAgents.filter(
      (
        agent,
      ) =>
        agent.status ===
          'ON_SITE',
    ).length


  const offDutyAgents =
    fieldAgents.filter(
      (
        agent,
      ) =>
        agent.status ===
          'OFF_DUTY',
    ).length


  // =====================================================================
  // STATISTIQUES INTERVENTIONS
  // =====================================================================

  const activeInterventions =
    interventions.filter(
      isActiveIntervention,
    ).length


  const completedInterventions =
    interventions.filter(
      (
        intervention,
      ) =>
        intervention.status ===
          'COMPLETED',
    ).length


  // =====================================================================
  // AGENTS FILTRÉS
  // =====================================================================

  const filteredAgents =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLocaleLowerCase(
              'fr-FR',
            )


        return [
          ...fieldAgents,
        ]
          .filter(
            (
              agent,
            ) => {

              if (
                query ===
                  ''
              ) {

                return true
              }


              const haystack =
                (
                  `${agent.firstName} `
                  + `${agent.lastName} `
                  + `${agent.phone} `
                  + `${agent.area} `
                  + `${agent.status}`
                )
                  .toLocaleLowerCase(
                    'fr-FR',
                  )


              return haystack.includes(
                query,
              )
            },
          )
          .sort(
            (
              a,
              b,
            ) => {

              const order:
                Record<
                  string,
                  number
                > = {

                  AVAILABLE:
                    1,

                  DISPATCHED:
                    2,

                  ON_SITE:
                    3,

                  OFF_DUTY:
                    4,
                }


              const byStatus =
                (
                  order[
                    a.status
                  ]
                  ??
                  99
                )
                -
                (
                  order[
                    b.status
                  ]
                  ??
                  99
                )


              if (
                byStatus !==
                  0
              ) {

                return byStatus
              }


              return (
                `${a.lastName} ${a.firstName}`
              ).localeCompare(
                `${b.lastName} ${b.firstName}`,
                'fr-FR',
              )
            },
          )
      },
      [
        fieldAgents,
        search,
      ],
    )


  // =====================================================================
  // INTERVENTIONS FILTRÉES
  // =====================================================================

  const filteredInterventions =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLocaleLowerCase(
              'fr-FR',
            )


        return [
          ...interventions,
        ]
          .filter(
            (
              intervention,
            ) => {

              if (
                interventionFilter ===
                  'ACTIVE'
                &&
                !isActiveIntervention(
                  intervention,
                )
              ) {

                return false
              }


              if (
                interventionFilter ===
                  'COMPLETED'
                &&
                intervention.status !==
                  'COMPLETED'
              ) {

                return false
              }


              if (
                query ===
                  ''
              ) {

                return true
              }


              const agent =
                agentsById.get(
                  intervention.agentId,
                )


              const customer =
                customersById.get(
                  intervention.customerId,
                )


              const alert =
                alertsById.get(
                  intervention.alertId,
                )


              const haystack =
                (
                  `${intervention.id} `
                  + `${intervention.status} `
                  + `${agent?.firstName ?? ''} `
                  + `${agent?.lastName ?? ''} `
                  + `${customer?.firstName ?? ''} `
                  + `${customer?.lastName ?? ''} `
                  + `${alert?.title ?? ''}`
                )
                  .toLocaleLowerCase(
                    'fr-FR',
                  )


              return haystack.includes(
                query,
              )
            },
          )
          .sort(
            (
              a,
              b,
            ) =>
              new Date(
                b.requestedAt,
              ).getTime()
              -
              new Date(
                a.requestedAt,
              ).getTime(),
          )
      },
      [
        agentsById,
        alertsById,
        customersById,
        interventionFilter,
        interventions,
        search,
      ],
    )


  // =====================================================================
  // AGENT SÉLECTIONNÉ
  // =====================================================================

  const selectedAgent =
    selectedAgentId
      ? (
        agentsById.get(
          selectedAgentId,
        )
        ??
        null
      )
      : null


  const selectedAgentInterventions =
    selectedAgent
      ? interventions.filter(
          (
            intervention,
          ) =>
            intervention.agentId ===
              selectedAgent.id,
        )
      : []


  // =====================================================================
  // INTERVENTION SÉLECTIONNÉE
  // =====================================================================

  const selectedIntervention =
    selectedInterventionId
      ? (
        interventions.find(
          (
            intervention,
          ) =>
            intervention.id ===
              selectedInterventionId,
        )
        ??
        null
      )
      : null


  const selectedInterventionAgent =
    selectedIntervention
      ? (
        agentsById.get(
          selectedIntervention.agentId,
        )
        ??
        null
      )
      : null


  const selectedInterventionCustomer =
    selectedIntervention
      ? (
        customersById.get(
          selectedIntervention.customerId,
        )
        ??
        null
      )
      : null


  const selectedInterventionAlert =
    selectedIntervention
      ? (
        alertsById.get(
          selectedIntervention.alertId,
        )
        ??
        null
      )
      : null


  // =====================================================================
  // NAVIGATION ENTRE ONGLETS
  // =====================================================================

  function openAgentsTab() {

    setActiveTab(
      'AGENTS',
    )

    setSelectedInterventionId(
      null,
    )
  }


  function openInterventionsTab() {

    setActiveTab(
      'INTERVENTIONS',
    )

    setSelectedAgentId(
      null,
    )
  }


  // =====================================================================
  // RENDU
  // =====================================================================

  return (
    <main
      className="company-field-page"
    >

      {/* ================================================================
          TOPBAR
          ================================================================ */}

      <header
        className="company-field-topbar"
      >
        <button
          type="button"
          className="company-field-back"
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


        <div
          className="company-field-topbar-title"
        >
          <UserRoundCheck
            aria-hidden="true"
          />

          <span>
            <strong>
              Opérations terrain
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
          className="company-field-refresh"
          disabled={
            loading.agents
            ||
            loading.interventions
          }
          onClick={
            () =>
              void refreshAll()
          }
        >
          <RefreshCw
            aria-hidden="true"
            className={
              loading.agents
              ||
              loading.interventions
                ? 'is-spinning'
                : undefined
            }
          />

          Actualiser
        </button>
      </header>


      <div
        className="company-field-content"
      >

        {/* ==============================================================
            TITRE
            ============================================================== */}

        <div
          className="company-field-heading"
        >
          <div>
            <p
              className="dashboard-eyebrow"
            >
              Ressources opérationnelles
            </p>

            <h1>
              Intervenants & interventions
            </h1>

            <p>
              Suivez les équipes terrain et les missions déclenchées
              depuis le centre de supervision.
            </p>
          </div>


          <div
            className="company-field-tabs"
          >
            <button
              type="button"
              className={
                activeTab ===
                  'AGENTS'
                  ? 'is-active'
                  : undefined
              }
              onClick={
                openAgentsTab
              }
            >
              <Users
                aria-hidden="true"
              />

              Intervenants
            </button>

            <button
              type="button"
              className={
                activeTab ===
                  'INTERVENTIONS'
                  ? 'is-active'
                  : undefined
              }
              onClick={
                openInterventionsTab
              }
            >
              <Wrench
                aria-hidden="true"
              />

              Interventions
            </button>
          </div>
        </div>


        {/* ==============================================================
            MESSAGES
            ============================================================== */}

        {
          feedback && (
            <div
              className={
                (
                  'company-field-feedback '
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
              className="company-field-feedback is-error"
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


        {/* ==============================================================
            INDICATEURS
            ============================================================== */}

        <div
          className="company-field-metrics"
        >
          <article>
            <CheckCircle2
              aria-hidden="true"
            />

            <span>
              Disponibles
            </span>

            <strong>
              {
                availableAgents
              }
            </strong>
          </article>

          <article>
            <Activity
              aria-hidden="true"
            />

            <span>
              Affectés
            </span>

            <strong>
              {
                dispatchedAgents
              }
            </strong>
          </article>

          <article>
            <MapPin
              aria-hidden="true"
            />

            <span>
              Sur place
            </span>

            <strong>
              {
                onSiteAgents
              }
            </strong>
          </article>

          <article>
            <Clock3
              aria-hidden="true"
            />

            <span>
              Hors service
            </span>

            <strong>
              {
                offDutyAgents
              }
            </strong>
          </article>

          <article>
            <Wrench
              aria-hidden="true"
            />

            <span>
              Missions actives
            </span>

            <strong>
              {
                activeInterventions
              }
            </strong>
          </article>

          <article>
            <ShieldCheck
              aria-hidden="true"
            />

            <span>
              Missions terminées
            </span>

            <strong>
              {
                completedInterventions
              }
            </strong>
          </article>
        </div>


        {/* ==============================================================
            BARRE OUTILS
            ============================================================== */}

        <div
          className="company-field-toolbar"
        >
          <label
            className="company-field-search"
          >
            <Search
              aria-hidden="true"
            />

            <input
              type="search"
              placeholder={
                activeTab ===
                  'AGENTS'
                  ? 'Rechercher un intervenant, une zone...'
                  : 'Rechercher un client, une alerte, un agent...'
              }
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
            />
          </label>


          {
            activeTab ===
              'INTERVENTIONS'
              &&
              (
                <div
                  className="company-field-filter-buttons"
                >
                  <button
                    type="button"
                    className={
                      interventionFilter ===
                        'ALL'
                        ? 'is-active'
                        : undefined
                    }
                    onClick={
                      () =>
                        setInterventionFilter(
                          'ALL',
                        )
                    }
                  >
                    Toutes
                  </button>

                  <button
                    type="button"
                    className={
                      interventionFilter ===
                        'ACTIVE'
                        ? 'is-active'
                        : undefined
                    }
                    onClick={
                      () =>
                        setInterventionFilter(
                          'ACTIVE',
                        )
                    }
                  >
                    Actives
                  </button>

                  <button
                    type="button"
                    className={
                      interventionFilter ===
                        'COMPLETED'
                        ? 'is-active'
                        : undefined
                    }
                    onClick={
                      () =>
                        setInterventionFilter(
                          'COMPLETED',
                        )
                    }
                  >
                    Terminées
                  </button>
                </div>
              )
          }
        </div>


        {/* ==============================================================
            ONGLET INTERVENANTS
            ============================================================== */}

        {
          activeTab ===
            'AGENTS'
            &&
            (
              <div
                className="company-field-layout"
              >
                <section
                  className="company-field-list-panel"
                >
                  <div
                    className="company-field-panel-heading"
                  >
                    <div>
                      <strong>
                        Équipe terrain
                      </strong>

                      <small>
                        {
                          filteredAgents.length
                        }
                        {' '}
                        intervenant(s)
                      </small>
                    </div>
                  </div>


                  {
                    loading.agents
                    &&
                    fieldAgents.length ===
                      0
                      ? (
                        <div
                          className="company-field-empty"
                        >
                          <RefreshCw
                            aria-hidden="true"
                            className="is-spinning"
                          />

                          Chargement...
                        </div>
                      )
                      : filteredAgents.length ===
                          0
                        ? (
                          <div
                            className="company-field-empty"
                          >
                            <Users
                              aria-hidden="true"
                            />

                            <strong>
                              Aucun intervenant
                            </strong>

                            <span>
                              Aucun résultat pour cette recherche.
                            </span>
                          </div>
                        )
                        : (
                          <div
                            className="company-agent-list"
                          >
                            {
                              filteredAgents.map(
                                (
                                  agent,
                                ) => (
                                  <button
                                    type="button"
                                    className={
                                      (
                                        'company-agent-card '
                                        +
                                        (
                                          selectedAgentId ===
                                            agent.id
                                            ? 'is-selected'
                                            : ''
                                        )
                                      )
                                    }
                                    key={
                                      agent.id
                                    }
                                    onClick={
                                      () =>
                                        setSelectedAgentId(
                                          agent.id,
                                        )
                                    }
                                  >
                                    <span
                                      className="company-agent-avatar"
                                    >
                                      {
                                        agent.firstName
                                          .slice(
                                            0,
                                            1,
                                          )
                                          .toUpperCase()
                                      }
                                      {
                                        agent.lastName
                                          .slice(
                                            0,
                                            1,
                                          )
                                          .toUpperCase()
                                      }
                                    </span>

                                    <span
                                      className="company-agent-main"
                                    >
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

                                        <span
                                          className={
                                            (
                                              'company-agent-status '
                                              +
                                              `is-${agent.status.toLowerCase()}`
                                            )
                                          }
                                        >
                                          {
                                            agentStatusLabel(
                                              agent.status,
                                            )
                                          }
                                        </span>
                                      </span>

                                      <small>
                                        <MapPin
                                          aria-hidden="true"
                                        />

                                        {
                                          agent.area
                                        }
                                      </small>

                                      <small>
                                        <Phone
                                          aria-hidden="true"
                                        />

                                        {
                                          agent.phone
                                        }
                                      </small>
                                    </span>
                                  </button>
                                ),
                              )
                            }
                          </div>
                        )
                  }
                </section>


                <section
                  className="company-field-detail-panel"
                >
                  {
                    !selectedAgent
                      ? (
                        <div
                          className="company-field-detail-empty"
                        >
                          <UserRoundCheck
                            aria-hidden="true"
                          />

                          <strong>
                            Sélectionnez un intervenant
                          </strong>

                          <span>
                            Sa fiche opérationnelle apparaîtra ici.
                          </span>
                        </div>
                      )
                      : (
                        <>
                          <div
                            className="company-agent-detail-header"
                          >
                            <span
                              className="company-agent-detail-avatar"
                            >
                              {
                                selectedAgent.firstName
                                  .slice(
                                    0,
                                    1,
                                  )
                                  .toUpperCase()
                              }
                              {
                                selectedAgent.lastName
                                  .slice(
                                    0,
                                    1,
                                  )
                                  .toUpperCase()
                              }
                            </span>

                            <div>
                              <div>
                                <h2>
                                  {
                                    selectedAgent.firstName
                                  }
                                  {' '}
                                  {
                                    selectedAgent.lastName
                                  }
                                </h2>

                                <span
                                  className={
                                    (
                                      'company-agent-status '
                                      +
                                      `is-${selectedAgent.status.toLowerCase()}`
                                    )
                                  }
                                >
                                  {
                                    agentStatusLabel(
                                      selectedAgent.status,
                                    )
                                  }
                                </span>
                              </div>

                              <a
                                href={
                                  `tel:${selectedAgent.phone}`
                                }
                              >
                                <Phone
                                  aria-hidden="true"
                                />

                                {
                                  selectedAgent.phone
                                }
                              </a>

                              <span>
                                <MapPin
                                  aria-hidden="true"
                                />

                                Zone :
                                {' '}
                                {
                                  selectedAgent.area
                                }
                              </span>
                            </div>
                          </div>


                          <section
                            className="company-field-section"
                          >
                            <div
                              className="company-field-section-heading"
                            >
                              <Wrench
                                aria-hidden="true"
                              />

                              <div>
                                <strong>
                                  Mission actuelle
                                </strong>

                                <small>
                                  Intervention actuellement rattachée à l&apos;agent.
                                </small>
                              </div>
                            </div>


                            {
                              !selectedAgent.currentInterventionId
                                ? (
                                  <div
                                    className="company-field-section-empty"
                                  >
                                    Aucune mission actuellement affectée.
                                  </div>
                                )
                                : (
                                  <button
                                    type="button"
                                    className="company-current-mission"
                                    onClick={
                                      () => {

                                        setSelectedInterventionId(
                                          selectedAgent.currentInterventionId
                                          ??
                                          null,
                                        )

                                        setActiveTab(
                                          'INTERVENTIONS',
                                        )
                                      }
                                    }
                                  >
                                    <Wrench
                                      aria-hidden="true"
                                    />

                                    <span>
                                      <strong>
                                        Intervention en cours
                                      </strong>

                                      <small>
                                        {
                                          selectedAgent.currentInterventionId
                                        }
                                      </small>
                                    </span>
                                  </button>
                                )
                            }
                          </section>


                          <section
                            className="company-field-section"
                          >
                            <div
                              className="company-field-section-heading"
                            >
                              <Clock3
                                aria-hidden="true"
                              />

                              <div>
                                <strong>
                                  Historique des missions
                                </strong>

                                <small>
                                  Interventions associées à cet intervenant.
                                </small>
                              </div>
                            </div>


                            {
                              selectedAgentInterventions.length ===
                                0
                                ? (
                                  <div
                                    className="company-field-section-empty"
                                  >
                                    Aucune intervention enregistrée.
                                  </div>
                                )
                                : (
                                  <div
                                    className="company-agent-history"
                                  >
                                    {
                                      [
                                        ...selectedAgentInterventions,
                                      ]
                                        .sort(
                                          (
                                            a,
                                            b,
                                          ) =>
                                            new Date(
                                              b.requestedAt,
                                            ).getTime()
                                            -
                                            new Date(
                                              a.requestedAt,
                                            ).getTime(),
                                        )
                                        .map(
                                          (
                                            intervention,
                                          ) => {

                                            const customer =
                                              customersById.get(
                                                intervention.customerId,
                                              )


                                            const alert =
                                              alertsById.get(
                                                intervention.alertId,
                                              )


                                            return (
                                              <button
                                                type="button"
                                                key={
                                                  intervention.id
                                                }
                                                onClick={
                                                  () => {

                                                    setSelectedInterventionId(
                                                      intervention.id,
                                                    )

                                                    setActiveTab(
                                                      'INTERVENTIONS',
                                                    )
                                                  }
                                                }
                                              >
                                                <span>
                                                  <strong>
                                                    {
                                                      alert?.title
                                                      ??
                                                      'Intervention'
                                                    }
                                                  </strong>

                                                  <small>
                                                    {
                                                      customer
                                                        ? (
                                                          `${customer.firstName} ${customer.lastName}`
                                                        )
                                                        : intervention.customerId
                                                    }
                                                  </small>
                                                </span>

                                                <span>
                                                  {
                                                    interventionStatusLabel(
                                                      intervention.status,
                                                    )
                                                  }
                                                </span>
                                              </button>
                                            )
                                          },
                                        )
                                    }
                                  </div>
                                )
                            }
                          </section>
                        </>
                      )
                  }
                </section>
              </div>
            )
        }


        {/* ==============================================================
            ONGLET INTERVENTIONS
            ============================================================== */}

        {
          activeTab ===
            'INTERVENTIONS'
            &&
            (
              <div
                className="company-field-layout"
              >
                <section
                  className="company-field-list-panel"
                >
                  <div
                    className="company-field-panel-heading"
                  >
                    <div>
                      <strong>
                        Missions terrain
                      </strong>

                      <small>
                        {
                          filteredInterventions.length
                        }
                        {' '}
                        intervention(s)
                      </small>
                    </div>
                  </div>


                  {
                    loading.interventions
                    &&
                    interventions.length ===
                      0
                      ? (
                        <div
                          className="company-field-empty"
                        >
                          <RefreshCw
                            aria-hidden="true"
                            className="is-spinning"
                          />

                          Chargement...
                        </div>
                      )
                      : filteredInterventions.length ===
                          0
                        ? (
                          <div
                            className="company-field-empty"
                          >
                            <Wrench
                              aria-hidden="true"
                            />

                            <strong>
                              Aucune intervention
                            </strong>

                            <span>
                              Aucun résultat pour les filtres actuels.
                            </span>
                          </div>
                        )
                        : (
                          <div
                            className="company-intervention-list"
                          >
                            {
                              filteredInterventions.map(
                                (
                                  intervention,
                                ) => {

                                  const agent =
                                    agentsById.get(
                                      intervention.agentId,
                                    )


                                  const customer =
                                    customersById.get(
                                      intervention.customerId,
                                    )


                                  const alert =
                                    alertsById.get(
                                      intervention.alertId,
                                    )


                                  return (
                                    <button
                                      type="button"
                                      className={
                                        (
                                          'company-intervention-card '
                                          +
                                          (
                                            selectedInterventionId ===
                                              intervention.id
                                              ? 'is-selected'
                                              : ''
                                          )
                                        )
                                      }
                                      key={
                                        intervention.id
                                      }
                                      onClick={
                                        () =>
                                          setSelectedInterventionId(
                                            intervention.id,
                                          )
                                      }
                                    >
                                      <span
                                        className={
                                          (
                                            'company-intervention-state-dot '
                                            +
                                            (
                                              isActiveIntervention(
                                                intervention,
                                              )
                                                ? 'is-active'
                                                : 'is-closed'
                                            )
                                          )
                                        }
                                      />

                                      <span
                                        className="company-intervention-main"
                                      >
                                        <span>
                                          <strong>
                                            {
                                              alert?.title
                                              ??
                                              'Intervention terrain'
                                            }
                                          </strong>

                                          <small>
                                            {
                                              formatDate(
                                                intervention.requestedAt,
                                              )
                                            }
                                          </small>
                                        </span>

                                        <span>
                                          {
                                            customer
                                              ? (
                                                `${customer.firstName} ${customer.lastName}`
                                              )
                                              : intervention.customerId
                                          }
                                        </span>

                                        <small>
                                          {
                                            agent
                                              ? (
                                                `${agent.firstName} ${agent.lastName}`
                                              )
                                              : intervention.agentId
                                          }
                                          {' · '}
                                          {
                                            interventionStatusLabel(
                                              intervention.status,
                                            )
                                          }
                                        </small>
                                      </span>
                                    </button>
                                  )
                                },
                              )
                            }
                          </div>
                        )
                  }
                </section>


                <section
                  className="company-field-detail-panel"
                >
                  {
                    !selectedIntervention
                      ? (
                        <div
                          className="company-field-detail-empty"
                        >
                          <Wrench
                            aria-hidden="true"
                          />

                          <strong>
                            Sélectionnez une intervention
                          </strong>

                          <span>
                            Le détail de la mission apparaîtra ici.
                          </span>
                        </div>
                      )
                      : (
                        <>
                          <div
                            className="company-intervention-detail-header"
                          >
                            <div>
                              <span
                                className={
                                  (
                                    'company-intervention-status '
                                    +
                                    (
                                      isActiveIntervention(
                                        selectedIntervention,
                                      )
                                        ? 'is-active'
                                        : 'is-closed'
                                    )
                                  )
                                }
                              >
                                {
                                  interventionStatusLabel(
                                    selectedIntervention.status,
                                  )
                                }
                              </span>

                              <h2>
                                {
                                  selectedInterventionAlert?.title
                                  ??
                                  'Intervention terrain'
                                }
                              </h2>

                              <p>
                                Mission demandée le
                                {' '}
                                {
                                  formatDate(
                                    selectedIntervention.requestedAt,
                                  )
                                }
                              </p>
                            </div>
                          </div>


                          <div
                            className="company-intervention-info-grid"
                          >
                            <article>
                              <UserRoundCheck
                                aria-hidden="true"
                              />

                              <span>
                                Intervenant
                              </span>

                              <strong>
                                {
                                  selectedInterventionAgent
                                    ? (
                                      `${selectedInterventionAgent.firstName} `
                                      + `${selectedInterventionAgent.lastName}`
                                    )
                                    : selectedIntervention.agentId
                                }
                              </strong>

                              {
                                selectedInterventionAgent
                                &&
                                (
                                  <a
                                    href={
                                      `tel:${selectedInterventionAgent.phone}`
                                    }
                                  >
                                    {
                                      selectedInterventionAgent.phone
                                    }
                                  </a>
                                )
                              }
                            </article>


                            <article>
                              <Users
                                aria-hidden="true"
                              />

                              <span>
                                Client
                              </span>

                              <strong>
                                {
                                  selectedInterventionCustomer
                                    ? (
                                      `${selectedInterventionCustomer.firstName} `
                                      + `${selectedInterventionCustomer.lastName}`
                                    )
                                    : selectedIntervention.customerId
                                }
                              </strong>

                              {
                                selectedInterventionCustomer
                                &&
                                (
                                  <a
                                    href={
                                      `tel:${selectedInterventionCustomer.phone}`
                                    }
                                  >
                                    {
                                      selectedInterventionCustomer.phone
                                    }
                                  </a>
                                )
                              }
                            </article>


                            <article>
                              <Siren
                                aria-hidden="true"
                              />

                              <span>
                                Alerte
                              </span>

                              <strong>
                                {
                                  selectedInterventionAlert?.title
                                  ??
                                  selectedIntervention.alertId
                                }
                              </strong>

                              <small>
                                {
                                  selectedInterventionAlert?.status
                                  ??
                                  '—'
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
                                  selectedIntervention.siteId
                                }
                              </strong>

                              <small>
                                Identifiant du site surveillé
                              </small>
                            </article>
                          </div>


                          <section
                            className="company-field-section"
                          >
                            <div
                              className="company-field-section-heading"
                            >
                              <Clock3
                                aria-hidden="true"
                              />

                              <div>
                                <strong>
                                  Chronologie de la mission
                                </strong>

                                <small>
                                  Horodatages réellement disponibles dans la base.
                                </small>
                              </div>
                            </div>


                            <div
                              className="company-intervention-timeline"
                            >
                              <TimelinePoint
                                label="Intervention demandée"
                                date={
                                  selectedIntervention.requestedAt
                                }
                                complete={
                                  true
                                }
                              />

                              <TimelinePoint
                                label="Intervention acceptée"
                                date={
                                  selectedIntervention.acceptedAt
                                }
                                complete={
                                  Boolean(
                                    selectedIntervention.acceptedAt,
                                  )
                                }
                              />

                              <TimelinePoint
                                label="Arrivée sur place"
                                date={
                                  selectedIntervention.arrivedAt
                                }
                                complete={
                                  Boolean(
                                    selectedIntervention.arrivedAt,
                                  )
                                }
                              />

                              <TimelinePoint
                                label="Intervention terminée"
                                date={
                                  selectedIntervention.completedAt
                                }
                                complete={
                                  Boolean(
                                    selectedIntervention.completedAt,
                                  )
                                }
                              />
                            </div>
                          </section>


                          <section
                            className="company-field-section"
                          >
                            <div
                              className="company-field-section-heading"
                            >
                              <ShieldCheck
                                aria-hidden="true"
                              />

                              <div>
                                <strong>
                                  Rapport d&apos;intervention
                                </strong>

                                <small>
                                  Compte rendu terrain associé à la mission.
                                </small>
                              </div>
                            </div>


                            {
                              selectedIntervention.report
                                ? (
                                  <p
                                    className="company-intervention-report"
                                  >
                                    {
                                      selectedIntervention.report
                                    }
                                  </p>
                                )
                                : (
                                  <div
                                    className="company-field-section-empty"
                                  >
                                    Aucun rapport n&apos;a encore été enregistré.
                                  </div>
                                )
                            }
                          </section>


                          <section
                            className="company-field-readonly-note"
                          >
                            <CircleAlert
                              aria-hidden="true"
                            />

                            <div>
                              <strong>
                                Suivi d&apos;état en lecture seule pour le moment
                              </strong>

                              <span>
                                Le backend actuel expose la liste des
                                interventions mais pas encore de route pour
                                enregistrer « accepté », « arrivé » ou
                                « terminé ». Aucun faux changement d&apos;état
                                n&apos;est donc simulé depuis cette page.
                              </span>
                            </div>
                          </section>
                        </>
                      )
                  }
                </section>
              </div>
            )
        }
      </div>
    </main>
  )
}


// =========================================================================
// POINT DE TIMELINE
// =========================================================================

function TimelinePoint(
  {
    label,
    date,
    complete,
  }:
  {
    label:
      string

    date:
      string | undefined

    complete:
      boolean
  },
) {

  return (
    <article
      className={
        complete
          ? 'is-complete'
          : 'is-pending'
      }
    >
      <span
        className="company-intervention-timeline-dot"
      />

      <div>
        <strong>
          {
            label
          }
        </strong>

        <span>
          {
            date
              ? formatDate(
                  date,
                )
              : 'En attente'
          }
        </span>
      </div>
    </article>
  )
}


// =========================================================================
// PAGE EXPORTÉE
// =========================================================================

function CompanyInterventionsPage() {

  return (
    <CompanyInterventionsContent />
  )
}


export default CompanyInterventionsPage
