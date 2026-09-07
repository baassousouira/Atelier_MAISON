// CompanyInfrastructurePage.tsx

// -----------------------------------------------------------------------
// SUPERVISION DE L'INFRASTRUCTURE RÉSEAU - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Cette page est destinée au centre de surveillance / administrateur.
//
// Son rôle n'est PAS de commander le matériel métier (caméra, robot,
// capteurs). Ces actions restent dans les pages Alertes / Clients.
//
// Cette page sert à comprendre rapidement :
//
// - quels Raspberry sont connus par FastAPI ;
// - lesquels sont ONLINE / OFFLINE ;
// - quand leur dernier heartbeat a été reçu ;
// - quels composants ils déclarent ;
// - si le lien physique Ethernet est connu comme branché / débranché ;
// - si l'API locale du Raspberry est joignable ;
// - à quel client / site le Raspberry est rattaché ;
// - quels changements de connectivité ont eu lieu pendant la session.
//
// IMPORTANT :
//
// Il faut distinguer deux notions :
//
// 1. ÉTAT LOGIQUE
//    Le Raspberry communique-t-il avec le serveur central ?
//    → basé aujourd'hui sur le heartbeat et le champ status ONLINE/OFFLINE.
//
// 2. ÉTAT PHYSIQUE DU LIEN
//    Le câble Ethernet est-il réellement branché ?
//    → nécessite une télémétrie réseau envoyée par le Raspberry ou par un
//      switch administrable.
//
// Le frontend est déjà prêt à afficher cette information via les champs
// optionnels physicalLinkState / networkInterface / localApiStatus.
// Tant que le backend ne les renvoie pas, l'interface affiche
// « Non télémétré » au lieu d'inventer une information.
// -----------------------------------------------------------------------

import {
  Activity,
  Bot,
  Cable,
  Camera,
  CircuitBoard,
  Clock3,
  Cpu,
  Monitor,
  Network,
  Plug,
  Radio,
  RefreshCw,
  Router,
  Server,
  ShieldCheck,
  Unplug,
  Wifi,
  WifiOff,
} from 'lucide-react'

import type {
  LucideIcon,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  useCompany,
} from '../hooks/useCompany'

import type {
  CompanyController,
  CompanyControllerComponent,
  CompanyLocalApiStatus,
  CompanyPhysicalLinkState,
} from '../types/company'

import '../styles/dashboard.css'
import '../styles/company-infrastructure.css'


// =========================================================================
// CONFIGURATION D'AFFICHAGE
// =========================================================================
//
// Ces deux valeurs sont uniquement des LIBELLÉS visuels.
// Elles ne sont jamais utilisées pour construire les requêtes HTTP.
//
// Toutes les requêtes React continuent à passer par :
//
// VITE_API_BASE_URL=/api
//        ↓
// proxy Vite
//        ↓
// FastAPI
//
// Les valeurs peuvent être personnalisées dans .env.local :
//
// VITE_INFRA_SERVER_IP=192.168.1.1
// VITE_INFRA_ADMIN_IP=192.168.1.5
// =========================================================================

const SERVER_IP_LABEL =
  import.meta.env.VITE_INFRA_SERVER_IP
  ||
  '192.168.1.1'


const ADMIN_IP_LABEL =
  import.meta.env.VITE_INFRA_ADMIN_IP
  ||
  '192.168.1.5'


// Fréquence de lecture des contrôleurs.
// Le heartbeat Raspberry est prévu environ toutes les 5 secondes.
const CONTROLLERS_REFRESH_INTERVAL_MS =
  5_000


// Le health check peut être moins fréquent que la lecture des Raspberry.
const HEALTH_REFRESH_INTERVAL_MS =
  10_000


// =========================================================================
// TYPES LOCAUX D'AFFICHAGE
// =========================================================================

type LinkVisualState =
  | 'ACTIVE'
  | 'DEGRADED'
  | 'DISCONNECTED'
  | 'UNKNOWN'


type SessionEventType =
  | 'ONLINE'
  | 'OFFLINE'
  | 'CABLE_CONNECTED'
  | 'CABLE_DISCONNECTED'
  | 'COMPONENT_ONLINE'
  | 'COMPONENT_OFFLINE'
  | 'COMPONENT_ENABLED'
  | 'COMPONENT_DISABLED'


type InfrastructureSessionEvent = {
  id:
    string

  createdAt:
    string

  type:
    SessionEventType

  controllerIp:
    string

  message:
    string
}


type ControllerSnapshot = {
  status:
    CompanyController['status']

  physicalLinkState:
    CompanyPhysicalLinkState

  components:
    Record<
      string,
      {
        status:
          CompanyControllerComponent['status']

        enabled:
          boolean
      }
    >
}


// =========================================================================
// FORMATAGE
// =========================================================================

