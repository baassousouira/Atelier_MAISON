// CompanySupportPage.tsx

// -----------------------------------------------------------------------
// SUPPORT ENTREPRISE - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Cette page permet au centre de supervision de gérer les tickets support.
//
// Elle permet de :
//
// - consulter tous les tickets ;
// - rechercher / filtrer les tickets ;
// - ouvrir un ticket ;
// - consulter le client concerné ;
// - consulter l'historique des messages ;
// - envoyer un message au client ;
// - ajouter une note interne ;
// - modifier le statut du ticket ;
// - consulter les commentaires internes associés.
//
// IMPORTANT :
//
// L'authentification réelle n'est toujours PAS développée.
// CompanyProvider utilise encore TEMPORARY_OPERATOR.
//
// -----------------------------------------------------------------------

import {
  ArrowLeft,
  CircleAlert,
  Headphones,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
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
  Priority,
  SupportTicket,
  SupportTicketStatus,
} from '../types/company'

import '../styles/dashboard.css'
import '../styles/company-dashboard.css'
import '../styles/company-support.css'


// =========================================================================
// OPTIONS
// =========================================================================

const SUPPORT_STATUS_OPTIONS:
  SupportTicketStatus[] = [
    'NEW',
    'IN_PROGRESS',
    'WAITING_CUSTOMER',
    'RESOLVED',
    'CLOSED',
  ]


const PRIORITY_OPTIONS:
  Priority[] = [
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL',
  ]


// =========================================================================
// LABELS
// =========================================================================

function supportStatusLabel(
  status:
    SupportTicketStatus,
): string {

  const labels:
    Record<
      SupportTicketStatus,
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


function categoryLabel(
  category:
    SupportTicket['category'],
): string {

  const labels:
    Record<
      SupportTicket['category'],
      string
    > = {

      CAMERA:
        'Caméra',

      ROBOT:
        'Robot',

      SENSOR:
        'Capteur',

      NETWORK:
        'Réseau',

      ACCOUNT:
        'Compte',

      ALERT:
        'Alerte',

      OTHER:
        'Autre',
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
        'short',
    },
  ).format(
    date,
  )
}


// =========================================================================
// COMPOSANT INTERNE
// =========================================================================

