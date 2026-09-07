// CompanyAuditPage.tsx

// -----------------------------------------------------------------------
// AUDIT GLOBAL ENTREPRISE - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Cette page centralise les traces d'audit générées automatiquement
// par FastAPI.
//
// Principe :
//
// - les pages React NE créent pas elles-mêmes de logs ;
// - les actions sensibles sont journalisées côté backend ;
// - cette page permet uniquement de consulter / filtrer les traces.
//
// Exemples de traces :
//
// - prise en charge d'une alerte ;
// - changement de statut ;
// - consultation d'une caméra ;
// - capture d'image ;
// - commande robot ;
// - activation / désactivation d'un équipement ;
// - appel client ;
// - affectation d'un intervenant ;
// - escalade ;
// - actions support.
//
// Route utilisée :
//
// GET /api/company/audit
//
// Le backend actuel accepte aussi éventuellement :
//
// ?customerId=...
//
// La recherche avancée de cette page est volontairement effectuée côté
// React afin de ne pas inventer des paramètres HTTP que FastAPI n'expose
// pas encore.
//
// -----------------------------------------------------------------------

import {
  Activity,
  ArrowLeft,
  Bot,
  Camera,
  CircleAlert,
  Clock3,
  FileSearch,
  Filter,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
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
  AuditLog,
} from '../types/company'

import '../styles/dashboard.css'
import '../styles/company-dashboard.css'
import '../styles/company-audit.css'


// =========================================================================
// TYPES LOCAUX
// =========================================================================

type AuditCategory =
  | 'ALL'
  | 'ALERT'
  | 'HARDWARE'
  | 'SUPPORT'
  | 'CUSTOMER'
  | 'INTERVENTION'
  | 'OTHER'


const AUDIT_CATEGORY_OPTIONS:
  AuditCategory[] = [
    'ALL',
    'ALERT',
    'HARDWARE',
    'SUPPORT',
    'CUSTOMER',
    'INTERVENTION',
    'OTHER',
  ]


// =========================================================================
// LABELS
// =========================================================================

function categoryLabel(
  category:
    AuditCategory,
): string {

  const labels:
    Record<
      AuditCategory,
      string
    > = {

      ALL:
        'Toutes',

      ALERT:
        'Alertes',

      HARDWARE:
        'Matériel',

      SUPPORT:
        'Support',

      CUSTOMER:
        'Clients',

      INTERVENTION:
        'Interventions',

      OTHER:
        'Autres',
    }


  return labels[
    category
  ]
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
        'medium',
    },
  ).format(
    date,
  )
}


// =========================================================================
// JOUR LOCAL
// =========================================================================

function localDayKey(
  value:
    string,
): string {

  const date =
    new Date(
      value,
    )


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {

    return ''
  }


  const year =
    date.getFullYear()


  const month =
    String(
      date.getMonth()
      +
      1,
    ).padStart(
      2,
      '0',
    )


  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    )


  return (
    `${year}-${month}-${day}`
  )
}


// =========================================================================
// CATÉGORISATION D'UN LOG
// =========================================================================
//
// On ne modifie pas le type AuditLog et on ne suppose pas que le backend
// possède déjà une colonne "category".
//
// La catégorie d'affichage est donc déduite uniquement des champs déjà
// réellement renvoyés par le backend.
//
// Cette catégorisation n'altère pas le log original.
// =========================================================================

function inferAuditCategory(
  log:
    AuditLog,
): AuditCategory {

  const text =
    (
      `${log.action} `
      + `${log.resourceType} `
      + `${log.description}`
    )
      .toUpperCase()


  if (
    text.includes(
      'CAMERA',
    )
    ||
    text.includes(
      'SCREENSHOT',
    )
    ||
    text.includes(
      'ROBOT',
    )
    ||
    text.includes(
      'EQUIPMENT',
    )
    ||
    text.includes(
      'SERVO',
    )
    ||
    text.includes(
      'SENSOR',
    )
  ) {

    return 'HARDWARE'
  }


  if (
    text.includes(
      'SUPPORT',
    )
    ||
    text.includes(
      'TICKET',
    )
  ) {

    return 'SUPPORT'
  }


  if (
    text.includes(
      'INTERVENTION',
    )
    ||
    text.includes(
      'AGENT',
    )
    ||
    text.includes(
      'DISPATCH',
    )
  ) {

    return 'INTERVENTION'
  }


  if (
    text.includes(
      'CUSTOMER',
    )
    ||
    text.includes(
      'CLIENT',
    )
  ) {

    return 'CUSTOMER'
  }


  if (
    text.includes(
      'ALERT',
    )
    ||
    text.includes(
      'ESCALAT',
    )
  ) {

    return 'ALERT'
  }


  return 'OTHER'
}


