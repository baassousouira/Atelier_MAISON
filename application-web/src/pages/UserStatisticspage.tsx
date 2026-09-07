import {
  useEffect,
  useState,
} from 'react'

import {
  Activity,
  BellRing,
  Clock3,
  ShieldCheck,
  Wifi,
} from 'lucide-react'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'

import {
  useSystem,
} from '../hooks/useSystem'

import type {
  StatisticsPeriod,
} from '../types/dashboard'

import '../styles/statistics-page.css'


/*
  ============================================================
  NOMS COMPLETS DES JOURS
  ============================================================

  Dans les graphiques :

  Lun
  Mar
  Mer
  Jeu
  ...

  Dans le bilan :

  lundi
  mardi
  mercredi
  jeudi
  ...
*/

const fullDayLabels:
  Record<string, string> = {
    Lun: 'lundi',

    Mar: 'mardi',

    Mer: 'mercredi',

    Jeu: 'jeudi',

    Ven: 'vendredi',

    Sam: 'samedi',

    Dim: 'dimanche',
  }


/*
  ============================================================
  LIBELLÉS DES PÉRIODES
  ============================================================
*/

const periodLabels:
  Record<
    StatisticsPeriod,
    string
  > = {
    '7D':
      '7 derniers jours',

    '30D':
      '30 derniers jours',

    '90D':
      '3 derniers mois',
  }