function formatDate(
  value:
    string | null | undefined,
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


function formatCurrentTime(): string {

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      hour:
        '2-digit',

      minute:
        '2-digit',

      second:
        '2-digit',
    },
  ).format(
    new Date(),
  )
}


// =========================================================================
// LABELS RASPBERRY / COMPOSANTS
// =========================================================================

function controllerTypeLabel(
  controller:
    CompanyController,
): string {

  return controller.controllerType ===
    'MOBILE'
    ? 'Raspberry mobile'
    : 'Raspberry fixe'
}


function componentLabel(
  component:
    CompanyControllerComponent,
): string {

  const normalized =
    component.name
      .trim()
      .toLowerCase()


  const labels:
    Record<
      string,
      string
    > = {

      camera:
        'Caméra',

      motion_sensor:
        'Détecteur de mouvement',

      photoresistance:
        'Photorésistance',

      light_sensor:
        'Capteur de luminosité',

      button:
        'Bouton',

      bouton:
        'Bouton',

      led:
        'LED',

      servo:
        'Servomoteur',

      robot:
        'Robot',
    }


  return (
    labels[
      normalized
    ]
    ??
    component.name
  )
}


function componentIcon(
  component:
    CompanyControllerComponent,
): LucideIcon {

  const kind =
    component.kind
      .toUpperCase()


  if (
    kind.includes(
      'CAMERA',
    )
  ) {

    return Camera
  }


  if (
    kind.includes(
      'ROBOT',
    )
  ) {

    return Bot
  }


  if (
    kind.includes(
      'SERVO',
    )
  ) {

    return CircuitBoard
  }


  return Radio
}


// =========================================================================
// TÉLÉMÉTRIE PHYSIQUE / API LOCALE
// =========================================================================

function physicalLinkState(
  controller:
    CompanyController,
): CompanyPhysicalLinkState {

  return (
    controller.physicalLinkState
    ??
    'UNKNOWN'
  )
}


function localApiStatus(
  controller:
    CompanyController,
): CompanyLocalApiStatus {

  return (
    controller.localApiStatus
    ??
    'UNKNOWN'
  )
}


function physicalLinkLabel(
  controller:
    CompanyController,
): string {

  const state =
    physicalLinkState(
      controller,
    )


  if (
    state ===
      'CONNECTED'
  ) {

    return 'Câble RJ45 branché'
  }


  if (
    state ===
      'DISCONNECTED'
  ) {

    return 'Câble RJ45 débranché'
  }


  return 'Câble non télémétré'
}


function localApiLabel(
  controller:
    CompanyController,
): string {

  const status =
    localApiStatus(
      controller,
    )


  if (
    status ===
      'REACHABLE'
  ) {

    return 'API locale :8001 joignable'
  }


  if (
    status ===
      'UNREACHABLE'
  ) {

    return 'API locale :8001 inaccessible'
  }


  return 'API locale non vérifiée'
}


// =========================================================================
// ÉTAT VISUEL D'UNE LIAISON
// =========================================================================
//
// Cette fonction évite de confondre :
//
// - câble physiquement débranché ;
// - câble branché mais Raspberry ne répondant plus ;
// - information physique inconnue mais heartbeat reçu.
// =========================================================================

function linkVisualState(
  controller:
    CompanyController,
): LinkVisualState {

  const physical =
    physicalLinkState(
      controller,
    )


  if (
    physical ===
      'DISCONNECTED'
  ) {

    return 'DISCONNECTED'
  }


  if (
    controller.status ===
      'ONLINE'
  ) {

    return 'ACTIVE'
  }


  if (
    physical ===
      'CONNECTED'
    &&
    controller.status ===
      'OFFLINE'
  ) {

    return 'DEGRADED'
  }


  return 'UNKNOWN'
}


function linkVisualLabel(
  state:
    LinkVisualState,
): string {

  const labels:
    Record<
      LinkVisualState,
      string
    > = {

      ACTIVE:
        'Communication active',

      DEGRADED:
        'Câble présent, communication perdue',

      DISCONNECTED:
        'Liaison physique débranchée',

      UNKNOWN:
        'État de liaison indéterminé',
    }


  return labels[
    state
  ]
}


// =========================================================================
// SNAPSHOT UTILISÉ POUR LE JOURNAL DE SESSION
// =========================================================================

function createControllerSnapshot(
  controller:
    CompanyController,
): ControllerSnapshot {

  const components:
    ControllerSnapshot['components'] = {}


  controller.components.forEach(
    (
      component,
    ) => {

      components[
        component.id
      ] = {
        status:
          component.status,

        enabled:
          component.enabled,
      }
    },
  )


  return {
    status:
      controller.status,

    physicalLinkState:
      physicalLinkState(
        controller,
      ),

    components,
  }
}


