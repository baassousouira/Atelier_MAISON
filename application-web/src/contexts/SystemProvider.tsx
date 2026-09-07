// SystemProvider.tsx

// -----------------------------------------------------------------------
// ÉTAT GLOBAL RÉEL DE L'APPLICATION
// -----------------------------------------------------------------------
//
// Ce Provider communique réellement avec FastAPI.
//
// Il ne contient aucune donnée de démonstration.
//
// Toutes les pages utilisent ensuite useSystem().
// -----------------------------------------------------------------------


import {
  useCallback,
  useEffect,
  useState,
} from 'react'


import type {
  ReactNode,
} from 'react'


import {
  getEquipments,
  getEvents,
  getMedia,
  getSystemState,
  pingServer,
  requestScreenshot,
  sendEventDecision,
  sendRobotMovement,
  setEquipmentEnabled,
  setMediaSaved,
  setSecurityArmed,
} from '../services/systemApi'


import type {
  BackendDecision,
  BackendEvent,
  Equipment,
  HistoryEvent,
  MediaItem,
  NetworkIncident,
  SecurityAlert,
  ServerConnection,
  StatisticsData,
  StatisticsPeriod,
} from '../types/dashboard'


import {
  SystemContext,
} from './system-context'


// =========================================================================
// PROPS
// =========================================================================

type SystemProviderProps = {

  children:
    ReactNode
}


// =========================================================================
// STATISTIQUES INITIALES
// =========================================================================

const EMPTY_STATISTICS:
  StatisticsData = {

    period:
      '7D',

    motionActivity:
      [],

    availabilityActivity:
      [],

    averageResponseTime:
      null,
  }


// =========================================================================
// FORMAT DATE BACKEND
// =========================================================================

function formatUnixDate(
  timestamp:
    number,
): string {

  return new Date(
    timestamp * 1000,
  ).toLocaleString(
    'fr-FR',
    {
      day:
        '2-digit',

      month:
        '2-digit',

      year:
        'numeric',

      hour:
        '2-digit',

      minute:
        '2-digit',

      second:
        '2-digit',

      hour12:
        false,
    },
  )
}


function currentDateTime():
  string {

  return new Date()
    .toLocaleString(
      'fr-FR',
      {
        day:
          '2-digit',

        month:
          '2-digit',

        year:
          'numeric',

        hour:
          '2-digit',

        minute:
          '2-digit',

        second:
          '2-digit',

        hour12:
          false,
      },
    )
}


// =========================================================================
// HISTORIQUE
// =========================================================================

function eventTitle(
  event:
    BackendEvent,
): string {

  if (
    event.decision ===
    'vraie_alerte'
  ) {

    return (
      'Vraie alerte confirmée'
    )
  }


  if (
    event.decision ===
    'fausse_alerte'
  ) {

    return (
      'Fausse alerte confirmée'
    )
  }


  return (
    'Alerte en attente'
  )
}


function eventStatus(
  event:
    BackendEvent,
): HistoryEvent['status'] {

  if (
    event.decision ===
    'fausse_alerte'
  ) {

    return 'INFO'
  }


  return 'WARNING'
}


function toHistoryEvent(
  event:
    BackendEvent,
): HistoryEvent {

  return {

    id:
      event.id,

    timestamp:
      formatUnixDate(
        event.horodatage,
      ),

    title:
      eventTitle(
        event,
      ),

    description:
      (
        `Capteur : ${event.capteur}`
        + ` · Zone : ${event.zone}`
        + ` · Décision : ${event.decision}.`
      ),

    actor:
      'Serveur central',

    category:
      'ALERT',

    status:
      eventStatus(
        event,
      ),
  }
}


// =========================================================================
// ALERTE ACTIVE
// =========================================================================

function toSecurityAlert(
  event:
    BackendEvent,
): SecurityAlert {

  return {

    id:
      event.id,

    title:
      'Événement de surveillance détecté',

    description:
      (
        'Le serveur central a reçu '
        + `un événement du capteur « ${event.capteur} ».`
      ),

    location:
      event.zone,

    detectedAt:
      formatUnixDate(
        event.horodatage,
      ),

    sourceSensor:
      event.capteur,

    status:
      'ACTIVE',
  }
}