function UserStatisticsPage() {
  const {
    statistics,
    statisticsLoading,
    loadStatistics,
  } =
    useSystem()


  /*
    ============================================================
    PÉRIODE SÉLECTIONNÉE
    ============================================================
  */

  const [
    period,
    setPeriod,
  ] =
    useState<StatisticsPeriod>(
      '7D',
    )


  /*
    ============================================================
    CHARGEMENT DES STATISTIQUES
    ============================================================

    Dès que la période change, SystemProvider recalcule les statistiques
    à partir des vrais événements reçus de GET /api/evenements.
  */

  useEffect(
    () => {
      void loadStatistics(
        period,
      )
    },

    [
      loadStatistics,
      period,
    ],
  )


  /*
    ============================================================
    DONNÉES DU GRAPHIQUE
    ============================================================
  */

  const motionActivity =
    statistics.motionActivity


  const availabilityActivity =
    statistics.availabilityActivity


  /*
    ============================================================
    NOMBRE TOTAL DE MOUVEMENTS
    ============================================================
  */

  const totalDetections =
    motionActivity.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.detections,

      0,
    )


  /*
    ============================================================
    NOMBRE TOTAL D'ALERTES
    ============================================================
  */

  const totalAlerts =
    motionActivity.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.alertes,

      0,
    )


  /*
    ============================================================
    POURCENTAGE DE DÉTECTIONS AYANT GÉNÉRÉ UNE ALERTE
    ============================================================
  */

  const alertRate =
    totalDetections > 0
      ? Math.round(
          (
            totalAlerts /
            totalDetections
          ) *
            100,
        )
      : 0


  /*
    ============================================================
    DISPONIBILITÉ MOYENNE
    ============================================================
  */

  const averageAvailability =
    availabilityActivity.length > 0
      ? availabilityActivity.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.disponibilite,

          0,
        ) /
        availabilityActivity.length
      : 0


  /*
    Exemple :

    99.7
        ↓
    "99,7"

    selon le format français.
  */

  const averageAvailabilityLabel =
    averageAvailability.toLocaleString(
      'fr-FR',
      {
        minimumFractionDigits: 1,

        maximumFractionDigits: 1,
      },
    )


  /*
    ============================================================
    JOUR AVEC LE PLUS DE MOUVEMENTS
    ============================================================
  */

  const busiestDay =
    motionActivity.length > 0
      ? [
          ...motionActivity,
        ].sort(
          (
            first,
            second,
          ) =>
            second.detections -
            first.detections,
        )[0]
      : null


  /*
    Exemple :

    Jeu
      ↓
    jeudi
  */

  const busiestDayFullLabel =
    busiestDay
      ? fullDayLabels[
          busiestDay.day
        ] ??
        busiestDay.day
      : ''


  /*
    ============================================================
    ÉTAT GLOBAL
    ============================================================
  */

  const installationStable =
    averageAvailability >=
    99


  return (
    <div className="user-page stats-mobile-page">
      {/*
        ========================================================
        EN-TÊTE
        ========================================================
      */}

      <header className="page-heading stats-mobile-heading">
        <div>
          <p className="page-eyebrow">
            Analyse
          </p>

          <h1>
            Statistiques
          </h1>

          <p>
            Suivez l'activité de surveillance
            et la disponibilité de votre installation.
          </p>
        </div>
      </header>


      {/*
        ========================================================
        SÉLECTION DE LA PÉRIODE
        ========================================================
      */}

      <section className="stats-mobile-period">
        <label
          htmlFor="statistics-period"
        >
          Période
        </label>

        <select
          id="statistics-period"
          value={
            period
          }
          disabled={
            statisticsLoading
          }
          onChange={
            (event) => {
              /*
                IMPORTANT :

                On garde le cast TypeScript
                sur une expression complète.

                L'ancienne version coupait :

                event.target.value
                as StatisticsPeriod

                ce qui provoquait l'erreur TS.
              */

              setPeriod(
                event.target
                  .value as StatisticsPeriod,
              )
            }
          }
        >
          <option value="7D">
            7 derniers jours
          </option>

          <option value="30D">
            30 derniers jours
          </option>

          <option value="90D">
            3 derniers mois
          </option>
        </select>
      </section>


      {/*
        ========================================================
        INDICATEURS
        ========================================================
      */}

      <section className="stats-mobile-kpi-grid">
        {/*
          ------------------------------------------------------
          MOUVEMENTS
          ------------------------------------------------------
        */}

        <article className="stats-mobile-kpi">
          <span className="stats-mobile-kpi-icon is-detection">
            <Activity
              aria-hidden="true"
            />
          </span>

          <div className="stats-mobile-kpi-copy">
            <span>
              Mouvements
            </span>

            <strong>
              {totalDetections}
            </strong>

            <small>
              {
                periodLabels[
                  period
                ]
              }
            </small>
          </div>
        </article>


        {/*
          ------------------------------------------------------
          ALERTES
          ------------------------------------------------------
        */}

        <article className="stats-mobile-kpi">
          <span className="stats-mobile-kpi-icon is-alert">
            <BellRing
              aria-hidden="true"
            />
          </span>

          <div className="stats-mobile-kpi-copy">
            <span>
              Alertes
            </span>

            <strong>
              {totalAlerts}
            </strong>

            <small>
              {alertRate}
              {' % des détections'}
            </small>
          </div>
        </article>


        {/*
          ------------------------------------------------------
          TEMPS DE RÉPONSE
          ------------------------------------------------------
        */}

        <article className="stats-mobile-kpi">
          <span className="stats-mobile-kpi-icon is-response">
            <Clock3
              aria-hidden="true"
            />
          </span>

          <div className="stats-mobile-kpi-copy">
            <span>
              Temps de réponse
            </span>

            <strong>
              {statistics.averageResponseTime !== null
                ? `${statistics.averageResponseTime} s`
                : '—'}
            </strong>

            <small>
              Moyenne de la période
            </small>
          </div>
        </article>


        {/*
          ------------------------------------------------------
          DISPONIBILITÉ
          ------------------------------------------------------
        */}

        <article className="stats-mobile-kpi">
          <span className="stats-mobile-kpi-icon is-availability">
            <Wifi
              aria-hidden="true"
            />
          </span>

          <div className="stats-mobile-kpi-copy">
            <span>
              Disponibilité
            </span>

            <strong>
              {availabilityActivity.length > 0
                ? `${averageAvailabilityLabel} %`
                : '—'}
            </strong>

            <small>
              {availabilityActivity.length > 0
                ? 'Objectif > 99 %'
                : 'Historique réseau non disponible'}
            </small>
          </div>
        </article>
      </section>


      {/*
        ========================================================
        MOUVEMENTS + ALERTES
        ========================================================
      */}

      <section className="stats-mobile-chart-card">
        <header className="stats-mobile-chart-header">
          <div>
            <span className="stats-mobile-eyebrow">
              Détection
            </span>

            <h2>
              Mouvements et alertes
            </h2>
          </div>

          <Activity
            aria-hidden="true"
          />
        </header>


        <div className="stats-mobile-legend">
          <span>
            <i className="is-motion" />

            Mouvements
          </span>

          <span>
            <i className="is-alert" />

            Alertes
          </span>
        </div>


        <div className="stats-mobile-chart-container">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <AreaChart
              data={
                motionActivity
              }
              margin={{
                top: 12,

                right: 6,

                bottom: 0,

                left: 6,
              }}
            >
              {/*
                Dégradé sous la courbe
                des mouvements.
              */}

              <defs>
                <linearGradient
                  id="statsMotionGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#109487"
                    stopOpacity={
                      0.18
                    }
                  />

                  <stop
                    offset="100%"
                    stopColor="#109487"
                    stopOpacity={
                      0
                    }
                  />
                </linearGradient>
              </defs>


              <CartesianGrid
                vertical={
                  false
                }
                strokeDasharray="4 4"
                stroke="#e2e9eb"
              />


              <XAxis
                dataKey="day"
                axisLine={
                  false
                }
                tickLine={
                  false
                }
                tick={{
                  fill:
                    '#71848c',

                  fontSize:
                    11,
                }}
                dy={
                  7
                }
              />


              <Tooltip />


              <Area
                type="monotone"
                dataKey="detections"
                name="Mouvements"
                stroke="#109487"
                strokeWidth={
                  2.5
                }
                fill="url(#statsMotionGradient)"
                dot={
                  false
                }
              />


              <Area
                type="monotone"
                dataKey="alertes"
                name="Alertes"
                stroke="#d95155"
                strokeWidth={
                  2
                }
                fill="transparent"
                dot={
                  false
                }
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>


      {/*
        ========================================================
        DISPONIBILITÉ
        ========================================================
      */}

      <section className="stats-mobile-chart-card">
        <header className="stats-mobile-chart-header">
          <div>
            <span className="stats-mobile-eyebrow">
              Réseau
            </span>

            <h2>
              Disponibilité quotidienne
            </h2>
          </div>

          <Wifi
            aria-hidden="true"
          />
        </header>


        <div className="stats-mobile-chart-container stats-mobile-chart-container-bar">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={
                availabilityActivity
              }
              margin={{
                top: 12,

                right: 5,

                bottom: 0,

                left: 5,
              }}
            >
              <CartesianGrid
                vertical={
                  false
                }
                strokeDasharray="4 4"
                stroke="#e2e9eb"
              />


              <XAxis
                dataKey="day"
                axisLine={
                  false
                }
                tickLine={
                  false
                }
                tick={{
                  fill:
                    '#71848c',

                  fontSize:
                    11,
                }}
                dy={
                  7
                }
              />


              <Tooltip />


              <Bar
                dataKey="disponibilite"
                name="Disponibilité"
                fill="#3478a9"
                radius={[
                  7,
                  7,
                  0,
                  0,
                ]}
                maxBarSize={
                  38
                }
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>


      {/*
        ========================================================
        BILAN
        ========================================================
      */}

      <section className="stats-mobile-summary">
        <span className="stats-mobile-summary-icon">
          <ShieldCheck
            aria-hidden="true"
          />
        </span>

        <div>
          <span className="stats-mobile-summary-eyebrow">
            Bilan de la période
          </span>

          <h2>
            {installationStable
              ? 'Installation stable'
              : 'Disponibilité à surveiller'}
          </h2>

          <p>
            La disponibilité moyenne est de
            {' '}

            <strong>
              {availabilityActivity.length > 0
                ? `${averageAvailabilityLabel} %`
                : '—'}
            </strong>
            .

            {busiestDay && (
              <>
                {' '}

                Le
                {' '}

                <strong>
                  {
                    busiestDayFullLabel
                  }
                </strong>

                {' '}

                concentre le plus grand nombre
                de mouvements détectés.
              </>
            )}
          </p>
        </div>
      </section>
    </div>
  )
}


export default UserStatisticsPage