// =========================================================================
// PAGE
// =========================================================================

function CompanyInfrastructurePage() {

  const {
    connectionStatus,
    checkCompanyConnection,

    controllers,
    refreshControllers,

    loading,
  } =
    useCompany()


  // =====================================================================
  // JOURNAL DE SESSION
  // =====================================================================
  //
  // Ce journal est volontairement LOCAL AU NAVIGATEUR.
  //
  // Il sert uniquement à visualiser pendant la démonstration les changements
  // détectés depuis l'ouverture de cette page.
  //
  // Il ne remplace PAS AuditLog, qui est généré côté FastAPI.
  // =====================================================================

  const [
    sessionEvents,
    setSessionEvents,
  ] =
    useState<
      InfrastructureSessionEvent[]
    >(
      [],
    )


  const previousSnapshotsRef =
    useRef<
      Map<
        string,
        ControllerSnapshot
      >
    >(
      new Map(),
    )


  const hasInitialSnapshotRef =
    useRef(
      false,
    )


  // =====================================================================
  // ACTUALISATION
  // =====================================================================

  useEffect(
    () => {

      void refreshControllers()


      const controllerInterval =
        window.setInterval(
          () => {

            void refreshControllers()
          },
          CONTROLLERS_REFRESH_INTERVAL_MS,
        )


      const healthInterval =
        window.setInterval(
          () => {

            void checkCompanyConnection()
          },
          HEALTH_REFRESH_INTERVAL_MS,
        )


      return () => {

        window.clearInterval(
          controllerInterval,
        )

        window.clearInterval(
          healthInterval,
        )
      }
    },
    [
      checkCompanyConnection,
      refreshControllers,
    ],
  )


  // =====================================================================
  // DÉTECTION DES CHANGEMENTS
  // =====================================================================

  useEffect(
    () => {

      const currentSnapshots =
        new Map<
          string,
          ControllerSnapshot
        >()


      controllers.forEach(
        (
          controller,
        ) => {

          currentSnapshots.set(
            controller.ip,
            createControllerSnapshot(
              controller,
            ),
          )
        },
      )


      // Premier chargement : on mémorise seulement l'état actuel.
      // On évite d'afficher artificiellement « X vient de se connecter »
      // alors que la page vient simplement d'être ouverte.
      if (
        !hasInitialSnapshotRef.current
      ) {

        previousSnapshotsRef.current =
          currentSnapshots

        hasInitialSnapshotRef.current =
          true

        return
      }


      const newEvents:
        InfrastructureSessionEvent[] = []


      controllers.forEach(
        (
          controller,
        ) => {

          const previous =
            previousSnapshotsRef.current.get(
              controller.ip,
            )


          const current =
            currentSnapshots.get(
              controller.ip,
            )


          if (
            !previous
            ||
            !current
          ) {

            return
          }


          // -------------------------------------------------------------
          // ONLINE / OFFLINE
          // -------------------------------------------------------------

          if (
            previous.status !==
              current.status
          ) {

            newEvents.push(
              {
                id:
                  crypto.randomUUID(),

                createdAt:
                  new Date().toISOString(),

                type:
                  current.status ===
                    'ONLINE'
                    ? 'ONLINE'
                    : 'OFFLINE',

                controllerIp:
                  controller.ip,

                message:
                  current.status ===
                    'ONLINE'
                    ? (
                      `${controllerTypeLabel(controller)} `
                      + `${controller.ip} est repassé en ligne.`
                    )
                    : (
                      `${controllerTypeLabel(controller)} `
                      + `${controller.ip} ne répond plus.`
                    ),
              },
            )
          }


          // -------------------------------------------------------------
          // CÂBLE PHYSIQUE
          // -------------------------------------------------------------

          if (
            previous.physicalLinkState !==
              current.physicalLinkState
            &&
            current.physicalLinkState !==
              'UNKNOWN'
          ) {

            newEvents.push(
              {
                id:
                  crypto.randomUUID(),

                createdAt:
                  new Date().toISOString(),

                type:
                  current.physicalLinkState ===
                    'CONNECTED'
                    ? 'CABLE_CONNECTED'
                    : 'CABLE_DISCONNECTED',

                controllerIp:
                  controller.ip,

                message:
                  current.physicalLinkState ===
                    'CONNECTED'
                    ? (
                      `Lien Ethernet détecté sur ${controller.ip}.`
                    )
                    : (
                      `Lien Ethernet perdu sur ${controller.ip}.`
                    ),
              },
            )
          }


          // -------------------------------------------------------------
          // COMPOSANTS
          // -------------------------------------------------------------

          controller.components.forEach(
            (
              component,
            ) => {

              const previousComponent =
                previous.components[
                  component.id
                ]


              const currentComponent =
                current.components[
                  component.id
                ]


              if (
                !previousComponent
                ||
                !currentComponent
              ) {

                return
              }


              if (
                previousComponent.status !==
                  currentComponent.status
              ) {

                newEvents.push(
                  {
                    id:
                      crypto.randomUUID(),

                    createdAt:
                      new Date().toISOString(),

                    type:
                      currentComponent.status ===
                        'ONLINE'
                        ? 'COMPONENT_ONLINE'
                        : 'COMPONENT_OFFLINE',

                    controllerIp:
                      controller.ip,

                    message:
                      (
                        `${componentLabel(component)} `
                        + `(${controller.ip}) est `
                        + (
                          currentComponent.status ===
                            'ONLINE'
                            ? 'en ligne.'
                            : 'hors ligne.'
                        )
                      ),
                  },
                )
              }


              if (
                previousComponent.enabled !==
                  currentComponent.enabled
              ) {

                newEvents.push(
                  {
                    id:
                      crypto.randomUUID(),

                    createdAt:
                      new Date().toISOString(),

                    type:
                      currentComponent.enabled
                        ? 'COMPONENT_ENABLED'
                        : 'COMPONENT_DISABLED',

                    controllerIp:
                      controller.ip,

                    message:
                      (
                        `${componentLabel(component)} `
                        + `(${controller.ip}) a été `
                        + (
                          currentComponent.enabled
                            ? 'activé.'
                            : 'désactivé.'
                        )
                      ),
                  },
                )
              }
            },
          )
        },
      )


      if (
        newEvents.length >
          0
      ) {

        setSessionEvents(
          (
            current,
          ) =>
            [
              ...newEvents.reverse(),
              ...current,
            ].slice(
              0,
              50,
            ),
        )
      }


      previousSnapshotsRef.current =
        currentSnapshots
    },
    [
      controllers,
    ],
  )


  // =====================================================================
  // STATISTIQUES DE TOPOLOGIE
  // =====================================================================

  const onlineControllers =
    controllers.filter(
      (
        controller,
      ) =>
        controller.status ===
          'ONLINE',
    ).length


  const offlineControllers =
    controllers.length
    -
    onlineControllers


  const assignedControllers =
    controllers.filter(
      (
        controller,
      ) =>
        controller.assigned,
    ).length


  const physicalLinksConnected =
    controllers.filter(
      (
        controller,
      ) =>
        physicalLinkState(
          controller,
        ) ===
          'CONNECTED',
    ).length


  const physicalLinksDisconnected =
    controllers.filter(
      (
        controller,
      ) =>
        physicalLinkState(
          controller,
        ) ===
          'DISCONNECTED',
    ).length


  const physicalLinksUnknown =
    controllers.length
    -
    physicalLinksConnected
    -
    physicalLinksDisconnected


  const sortedControllers =
    useMemo(
      () =>
        [
          ...controllers,
        ].sort(
          (
            a,
            b,
          ) => {

            if (
              a.status !==
                b.status
            ) {

              return a.status ===
                'ONLINE'
                ? -1
                : 1
            }


            return a.ip.localeCompare(
              b.ip,
            )
          },
        ),
      [
        controllers,
      ],
    )


  // =====================================================================
  // ACTUALISATION MANUELLE
  // =====================================================================

  async function handleRefresh() {

    await Promise.all(
      [
        checkCompanyConnection(),
        refreshControllers(),
      ],
    )
  }


  // =====================================================================
  // RENDU
  // =====================================================================

  return (
    <main
      className="company-infrastructure-page"
    >

      {/* ================================================================
          EN-TÊTE
          ================================================================ */}

      <div
        className="company-infrastructure-heading"
      >
        <div>
          <p
            className="dashboard-eyebrow"
          >
            Supervision technique
          </p>

          <h1>
            Infrastructure réseau
          </h1>

          <p>
            Vue en temps réel des nœuds, liaisons réseau, Raspberry
            et composants utilisés par le prototype Atelier Maison.
          </p>
        </div>


        <div
          className="company-infrastructure-heading-actions"
        >
          <div
            className="company-infrastructure-live-pill"
          >
            <Activity
              aria-hidden="true"
            />

            <span>
              <strong>
                Actualisation automatique
              </strong>

              <small>
                Raspberry : 5 s · API : 10 s
              </small>
            </span>
          </div>


          <button
            type="button"
            disabled={
              loading.controllers
            }
            onClick={
              () =>
                void handleRefresh()
            }
          >
            <RefreshCw
              aria-hidden="true"
              className={
                loading.controllers
                  ? 'is-spinning'
                  : undefined
              }
            />

            Actualiser
          </button>
        </div>
      </div>


      {/* ================================================================
          INDICATEURS
          ================================================================ */}

      <div
        className="company-infrastructure-metrics"
      >
        <article>
          <Server
            aria-hidden="true"
          />

          <span>
            Serveur central
          </span>

          <strong>
            {
              connectionStatus ===
                'CONNECTED'
                ? 'En ligne'
                : 'Hors ligne'
            }
          </strong>

          <small>
            {
              SERVER_IP_LABEL
            }
          </small>
        </article>


        <article>
          <Cpu
            aria-hidden="true"
          />

          <span>
            Raspberry détectés
          </span>

          <strong>
            {
              controllers.length
            }
          </strong>

          <small>
            {
              assignedControllers
            }
            {' '}
            rattaché(s) à un site
          </small>
        </article>


        <article>
          <Wifi
            aria-hidden="true"
          />

          <span>
            Raspberry en ligne
          </span>

          <strong>
            {
              onlineControllers
            }
          </strong>

          <small>
            {
              offlineControllers
            }
            {' '}
            hors ligne
          </small>
        </article>


        <article>
          <Cable
            aria-hidden="true"
          />

          <span>
            Liens RJ45 télémétrés
          </span>

          <strong>
            {
              physicalLinksConnected
            }
          </strong>

          <small>
            {
              physicalLinksDisconnected
            }
            {' '}
            débranché(s) ·
            {' '}
            {
              physicalLinksUnknown
            }
            {' '}
            inconnu(s)
          </small>
        </article>
      </div>


      {/* ================================================================
          NOTE MÉTHODOLOGIQUE
          ================================================================ */}

      <section
        className="company-infrastructure-method-note"
      >
        <ShieldCheck
          aria-hidden="true"
        />

        <div>
          <strong>
            Deux informations différentes sont affichées
          </strong>

          <p>
            « En ligne / hors ligne » décrit la communication observée avec
            FastAPI. « Câble branché / débranché » correspond à une télémétrie
            physique différente. Tant que cette télémétrie n&apos;est pas envoyée
            par les Raspberry, le site affiche « câble non télémétré » au lieu
            de déduire à tort qu&apos;un câble est débranché.
          </p>
        </div>
      </section>


      {/* ================================================================
          TOPOLOGIE VISUELLE
          ================================================================ */}

      <section
        className="company-infrastructure-panel"
      >
        <div
          className="company-infrastructure-panel-heading"
        >
          <div>
            <Network
              aria-hidden="true"
            />

            <span>
              <strong>
                Topologie du prototype
              </strong>

              <small>
                Schéma logique mis à jour à partir de FastAPI.
              </small>
            </span>
          </div>

          <span>
            Dernière lecture navigateur :
            {' '}
            {
              formatCurrentTime()
            }
          </span>
        </div>


        <div
          className="company-infrastructure-topology"
        >

          {/* ------------------------------------------------------------
              NIVEAU 1 : SERVEUR / SWITCH / POSTE ADMIN
              ------------------------------------------------------------ */}

          <div
            className="company-infrastructure-core-row"
          >
            <InfrastructureCoreNode
              icon={
                Server
              }
              title="Serveur central"
              subtitle={
                SERVER_IP_LABEL
              }
              stateLabel={
                connectionStatus ===
                  'CONNECTED'
                  ? 'API FastAPI accessible'
                  : 'API FastAPI inaccessible'
              }
              tone={
                connectionStatus ===
                  'CONNECTED'
                  ? 'online'
                  : 'offline'
              }
            />


            <div
              className={
                (
                  'company-infrastructure-core-link '
                  +
                  (
                    connectionStatus ===
                      'CONNECTED'
                      ? 'is-active'
                      : 'is-disconnected'
                  )
                )
              }
            >
              <span>
                RJ45 / réseau
              </span>
            </div>


            <InfrastructureCoreNode
              icon={
                Router
              }
              title="Switch réseau"
              subtitle="Commutation Ethernet"
              stateLabel="Équipement passif non télémétré"
              tone="neutral"
            />


            <div
              className="company-infrastructure-core-link is-active"
            >
              <span>
                Interface web
              </span>
            </div>


            <InfrastructureCoreNode
              icon={
                Monitor
              }
              title="Poste administrateur"
              subtitle={
                ADMIN_IP_LABEL
              }
              stateLabel="React / Vite actif"
              tone="online"
            />
          </div>


          {/* ------------------------------------------------------------
              NIVEAU 2 : RASPBERRY
              ------------------------------------------------------------ */}

          <div
            className="company-infrastructure-controller-branch"
          >
            <div
              className="company-infrastructure-branch-trunk"
              aria-hidden="true"
            />


            {
              sortedControllers.length ===
                0
                ? (
                  <div
                    className="company-infrastructure-no-controller"
                  >
                    <Cpu
                      aria-hidden="true"
                    />

                    <strong>
                      Aucun Raspberry détecté
                    </strong>

                    <span>
                      Un Raspberry apparaîtra ici après réception de son
                      premier heartbeat par FastAPI.
                    </span>
                  </div>
                )
                : (
                  <div
                    className="company-infrastructure-controller-grid"
                  >
                    {
                      sortedControllers.map(
                        (
                          controller,
                        ) => (
                          <ControllerTopologyCard
                            key={
                              controller.ip
                            }
                            controller={
                              controller
                            }
                          />
                        ),
                      )
                    }
                  </div>
                )
            }
          </div>
        </div>
      </section>


      {/* ================================================================
          LÉGENDE
          ================================================================ */}

      <section
        className="company-infrastructure-panel"
      >
        <div
          className="company-infrastructure-panel-heading"
        >
          <div>
            <Cable
              aria-hidden="true"
            />

            <span>
              <strong>
                Légende des états
              </strong>

              <small>
                Lecture visuelle commune pour la démonstration.
              </small>
            </span>
          </div>
        </div>


        <div
          className="company-infrastructure-legend"
        >
          <LegendItem
            tone="online"
            icon={
              Wifi
            }
            title="Vert — en ligne"
            description="Heartbeat reçu récemment et communication disponible."
          />

          <LegendItem
            tone="offline"
            icon={
              WifiOff
            }
            title="Rouge — hors ligne"
            description="Le nœud ne communique plus avec le serveur."
          />

          <LegendItem
            tone="degraded"
            icon={
              Cable
            }
            title="Orange — dégradé"
            description="Lien physique présent mais communication logique perdue."
          />

          <LegendItem
            tone="neutral"
            icon={
              Radio
            }
            title="Gris — inconnu"
            description="Information non télémétrée ou impossible à déterminer."
          />

          <LegendItem
            tone="online"
            icon={
              Plug
            }
            title="Câble branché"
            description="Le Raspberry déclare un carrier Ethernet actif."
          />

          <LegendItem
            tone="offline"
            icon={
              Unplug
            }
            title="Câble débranché"
            description="Le Raspberry déclare la perte du carrier Ethernet."
          />
        </div>
      </section>


      {/* ================================================================
          TABLEAU TECHNIQUE
          ================================================================ */}

      <section
        className="company-infrastructure-panel"
      >
        <div
          className="company-infrastructure-panel-heading"
        >
          <div>
            <CircuitBoard
              aria-hidden="true"
            />

            <span>
              <strong>
                État technique détaillé
              </strong>

              <small>
                Valeurs brutes utiles au diagnostic.
              </small>
            </span>
          </div>
        </div>


        <div
          className="company-infrastructure-table-wrapper"
        >
          <table
            className="company-infrastructure-table"
          >
            <thead>
              <tr>
                <th>
                  Nœud
                </th>

                <th>
                  IP
                </th>

                <th>
                  Communication
                </th>

                <th>
                  Câble physique
                </th>

                <th>
                  API locale
                </th>

                <th>
                  Site / client
                </th>

                <th>
                  Dernier contact
                </th>
              </tr>
            </thead>

            <tbody>
              {
                sortedControllers.map(
                  (
                    controller,
                  ) => (
                    <tr
                      key={
                        controller.ip
                      }
                    >
                      <td>
                        <strong>
                          {
                            controllerTypeLabel(
                              controller,
                            )
                          }
                        </strong>
                      </td>

                      <td>
                        <code>
                          {
                            controller.ip
                          }
                        </code>
                      </td>

                      <td>
                        <StatusBadge
                          label={
                            controller.status ===
                              'ONLINE'
                              ? 'En ligne'
                              : 'Hors ligne'
                          }
                          tone={
                            controller.status ===
                              'ONLINE'
                              ? 'online'
                              : 'offline'
                          }
                        />
                      </td>

                      <td>
                        <StatusBadge
                          label={
                            physicalLinkLabel(
                              controller,
                            )
                          }
                          tone={
                            physicalLinkState(
                              controller,
                            ) ===
                              'CONNECTED'
                              ? 'online'
                              : physicalLinkState(
                                  controller,
                                ) ===
                                  'DISCONNECTED'
                                ? 'offline'
                                : 'neutral'
                          }
                        />
                      </td>

                      <td>
                        <StatusBadge
                          label={
                            localApiLabel(
                              controller,
                            )
                          }
                          tone={
                            localApiStatus(
                              controller,
                            ) ===
                              'REACHABLE'
                              ? 'online'
                              : localApiStatus(
                                  controller,
                                ) ===
                                  'UNREACHABLE'
                                ? 'offline'
                                : 'neutral'
                          }
                        />
                      </td>

                      <td>
                        {
                          controller.assigned
                            ? (
                              <span>
                                {
                                  controller.siteName
                                  ??
                                  'Site'
                                }
                                <br />
                                <small>
                                  {
                                    controller.customerName
                                    ??
                                    'Client'
                                  }
                                </small>
                              </span>
                            )
                            : (
                              <span
                                className="company-infrastructure-unassigned"
                              >
                                Non attribué
                              </span>
                            )
                        }
                      </td>

                      <td>
                        {
                          formatDate(
                            controller.lastSeen,
                          )
                        }
                      </td>
                    </tr>
                  ),
                )
              }
            </tbody>
          </table>
        </div>
      </section>


      {/* ================================================================
          JOURNAL DE SESSION
          ================================================================ */}

      <section
        className="company-infrastructure-panel"
      >
        <div
          className="company-infrastructure-panel-heading"
        >
          <div>
            <Clock3
              aria-hidden="true"
            />

            <span>
              <strong>
                Changements observés pendant cette session
              </strong>

              <small>
                Journal local au navigateur — non persistant.
              </small>
            </span>
          </div>


          {
            sessionEvents.length >
              0
              &&
              (
                <button
                  type="button"
                  className="company-infrastructure-clear-log"
                  onClick={
                    () =>
                      setSessionEvents(
                        [],
                      )
                  }
                >
                  Effacer l&apos;affichage
                </button>
              )
          }
        </div>


        {
          sessionEvents.length ===
            0
            ? (
              <div
                className="company-infrastructure-empty-log"
              >
                <Activity
                  aria-hidden="true"
                />

                <span>
                  Aucun changement détecté depuis l&apos;ouverture de la page.
                </span>
              </div>
            )
            : (
              <div
                className="company-infrastructure-session-log"
              >
                {
                  sessionEvents.map(
                    (
                      event,
                    ) => (
                      <article
                        key={
                          event.id
                        }
                      >
                        <span
                          className={
                            (
                              'company-infrastructure-event-dot '
                              +
                              (
                                event.type.includes(
                                  'OFFLINE',
                                )
                                ||
                                event.type ===
                                  'CABLE_DISCONNECTED'
                                ||
                                event.type ===
                                  'COMPONENT_DISABLED'
                                  ? 'is-offline'
                                  : 'is-online'
                              )
                            )
                          }
                        />

                        <div>
                          <strong>
                            {
                              event.message
                            }
                          </strong>

                          <span>
                            {
                              formatDate(
                                event.createdAt,
                              )
                            }
                            {' · '}
                            {
                              event.controllerIp
                            }
                          </span>
                        </div>
                      </article>
                    ),
                  )
                }
              </div>
            )
        }
      </section>
    </main>
  )
}