// =========================================================================
// STATISTIQUES
// =========================================================================

function numberOfDays(
  period:
    StatisticsPeriod,
): number {

  if (
    period === '30D'
  ) {

    return 30
  }


  if (
    period === '90D'
  ) {

    return 90
  }


  return 7
}


function dateKey(
  date:
    Date,
): string {

  const year =
    date.getFullYear()


  const month =
    String(
      date.getMonth() + 1,
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


function dayLabel(
  date:
    Date,

  period:
    StatisticsPeriod,
): string {

  if (
    period === '7D'
  ) {

    return date
      .toLocaleDateString(
        'fr-FR',
        {
          weekday:
            'short',
        },
      )
      .replace(
        '.',
        '',
      )
  }


  return date
    .toLocaleDateString(
      'fr-FR',
      {
        day:
          '2-digit',

        month:
          '2-digit',
      },
    )
}


function buildStatistics(
  events:
    BackendEvent[],

  period:
    StatisticsPeriod,
): StatisticsData {

  const days =
    numberOfDays(
      period,
    )


  const now =
    new Date()


  const firstDay =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
        - (
          days - 1
        ),
    )


  const counts =
    new Map<
      string,
      {
        detections:
          number

        alertes:
          number
      }
    >()


  for (
    const event
    of events
  ) {

    const eventDate =
      new Date(
        event.horodatage
          * 1000,
      )


    if (
      eventDate <
      firstDay
    ) {

      continue
    }


    const key =
      dateKey(
        eventDate,
      )


    const current =
      counts.get(
        key,
      ) ?? {
        detections:
          0,

        alertes:
          0,
      }


    current.detections +=
      1


    if (
      event.decision ===
      'vraie_alerte'
    ) {

      current.alertes +=
        1
    }


    counts.set(
      key,
      current,
    )
  }


  const motionActivity =
    Array.from(
      {
        length:
          days,
      },

      (
        _,
        index,
      ) => {

        const date =
          new Date(
            firstDay.getFullYear(),
            firstDay.getMonth(),
            firstDay.getDate()
              + index,
          )


        const countsForDay =
          counts.get(
            dateKey(
              date,
            ),
          ) ?? {
            detections:
              0,

            alertes:
              0,
          }


        return {

          day:
            dayLabel(
              date,
              period,
            ),

          detections:
            countsForDay.detections,

          alertes:
            countsForDay.alertes,
        }
      },
    )


  const responseTimes =
    events
      .filter(
        (
          event,
        ) =>
          event.horodatage_decision
            !== null
          &&
          event.horodatage_decision
            >= event.horodatage,
      )
      .map(
        (
          event,
        ) =>
          (event.horodatage_decision as number)
          - event.horodatage,
      )


  const averageResponseTime =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce(
            (
              sum,
              value,
            ) =>
              sum + value,
            0,
          )
          /
          responseTimes.length,
        )
      : null


  return {

    period,

    motionActivity,

    // La disponibilité réseau nécessitera
    // un véritable historique de heartbeat.
    //
    // On ne fabrique donc pas encore ces nombres.

    availabilityActivity:
      [],

    averageResponseTime,
  }
}


// =========================================================================
// PROVIDER
// =========================================================================