function CompanySupportContent() {

  const navigate =
    useNavigate()


  const {
    currentOperator,

    supportTickets,
    selectedSupportTicket,

    refreshSupportTickets,
    openSupportTicket,
    clearSelectedSupportTicket,

    sendSupportMessage,
    changeSupportStatus,
    addSupportComment,

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
      SupportTicketStatus | ''
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
  // RÉPONSE CLIENT
  // =====================================================================

  const [
    clientMessage,
    setClientMessage,
  ] =
    useState(
      '',
    )


  // =====================================================================
  // NOTE INTERNE
  // =====================================================================

  const [
    internalNote,
    setInternalNote,
  ] =
    useState(
      '',
    )


  // =====================================================================
  // COMMENTAIRE INTERNE
  // =====================================================================

  const [
    internalComment,
    setInternalComment,
  ] =
    useState(
      '',
    )


  // =====================================================================
  // CHARGEMENT
  // =====================================================================

  const loadTickets =
    useCallback(
      async (): Promise<void> => {

        await refreshSupportTickets(
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
        refreshSupportTickets,
        search,
        statusFilter,
      ],
    )


  useEffect(
    () => {

      void refreshSupportTickets()
    },
    [
      refreshSupportTickets,
    ],
  )


  // =====================================================================
  // RÉINITIALISER LES ZONES DE SAISIE AU CHANGEMENT DE TICKET
  // =====================================================================

  useEffect(
    () => {

      setClientMessage(
        '',
      )

      setInternalNote(
        '',
      )

      setInternalComment(
        '',
      )
    },
    [
      selectedSupportTicket
        ?.ticket.id,
    ],
  )


  // =====================================================================
  // TRI DES TICKETS
  // =====================================================================

  const sortedTickets =
    useMemo(
      () =>
        [
          ...supportTickets,
        ].sort(
          (
            a,
            b,
          ) =>
            new Date(
              b.updatedAt,
            ).getTime()
            -
            new Date(
              a.updatedAt,
            ).getTime(),
        ),
      [
        supportTickets,
      ],
    )


  // =====================================================================
  // OUVRIR UN TICKET
  // =====================================================================

  async function handleOpenTicket(
    ticket:
      SupportTicket,
  ) {

    await openSupportTicket(
      ticket.id,
    )
  }


  // =====================================================================
  // MESSAGE CLIENT
  // =====================================================================

  async function handleSendClientMessage() {

    if (
      !selectedSupportTicket
      ||
      clientMessage.trim() ===
        ''
    ) {

      return
    }


    await sendSupportMessage(
      selectedSupportTicket.ticket.id,
      clientMessage.trim(),
      false,
    )


    setClientMessage(
      '',
    )
  }


  // =====================================================================
  // NOTE INTERNE
  // =====================================================================

  async function handleSendInternalNote() {

    if (
      !selectedSupportTicket
      ||
      internalNote.trim() ===
        ''
    ) {

      return
    }


    await sendSupportMessage(
      selectedSupportTicket.ticket.id,
      internalNote.trim(),
      true,
    )


    setInternalNote(
      '',
    )
  }


  // =====================================================================
  // COMMENTAIRE INTERNE
  // =====================================================================

  async function handleAddComment() {

    if (
      !selectedSupportTicket
      ||
      internalComment.trim() ===
        ''
    ) {

      return
    }


    await addSupportComment(
      selectedSupportTicket.ticket.id,
      internalComment.trim(),
    )


    setInternalComment(
      '',
    )
  }


  // =====================================================================
  // STATUT
  // =====================================================================

  async function handleChangeStatus(
    status:
      SupportTicketStatus,
  ) {

    if (
      !selectedSupportTicket
    ) {

      return
    }


    await changeSupportStatus(
      selectedSupportTicket.ticket.id,
      status,
    )
  }


  // =====================================================================
  // RENDU
  // =====================================================================

  return (
    <main
      className="company-support-page"
    >

      {/* ================================================================
          TOPBAR
          ================================================================ */}

      <header
        className="company-support-topbar"
      >
        <button
          type="button"
          className="company-support-back"
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
          className="company-support-topbar-title"
        >
          <Headphones
            aria-hidden="true"
          />

          <span>
            <strong>
              Support
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
          className="company-support-refresh"
          disabled={
            loading.support
          }
          onClick={
            () =>
              void loadTickets()
          }
        >
          <RefreshCw
            aria-hidden="true"
            className={
              loading.support
                ? 'is-spinning'
                : undefined
            }
          />

          Actualiser
        </button>
      </header>


      <div
        className="company-support-shell"
      >

        {/* ==============================================================
            LISTE TICKETS
            ============================================================== */}

        <section
          className="company-support-list-panel"
        >
          <div
            className="company-support-heading"
          >
            <div>
              <p
                className="dashboard-eyebrow"
              >
                Assistance client
              </p>

              <h1>
                Tickets support
              </h1>

              <p>
                Suivez les demandes techniques et opérationnelles.
              </p>
            </div>

            <span>
              {
                supportTickets.length
              }
            </span>
          </div>


          {/* ------------------------------------------------------------
              FILTRES
              ------------------------------------------------------------ */}

          <div
            className="company-support-filters"
          >
            <label
              className="company-support-search"
            >
              <Search
                aria-hidden="true"
              />

              <input
                type="search"
                placeholder="Sujet, client..."
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

                      void loadTickets()
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
                    SUPPORT_STATUS_OPTIONS.find(
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
                SUPPORT_STATUS_OPTIONS.map(
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
                        supportStatusLabel(
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
                  void loadTickets()
              }
            >
              Filtrer
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
                    'company-support-feedback '
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
                className="company-support-feedback is-error"
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
              CARTES TICKET
              ------------------------------------------------------------ */}

          <div
            className="company-support-ticket-list"
          >
            {
              loading.support
              &&
              supportTickets.length ===
                0
                ? (
                  <div
                    className="company-support-empty"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className="is-spinning"
                    />

                    Chargement...
                  </div>
                )
                : sortedTickets.length ===
                    0
                  ? (
                    <div
                      className="company-support-empty"
                    >
                      <Headphones
                        aria-hidden="true"
                      />

                      <strong>
                        Aucun ticket
                      </strong>

                      <span>
                        Aucun ticket ne correspond aux filtres actuels.
                      </span>
                    </div>
                  )
                  : (
                    sortedTickets.map(
                      (
                        ticket,
                      ) => {

                        const selected =
                          selectedSupportTicket
                            ?.ticket.id ===
                          ticket.id


                        return (
                          <button
                            type="button"
                            className={
                              (
                                'company-support-ticket-card '
                                +
                                (
                                  selected
                                    ? 'is-selected'
                                    : ''
                                )
                              )
                            }
                            key={
                              ticket.id
                            }
                            onClick={
                              () =>
                                void handleOpenTicket(
                                  ticket,
                                )
                            }
                          >
                            <span
                              className={
                                (
                                  'company-support-priority-bar '
                                  +
                                  `is-${ticket.priority.toLowerCase()}`
                                )
                              }
                            />

                            <span
                              className="company-support-ticket-body"
                            >
                              <span
                                className="company-support-ticket-top"
                              >
                                <strong>
                                  {
                                    ticket.subject
                                  }
                                </strong>

                                <small>
                                  {
                                    formatDate(
                                      ticket.updatedAt,
                                    )
                                  }
                                </small>
                              </span>

                              <span
                                className="company-support-ticket-description"
                              >
                                {
                                  ticket.description
                                }
                              </span>

                              <span
                                className="company-support-ticket-meta"
                              >
                                <span>
                                  {
                                    categoryLabel(
                                      ticket.category,
                                    )
                                  }
                                </span>

                                <span
                                  className={
                                    (
                                      'company-support-chip '
                                      +
                                      `is-${ticket.priority.toLowerCase()}`
                                    )
                                  }
                                >
                                  {
                                    priorityLabel(
                                      ticket.priority,
                                    )
                                  }
                                </span>

                                <span
                                  className="company-support-chip"
                                >
                                  {
                                    supportStatusLabel(
                                      ticket.status,
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
            DÉTAIL TICKET
            ============================================================== */}

        <section
          className="company-support-detail"
        >
          {
            loading.supportDetail
            &&
            !selectedSupportTicket
              ? (
                <div
                  className="company-support-detail-empty"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className="is-spinning"
                  />

                  Chargement du ticket...
                </div>
              )
              : !selectedSupportTicket
                ? (
                  <div
                    className="company-support-detail-empty"
                  >
                    <MessageSquareText
                      aria-hidden="true"
                    />

                    <strong>
                      Sélectionnez un ticket
                    </strong>

                    <span>
                      Le dossier support complet apparaîtra ici.
                    </span>
                  </div>
                )
                : (
                  <>
                    {/* --------------------------------------------------
                        EN-TÊTE
                        -------------------------------------------------- */}

                    <div
                      className="company-support-detail-header"
                    >
                      <div>
                        <div
                          className="company-support-detail-badges"
                        >
                          <span
                            className={
                              (
                                'company-support-chip '
                                +
                                `is-${selectedSupportTicket.ticket.priority.toLowerCase()}`
                              )
                            }
                          >
                            {
                              priorityLabel(
                                selectedSupportTicket.ticket.priority,
                              )
                            }
                          </span>

                          <span
                            className="company-support-chip"
                          >
                            {
                              supportStatusLabel(
                                selectedSupportTicket.ticket.status,
                              )
                            }
                          </span>

                          <span
                            className="company-support-chip"
                          >
                            {
                              categoryLabel(
                                selectedSupportTicket.ticket.category,
                              )
                            }
                          </span>
                        </div>

                        <h2>
                          {
                            selectedSupportTicket.ticket.subject
                          }
                        </h2>

                        <p>
                          {
                            selectedSupportTicket.ticket.description
                          }
                        </p>

                        <small>
                          Créé le
                          {' '}
                          {
                            formatDate(
                              selectedSupportTicket.ticket.createdAt,
                            )
                          }
                          {' · '}
                          Mis à jour le
                          {' '}
                          {
                            formatDate(
                              selectedSupportTicket.ticket.updatedAt,
                            )
                          }
                        </small>
                      </div>


                      <button
                        type="button"
                        className="company-support-close"
                        aria-label="Fermer le ticket"
                        onClick={
                          clearSelectedSupportTicket
                        }
                      >
                        <X
                          aria-hidden="true"
                        />
                      </button>
                    </div>


                    {/* --------------------------------------------------
                        CLIENT
                        -------------------------------------------------- */}

                    <section
                      className="company-support-section"
                    >
                      <div
                        className="company-support-section-heading"
                      >
                        <UserRound
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            Client
                          </strong>

                          <small>
                            Coordonnées du demandeur.
                          </small>
                        </div>
                      </div>


                      <div
                        className="company-support-customer-card"
                      >
                        <div
                          className="company-support-customer-avatar"
                        >
                          {
                            selectedSupportTicket.customer.firstName
                              .slice(
                                0,
                                1,
                              )
                              .toUpperCase()
                          }
                          {
                            selectedSupportTicket.customer.lastName
                              .slice(
                                0,
                                1,
                              )
                              .toUpperCase()
                          }
                        </div>

                        <div>
                          <strong>
                            {
                              selectedSupportTicket.customer.firstName
                            }
                            {' '}
                            {
                              selectedSupportTicket.customer.lastName
                            }
                          </strong>

                          <a
                            href={
                              `mailto:${selectedSupportTicket.customer.email}`
                            }
                          >
                            <Mail
                              aria-hidden="true"
                            />

                            {
                              selectedSupportTicket.customer.email
                            }
                          </a>

                          <a
                            href={
                              `tel:${selectedSupportTicket.customer.phone}`
                            }
                          >
                            <Phone
                              aria-hidden="true"
                            />

                            {
                              selectedSupportTicket.customer.phone
                            }
                          </a>
                        </div>
                      </div>
                    </section>


                    {/* --------------------------------------------------
                        STATUT
                        -------------------------------------------------- */}

                    <section
                      className="company-support-section"
                    >
                      <div
                        className="company-support-section-heading"
                      >
                        <Wrench
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            Statut du ticket
                          </strong>

                          <small>
                            Le changement est enregistré par le backend.
                          </small>
                        </div>
                      </div>


                      <div
                        className="company-support-status-actions"
                      >
                        {
                          SUPPORT_STATUS_OPTIONS.map(
                            (
                              status,
                            ) => (
                              <button
                                type="button"
                                key={
                                  status
                                }
                                className={
                                  (
                                    selectedSupportTicket.ticket.status ===
                                      status
                                      ? 'is-current'
                                      : ''
                                  )
                                }
                                disabled={
                                  loading.action
                                  ||
                                  selectedSupportTicket.ticket.status ===
                                    status
                                }
                                onClick={
                                  () =>
                                    void handleChangeStatus(
                                      status,
                                    )
                                }
                              >
                                {
                                  supportStatusLabel(
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
                        FIL DE MESSAGES
                        -------------------------------------------------- */}

                    <section
                      className="company-support-section"
                    >
                      <div
                        className="company-support-section-heading"
                      >
                        <MessageSquareText
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            Conversation
                          </strong>

                          <small>
                            Historique des échanges liés au ticket.
                          </small>
                        </div>
                      </div>


                      <div
                        className="company-support-conversation"
                      >
                        {
                          selectedSupportTicket.messages.length ===
                            0
                            ? (
                              <div
                                className="company-support-section-empty"
                              >
                                Aucun message.
                              </div>
                            )
                            : (
                              selectedSupportTicket.messages.map(
                                (
                                  message,
                                ) => (
                                  <article
                                    className={
                                      (
                                        'company-support-message '
                                        +
                                        (
                                          message.internal
                                            ? 'is-internal'
                                            : message.authorType ===
                                                'CUSTOMER'
                                              ? 'is-customer'
                                              : 'is-company'
                                        )
                                      )
                                    }
                                    key={
                                      message.id
                                    }
                                  >
                                    <div
                                      className="company-support-message-heading"
                                    >
                                      <strong>
                                        {
                                          message.authorName
                                        }
                                      </strong>

                                      <span>
                                        {
                                          message.internal
                                            ? 'Note interne'
                                            : message.authorType ===
                                                'CUSTOMER'
                                              ? 'Client'
                                              : 'Entreprise'
                                        }
                                      </span>
                                    </div>

                                    <p>
                                      {
                                        message.message
                                      }
                                    </p>

                                    <small>
                                      {
                                        formatDate(
                                          message.createdAt,
                                        )
                                      }
                                    </small>
                                  </article>
                                ),
                              )
                            )
                        }
                      </div>
                    </section>


                    {/* --------------------------------------------------
                        RÉPONDRE AU CLIENT
                        -------------------------------------------------- */}

                    <section
                      className="company-support-section"
                    >
                      <div
                        className="company-support-section-heading"
                      >
                        <Mail
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            Répondre au client
                          </strong>

                          <small>
                            Message visible dans le fil support.
                          </small>
                        </div>
                      </div>


                      <textarea
                        className="company-support-textarea"
                        placeholder="Écrire une réponse au client..."
                        value={
                          clientMessage
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setClientMessage(
                              event.target.value,
                            )
                        }
                      />


                      <div
                        className="company-support-send-row"
                      >
                        <button
                          type="button"
                          disabled={
                            loading.action
                            ||
                            clientMessage.trim() ===
                              ''
                          }
                          onClick={
                            () =>
                              void handleSendClientMessage()
                          }
                        >
                          Envoyer la réponse
                        </button>
                      </div>
                    </section>


                    {/* --------------------------------------------------
                        NOTE INTERNE
                        -------------------------------------------------- */}

                    <section
                      className="company-support-section"
                    >
                      <div
                        className="company-support-section-heading"
                      >
                        <ShieldCheck
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            Note interne dans le fil
                          </strong>

                          <small>
                            Invisible pour le client.
                          </small>
                        </div>
                      </div>


                      <textarea
                        className="company-support-textarea"
                        placeholder="Ajouter une note interne au fil..."
                        value={
                          internalNote
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setInternalNote(
                              event.target.value,
                            )
                        }
                      />


                      <div
                        className="company-support-send-row"
                      >
                        <button
                          type="button"
                          className="is-secondary"
                          disabled={
                            loading.action
                            ||
                            internalNote.trim() ===
                              ''
                          }
                          onClick={
                            () =>
                              void handleSendInternalNote()
                          }
                        >
                          Ajouter la note
                        </button>
                      </div>
                    </section>


                    {/* --------------------------------------------------
                        COMMENTAIRES INTERNES
                        -------------------------------------------------- */}

                    <section
                      className="company-support-section"
                    >
                      <div
                        className="company-support-section-heading"
                      >
                        <Headphones
                          aria-hidden="true"
                        />

                        <div>
                          <strong>
                            Commentaires internes
                          </strong>

                          <small>
                            Notes de dossier distinctes du fil support.
                          </small>
                        </div>
                      </div>


                      <div
                        className="company-support-comments"
                      >
                        {
                          selectedSupportTicket.comments.length ===
                            0
                            ? (
                              <div
                                className="company-support-section-empty"
                              >
                                Aucun commentaire interne.
                              </div>
                            )
                            : (
                              selectedSupportTicket.comments.map(
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
                      </div>


                      <textarea
                        className="company-support-textarea"
                        placeholder="Ajouter un commentaire interne..."
                        value={
                          internalComment
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setInternalComment(
                              event.target.value,
                            )
                        }
                      />


                      <div
                        className="company-support-send-row"
                      >
                        <button
                          type="button"
                          className="is-secondary"
                          disabled={
                            loading.action
                            ||
                            internalComment.trim() ===
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
                    </section>
                  </>
                )
          }
        </section>
      </div>
    </main>
  )
}


// =========================================================================
// PAGE EXPORTÉE
// =========================================================================

function CompanySupportPage() {

  return (
    <CompanySupportContent />
  )
}


export default CompanySupportPage
