// CompanyCustomersPage.tsx

// -----------------------------------------------------------------------
// FICHES CLIENTS ENTREPRISE - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Cette page permet au centre de supervision de consulter les dossiers
// clients complets.
//
// Pour chaque client, on affiche notamment :
//
// - identité et coordonnées ;
// - sites surveillés ;
// - contacts d'urgence ;
// - alertes récentes ;
// - historique complet des alertes ;
// - historique des actions client / entreprise / système ;
// - statistiques avancées ;
// - tickets support ;
// - commentaires internes ;
// - logs d'audit.
//
// IMPORTANT :
//
// L'authentification réelle n'est toujours PAS développée.
// L'opérateur affiché provient encore du CompanyProvider.
//
// -----------------------------------------------------------------------

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Cpu,
  FileText,
  Headphones,
  Home,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
  Wifi,
  WifiOff,
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
  CompanyAlert,
  CompanyController,
  CreateCustomerInstallationInput,
  Customer,
  CustomerActivity,
  CustomerStatisticsPeriod,
  MonitoredSite,
  Priority,
  SupportTicket,
} from '../types/company'

import '../styles/dashboard.css'
import '../styles/company-dashboard.css'
import '../styles/company-customers.css'


// =========================================================================
// OPTIONS
// =========================================================================

const CUSTOMER_STATUS_OPTIONS:
  Customer['status'][] = [
    'ACTIVE',
    'SUSPENDED',
    'INACTIVE',
  ]


const STATISTICS_PERIOD_OPTIONS:
  CustomerStatisticsPeriod[] = [
    '7D',
    '30D',
    '90D',
    '1Y',
  ]


// =========================================================================
// LABELS
// =========================================================================

function customerStatusLabel(
  status:
    Customer['status'],
): string {

  const labels:
    Record<
      Customer['status'],
      string
    > = {

      ACTIVE:
        'Actif',

      SUSPENDED:
        'Suspendu',

      INACTIVE:
        'Inactif',
    }


  return labels[
    status
  ]
}


function siteStatusLabel(
  status:
    MonitoredSite['status'],
): string {

  const labels:
    Record<
      MonitoredSite['status'],
      string
    > = {

      ONLINE:
        'En ligne',

      DEGRADED:
        'Dégradé',

      OFFLINE:
        'Hors ligne',
    }


  return labels[
    status
  ]
}


function controllerTypeLabel(
  controller:
    CompanyController,
): string {

  return (
    controller.controllerType ===
      'MOBILE'
      ? 'Raspberry mobile'
      : 'Raspberry fixe'
  )
}


function componentLabel(
  technicalName:
    string,
): string {

  const labels:
    Record<
      string,
      string
    > = {

      camera:
        'Caméra',

      motion_sensor:
        'Détecteur de mouvement',

      motion:
        'Détecteur de mouvement',

      pir:
        'Détecteur de mouvement',

      robot:
        'Robot',

      servo:
        'Servomoteur',

      photoresistance:
        'Photorésistance',

      light_sensor:
        'Capteur de luminosité',

      led:
        'LED',

      button:
        'Bouton',

      bouton:
        'Bouton',
    }


  return (
    labels[
      technicalName
        .trim()
        .toLowerCase()
    ]
    ??
    technicalName
  )
}


function alertPriorityLabel(
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


function activityCategoryLabel(
  category:
    CustomerActivity['category'],
): string {

  const labels:
    Record<
      CustomerActivity['category'],
      string
    > = {

      ALERT:
        'Alerte',

      CUSTOMER_ACTION:
        'Action client',

      COMPANY_ACTION:
        'Action entreprise',

      SYSTEM:
        'Système',

      SUPPORT:
        'Support',
    }


  return labels[
    category
  ]
}


function periodLabel(
  period:
    CustomerStatisticsPeriod,
): string {

  const labels:
    Record<
      CustomerStatisticsPeriod,
      string
    > = {

      '7D':
        '7 jours',

      '30D':
        '30 jours',

      '90D':
        '90 jours',

      '1Y':
        '1 an',
    }


  return labels[
    period
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
        'short',
    },
  ).format(
    date,
  )
}


// =========================================================================
// DURÉE
// =========================================================================

function formatSeconds(
  value:
    number | null,
): string {

  if (
    value === null
  ) {

    return '—'
  }


  if (
    value < 60
  ) {

    return `${Math.round(value)} s`
  }


  const minutes =
    Math.floor(
      value / 60,
    )


  const seconds =
    Math.round(
      value % 60,
    )


  return (
    `${minutes} min ${seconds} s`
  )
}


// =========================================================================
// COMPOSANT INTERNE
// =========================================================================