export function SystemProvider({
  children,
}: SystemProviderProps) {


  const [
    isArmed,
    setIsArmed,
  ] =
    useState(
      false,
    )


  const [
    equipment,
    setEquipment,
  ] =
    useState<
      Equipment[]
    >(
      [],
    )


  const [
    rawEvents,
    setRawEvents,
  ] =
    useState<
      BackendEvent[]
    >(
      [],
    )


  const [
    activeAlert,
    setActiveAlert,
  ] =
    useState<
      SecurityAlert |
      null
    >(
      null,
    )


  const [
    media,
    setMedia,
  ] =
    useState<
      MediaItem[]
    >(
      [],
    )


  const [
    history,
    setHistory,
  ] =
    useState<
      HistoryEvent[]
    >(
      [],
    )


  const [
    statistics,
    setStatistics,
  ] =
    useState<
      StatisticsData
    >(
      EMPTY_STATISTICS,
    )


  const [
    statisticsLoading,
    setStatisticsLoading,
  ] =
    useState(
      false,
    )


  const [
    feedback,
    setFeedback,
  ] =
    useState(
      '',
    )


  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    )


  const [
    dataError,
    setDataError,
  ] =
    useState(
      '',
    )


  const [
    serverConnection,
    setServerConnection,
  ] =
    useState<
      ServerConnection
    >(
      {
        status:
          'CHECKING',

        lastContact:
          'Aucun contact confirmé',

        failedChecks:
          0,
      },
    )


  const [
    networkIncident,
    setNetworkIncident,
  ] =
    useState<
      NetworkIncident |
      null
    >(
      null,
    )


  // =========================================================================
  // SERVEUR CONNECTÉ
  // =========================================================================

  const markConnected =
    useCallback(
      () => {

        setServerConnection(
          {
            status:
              'CONNECTED',

            lastContact:
              currentDateTime(),

            failedChecks:
              0,
          },
        )
      },
      [],
    )


  // =========================================================================
  // INCIDENT
  // =========================================================================

  const createIncident =
    useCallback(
      (
        reason:
          string,
      ) => {

        setNetworkIncident(
          (
            current,
          ) => {

            // Si le même incident existe déjà,
            // on conserve notamment son état dismissed.

            if (
              current
              &&
              current.reason === reason
            ) {

              return current
            }


            return {

              id:
                `network-${Date.now()}`,

              detectedAt:
                currentDateTime(),

              reason,

              dismissed:
                false,
            }
          },
        )
      },
      [],
    )


  const markDisconnected =
    useCallback(
      (
        reason:
          string,
      ) => {

        setServerConnection(
          (
            current,
          ) => ({
            status:
              'DISCONNECTED',

            lastContact:
              current.lastContact,

            failedChecks:
              current.failedChecks
              + 1,
          }),
        )


        createIncident(
          reason,
        )
      },
      [
        createIncident,
      ],
    )


  // =========================================================================
  // APPLICATION DES ÉVÉNEMENTS
  // =========================================================================

  const applyEvents =
    useCallback(
      (
        events:
          BackendEvent[],
      ) => {

        setRawEvents(
          events,
        )


        setHistory(
          events.map(
            toHistoryEvent,
          ),
        )


        const pending =
          events.find(
            (
              event,
            ) =>
              event.decision ===
              'en_attente',
          )


        setActiveAlert(
          pending
            ? toSecurityAlert(
                pending,
              )
            : null,
        )


        setStatistics(
          (
            current,
          ) =>
            buildStatistics(
              events,
              current.period,
            ),
        )
      },
      [],
    )


  // =========================================================================
  // INCIDENT RASPBERRY OFFLINE
  // =========================================================================

  const updateEquipmentIncident =
    useCallback(
      (
        equipments:
          Equipment[],
      ) => {

        const offlineControllers =
          Array.from(
            new Set(
              equipments
                .filter(
                  (
                    item,
                  ) =>
                    item.status ===
                    'OFFLINE',
                )
                .map(
                  (
                    item,
                  ) =>
                    item.controllerId,
                ),
            ),
          )


        if (
          offlineControllers.length === 0
        ) {

          // Tout répond :
          // aucun incident réseau actif.

          setNetworkIncident(
            null,
          )


          return
        }


        createIncident(
          (
            'Connexion interrompue avec : '
            + offlineControllers.join(
                ', ',
              )
            + '.'
          ),
        )
      },
      [
        createIncident,
      ],
    )


  // =========================================================================
  // RECHARGEMENT COMPLET
  // =========================================================================

  const refreshSystemData =
    useCallback(
      async ():
        Promise<boolean> => {

        try {

          // Les quatre appels sont indépendants.
          //
          // Promise.all permet de les exécuter
          // en parallèle.

          const [
            systemState,
            equipments,
            events,
            mediaItems,
          ] =
            await Promise.all(
              [
                getSystemState(),
                getEquipments(),
                getEvents(),
                getMedia(),
              ],
            )


          setIsArmed(
            systemState.armed,
          )


          setEquipment(
            equipments,
          )


          setMedia(
            mediaItems,
          )


          applyEvents(
            events,
          )


          markConnected()


          updateEquipmentIncident(
            equipments,
          )


          setDataError(
            '',
          )


          return true

        } catch (
          error
        ) {

          const message =
            error instanceof Error
              ? error.message
              : (
                  'Erreur inconnue.'
                )


          setDataError(
            message,
          )


          markDisconnected(
            (
              'L’application ne reçoit plus '
              + 'correctement les données '
              + 'du serveur central.'
            ),
          )


          return false
        }
      },
      [
        applyEvents,
        markConnected,
        markDisconnected,
        updateEquipmentIncident,
      ],
    )


  // =========================================================================
  // PREMIER CHARGEMENT + POLLING
  // =========================================================================

  useEffect(
    () => {

      let cancelled =
        false


      async function firstLoad() {

        await refreshSystemData()


        if (
          !cancelled
        ) {

          setIsLoading(
            false,
          )
        }
      }


      void firstLoad()


      // Toutes les 2 secondes :
      //
      // React relit réellement FastAPI.
      //
      // Plus tard un WebSocket pourra remplacer
      // ou compléter ce polling.

      const interval =
        window.setInterval(
          () => {

            void refreshSystemData()
          },

          2000,
        )


      return () => {

        cancelled =
          true


        window.clearInterval(
          interval,
        )
      }
    },
    [
      refreshSystemData,
    ],
  )


  // =========================================================================
  // HEALTH CHECK
  // =========================================================================

  const checkServerConnection =
    useCallback(
      async ():
        Promise<boolean> => {

        try {

          await pingServer()


          markConnected()


          return true

        } catch {

          markDisconnected(
            (
              'Le serveur central '
              + 'ne répond plus.'
            ),
          )


          return false
        }
      },
      [
        markConnected,
        markDisconnected,
      ],
    )


    // =========================================================================
    // RÉTABLIR CONNEXION
    // =========================================================================
    //
    // Cette fonction est utilisée par :
    //
    // - le bouton "Réessayer" de l'interface ;
    // - le bouton "Vérifier à nouveau" de la popup.
    //
    // On ne se contente pas de changer l'état React.
    //
    // On vérifie réellement :
    //
    // 1. est-ce que FastAPI répond à GET /health ?
    // 2. si oui, peut-on récupérer les données du système ?
    //
    // =========================================================================

    async function restoreConnection():
    Promise<void> {

    // ---------------------------------------------------------------
    // Si l'utilisateur avait précédemment fermé la popup,
    // un clic explicite sur "Réessayer" signifie qu'il souhaite
    // effectuer une nouvelle tentative.
    //
    // On autorise donc l'incident à réapparaître pendant le contrôle.
    // ---------------------------------------------------------------

    setNetworkIncident(
        (
        current,
        ) => {

        if (
            !current
        ) {

            return null
        }


        return {
            ...current,

            dismissed:
            false,
        }
        },
    )


    // ---------------------------------------------------------------
    // ÉTAT : VÉRIFICATION EN COURS
    // ---------------------------------------------------------------

    setServerConnection(
        (
        current,
        ) => ({
        ...current,

        status:
            'CHECKING',
        }),
    )


    setFeedback(
        'Vérification de la connexion en cours...',
    )


    // ---------------------------------------------------------------
    // ÉTAPE 1 :
    // vérifier uniquement que FastAPI répond.
    //
    // checkServerConnection() appelle réellement pingServer(),
    // donc GET /api/health.
    // ---------------------------------------------------------------

    const serverAvailable =
        await checkServerConnection()


    if (
        !serverAvailable
    ) {

        setFeedback(
        'Le serveur central ne répond toujours pas.',
        )


        return
    }


    // ---------------------------------------------------------------
    // ÉTAPE 2 :
    // FastAPI répond.
    //
    // On recharge maintenant toutes les données :
    //
    // GET /system
    // GET /equipements
    // GET /evenements
    // GET /media
    // ---------------------------------------------------------------

    const dataAvailable =
        await refreshSystemData()


    if (
        dataAvailable
    ) {

        setFeedback(
        'Connexion au serveur rétablie. Données actualisées.',
        )

        return
    }


    // FastAPI avait répondu au health check,
    // mais au moins une route de données a échoué.

    setFeedback(
        (
        'Le serveur central répond, '
        + 'mais certaines données restent indisponibles.'
        ),
    )
    }


  // =========================================================================
  // FERMER POPUP INCIDENT
  // =========================================================================

  function dismissNetworkIncident():
    void {

    setNetworkIncident(
      (
        current,
      ) => {

        if (!current) {

          return null
        }


        return {
          ...current,

          dismissed:
            true,
        }
      },
    )
  }


  function clearFeedback():
    void {

    setFeedback(
      '',
    )
  }


  // =========================================================================
  // DÉCISION ALERTE
  // =========================================================================

  async function answerAlert(
    decision:
      Exclude<
        BackendDecision,
        'en_attente'
      >,
  ): Promise<void> {

    if (!activeAlert) {

      return
    }


    try {

      await sendEventDecision(
        activeAlert.id,
        decision,
      )


      setFeedback(
        decision ===
          'vraie_alerte'
          ? (
              'Vraie alerte enregistrée.'
            )
          : (
              'Fausse alerte enregistrée.'
            ),
      )


      await refreshSystemData()

    } catch (
      error
    ) {

      setFeedback(
        error instanceof Error
          ? error.message
          : (
              "Impossible d'enregistrer "
              + "la décision."
            ),
      )
    }
  }


    // =========================================================================
    // STATISTIQUES
    // =========================================================================
    //
    // IMPORTANT :
    //
    // UserStatisticspage utilise loadStatistics dans un useEffect.
    //
    // La fonction doit donc conserver la même référence entre les rendus
    // tant que les événements bruts n'ont pas changé.
    //
    // Sans useCallback(), chaque setState du Provider recréait
    // loadStatistics(), ce qui pouvait relancer en boucle le useEffect
    // de la page Statistiques.
    // =========================================================================

    const loadStatistics =
    useCallback(
        async (
        period:
            StatisticsPeriod,
        ): Promise<void> => {

        setStatisticsLoading(
            true,
        )


        try {

            setStatistics(
            buildStatistics(
                rawEvents,
                period,
            ),
            )

        } finally {

            setStatisticsLoading(
            false,
            )
        }
        },
        [
        rawEvents,
        ],
    )


  // =========================================================================
  // ACTIVATION GLOBALE
  // =========================================================================

  async function toggleSecuritySystem():
    Promise<void> {

    try {

      const newState =
        !isArmed


      const response =
        await setSecurityArmed(
          newState,
        )


      setIsArmed(
        response.armed,
      )


      setFeedback(
        response.armed
          ? (
              'Surveillance activée.'
            )
          : (
              'Surveillance désactivée.'
            ),
      )


      await refreshSystemData()

    } catch (
      error
    ) {

      setFeedback(
        error instanceof Error
          ? error.message
          : (
              'Impossible de modifier '
              + 'la surveillance.'
            ),
      )
    }
  }


  // =========================================================================
  // ACTIVATION ÉQUIPEMENT
  // =========================================================================

  async function toggleEquipment(
    equipmentId:
      string,
  ): Promise<void> {

    const target =
      equipment.find(
        (
          item,
        ) =>
          item.id ===
          equipmentId,
      )


    if (!target) {

      setFeedback(
        'Équipement introuvable.',
      )

      return
    }


    if (
      target.status ===
      'OFFLINE'
    ) {

      setFeedback(
        (
          'Impossible de commander '
          + 'un équipement hors ligne.'
        ),
      )

      return
    }


    try {

      await setEquipmentEnabled(
        target.id,
        !target.enabled,
      )


      setFeedback(
        !target.enabled
          ? (
              `${target.name} activé.`
            )
          : (
              `${target.name} désactivé.`
            ),
      )


      // On relit le vrai état serveur
      // au lieu de modifier seulement React.

      await refreshSystemData()

    } catch (
      error
    ) {

      setFeedback(
        error instanceof Error
          ? error.message
          : (
              'Impossible de commander '
              + 'cet équipement.'
            ),
      )
    }
  }


  // =========================================================================
  // ROBOT
  // =========================================================================

  async function sendRobotCommand(
    _robotId:
      string,

    command:
      string,

    speed:
      number,
  ): Promise<void> {

    try {

      // robotId reste dans la signature
      // pour ne pas casser les composants actuels.
      //
      // Le serveur choisit lui-même
      // le Raspberry has_servo=true.

      await sendRobotMovement(
        command,
        speed,
      )


      setFeedback(
        (
          `Commande ${command} `
          + 'envoyée au système mobile.'
        ),
      )

    } catch (
      error
    ) {

      setFeedback(
        error instanceof Error
          ? error.message
          : (
              'Commande robot impossible.'
            ),
      )
    }
  }


  // =========================================================================
  // CAPTURE
  // =========================================================================

  async function takeScreenshot(
    cameraId:
      string,
  ): Promise<void> {

    try {

      const created =
        await requestScreenshot(
          cameraId,
        )


      // La capture vient réellement du serveur.
      //
      // On peut donc l'ajouter immédiatement.

      setMedia(
        (
          current,
        ) => [
          created,
          ...current,
        ],
      )


      setFeedback(
        'Capture enregistrée.',
      )

    } catch (
      error
    ) {

      setFeedback(
        error instanceof Error
          ? error.message
          : (
              'Impossible de prendre '
              + 'une capture.'
            ),
      )
    }
  }


  // =========================================================================
  // CONSERVATION MÉDIA
  // =========================================================================

  async function toggleMediaSaved(
    mediaId:
      string,
  ): Promise<void> {

    const target =
      media.find(
        (
          item,
        ) =>
          item.id ===
          mediaId,
      )


    if (!target) {

      return
    }


    try {

      await setMediaSaved(
        target.id,
        !target.saved,
      )


      await refreshSystemData()

    } catch (
      error
    ) {

      setFeedback(
        error instanceof Error
          ? error.message
          : (
              'Impossible de modifier '
              + 'ce média.'
            ),
      )
    }
  }


  // =========================================================================
  // SOURCES DE DÉTECTION ACTIVES
  // =========================================================================

  const detectionKinds = [
    'CAMERA',
    'ROBOT_CAMERA',
    'PHOTORESISTOR',
    'MOTION_SENSOR',
  ]


  const activeDetectionSourceIds =
    equipment
      .filter(
        (
          item,
        ) =>
          item.enabled
          &&
          item.status ===
            'ONLINE'
          &&
          detectionKinds.includes(
            item.kind,
          ),
      )
      .map(
        (
          item,
        ) =>
          item.id,
      )


  // =========================================================================
  // CONTEXTE
  // =========================================================================

  return (

    <SystemContext.Provider
      value={{

        isArmed,

        equipment,

        rawEvents,

        activeAlert,

        media,

        history,

        statistics,

        statisticsLoading,

        feedback,

        serverConnection,

        networkIncident,

        isLoading,

        dataError,

        activeDetectionSourceIds,

        refreshSystemData,

        checkServerConnection,

        restoreConnection,

        dismissNetworkIncident,

        clearFeedback,

        answerAlert,

        loadStatistics,

        toggleSecuritySystem,

        toggleEquipment,

        sendRobotCommand,

        takeScreenshot,

        toggleMediaSaved,
      }}
    >

      {children}

    </SystemContext.Provider>
  )
}