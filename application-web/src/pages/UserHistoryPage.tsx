import {
  useMemo,
  useState,
} from 'react'

import type {
  LucideIcon,
} from 'lucide-react'

import {
  BellRing,
  Camera,
  ChevronDown,
  Clock3,
  Cpu,
  Filter,
  History,
  Search,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'

import {
  useSystem,
} from '../hooks/useSystem'

import type {
  HistoryCategory,
} from '../types/dashboard'

import '../styles/history-page.css'

type FilterValue =
  | 'ALL'
  | HistoryCategory

type HistoryFilter = {
  label: string
  value: FilterValue
}

const filters: HistoryFilter[] = [
  {
    label: 'Tous les événements',
    value: 'ALL',
  },
  {
    label: 'Alertes',
    value: 'ALERT',
  },
  {
    label: 'Commandes',
    value: 'COMMAND',
  },
  {
    label: 'Système',
    value: 'SYSTEM',
  },
  {
    label: 'Médias',
    value: 'MEDIA',
  },
]

const categoryLabels:
  Record<
    HistoryCategory,
    string
  > = {
    ALERT: 'Alerte',
    COMMAND: 'Commande',
    SYSTEM: 'Système',
    MEDIA: 'Média',
  }

/*
  ============================================================
  ICÔNES DES CATÉGORIES
  ============================================================
*/

function getCategoryIcon(
  category: HistoryCategory,
): LucideIcon {
  switch (category) {
    case 'ALERT':
      return BellRing

    case 'MEDIA':
      return Camera

    case 'SYSTEM':
      return Cpu

    case 'COMMAND':
    default:
      return SlidersHorizontal
  }
}

/*
  ============================================================
  DATE + HEURE
  ============================================================

  Exemple :

  03/09/2026 16:49:44

  devient :

  date = 03/09/2026
  time = 16:49:44
*/

function splitTimestamp(
  timestamp: string,
) {
  const normalizedTimestamp =
    timestamp
      .replace(',', '')
      .trim()

  const parts =
    normalizedTimestamp
      .split(/\s+/)

  if (parts.length >= 2) {
    return {
      date: parts[0],

      time: parts
        .slice(1)
        .join(' '),
    }
  }

  return {
    date: timestamp,
    time: '',
  }
}

/*
  ============================================================
  PAGE
  ============================================================
*/

function UserHistoryPage() {
  const {
    history,
  } = useSystem()

  const [
    activeFilter,
    setActiveFilter,
  ] =
    useState<FilterValue>(
      'ALL',
    )

  const [
    query,
    setQuery,
  ] =
    useState('')

  /*
    ============================================================
    HISTORIQUE FILTRÉ
    ============================================================
  */

  const filteredHistory =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLowerCase()

        return history.filter(
          (event) => {
            const matchesCategory =
              activeFilter ===
                'ALL' ||
              event.category ===
                activeFilter

            const matchesQuery =
              !normalizedQuery ||

              event.title
                .toLowerCase()
                .includes(
                  normalizedQuery,
                ) ||

              event.description
                .toLowerCase()
                .includes(
                  normalizedQuery,
                ) ||

              event.actor
                .toLowerCase()
                .includes(
                  normalizedQuery,
                ) ||

              event.timestamp
                .toLowerCase()
                .includes(
                  normalizedQuery,
                ) ||

              categoryLabels[
                event.category
              ]
                .toLowerCase()
                .includes(
                  normalizedQuery,
                )

            return (
              matchesCategory &&
              matchesQuery
            )
          },
        )
      },

      [
        activeFilter,
        history,
        query,
      ],
    )

  return (
    <div className="user-page history-clean-page">
      {/*
        ========================================================
        EN-TÊTE
        ========================================================
      */}

      <header className="page-heading history-clean-heading">
        <div>
          <p className="page-eyebrow">
            Traçabilité
          </p>

          <h1>
            Historique
          </h1>

          <p>
            Retrouvez toutes les actions
            et tous les événements enregistrés
            sur votre installation.
          </p>
        </div>

        <span className="page-status is-neutral">
          <History
            aria-hidden="true"
          />

          {history.length}
          {' '}
          événements
        </span>
      </header>

      {/*
        ========================================================
        RECHERCHE + FILTRE
        ========================================================
      */}

      <section className="history-clean-toolbar">
        <label className="history-clean-search">
          <Search
            aria-hidden="true"
          />

          <span className="sr-only">
            Rechercher dans l'historique
          </span>

          <input
            type="search"
            placeholder="Rechercher un événement…"
            value={query}
            onChange={(event) => {
              setQuery(
                event.target.value,
              )
            }}
          />
        </label>

        <label className="history-clean-filter">
          <Filter
            aria-hidden="true"
          />

          <span className="sr-only">
            Filtrer les événements
          </span>

          <select
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(
                event.target
                  .value as FilterValue,
              )
            }}
          >
            {filters.map(
              (filter) => (
                <option
                  key={filter.value}
                  value={filter.value}
                >
                  {filter.label}
                </option>
              ),
            )}
          </select>

          <ChevronDown
            className="history-clean-filter-chevron"
            aria-hidden="true"
          />
        </label>
      </section>

      {/*
        ========================================================
        NOMBRE DE RÉSULTATS
        ========================================================
      */}

      <div className="history-clean-results-heading">
        <span>
          {filteredHistory.length}
          {' '}
          {filteredHistory.length > 1
            ? 'événements affichés'
            : 'événement affiché'}
        </span>
      </div>

      {/*
        ========================================================
        VERSION DESKTOP
        ========================================================
      */}

      <section className="history-clean-desktop">
        <div className="history-clean-table-container">
          <table className="history-clean-table">
            <thead>
              <tr>
                <th>
                  Événement
                </th>

                <th>
                  Catégorie
                </th>

                <th>
                  Auteur
                </th>

                <th>
                  Date
                </th>

                <th>
                  Heure
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredHistory.map(
                (event) => {
                  const Icon =
                    getCategoryIcon(
                      event.category,
                    )

                  const {
                    date,
                    time,
                  } =
                    splitTimestamp(
                      event.timestamp,
                    )

                  return (
                    <tr
                      key={event.id}
                    >
                      <td>
                        <div className="history-clean-desktop-event">
                          <span
                            className={
                              `history-clean-icon history-clean-${event.category.toLowerCase()}`
                            }
                          >
                            <Icon
                              aria-hidden="true"
                            />
                          </span>

                          <div>
                            <strong>
                              {event.title}
                            </strong>

                            <span>
                              {event.description}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            `history-clean-category history-clean-${event.category.toLowerCase()}`
                          }
                        >
                          {
                            categoryLabels[
                              event.category
                            ]
                          }
                        </span>
                      </td>

                      <td>
                        {event.actor}
                      </td>

                      <td>
                        <time className="history-clean-desktop-date">
                          {date}
                        </time>
                      </td>

                      <td>
                        <time className="history-clean-desktop-date">
                          {time}
                        </time>
                      </td>
                    </tr>
                  )
                },
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/*
        ========================================================
        VERSION MOBILE
        ========================================================
      */}

      <section className="history-clean-mobile">
        {filteredHistory.map(
          (event) => {
            const Icon =
              getCategoryIcon(
                event.category,
              )

            const {
              date,
              time,
            } =
              splitTimestamp(
                event.timestamp,
              )

            return (
              <article
                className="history-clean-card"
                key={event.id}
              >
                {/*
                  ==================================================
                  EN-TÊTE DE LA CARTE

                  Le badge est maintenant placé
                  tout en haut à droite.

                  L'icône a aussi été réduite.
                  ==================================================
                */}

                <div className="history-clean-card-header">
                  <div className="history-clean-card-heading-main">
                    <span
                      className={
                        `history-clean-card-icon history-clean-${event.category.toLowerCase()}`
                      }
                    >
                      <Icon
                        aria-hidden="true"
                      />
                    </span>

                    <strong className="history-clean-card-event-title">
                      {event.title}
                    </strong>
                  </div>

                  <span
                    className={
                      `history-clean-category history-clean-${event.category.toLowerCase()}`
                    }
                  >
                    {
                      categoryLabels[
                        event.category
                      ]
                    }
                  </span>
                </div>

                {/*
                  ==================================================
                  DESCRIPTION
                  ==================================================
                */}

                <p className="history-clean-card-description">
                  {event.description}
                </p>

                {/*
                  ==================================================
                  MÉTADONNÉES
                  ==================================================
                */}

                <footer className="history-clean-card-footer">
                  <div className="history-clean-card-author">
                    <UserRound
                      aria-hidden="true"
                    />

                    <strong>
                      {event.actor}
                    </strong>
                  </div>

                  <div className="history-clean-card-datetime">
                    <Clock3
                      aria-hidden="true"
                    />

                    <time>
                      {date}

                      {time && (
                        <>
                          {' · '}
                          {time}
                        </>
                      )}
                    </time>
                  </div>
                </footer>
              </article>
            )
          },
        )}
      </section>

      {/*
        ========================================================
        AUCUN RÉSULTAT
        ========================================================
      */}

      {filteredHistory.length ===
        0 && (
        <section className="history-clean-empty">
          <Search
            aria-hidden="true"
          />

          <strong>
            Aucun événement trouvé
          </strong>

          <span>
            Essayez une autre recherche
            ou modifiez le filtre.
          </span>
        </section>
      )}
    </div>
  )
}

export default UserHistoryPage