function CompanyCustomersContent() {

  const navigate =
    useNavigate()


  const {
    currentOperator,

    customers,
    selectedCustomer,

    refreshCustomers,
    openCustomer,
    clearSelectedCustomer,

    loadCustomerStatistics,
    addCustomerComment,

    controllers,
    refreshControllers,
    createCustomerInstallation,

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
  // RECHERCHE / FILTRE
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
      Customer['status'] | ''
    >(
      '',
    )


  // =====================================================================
  // ONGLET CLIENT
  // =====================================================================

  type CustomerTab =
    | 'OVERVIEW'
    | 'ALERTS'
    | 'ACTIVITY'
    | 'STATISTICS'
    | 'SUPPORT'
    | 'COMMENTS'
    | 'AUDIT'


  const [
    activeTab,
    setActiveTab,
  ] =
    useState<
      CustomerTab
    >(
      'OVERVIEW',
    )


  // =====================================================================
  // PÉRIODE STATISTIQUES
  // =====================================================================

  const [
    statisticsPeriod,
    setStatisticsPeriod,
  ] =
    useState<
      CustomerStatisticsPeriod
    >(
      '30D',
    )


  // =====================================================================
  // COMMENTAIRE
  // =====================================================================

  const [
    newComment,
    setNewComment,
  ] =
    useState(
      '',
    )


  // =====================================================================
  // CRÉATION D'UN NOUVEAU CLIENT
  // =====================================================================

  const [
    createCustomerOpen,
    setCreateCustomerOpen,
  ] =
    useState(
      false,
    )


  // =====================================================================
  // CHARGEMENT
  // =====================================================================

  const loadCustomers =
    useCallback(
      async (): Promise<void> => {

        await refreshCustomers(
          {
            search:
              search.trim()
                || undefined,

            status:
              statusFilter
                || undefined,
          },
        )
      },
      [
        refreshCustomers,
        search,
        statusFilter,
      ],
    )


  useEffect(
    () => {

      void refreshCustomers()
    },
    [
      refreshCustomers,
    ],
  )


  // =====================================================================
  // OUVERTURE CLIENT
  // =====================================================================

  async function handleOpenCustomer(
    customer:
      Customer,
  ) {

    setActiveTab(
      'OVERVIEW',
    )

    setStatisticsPeriod(
      '30D',
    )

    setNewComment(
      '',
    )


    await Promise.all(
      [
        openCustomer(
          customer.id,
        ),

        refreshAuditLogs(
          customer.id,
        ),
      ],
    )
  }


  // =====================================================================
  // CHANGEMENT PÉRIODE
  // =====================================================================

  async function handlePeriodChange(
    period:
      CustomerStatisticsPeriod,
  ) {

    setStatisticsPeriod(
      period,
    )


    if (
      !selectedCustomer
    ) {

      return
    }


    await loadCustomerStatistics(
      selectedCustomer.customer.id,
      period,
    )
  }


  // =====================================================================
  // COMMENTAIRE
  // =====================================================================

  async function handleAddComment() {

    if (
      !selectedCustomer
      ||
      newComment.trim() ===
        ''
    ) {

      return
    }


    await addCustomerComment(
      selectedCustomer.customer.id,
      newComment.trim(),
    )


    setNewComment(
      '',
    )
  }


  // =====================================================================
  // OUVRIR LE FORMULAIRE DE CRÉATION
  // =====================================================================
  //
  // On recharge d'abord les Raspberry réellement connus du serveur.
  // Si aucun heartbeat n'a encore été reçu, la liste sera simplement vide.
  // =====================================================================

  async function handleOpenCreateCustomer() {

    await refreshControllers()


    setCreateCustomerOpen(
      true,
    )
  }


  // =====================================================================
  // TRI DES CLIENTS
  // =====================================================================

  const sortedCustomers =
    useMemo(
      () =>
        [
          ...customers,
        ].sort(
          (
            a,
            b,
          ) => {

            const aName =
              (
                `${a.lastName} ${a.firstName}`
              ).toLocaleLowerCase(
                'fr-FR',
              )


            const bName =
              (
                `${b.lastName} ${b.firstName}`
              ).toLocaleLowerCase(
                'fr-FR',
              )


            return aName.localeCompare(
              bName,
              'fr-FR',
            )
          },
        ),
      [
        customers,
      ],
    )


  // =====================================================================
  // STATISTIQUES JOURNALIÈRES
  // =====================================================================

  const maxDailyAlerts =
    useMemo(
      () => {

        const points =
          selectedCustomer
            ?.statistics.dailyActivity
          ??
          []


        if (
          points.length ===
            0
        ) {

          return 1
        }


        return Math.max(
          1,
          ...points.map(
            (
              point,
            ) =>
              point.alerts,
          ),
        )
      },
      [
        selectedCustomer,
      ],
    )


  // =====================================================================
  // RENDU
  // =====================================================================

  return (
    <main
      className="company-customers-page"
    >

      {/* ================================================================
          TOPBAR
          ================================================================ */}

      <header
        className="company-customers-topbar"
      >
        <button
          type="button"
          className="company-customers-back"
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
          className="company-customers-topbar-title"
        >
          <Users
            aria-hidden="true"
          />

          <span>
            <strong>
              Clients
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
          className="company-customers-refresh"
          disabled={
            loading.customers
          }
          onClick={
            () =>
              void loadCustomers()
          }
        >
          <RefreshCw
            aria-hidden="true"
            className={
              loading.customers
                ? 'is-spinning'
                : undefined
            }
          />

          Actualiser
        </button>
      </header>


      <div
        className="company-customers-shell"
      >

        {/* ==============================================================
            LISTE CLIENTS
            ============================================================== */}

        <section
          className="company-customers-list"
        >
          <div
            className="company-customers-heading"
          >
            <div>
              <p
                className="dashboard-eyebrow"
              >
                Parc clients
              </p>

              <h1>
                Dossiers clients
              </h1>

              <p>
                Consultez les personnes et les sites surveillés.
              </p>
            </div>

            <div
              className="company-customers-heading-actions"
            >
              <span
                className="company-customers-count"
              >
                {
                  customers.length
                }
              </span>

              <button
                type="button"
                className="company-create-customer-button"
                onClick={
                  () =>
                    void handleOpenCreateCustomer()
                }
              >
                <Plus
                  aria-hidden="true"
                />

                Nouveau client
              </button>
            </div>
          </div>


          {/* ------------------------------------------------------------
              FILTRES
              ------------------------------------------------------------ */}

          <div
            className="company-customers-filters"
          >
            <label>
              <Search
                aria-hidden="true"
              />

              <input
                type="search"
                placeholder="Nom, email, téléphone..."
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

                      void loadCustomers()
                    }
                  }
                }
              />
            </label>


            <select
              aria-label="Filtrer par statut client"
              value={
                statusFilter
              }
              onChange={
                (
                  event,
                ) => {

                  const value =
                    CUSTOMER_STATUS_OPTIONS.find(
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
                Tous
              </option>

              {
                CUSTOMER_STATUS_OPTIONS.map(
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
                        customerStatusLabel(
                          status,
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
                  void loadCustomers()
              }
            >
              Filtrer
            </button>
          </div>


          {/* ------------------------------------------------------------
              MESSAGES
              ------------------------------------------------------------ */}

          {
            feedback && (
              <div
                className={
                  (
                    'company-customer-feedback '
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
                className="company-customer-feedback is-error"
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
              CARTES CLIENTS
              ------------------------------------------------------------ */}

          <div
            className="company-customer-cards"
          >
            {
              loading.customers
              &&
              customers.length ===
                0
                ? (
                  <div
                    className="company-customer-empty"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className="is-spinning"
                    />

                    Chargement...
                  </div>
                )
                : sortedCustomers.length ===
                    0
                  ? (
                    <div
                      className="company-customer-empty"
                    >
                      <Users
                        aria-hidden="true"
                      />

                      <strong>
                        Aucun client
                      </strong>

                      <span>
                        Aucun dossier ne correspond aux filtres.
                      </span>
                    </div>
                  )
                  : (
                    sortedCustomers.map(
                      (
                        customer,
                      ) => {

                        const selected =
                          selectedCustomer
                            ?.customer.id ===
                          customer.id


                        return (
                          <button
                            type="button"
                            className={
                              (
                                'company-customer-card '
                                +
                                (
                                  selected
                                    ? 'is-selected'
                                    : ''
                                )
                              )
                            }
                            key={
                              customer.id
                            }
                            onClick={
                              () =>
                                void handleOpenCustomer(
                                  customer,
                                )
                            }
                          >
                            <span
                              className="company-customer-avatar"
                            >
                              {
                                customer.firstName
                                  .slice(
                                    0,
                                    1,
                                  )
                                  .toUpperCase()
                              }
                              {
                                customer.lastName
                                  .slice(
                                    0,
                                    1,
                                  )
                                  .toUpperCase()
                              }
                            </span>

                            <span
                              className="company-customer-card-body"
                            >
                              <span
                                className="company-customer-card-name"
                              >
                                <strong>
                                  {
                                    customer.firstName
                                  }
                                  {' '}
                                  {
                                    customer.lastName
                                  }
                                </strong>

                                <span
                                  className={
                                    (
                                      'company-customer-status '
                                      +
                                      `is-${customer.status.toLowerCase()}`
                                    )
                                  }
                                >
                                  {
                                    customerStatusLabel(
                                      customer.status,
                                    )
                                  }
                                </span>
                              </span>

                              <span>
                                {
                                  customer.email
                                }
                              </span>

                              <small>
                                {
                                  customer.phone
                                }
                              </small>
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
            FICHE CLIENT
            ============================================================== */}

        <section
          className="company-customer-detail"
        >
          {
            loading.customerDetail
            &&
            !selectedCustomer
              ? (
                <div
                  className="company-customer-detail-empty"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className="is-spinning"
                  />

                  Chargement de la fiche...
                </div>
              )
              : !selectedCustomer
                ? (
                  <div
                    className="company-customer-detail-empty"
                  >
                    <UserRound
                      aria-hidden="true"
                    />

                    <strong>
                      Sélectionnez un client
                    </strong>

                    <span>
                      Sa fiche complète apparaîtra ici.
                    </span>
                  </div>
                )
                : (
                  <>
                    {/* --------------------------------------------------
                        EN-TÊTE
                        -------------------------------------------------- */}

                    <div
                      className="company-customer-profile-header"
                    >
                      <div
                        className="company-customer-profile-avatar"
                      >
                        {
                          selectedCustomer.customer.firstName
                            .slice(
                              0,
                              1,
                            )
                            .toUpperCase()
                        }
                        {
                          selectedCustomer.customer.lastName
                            .slice(
                              0,
                              1,
                            )
                            .toUpperCase()
                        }
                      </div>


                      <div
                        className="company-customer-profile-main"
                      >
                        <div
                          className="company-customer-profile-title"
                        >
                          <div>
                            <h2>
                              {
                                selectedCustomer.customer.firstName
                              }
                              {' '}
                              {
                                selectedCustomer.customer.lastName
                              }
                            </h2>

                            <span
                              className={
                                (
                                  'company-customer-status '
                                  +
                                  `is-${selectedCustomer.customer.status.toLowerCase()}`
                                )
                              }
                            >
                              {
                                customerStatusLabel(
                                  selectedCustomer.customer.status,
                                )
                              }
                            </span>
                          </div>


                          <button
                            type="button"
                            aria-label="Fermer la fiche client"
                            onClick={
                              clearSelectedCustomer
                            }
                          >
                            <X
                              aria-hidden="true"
                            />
                          </button>
                        </div>


                        <div
                          className="company-customer-contact-row"
                        >
                          <a
                            href={
                              `mailto:${selectedCustomer.customer.email}`
                            }
                          >
                            <Mail
                              aria-hidden="true"
                            />

                            {
                              selectedCustomer.customer.email
                            }
                          </a>

                          <a
                            href={
                              `tel:${selectedCustomer.customer.phone}`
                            }
                          >
                            <Phone
                              aria-hidden="true"
                            />

                            {
                              selectedCustomer.customer.phone
                            }
                          </a>
                        </div>


                        <small>
                          Client depuis le
                          {' '}
                          {
                            formatDate(
                              selectedCustomer.customer.createdAt,
                            )
                          }
                        </small>
                      </div>
                    </div>


                    {/* --------------------------------------------------
                        ONGLETS
                        -------------------------------------------------- */}

                    <nav
                      className="company-customer-tabs"
                      aria-label="Sections de la fiche client"
                    >
                      <button
                        type="button"
                        className={
                          activeTab ===
                            'OVERVIEW'
                            ? 'is-active'
                            : undefined
                        }
                        onClick={
                          () =>
                            setActiveTab(
                              'OVERVIEW',
                            )
                        }
                      >
                        Vue d&apos;ensemble
                      </button>

                      <button
                        type="button"
                        className={
                          activeTab ===
                            'ALERTS'
                            ? 'is-active'
                            : undefined
                        }
                        onClick={
                          () =>
                            setActiveTab(
                              'ALERTS',
                            )
                        }
                      >
                        Alertes
                      </button>

                      <button
                        type="button"
                        className={
                          activeTab ===
                            'ACTIVITY'
                            ? 'is-active'
                            : undefined
                        }
                        onClick={
                          () =>
                            setActiveTab(
                              'ACTIVITY',
                            )
                        }
                      >
                        Activité
                      </button>

                      <button
                        type="button"
                        className={
                          activeTab ===
                            'STATISTICS'
                            ? 'is-active'
                            : undefined
                        }
                        onClick={
                          () =>
                            setActiveTab(
                              'STATISTICS',
                            )
                        }
                      >
                        Statistiques
                      </button>

                      <button
                        type="button"
                        className={
                          activeTab ===
                            'SUPPORT'
                            ? 'is-active'
                            : undefined
                        }
                        onClick={
                          () =>
                            setActiveTab(
                              'SUPPORT',
                            )
                        }
                      >
                        Support
                      </button>

                      <button
                        type="button"
                        className={
                          activeTab ===
                            'COMMENTS'
                            ? 'is-active'
                            : undefined
                        }
                        onClick={
                          () =>
                            setActiveTab(
                              'COMMENTS',
                            )
                        }
                      >
                        Commentaires
                      </button>

                      <button
                        type="button"
                        className={
                          activeTab ===
                            'AUDIT'
                            ? 'is-active'
                            : undefined
                        }
                        onClick={
                          () =>
                            setActiveTab(
                              'AUDIT',
                            )
                        }
                      >
                        Logs
                      </button>
                    </nav>


                    {/* ==================================================
                        VUE D'ENSEMBLE
                        ================================================== */}

                    {
                      activeTab ===
                        'OVERVIEW'
                        &&
                        (
                          <div
                            className="company-customer-tab-content"
                          >

                            {/* ------------------------------------------
                                SYNTHÈSE
                                ------------------------------------------ */}

                            <div
                              className="company-customer-summary-grid"
                            >
                              <article>
                                <Home
                                  aria-hidden="true"
                                />

                                <span>
                                  Sites
                                </span>

                                <strong>
                                  {
                                    selectedCustomer.sites.length
                                  }
                                </strong>
                              </article>

                              <article>
                                <Siren
                                  aria-hidden="true"
                                />

                                <span>
                                  Alertes récentes
                                </span>

                                <strong>
                                  {
                                    selectedCustomer.recentAlerts.length
                                  }
                                </strong>
                              </article>

                              <article>
                                <Headphones
                                  aria-hidden="true"
                                />

                                <span>
                                  Tickets support
                                </span>

                                <strong>
                                  {
                                    selectedCustomer.supportTickets.length
                                  }
                                </strong>
                              </article>

                              <article>
                                <MessageSquareText
                                  aria-hidden="true"
                                />

                                <span>
                                  Notes internes
                                </span>

                                <strong>
                                  {
                                    selectedCustomer.comments.length
                                  }
                                </strong>
                              </article>
                            </div>


                            {/* ------------------------------------------
                                NOTES CLIENT
                                ------------------------------------------ */}

                            {
                              selectedCustomer.customer.notes
                              &&
                              (
                                <section
                                  className="company-customer-block"
                                >
                                  <div
                                    className="company-customer-block-heading"
                                  >
                                    <FileText
                                      aria-hidden="true"
                                    />

                                    <div>
                                      <strong>
                                        Note client
                                      </strong>

                                      <small>
                                        Information générale du dossier.
                                      </small>
                                    </div>
                                  </div>

                                  <p>
                                    {
                                      selectedCustomer.customer.notes
                                    }
                                  </p>
                                </section>
                              )
                            }


                            {/* ------------------------------------------
                                SITES
                                ------------------------------------------ */}

                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-block-heading"
                              >
                                <Building2
                                  aria-hidden="true"
                                />

                                <div>
                                  <strong>
                                    Sites surveillés
                                  </strong>

                                  <small>
                                    Domiciles et lieux rattachés au client.
                                  </small>
                                </div>
                              </div>


                              {
                                selectedCustomer.sites.length ===
                                  0
                                  ? (
                                    <div
                                      className="company-customer-block-empty"
                                    >
                                      Aucun site enregistré.
                                    </div>
                                  )
                                  : (
                                    <div
                                      className="company-site-list"
                                    >
                                      {
                                        selectedCustomer.sites.map(
                                          (
                                            site,
                                          ) => (
                                            <article
                                              key={
                                                site.id
                                              }
                                            >
                                              <div
                                                className="company-site-icon"
                                              >
                                                <Home
                                                  aria-hidden="true"
                                                />
                                              </div>

                                              <div
                                                className="company-site-main"
                                              >
                                                <div>
                                                  <strong>
                                                    {
                                                      site.name
                                                    }
                                                  </strong>

                                                  <span
                                                    className={
                                                      (
                                                        'company-site-status '
                                                        +
                                                        `is-${site.status.toLowerCase()}`
                                                      )
                                                    }
                                                  >
                                                    {
                                                      siteStatusLabel(
                                                        site.status,
                                                      )
                                                    }
                                                  </span>
                                                </div>

                                                <span>
                                                  <MapPin
                                                    aria-hidden="true"
                                                  />

                                                  {
                                                    site.address
                                                  }
                                                  {', '}
                                                  {
                                                    site.postalCode
                                                  }
                                                  {' '}
                                                  {
                                                    site.city
                                                  }
                                                </span>

                                                <small>
                                                  Surveillance
                                                  {' '}
                                                  {
                                                    site.armed
                                                      ? 'armée'
                                                      : 'désarmée'
                                                  }
                                                </small>
                                              </div>


                                              {
                                                site.status ===
                                                  'ONLINE'
                                                  ? (
                                                    <Wifi
                                                      aria-label="En ligne"
                                                    />
                                                  )
                                                  : (
                                                    <WifiOff
                                                      aria-label="Connexion dégradée ou hors ligne"
                                                    />
                                                  )
                                              }
                                            </article>
                                          ),
                                        )
                                      }
                                    </div>
                                  )
                              }
                            </section>


                            {/* ------------------------------------------
                                INSTALLATION & APPAREILS
                                ------------------------------------------ */}

                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-block-heading"
                              >
                                <Cpu
                                  aria-hidden="true"
                                />

                                <div>
                                  <strong>
                                    Installation & appareils
                                  </strong>

                                  <small>
                                    Raspberry et composants réellement
                                    rattachés aux sites du client.
                                  </small>
                                </div>
                              </div>


                              <div
                                className="company-customer-installations"
                              >
                                {
                                  selectedCustomer.sites.map(
                                    (
                                      site,
                                    ) => (
                                      <article
                                        className="company-installation-site"
                                        key={
                                          site.id
                                        }
                                      >
                                        <div
                                          className="company-installation-site-heading"
                                        >
                                          <div>
                                            <Home
                                              aria-hidden="true"
                                            />

                                            <span>
                                              <strong>
                                                {
                                                  site.name
                                                }
                                              </strong>

                                              <small>
                                                {
                                                  site.address
                                                }
                                                {', '}
                                                {
                                                  site.postalCode
                                                }
                                                {' '}
                                                {
                                                  site.city
                                                }
                                              </small>
                                            </span>
                                          </div>

                                          <span
                                            className={
                                              (
                                                'company-site-status '
                                                +
                                                `is-${site.status.toLowerCase()}`
                                              )
                                            }
                                          >
                                            {
                                              siteStatusLabel(
                                                site.status,
                                              )
                                            }
                                          </span>
                                        </div>


                                        {
                                          (
                                            site.controllers
                                            ??
                                            []
                                          ).length ===
                                            0
                                            ? (
                                              <div
                                                className="company-installation-empty"
                                              >
                                                <Radio
                                                  aria-hidden="true"
                                                />

                                                <span>
                                                  Aucun Raspberry n&apos;est
                                                  actuellement rattaché à ce site.
                                                </span>
                                              </div>
                                            )
                                            : (
                                              <div
                                                className="company-controller-list"
                                              >
                                                {
                                                  (
                                                    site.controllers
                                                    ??
                                                    []
                                                  ).map(
                                                    (
                                                      controller,
                                                    ) => (
                                                      <div
                                                        className="company-controller-card"
                                                        key={
                                                          controller.ip
                                                        }
                                                      >
                                                        <div
                                                          className="company-controller-heading"
                                                        >
                                                          <div>
                                                            <Cpu
                                                              aria-hidden="true"
                                                            />

                                                            <span>
                                                              <strong>
                                                                {
                                                                  controllerTypeLabel(
                                                                    controller,
                                                                  )
                                                                }
                                                              </strong>

                                                              <small>
                                                                {
                                                                  controller.ip
                                                                }
                                                              </small>
                                                            </span>
                                                          </div>

                                                          <span
                                                            className={
                                                              (
                                                                'company-controller-status '
                                                                +
                                                                `is-${controller.status.toLowerCase()}`
                                                              )
                                                            }
                                                          >
                                                            {
                                                              controller.status ===
                                                                'ONLINE'
                                                                ? 'En ligne'
                                                                : 'Hors ligne'
                                                            }
                                                          </span>
                                                        </div>


                                                        <div
                                                          className="company-controller-meta"
                                                        >
                                                          <span>
                                                            Dernier contact :
                                                          </span>

                                                          <strong>
                                                            {
                                                              controller.lastSeen
                                                                ? formatDate(
                                                                    controller.lastSeen,
                                                                  )
                                                                : 'Jamais reçu'
                                                            }
                                                          </strong>
                                                        </div>


                                                        {
                                                          controller.components.length ===
                                                            0
                                                            ? (
                                                              <div
                                                                className="company-installation-empty is-small"
                                                              >
                                                                Aucun composant déclaré
                                                                par ce Raspberry.
                                                              </div>
                                                            )
                                                            : (
                                                              <div
                                                                className="company-component-list"
                                                              >
                                                                {
                                                                  controller.components.map(
                                                                    (
                                                                      component,
                                                                    ) => (
                                                                      <div
                                                                        className="company-component-row"
                                                                        key={
                                                                          component.id
                                                                        }
                                                                      >
                                                                        <span
                                                                          className="company-component-icon"
                                                                        >
                                                                          <Radio
                                                                            aria-hidden="true"
                                                                          />
                                                                        </span>

                                                                        <span
                                                                          className="company-component-copy"
                                                                        >
                                                                          <strong>
                                                                            {
                                                                              componentLabel(
                                                                                component.name,
                                                                              )
                                                                            }
                                                                          </strong>

                                                                          <small>
                                                                            {
                                                                              component.enabled
                                                                                ? 'Activé'
                                                                                : 'Désactivé'
                                                                            }
                                                                          </small>
                                                                        </span>

                                                                        <span
                                                                          className={
                                                                            (
                                                                              'company-component-status '
                                                                              +
                                                                              `is-${component.status.toLowerCase()}`
                                                                            )
                                                                          }
                                                                        >
                                                                          {
                                                                            component.status ===
                                                                              'ONLINE'
                                                                              ? 'En ligne'
                                                                              : 'Hors ligne'
                                                                          }
                                                                        </span>
                                                                      </div>
                                                                    ),
                                                                  )
                                                                }
                                                              </div>
                                                            )
                                                        }
                                                      </div>
                                                    ),
                                                  )
                                                }
                                              </div>
                                            )
                                        }
                                      </article>
                                    ),
                                  )
                                }
                              </div>
                            </section>


                            {/* ------------------------------------------
                                CONTACTS D'URGENCE
                                ------------------------------------------ */}

                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-block-heading"
                              >
                                <Phone
                                  aria-hidden="true"
                                />

                                <div>
                                  <strong>
                                    Contacts d&apos;urgence
                                  </strong>

                                  <small>
                                    Ordre de priorité défini dans le dossier.
                                  </small>
                                </div>
                              </div>


                              {
                                selectedCustomer.emergencyContacts.length ===
                                  0
                                  ? (
                                    <div
                                      className="company-customer-block-empty"
                                    >
                                      Aucun contact d&apos;urgence.
                                    </div>
                                  )
                                  : (
                                    <div
                                      className="company-emergency-contacts"
                                    >
                                      {
                                        [
                                          ...selectedCustomer.emergencyContacts,
                                        ]
                                          .sort(
                                            (
                                              a,
                                              b,
                                            ) =>
                                              a.priority
                                              -
                                              b.priority,
                                          )
                                          .map(
                                            (
                                              contact,
                                            ) => (
                                              <article
                                                key={
                                                  contact.id
                                                }
                                              >
                                                <span>
                                                  #
                                                  {
                                                    contact.priority
                                                  }
                                                </span>

                                                <div>
                                                  <strong>
                                                    {
                                                      contact.firstName
                                                    }
                                                    {' '}
                                                    {
                                                      contact.lastName
                                                    }
                                                  </strong>

                                                  <small>
                                                    {
                                                      contact.relationship
                                                    }
                                                  </small>
                                                </div>

                                                <a
                                                  href={
                                                    `tel:${contact.phone}`
                                                  }
                                                >
                                                  {
                                                    contact.phone
                                                  }
                                                </a>
                                              </article>
                                            ),
                                          )
                                      }
                                    </div>
                                  )
                              }
                            </section>


                            {/* ------------------------------------------
                                ALERTES RÉCENTES
                                ------------------------------------------ */}

                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-block-heading"
                              >
                                <AlertTriangle
                                  aria-hidden="true"
                                />

                                <div>
                                  <strong>
                                    Alertes récentes
                                  </strong>

                                  <small>
                                    Derniers événements opérationnels.
                                  </small>
                                </div>
                              </div>


                              <CustomerAlertList
                                alerts={
                                  selectedCustomer.recentAlerts
                                }
                              />
                            </section>
                          </div>
                        )
                    }


                    {/* ==================================================
                        HISTORIQUE ALERTES
                        ================================================== */}

                    {
                      activeTab ===
                        'ALERTS'
                        &&
                        (
                          <div
                            className="company-customer-tab-content"
                          >
                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-block-heading"
                              >
                                <Siren
                                  aria-hidden="true"
                                />

                                <div>
                                  <strong>
                                    Historique complet des alertes
                                  </strong>

                                  <small>
                                    Toutes les alertes connues pour ce client.
                                  </small>
                                </div>
                              </div>

                              <CustomerAlertList
                                alerts={
                                  selectedCustomer.alertHistory
                                }
                              />
                            </section>
                          </div>
                        )
                    }


                    {/* ==================================================
                        ACTIVITÉ
                        ================================================== */}

                    {
                      activeTab ===
                        'ACTIVITY'
                        &&
                        (
                          <div
                            className="company-customer-tab-content"
                          >
                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-block-heading"
                              >
                                <Activity
                                  aria-hidden="true"
                                />

                                <div>
                                  <strong>
                                    Historique d&apos;activité
                                  </strong>

                                  <small>
                                    Actions du client, de l&apos;entreprise,
                                    du système et du support.
                                  </small>
                                </div>
                              </div>


                              {
                                selectedCustomer.activityHistory.length ===
                                  0
                                  ? (
                                    <div
                                      className="company-customer-block-empty"
                                    >
                                      Aucun historique disponible.
                                    </div>
                                  )
                                  : (
                                    <div
                                      className="company-activity-timeline"
                                    >
                                      {
                                        selectedCustomer.activityHistory.map(
                                          (
                                            activity,
                                          ) => (
                                            <article
                                              key={
                                                activity.id
                                              }
                                            >
                                              <span
                                                className="company-activity-dot"
                                              />

                                              <div>
                                                <div>
                                                  <strong>
                                                    {
                                                      activity.title
                                                    }
                                                  </strong>

                                                  <span>
                                                    {
                                                      activityCategoryLabel(
                                                        activity.category,
                                                      )
                                                    }
                                                  </span>
                                                </div>

                                                <p>
                                                  {
                                                    activity.description
                                                  }
                                                </p>

                                                <small>
                                                  {
                                                    activity.actor
                                                  }
                                                  {' · '}
                                                  {
                                                    formatDate(
                                                      activity.createdAt,
                                                    )
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
                          </div>
                        )
                    }


                    {/* ==================================================
                        STATISTIQUES
                        ================================================== */}

                    {
                      activeTab ===
                        'STATISTICS'
                        &&
                        (
                          <div
                            className="company-customer-tab-content"
                          >
                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-statistics-header"
                              >
                                <div
                                  className="company-customer-block-heading"
                                >
                                  <BarChart3
                                    aria-hidden="true"
                                  />

                                  <div>
                                    <strong>
                                      Statistiques avancées
                                    </strong>

                                    <small>
                                      Mesures calculées à partir de la base.
                                    </small>
                                  </div>
                                </div>


                                <select
                                  aria-label="Période des statistiques"
                                  value={
                                    statisticsPeriod
                                  }
                                  onChange={
                                    (
                                      event,
                                    ) => {

                                      const value =
                                        STATISTICS_PERIOD_OPTIONS.find(
                                          (
                                            period,
                                          ) =>
                                            period ===
                                              event.target.value,
                                        )


                                      if (
                                        value
                                      ) {

                                        void handlePeriodChange(
                                          value,
                                        )
                                      }
                                    }
                                  }
                                >
                                  {
                                    STATISTICS_PERIOD_OPTIONS.map(
                                      (
                                        period,
                                      ) => (
                                        <option
                                          key={
                                            period
                                          }
                                          value={
                                            period
                                          }
                                        >
                                          {
                                            periodLabel(
                                              period,
                                            )
                                          }
                                        </option>
                                      ),
                                    )
                                  }
                                </select>
                              </div>


                              <div
                                className="company-statistics-grid"
                              >
                                <StatisticCard
                                  label="Détections"
                                  value={
                                    selectedCustomer.statistics.totalDetections
                                  }
                                />

                                <StatisticCard
                                  label="Alertes"
                                  value={
                                    selectedCustomer.statistics.totalAlerts
                                  }
                                />

                                <StatisticCard
                                  label="Alertes confirmées"
                                  value={
                                    selectedCustomer.statistics.confirmedAlerts
                                  }
                                />

                                <StatisticCard
                                  label="Fausses alertes"
                                  value={
                                    selectedCustomer.statistics.falseAlarms
                                  }
                                />

                                <StatisticCard
                                  label="Appels client"
                                  value={
                                    selectedCustomer.statistics.clientCalls
                                  }
                                />

                                <StatisticCard
                                  label="Interventions"
                                  value={
                                    selectedCustomer.statistics.fieldInterventions
                                  }
                                />

                                <StatisticCard
                                  label="Escalades"
                                  value={
                                    selectedCustomer.statistics.emergencyEscalations
                                  }
                                />

                                <StatisticCard
                                  label="Tickets support"
                                  value={
                                    selectedCustomer.statistics.supportTickets
                                  }
                                />
                              </div>


                              <div
                                className="company-statistics-times"
                              >
                                <article>
                                  <Clock3
                                    aria-hidden="true"
                                  />

                                  <span>
                                    Prise en charge moyenne
                                  </span>

                                  <strong>
                                    {
                                      formatSeconds(
                                        selectedCustomer.statistics
                                          .averageTakeoverTimeSeconds,
                                      )
                                    }
                                  </strong>
                                </article>

                                <article>
                                  <Clock3
                                    aria-hidden="true"
                                  />

                                  <span>
                                    Résolution moyenne
                                  </span>

                                  <strong>
                                    {
                                      formatSeconds(
                                        selectedCustomer.statistics
                                          .averageResolutionTimeSeconds,
                                      )
                                    }
                                  </strong>
                                </article>

                                <article>
                                  {
                                    selectedCustomer.statistics
                                      .systemAvailabilityPercent
                                    === null
                                      ? (
                                        <WifiOff
                                          aria-hidden="true"
                                        />
                                      )
                                      : (
                                        <Wifi
                                          aria-hidden="true"
                                        />
                                      )
                                  }

                                  <span>
                                    Disponibilité système
                                  </span>

                                  <strong>
                                    {
                                      selectedCustomer.statistics
                                        .systemAvailabilityPercent
                                      === null
                                        ? 'Non calculable'
                                        : (
                                          `${selectedCustomer.statistics
                                            .systemAvailabilityPercent.toFixed(1)} %`
                                        )
                                    }
                                  </strong>
                                </article>
                              </div>


                              <div
                                className="company-daily-chart"
                              >
                                <div
                                  className="company-daily-chart-heading"
                                >
                                  <strong>
                                    Alertes par jour
                                  </strong>

                                  <small>
                                    {
                                      periodLabel(
                                        statisticsPeriod,
                                      )
                                    }
                                  </small>
                                </div>


                                {
                                  selectedCustomer.statistics.dailyActivity.length ===
                                    0
                                    ? (
                                      <div
                                        className="company-customer-block-empty"
                                      >
                                        Aucune donnée sur cette période.
                                      </div>
                                    )
                                    : (
                                      <div
                                        className="company-daily-bars"
                                      >
                                        {
                                          selectedCustomer.statistics.dailyActivity.map(
                                            (
                                              point,
                                            ) => {

                                              const percent =
                                                (
                                                  point.alerts
                                                  /
                                                  maxDailyAlerts
                                                )
                                                *
                                                100


                                              return (
                                                <div
                                                  className="company-daily-bar-column"
                                                  key={
                                                    point.date
                                                  }
                                                  title={
                                                    (
                                                      `${point.date} : `
                                                      + `${point.alerts} alertes`
                                                    )
                                                  }
                                                >
                                                  <span
                                                    className="company-daily-bar-value"
                                                  >
                                                    {
                                                      point.alerts
                                                    }
                                                  </span>

                                                  <div
                                                    className="company-daily-bar-track"
                                                  >
                                                    <span
                                                      style={
                                                        {
                                                          height:
                                                            `${Math.max(
                                                              percent,
                                                              point.alerts > 0
                                                                ? 5
                                                                : 0,
                                                            )}%`,
                                                        }
                                                      }
                                                    />
                                                  </div>

                                                  <small>
                                                    {
                                                      point.date.slice(
                                                        5,
                                                      )
                                                    }
                                                  </small>
                                                </div>
                                              )
                                            },
                                          )
                                        }
                                      </div>
                                    )
                                }
                              </div>
                            </section>
                          </div>
                        )
                    }


                    {/* ==================================================
                        SUPPORT
                        ================================================== */}

                    {
                      activeTab ===
                        'SUPPORT'
                        &&
                        (
                          <div
                            className="company-customer-tab-content"
                          >
                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-block-heading"
                              >
                                <Headphones
                                  aria-hidden="true"
                                />

                                <div>
                                  <strong>
                                    Tickets support
                                  </strong>

                                  <small>
                                    Demandes rattachées à ce client.
                                  </small>
                                </div>
                              </div>


                              {
                                selectedCustomer.supportTickets.length ===
                                  0
                                  ? (
                                    <div
                                      className="company-customer-block-empty"
                                    >
                                      Aucun ticket support.
                                    </div>
                                  )
                                  : (
                                    <div
                                      className="company-customer-support-list"
                                    >
                                      {
                                        selectedCustomer.supportTickets.map(
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
                                                    alertPriorityLabel(
                                                      ticket.priority,
                                                    )
                                                  }
                                                </span>

                                                <small>
                                                  {
                                                    formatDate(
                                                      ticket.createdAt,
                                                    )
                                                  }
                                                </small>
                                              </div>

                                              <span>
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
                        )
                    }


                    {/* ==================================================
                        COMMENTAIRES
                        ================================================== */}

                    {
                      activeTab ===
                        'COMMENTS'
                        &&
                        (
                          <div
                            className="company-customer-tab-content"
                          >
                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-block-heading"
                              >
                                <MessageSquareText
                                  aria-hidden="true"
                                />

                                <div>
                                  <strong>
                                    Commentaires internes
                                  </strong>

                                  <small>
                                    Notes humaines distinctes des logs.
                                  </small>
                                </div>
                              </div>


                              <div
                                className="company-customer-comments"
                              >
                                {
                                  selectedCustomer.comments.length ===
                                    0
                                    ? (
                                      <div
                                        className="company-customer-block-empty"
                                      >
                                        Aucun commentaire.
                                      </div>
                                    )
                                    : (
                                      selectedCustomer.comments.map(
                                        (
                                          comment,
                                        ) => (
                                          <article
                                            key={
                                              comment.id
                                            }
                                          >
                                            <div>
                                              <strong>
                                                {
                                                  comment.authorName
                                                }
                                              </strong>

                                              <small>
                                                {
                                                  formatDate(
                                                    comment.createdAt,
                                                  )
                                                }
                                              </small>
                                            </div>

                                            <p>
                                              {
                                                comment.message
                                              }
                                            </p>
                                          </article>
                                        ),
                                      )
                                    )
                                }


                                <div
                                  className="company-customer-add-comment"
                                >
                                  <textarea
                                    placeholder="Ajouter une note interne sur ce client..."
                                    value={
                                      newComment
                                    }
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
                                    Ajouter le commentaire
                                  </button>
                                </div>
                              </div>
                            </section>
                          </div>
                        )
                    }


                    {/* ==================================================
                        AUDIT
                        ================================================== */}

                    {
                      activeTab ===
                        'AUDIT'
                        &&
                        (
                          <div
                            className="company-customer-tab-content"
                          >
                            <section
                              className="company-customer-block"
                            >
                              <div
                                className="company-customer-block-heading"
                              >
                                <FileText
                                  aria-hidden="true"
                                />

                                <div>
                                  <strong>
                                    Logs d&apos;audit
                                  </strong>

                                  <small>
                                    Qui a fait quoi, quand et sur quelle ressource.
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
                                      className="company-customer-block-empty"
                                    >
                                      Chargement des logs...
                                    </div>
                                  )
                                  : auditLogs.length ===
                                      0
                                    ? (
                                      <div
                                        className="company-customer-block-empty"
                                      >
                                        Aucun log pour ce client.
                                      </div>
                                    )
                                    : (
                                      <AuditLogTable
                                        logs={
                                          auditLogs
                                        }
                                      />
                                    )
                              }
                            </section>
                          </div>
                        )
                    }
                  </>
                )
          }
        </section>
      </div>


      {
        createCustomerOpen
        &&
        (
          <CreateCustomerInstallationModal
            controllers={
              controllers
            }
            loading={
              loading.customerCreation
              ||
              loading.controllers
            }
            onClose={
              () =>
                setCreateCustomerOpen(
                  false,
                )
            }
            onRefreshControllers={
              refreshControllers
            }
            onSubmit={
              async (
                input,
              ) => {

                const result =
                  await createCustomerInstallation(
                    input,
                  )


                if (
                  result
                ) {

                  setCreateCustomerOpen(
                    false,
                  )
                }
              }
            }
          />
        )
      }
    </main>
  )
}


// =========================================================================
// MODALE : NOUVEAU CLIENT + SITE + RASPBERRY
// =========================================================================
//
// L'admin travaille sur PC : la modale est volontairement large.
//
// Elle suit les trois objets réels du système :
//
// 1. Customer
// 2. MonitoredSite
// 3. Raspberry / Controller
//
// Aucun matériel n'est inventé dans React.
// =========================================================================

type CreateCustomerInstallationModalProps = {
  controllers:
    CompanyController[]

  loading:
    boolean

  onClose:
    () => void

  onRefreshControllers:
    () => Promise<void>

  onSubmit:
    (
      input:
        CreateCustomerInstallationInput,
    ) => Promise<void>
}


function CreateCustomerInstallationModal(
  {
    controllers,
    loading,
    onClose,
    onRefreshControllers,
    onSubmit,
  }:
    CreateCustomerInstallationModalProps,
) {

  const [
    step,
    setStep,
  ] =
    useState(
      1,
    )


  const [
    customer,
    setCustomer,
  ] =
    useState<
      CreateCustomerInstallationInput['customer']
    >(
      {
        firstName:
          '',

        lastName:
          '',

        email:
          '',

        phone:
          '',

        notes:
          '',
      },
    )


  const [
    site,
    setSite,
  ] =
    useState<
      CreateCustomerInstallationInput['site']
    >(
      {
        name:
          'Domicile principal',

        address:
          '',

        city:
          '',

        postalCode:
          '',

        country:
          'France',
      },
    )


  const [
    selectedControllerIps,
    setSelectedControllerIps,
  ] =
    useState<
      string[]
    >(
      [],
    )


  // Les Raspberry déjà affectés restent visibles pour information,
  // mais ils ne sont pas sélectionnables dans une nouvelle installation.
  const availableControllers =
    controllers.filter(
      (
        controller,
      ) =>
        !controller.assigned,
    )


  const canContinueStep1 =
    (
      customer.firstName.trim() !==
        ''
      &&
      customer.lastName.trim() !==
        ''
      &&
      customer.email.trim() !==
        ''
      &&
      customer.phone.trim() !==
        ''
    )


  const canContinueStep2 =
    (
      site.name.trim() !==
        ''
      &&
      site.address.trim() !==
        ''
      &&
      site.city.trim() !==
        ''
      &&
      site.postalCode.trim() !==
        ''
      &&
      site.country.trim() !==
        ''
    )


  function toggleController(
    ip:
      string,
  ) {

    setSelectedControllerIps(
      (
        previous,
      ) =>
        previous.includes(
          ip,
        )
          ? previous.filter(
              (
                value,
              ) =>
                value !==
                  ip,
            )
          : [
              ...previous,
              ip,
            ],
    )
  }


  return (
    <div
      className="company-create-modal-backdrop"
      role="presentation"
    >
      <section
        className="company-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-customer-title"
      >
        <header
          className="company-create-modal-header"
        >
          <div>
            <p
              className="dashboard-eyebrow"
            >
              Administration
            </p>

            <h2
              id="create-customer-title"
            >
              Nouveau client
            </h2>

            <p>
              Créez le dossier, son site surveillé puis rattachez
              les Raspberry déjà découverts par le serveur.
            </p>
          </div>

          <button
            type="button"
            aria-label="Fermer"
            disabled={
              loading
            }
            onClick={
              onClose
            }
          >
            <X
              aria-hidden="true"
            />
          </button>
        </header>


        <div
          className="company-create-steps"
        >
          {
            [
              {
                number:
                  1,

                label:
                  'Client',
              },
              {
                number:
                  2,

                label:
                  'Site surveillé',
              },
              {
                number:
                  3,

                label:
                  'Installation',
              },
            ].map(
              (
                item,
              ) => (
                <div
                  className={
                    (
                      'company-create-step '
                      +
                      (
                        step ===
                          item.number
                          ? 'is-current'
                          : step >
                              item.number
                            ? 'is-complete'
                            : ''
                      )
                    )
                  }
                  key={
                    item.number
                  }
                >
                  <span>
                    {
                      step >
                        item.number
                        ? (
                          <CheckCircle2
                            aria-hidden="true"
                          />
                        )
                        : item.number
                    }
                  </span>

                  <strong>
                    {
                      item.label
                    }
                  </strong>
                </div>
              ),
            )
          }
        </div>


        <div
          className="company-create-modal-body"
        >
          {
            step ===
              1
              &&
              (
                <>
                  <div
                    className="company-create-section-heading"
                  >
                    <UserRound
                      aria-hidden="true"
                    />

                    <div>
                      <strong>
                        Identité du client
                      </strong>

                      <span>
                        Ces informations constituent le dossier principal.
                      </span>
                    </div>
                  </div>


                  <div
                    className="company-create-form-grid"
                  >
                    <label>
                      Prénom

                      <input
                        type="text"
                        value={
                          customer.firstName
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setCustomer(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                firstName:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <label>
                      Nom

                      <input
                        type="text"
                        value={
                          customer.lastName
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setCustomer(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                lastName:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <label>
                      Email

                      <input
                        type="email"
                        value={
                          customer.email
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setCustomer(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                email:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <label>
                      Téléphone

                      <input
                        type="tel"
                        value={
                          customer.phone
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setCustomer(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                phone:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <label
                      className="is-full"
                    >
                      Notes internes

                      <textarea
                        value={
                          customer.notes
                          ??
                          ''
                        }
                        placeholder="Informations utiles au centre de supervision..."
                        onChange={
                          (
                            event,
                          ) =>
                            setCustomer(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                notes:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>
                  </div>
                </>
              )
          }


          {
            step ===
              2
              &&
              (
                <>
                  <div
                    className="company-create-section-heading"
                  >
                    <Home
                      aria-hidden="true"
                    />

                    <div>
                      <strong>
                        Site surveillé
                      </strong>

                      <span>
                        Un client pourra posséder plusieurs sites plus tard.
                      </span>
                    </div>
                  </div>


                  <div
                    className="company-create-form-grid"
                  >
                    <label
                      className="is-full"
                    >
                      Nom du site

                      <input
                        type="text"
                        value={
                          site.name
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setSite(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                name:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <label
                      className="is-full"
                    >
                      Adresse

                      <input
                        type="text"
                        value={
                          site.address
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setSite(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                address:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <label>
                      Code postal

                      <input
                        type="text"
                        value={
                          site.postalCode
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setSite(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                postalCode:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <label>
                      Ville

                      <input
                        type="text"
                        value={
                          site.city
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setSite(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                city:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>

                    <label
                      className="is-full"
                    >
                      Pays

                      <input
                        type="text"
                        value={
                          site.country
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setSite(
                              (
                                previous,
                              ) => ({
                                ...previous,

                                country:
                                  event.target.value,
                              }),
                            )
                        }
                      />
                    </label>
                  </div>
                </>
              )
          }


          {
            step ===
              3
              &&
              (
                <>
                  <div
                    className="company-create-section-heading"
                  >
                    <Cpu
                      aria-hidden="true"
                    />

                    <div>
                      <strong>
                        Raspberry disponibles
                      </strong>

                      <span>
                        La liste provient des heartbeats reçus par FastAPI.
                        Aucune IP n&apos;est écrite en dur dans le site.
                      </span>
                    </div>
                  </div>


                  <div
                    className="company-create-controller-toolbar"
                  >
                    <div>
                      <strong>
                        {
                          availableControllers.length
                        }
                        {' '}
                        disponible(s)
                      </strong>

                      <span>
                        {
                          selectedControllerIps.length
                        }
                        {' '}
                        sélectionné(s)
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={
                        loading
                      }
                      onClick={
                        () =>
                          void onRefreshControllers()
                      }
                    >
                      <RefreshCw
                        aria-hidden="true"
                      />

                      Actualiser les Raspberry
                    </button>
                  </div>


                  {
                    availableControllers.length ===
                      0
                      ? (
                        <div
                          className="company-create-no-controller"
                        >
                          <Radio
                            aria-hidden="true"
                          />

                          <div>
                            <strong>
                              Aucun Raspberry disponible
                            </strong>

                            <p>
                              Le client et son site peuvent quand même être
                              créés. Les Raspberry pourront être rattachés
                              après leur premier heartbeat sur le réseau
                              de l&apos;école.
                            </p>
                          </div>
                        </div>
                      )
                      : (
                        <div
                          className="company-create-controller-list"
                        >
                          {
                            availableControllers.map(
                              (
                                controller,
                              ) => {

                                const selected =
                                  selectedControllerIps.includes(
                                    controller.ip,
                                  )


                                return (
                                  <button
                                    type="button"
                                    className={
                                      (
                                        'company-create-controller-option '
                                        +
                                        (
                                          selected
                                            ? 'is-selected'
                                            : ''
                                        )
                                      )
                                    }
                                    key={
                                      controller.ip
                                    }
                                    onClick={
                                      () =>
                                        toggleController(
                                          controller.ip,
                                        )
                                    }
                                  >
                                    <span
                                      className="company-create-controller-check"
                                    >
                                      {
                                        selected
                                          ? (
                                            <CheckCircle2
                                              aria-hidden="true"
                                            />
                                          )
                                          : null
                                      }
                                    </span>

                                    <span
                                      className="company-create-controller-main"
                                    >
                                      <span>
                                        <strong>
                                          {
                                            controllerTypeLabel(
                                              controller,
                                            )
                                          }
                                        </strong>

                                        <span
                                          className={
                                            (
                                              'company-controller-status '
                                              +
                                              `is-${controller.status.toLowerCase()}`
                                            )
                                          }
                                        >
                                          {
                                            controller.status ===
                                              'ONLINE'
                                              ? 'En ligne'
                                              : 'Hors ligne'
                                          }
                                        </span>
                                      </span>

                                      <small>
                                        {
                                          controller.ip
                                        }
                                        {' · '}
                                        {
                                          controller.components
                                            .map(
                                              (
                                                component,
                                              ) =>
                                                componentLabel(
                                                  component.name,
                                                ),
                                            )
                                            .join(
                                              ' · ',
                                            )
                                          ||
                                          'Aucun composant déclaré'
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
                </>
              )
          }
        </div>


        <footer
          className="company-create-modal-footer"
        >
          <button
            type="button"
            className="is-secondary"
            disabled={
              loading
              ||
              step ===
                1
            }
            onClick={
              () =>
                setStep(
                  (
                    previous,
                  ) =>
                    Math.max(
                      1,
                      previous - 1,
                    ),
                )
            }
          >
            <ChevronLeft
              aria-hidden="true"
            />

            Précédent
          </button>


          <div>
            <button
              type="button"
              className="is-secondary"
              disabled={
                loading
              }
              onClick={
                onClose
              }
            >
              Annuler
            </button>


            {
              step <
                3
                ? (
                  <button
                    type="button"
                    className="is-primary"
                    disabled={
                      loading
                      ||
                      (
                        step ===
                          1
                          ? !canContinueStep1
                          : !canContinueStep2
                      )
                    }
                    onClick={
                      () =>
                        setStep(
                          (
                            previous,
                          ) =>
                            Math.min(
                              3,
                              previous + 1,
                            ),
                        )
                    }
                  >
                    Suivant

                    <ChevronRight
                      aria-hidden="true"
                    />
                  </button>
                )
                : (
                  <button
                    type="button"
                    className="is-primary"
                    disabled={
                      loading
                    }
                    onClick={
                      () =>
                        void onSubmit(
                          {
                            customer:
                              {
                                ...customer,

                                firstName:
                                  customer.firstName.trim(),

                                lastName:
                                  customer.lastName.trim(),

                                email:
                                  customer.email.trim(),

                                phone:
                                  customer.phone.trim(),

                                notes:
                                  customer.notes
                                    ?.trim()
                                    ||
                                    undefined,
                              },

                            site:
                              {
                                ...site,

                                name:
                                  site.name.trim(),

                                address:
                                  site.address.trim(),

                                city:
                                  site.city.trim(),

                                postalCode:
                                  site.postalCode.trim(),

                                country:
                                  site.country.trim(),
                              },

                            controllerIps:
                              selectedControllerIps,
                          },
                        )
                    }
                  >
                    {
                      loading
                        ? 'Création...'
                        : (
                          selectedControllerIps.length > 0
                            ? 'Créer et rattacher'
                            : 'Créer sans matériel'
                        )
                    }
                  </button>
                )
            }
          </div>
        </footer>
      </section>
    </div>
  )
}


// =========================================================================
// LISTE D'ALERTES CLIENT
// =========================================================================

function CustomerAlertList(
  {
    alerts,
  }:
  {
    alerts:
      CompanyAlert[]
  },
) {

  if (
    alerts.length ===
      0
  ) {

    return (
      <div
        className="company-customer-block-empty"
      >
        Aucune alerte.
      </div>
    )
  }


  return (
    <div
      className="company-client-alert-list"
    >
      {
        alerts.map(
          (
            alert,
          ) => (
            <article
              key={
                alert.id
              }
            >
              <span
                className={
                  (
                    'company-client-alert-priority '
                    +
                    `is-${alert.priority.toLowerCase()}`
                  )
                }
              />

              <div>
                <div>
                  <strong>
                    {
                      alert.title
                    }
                  </strong>

                  <span>
                    {
                      alertPriorityLabel(
                        alert.priority,
                      )
                    }
                  </span>
                </div>

                <p>
                  {
                    alert.description
                  }
                </p>

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
            </article>
          ),
        )
      }
    </div>
  )
}


// =========================================================================
// CARTE STATISTIQUE
// =========================================================================

function StatisticCard(
  {
    label,
    value,
  }:
  {
    label:
      string

    value:
      number
  },
) {

  return (
    <article>
      <span>
        {
          label
        }
      </span>

      <strong>
        {
          value
        }
      </strong>
    </article>
  )
}


// =========================================================================
// TABLE AUDIT
// =========================================================================

function AuditLogTable(
  {
    logs,
  }:
  {
    logs:
      AuditLog[]
  },
) {

  return (
    <div
      className="company-audit-table-wrapper"
    >
      <table
        className="company-audit-table"
      >
        <thead>
          <tr>
            <th>
              Date
            </th>

            <th>
              Acteur
            </th>

            <th>
              Action
            </th>

            <th>
              Ressource
            </th>

            <th>
              Description
            </th>
          </tr>
        </thead>

        <tbody>
          {
            logs.map(
              (
                log,
              ) => (
                <tr
                  key={
                    log.id
                  }
                >
                  <td>
                    {
                      formatDate(
                        log.createdAt,
                      )
                    }
                  </td>

                  <td>
                    {
                      log.actorName
                    }
                  </td>

                  <td>
                    {
                      log.action
                    }
                  </td>

                  <td>
                    {
                      log.resourceType
                    }
                    {' / '}
                    {
                      log.resourceId
                    }
                  </td>

                  <td>
                    {
                      log.description
                    }
                  </td>
                </tr>
              ),
            )
          }
        </tbody>
      </table>
    </div>
  )
}


// =========================================================================
// PAGE EXPORTÉE
// =========================================================================

function CompanyCustomersPage() {

  return (
    <CompanyCustomersContent />
  )
}


export default CompanyCustomersPage