// =========================================================================
// ICÔNE D'UN LOG
// =========================================================================

function AuditIcon(
  {
    category,
  }:
  {
    category:
      AuditCategory
  },
) {

  if (
    category ===
      'HARDWARE'
  ) {

    return (
      <Camera
        aria-hidden="true"
      />
    )
  }


  if (
    category ===
      'ALERT'
  ) {

    return (
      <ShieldCheck
        aria-hidden="true"
      />
    )
  }


  if (
    category ===
      'INTERVENTION'
  ) {

    return (
      <Activity
        aria-hidden="true"
      />
    )
  }


  if (
    category ===
      'CUSTOMER'
  ) {

    return (
      <UserRound
        aria-hidden="true"
      />
    )
  }


  if (
    category ===
      'SUPPORT'
  ) {

    return (
      <FileSearch
        aria-hidden="true"
      />
    )
  }


  return (
    <History
      aria-hidden="true"
    />
  )
}


// =========================================================================
// COMPOSANT INTERNE
// =========================================================================

function CompanyAuditContent() {

  const navigate =
    useNavigate()


  const {
    currentOperator,

    auditLogs,
    refreshAuditLogs,

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
    category,
    setCategory,
  ] =
    useState<
      AuditCategory
    >(
      'ALL',
    )


  const [
    actorFilter,
    setActorFilter,
  ] =
    useState(
      '',
    )


  const [
    resourceFilter,
    setResourceFilter,
  ] =
    useState(
      '',
    )


  const [
    dateFrom,
    setDateFrom,
  ] =
    useState(
      '',
    )


  const [
    dateTo,
    setDateTo,
  ] =
    useState(
      '',
    )


  // =====================================================================
  // LOG SÉLECTIONNÉ
  // =====================================================================

  const [
    selectedLogId,
    setSelectedLogId,
  ] =
    useState<
      string | null
    >(
      null,
    )


  // =====================================================================
  // CHARGEMENT
  // =====================================================================

  const refreshAudit =
    useCallback(
      async (): Promise<void> => {

        await refreshAuditLogs()
      },
      [
        refreshAuditLogs,
      ],
    )


  useEffect(
    () => {

      void refreshAudit()
    },
    [
      refreshAudit,
    ],
  )


  // =====================================================================
  // ACTEURS DISPONIBLES
  // =====================================================================

  const actors =
    useMemo(
      () => {

        return [
          ...new Set(
            auditLogs
              .map(
                (
                  log,
                ) =>
                  log.actorName,
              )
              .filter(
                (
                  value,
                ) =>
                  value.trim() !==
                    '',
              ),
          ),
        ].sort(
          (
            a,
            b,
          ) =>
            a.localeCompare(
              b,
              'fr-FR',
            ),
        )
      },
      [
        auditLogs,
      ],
    )


  // =====================================================================
  // TYPES DE RESSOURCE DISPONIBLES
  // =====================================================================

  const resourceTypes =
    useMemo(
      () => {

        return [
          ...new Set(
            auditLogs
              .map(
                (
                  log,
                ) =>
                  log.resourceType,
              )
              .filter(
                (
                  value,
                ) =>
                  value.trim() !==
                    '',
              ),
          ),
        ].sort(
          (
            a,
            b,
          ) =>
            a.localeCompare(
              b,
              'fr-FR',
            ),
        )
      },
      [
        auditLogs,
      ],
    )


  // =====================================================================
  // FILTRAGE
  // =====================================================================

  const filteredLogs =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLocaleLowerCase(
              'fr-FR',
            )


        const result =
          auditLogs.filter(
            (
              log,
            ) => {

              if (
                category !==
                  'ALL'
                &&
                inferAuditCategory(
                  log,
                ) !==
                  category
              ) {

                return false
              }


              if (
                actorFilter !==
                  ''
                &&
                log.actorName !==
                  actorFilter
              ) {

                return false
              }


              if (
                resourceFilter !==
                  ''
                &&
                log.resourceType !==
                  resourceFilter
              ) {

                return false
              }


              const day =
                localDayKey(
                  log.createdAt,
                )


              if (
                dateFrom !==
                  ''
                &&
                day !==
                  ''
                &&
                day <
                  dateFrom
              ) {

                return false
              }


              if (
                dateTo !==
                  ''
                &&
                day !==
                  ''
                &&
                day >
                  dateTo
              ) {

                return false
              }


              if (
                query ===
                  ''
              ) {

                return true
              }


              const haystack =
                (
                  `${log.actorName} `
                  + `${log.action} `
                  + `${log.resourceType} `
                  + `${log.resourceId} `
                  + `${log.description}`
                )
                  .toLocaleLowerCase(
                    'fr-FR',
                  )


              return haystack.includes(
                query,
              )
            },
          )


        return [
          ...result,
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
        )
      },
      [
        actorFilter,
        auditLogs,
        category,
        dateFrom,
        dateTo,
        resourceFilter,
        search,
      ],
    )


  // =====================================================================
  // LOG SÉLECTIONNÉ
  // =====================================================================

  const selectedLog =
    selectedLogId
      ? (
        auditLogs.find(
          (
            log,
          ) =>
            log.id ===
              selectedLogId,
        )
        ??
        null
      )
      : null


  // =====================================================================
  // STATISTIQUES
  // =====================================================================

  const todayKey =
    localDayKey(
      new Date()
        .toISOString(),
    )


  const todayLogs =
    auditLogs.filter(
      (
        log,
      ) =>
        localDayKey(
          log.createdAt,
        ) ===
          todayKey,
    ).length


  const hardwareLogs =
    auditLogs.filter(
      (
        log,
      ) =>
        inferAuditCategory(
          log,
        ) ===
          'HARDWARE',
    ).length


  const uniqueActors =
    new Set(
      auditLogs.map(
        (
          log,
        ) =>
          log.actorName,
      ),
    ).size


  // =====================================================================
  // RESET FILTRES
  // =====================================================================

  function clearFilters() {

    setSearch(
      '',
    )

    setCategory(
      'ALL',
    )

    setActorFilter(
      '',
    )

    setResourceFilter(
      '',
    )

    setDateFrom(
      '',
    )

    setDateTo(
      '',
    )
  }


  // =====================================================================
  // RENDU
  // =====================================================================

  return (
    <main
      className="company-audit-page"
    >

      {/* ================================================================
          TOPBAR
          ================================================================ */}

      <header
        className="company-audit-topbar"
      >
        <button
          type="button"
          className="company-audit-back"
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
          className="company-audit-topbar-title"
        >
          <History
            aria-hidden="true"
          />

          <span>
            <strong>
              Audit global
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
          className="company-audit-refresh"
          disabled={
            loading.audit
          }
          onClick={
            () =>
              void refreshAudit()
          }
        >
          <RefreshCw
            aria-hidden="true"
            className={
              loading.audit
                ? 'is-spinning'
                : undefined
            }
          />

          Actualiser
        </button>
      </header>


      <div
        className="company-audit-content"
      >

        {/* ==============================================================
            TITRE
            ============================================================== */}

        <div
          className="company-audit-heading"
        >
          <div>
            <p
              className="dashboard-eyebrow"
            >
              Traçabilité
            </p>

            <h1>
              Journal d&apos;audit
            </h1>

            <p>
              Consultez les actions enregistrées automatiquement
              par le serveur central.
            </p>
          </div>


          <div
            className="company-audit-readonly"
          >
            <ShieldCheck
              aria-hidden="true"
            />

            <span>
              <strong>
                Lecture seule
              </strong>

              <small>
                Les logs sont générés côté FastAPI.
              </small>
            </span>
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
                  'company-audit-feedback '
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
              className="company-audit-feedback is-error"
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
          className="company-audit-metrics"
        >
          <article>
            <History
              aria-hidden="true"
            />

            <span>
              Logs chargés
            </span>

            <strong>
              {
                auditLogs.length
              }
            </strong>
          </article>


          <article>
            <Clock3
              aria-hidden="true"
            />

            <span>
              Aujourd&apos;hui
            </span>

            <strong>
              {
                todayLogs
              }
            </strong>
          </article>


          <article>
            <Bot
              aria-hidden="true"
            />

            <span>
              Actions matérielles
            </span>

            <strong>
              {
                hardwareLogs
              }
            </strong>
          </article>


          <article>
            <UserRound
              aria-hidden="true"
            />

            <span>
              Acteurs distincts
            </span>

            <strong>
              {
                uniqueActors
              }
            </strong>
          </article>
        </div>


        {/* ==============================================================
            FILTRES
            ============================================================== */}

        <section
          className="company-audit-filters-panel"
        >
          <div
            className="company-audit-filters-title"
          >
            <div>
              <Filter
                aria-hidden="true"
              />

              <span>
                <strong>
                  Filtres
                </strong>

                <small>
                  Recherche sur les logs actuellement chargés.
                </small>
              </span>
            </div>


            <button
              type="button"
              onClick={
                clearFilters
              }
            >
              Réinitialiser
            </button>
          </div>


          <div
            className="company-audit-filters"
          >
            <label
              className="company-audit-search"
            >
              <Search
                aria-hidden="true"
              />

              <input
                type="search"
                placeholder="Acteur, action, ressource, description..."
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


            <label>
              <span>
                Catégorie
              </span>

              <select
                value={
                  category
                }
                onChange={
                  (
                    event,
                  ) => {

                    const value =
                      AUDIT_CATEGORY_OPTIONS.find(
                        (
                          item,
                        ) =>
                          item ===
                            event.target.value,
                      )


                    if (
                      value
                    ) {

                      setCategory(
                        value,
                      )
                    }
                  }
                }
              >
                {
                  AUDIT_CATEGORY_OPTIONS.map(
                    (
                      value,
                    ) => (
                      <option
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {
                          categoryLabel(
                            value,
                          )
                        }
                      </option>
                    ),
                  )
                }
              </select>
            </label>


            <label>
              <span>
                Acteur
              </span>

              <select
                value={
                  actorFilter
                }
                onChange={
                  (
                    event,
                  ) =>
                    setActorFilter(
                      event.target.value,
                    )
                }
              >
                <option
                  value=""
                >
                  Tous
                </option>

                {
                  actors.map(
                    (
                      actor,
                    ) => (
                      <option
                        key={
                          actor
                        }
                        value={
                          actor
                        }
                      >
                        {
                          actor
                        }
                      </option>
                    ),
                  )
                }
              </select>
            </label>


            <label>
              <span>
                Ressource
              </span>

              <select
                value={
                  resourceFilter
                }
                onChange={
                  (
                    event,
                  ) =>
                    setResourceFilter(
                      event.target.value,
                    )
                }
              >
                <option
                  value=""
                >
                  Toutes
                </option>

                {
                  resourceTypes.map(
                    (
                      resourceType,
                    ) => (
                      <option
                        key={
                          resourceType
                        }
                        value={
                          resourceType
                        }
                      >
                        {
                          resourceType
                        }
                      </option>
                    ),
                  )
                }
              </select>
            </label>


            <label>
              <span>
                Du
              </span>

              <input
                type="date"
                value={
                  dateFrom
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDateFrom(
                      event.target.value,
                    )
                }
              />
            </label>


            <label>
              <span>
                Au
              </span>

              <input
                type="date"
                value={
                  dateTo
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDateTo(
                      event.target.value,
                    )
                }
              />
            </label>
          </div>
        </section>


        {/* ==============================================================
            TABLE + DÉTAIL
            ============================================================== */}

        <div
          className="company-audit-layout"
        >

          <section
            className="company-audit-list-panel"
          >
            <div
              className="company-audit-list-heading"
            >
              <div>
                <strong>
                  Journal
                </strong>

                <small>
                  {
                    filteredLogs.length
                  }
                  {' '}
                  résultat(s)
                </small>
              </div>
            </div>


            {
              loading.audit
              &&
              auditLogs.length ===
                0
                ? (
                  <div
                    className="company-audit-empty"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className="is-spinning"
                    />

                    Chargement des logs...
                  </div>
                )
                : filteredLogs.length ===
                    0
                  ? (
                    <div
                      className="company-audit-empty"
                    >
                      <FileSearch
                        aria-hidden="true"
                      />

                      <strong>
                        Aucun log
                      </strong>

                      <span>
                        Aucun élément ne correspond aux filtres actuels.
                      </span>
                    </div>
                  )
                  : (
                    <div
                      className="company-audit-list"
                    >
                      {
                        filteredLogs.map(
                          (
                            log,
                          ) => {

                            const logCategory =
                              inferAuditCategory(
                                log,
                              )


                            return (
                              <button
                                type="button"
                                className={
                                  (
                                    'company-audit-row '
                                    +
                                    (
                                      selectedLogId ===
                                        log.id
                                        ? 'is-selected'
                                        : ''
                                    )
                                  )
                                }
                                key={
                                  log.id
                                }
                                onClick={
                                  () =>
                                    setSelectedLogId(
                                      log.id,
                                    )
                                }
                              >
                                <span
                                  className={
                                    (
                                      'company-audit-row-icon '
                                      +
                                      `is-${logCategory.toLowerCase()}`
                                    )
                                  }
                                >
                                  <AuditIcon
                                    category={
                                      logCategory
                                    }
                                  />
                                </span>

                                <span
                                  className="company-audit-row-main"
                                >
                                  <span
                                    className="company-audit-row-top"
                                  >
                                    <strong>
                                      {
                                        log.action
                                      }
                                    </strong>

                                    <small>
                                      {
                                        formatDate(
                                          log.createdAt,
                                        )
                                      }
                                    </small>
                                  </span>

                                  <span
                                    className="company-audit-row-description"
                                  >
                                    {
                                      log.description
                                    }
                                  </span>

                                  <span
                                    className="company-audit-row-meta"
                                  >
                                    <span>
                                      {
                                        log.actorName
                                      }
                                    </span>

                                    <span>
                                      {
                                        log.resourceType
                                      }
                                      {' · '}
                                      {
                                        log.resourceId
                                      }
                                    </span>
                                  </span>
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


          <aside
            className="company-audit-detail-panel"
          >
            {
              !selectedLog
                ? (
                  <div
                    className="company-audit-detail-empty"
                  >
                    <History
                      aria-hidden="true"
                    />

                    <strong>
                      Sélectionnez un log
                    </strong>

                    <span>
                      Le détail exact de l&apos;action apparaîtra ici.
                    </span>
                  </div>
                )
                : (
                  <>
                    <div
                      className="company-audit-detail-header"
                    >
                      <span
                        className={
                          (
                            'company-audit-detail-icon '
                            +
                            `is-${inferAuditCategory(
                              selectedLog,
                            ).toLowerCase()}`
                          )
                        }
                      >
                        <AuditIcon
                          category={
                            inferAuditCategory(
                              selectedLog,
                            )
                          }
                        />
                      </span>

                      <div>
                        <span>
                          {
                            categoryLabel(
                              inferAuditCategory(
                                selectedLog,
                              ),
                            )
                          }
                        </span>

                        <h2>
                          {
                            selectedLog.action
                          }
                        </h2>

                        <p>
                          {
                            selectedLog.description
                          }
                        </p>
                      </div>
                    </div>


                    <div
                      className="company-audit-detail-grid"
                    >
                      <article>
                        <Clock3
                          aria-hidden="true"
                        />

                        <span>
                          Horodatage
                        </span>

                        <strong>
                          {
                            formatDate(
                              selectedLog.createdAt,
                            )
                          }
                        </strong>
                      </article>


                      <article>
                        <UserRound
                          aria-hidden="true"
                        />

                        <span>
                          Acteur
                        </span>

                        <strong>
                          {
                            selectedLog.actorName
                          }
                        </strong>
                      </article>


                      <article>
                        <FileSearch
                          aria-hidden="true"
                        />

                        <span>
                          Type de ressource
                        </span>

                        <strong>
                          {
                            selectedLog.resourceType
                          }
                        </strong>
                      </article>


                      <article>
                        <Activity
                          aria-hidden="true"
                        />

                        <span>
                          Identifiant ressource
                        </span>

                        <strong>
                          {
                            selectedLog.resourceId
                          }
                        </strong>
                      </article>
                    </div>


                    <section
                      className="company-audit-technical-block"
                    >
                      <div>
                        <ShieldCheck
                          aria-hidden="true"
                        />

                        <span>
                          <strong>
                            Identifiant du log
                          </strong>

                          <small>
                            Clé de traçabilité dans la base.
                          </small>
                        </span>
                      </div>

                      <code>
                        {
                          selectedLog.id
                        }
                      </code>
                    </section>


                    <section
                      className="company-audit-readonly-note"
                    >
                      <ShieldCheck
                        aria-hidden="true"
                      />

                      <div>
                        <strong>
                          Log non modifiable
                        </strong>

                        <span>
                          Cette interface ne fournit volontairement aucune
                          fonction permettant d&apos;éditer ou supprimer
                          une trace d&apos;audit.
                        </span>
                      </div>
                    </section>
                  </>
                )
            }
          </aside>
        </div>
      </div>
    </main>
  )
}


// =========================================================================
// PAGE EXPORTÉE
// =========================================================================

function CompanyAuditPage() {

  return (
    <CompanyAuditContent />
  )
}


export default CompanyAuditPage