// =========================================================================
// NŒUD PRINCIPAL DE LA TOPOLOGIE
// =========================================================================

function InfrastructureCoreNode(
  {
    icon:
      Icon,

    title,
    subtitle,
    stateLabel,
    tone,
  }:
  {
    icon:
      LucideIcon

    title:
      string

    subtitle:
      string

    stateLabel:
      string

    tone:
      'online' | 'offline' | 'neutral'
  },
) {

  return (
    <article
      className={
        (
          'company-infrastructure-core-node '
          +
          `is-${tone}`
        )
      }
    >
      <div
        className="company-infrastructure-node-icon"
      >
        <Icon
          aria-hidden="true"
        />
      </div>

      <div>
        <strong>
          {
            title
          }
        </strong>

        <code>
          {
            subtitle
          }
        </code>

        <span>
          {
            stateLabel
          }
        </span>
      </div>
    </article>
  )
}


// =========================================================================
// CARTE RASPBERRY DANS LA TOPOLOGIE
// =========================================================================

function ControllerTopologyCard(
  {
    controller,
  }:
  {
    controller:
      CompanyController
  },
) {

  const linkState =
    linkVisualState(
      controller,
    )


  return (
    <article
      className={
        (
          'company-infrastructure-controller-card '
          +
          `link-${linkState.toLowerCase()}`
        )
      }
    >
      <div
        className="company-infrastructure-controller-link"
        aria-label={
          linkVisualLabel(
            linkState,
          )
        }
      >
        <span>
          {
            linkVisualLabel(
              linkState,
            )
          }
        </span>
      </div>


      <div
        className="company-infrastructure-controller-card-header"
      >
        <div
          className="company-infrastructure-controller-icon"
        >
          <Cpu
            aria-hidden="true"
          />
        </div>

        <div>
          <div>
            <strong>
              {
                controllerTypeLabel(
                  controller,
                )
              }
            </strong>

            <StatusBadge
              label={
                controller.status ===
                  'ONLINE'
                  ? 'En ligne'
                  : 'Hors ligne'
              }
              tone={
                controller.status ===
                  'ONLINE'
                  ? 'online'
                  : 'offline'
              }
            />
          </div>

          <code>
            {
              controller.ip
            }
          </code>
        </div>
      </div>


      <div
        className="company-infrastructure-controller-network"
      >
        <div>
          {
            physicalLinkState(
              controller,
            ) ===
              'CONNECTED'
              ? (
                <Plug
                  aria-hidden="true"
                />
              )
              : physicalLinkState(
                  controller,
                ) ===
                  'DISCONNECTED'
                ? (
                  <Unplug
                    aria-hidden="true"
                  />
                )
                : (
                  <Cable
                    aria-hidden="true"
                  />
                )
          }

          <span>
            <strong>
              {
                physicalLinkLabel(
                  controller,
                )
              }
            </strong>

            <small>
              {
                controller.networkInterface
                ??
                'Interface réseau inconnue'
              }
              {' · '}
              {
                controller.networkMedium
                ??
                'RJ45 attendu'
              }
            </small>
          </span>
        </div>


        <div>
          <Network
            aria-hidden="true"
          />

          <span>
            <strong>
              {
                localApiLabel(
                  controller,
                )
              }
            </strong>

            <small>
              {
                controller.linkSpeedMbps !==
                  null
                &&
                controller.linkSpeedMbps !==
                  undefined
                  ? `${controller.linkSpeedMbps} Mb/s`
                  : 'Débit non télémétré'
              }
            </small>
          </span>
        </div>
      </div>


      <div
        className="company-infrastructure-controller-assignment"
      >
        <span>
          Site
        </span>

        <strong>
          {
            controller.assigned
              ? (
                controller.siteName
                ??
                'Site attribué'
              )
              : 'Non attribué'
          }
        </strong>

        <small>
          {
            controller.assigned
              ? (
                controller.customerName
                ??
                'Client rattaché'
              )
              : 'Disponible pour une installation'
          }
        </small>
      </div>


      <div
        className="company-infrastructure-components"
      >
        <div
          className="company-infrastructure-components-heading"
        >
          <span>
            Composants déclarés
          </span>

          <strong>
            {
              controller.components.length
            }
          </strong>
        </div>


        {
          controller.components.length ===
            0
            ? (
              <div
                className="company-infrastructure-no-component"
              >
                Aucun composant déclaré dans le heartbeat.
              </div>
            )
            : (
              controller.components.map(
                (
                  component,
                ) => {

                  const Icon =
                    componentIcon(
                      component,
                    )


                  return (
                    <div
                      className="company-infrastructure-component-row"
                      key={
                        component.id
                      }
                    >
                      <Icon
                        aria-hidden="true"
                      />

                      <span>
                        <strong>
                          {
                            componentLabel(
                              component,
                            )
                          }
                        </strong>

                        <small>
                          {
                            component.enabled
                              ? 'Activé'
                              : 'Désactivé'
                          }
                          {' · '}
                          {
                            component.status ===
                              'ONLINE'
                              ? 'En ligne'
                              : 'Hors ligne'
                          }
                        </small>
                      </span>

                      <span
                        className={
                          (
                            'company-infrastructure-small-dot '
                            +
                            (
                              component.status ===
                                'ONLINE'
                                ? 'is-online'
                                : 'is-offline'
                            )
                          )
                        }
                        aria-hidden="true"
                      />
                    </div>
                  )
                },
              )
            )
        }
      </div>


      <div
        className="company-infrastructure-controller-footer"
      >
        <Clock3
          aria-hidden="true"
        />

        <span>
          Dernier heartbeat :
          {' '}
          {
            formatDate(
              controller.lastSeen,
            )
          }
        </span>
      </div>
    </article>
  )
}


// =========================================================================
// BADGE D'ÉTAT
// =========================================================================

function StatusBadge(
  {
    label,
    tone,
  }:
  {
    label:
      string

    tone:
      'online' | 'offline' | 'degraded' | 'neutral'
  },
) {

  return (
    <span
      className={
        (
          'company-infrastructure-status-badge '
          +
          `is-${tone}`
        )
      }
    >
      <span
        aria-hidden="true"
      />

      {
        label
      }
    </span>
  )
}


// =========================================================================
// ÉLÉMENT DE LÉGENDE
// =========================================================================

function LegendItem(
  {
    tone,
    icon:
      Icon,
    title,
    description,
  }:
  {
    tone:
      'online' | 'offline' | 'degraded' | 'neutral'

    icon:
      LucideIcon

    title:
      string

    description:
      string
  },
) {

  return (
    <article
      className={
        (
          'company-infrastructure-legend-item '
          +
          `is-${tone}`
        )
      }
    >
      <div>
        <Icon
          aria-hidden="true"
        />
      </div>

      <span>
        <strong>
          {
            title
          }
        </strong>

        <small>
          {
            description
          }
        </small>
      </span>
    </article>
  )
}


export default CompanyInfrastructurePage
