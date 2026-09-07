// system-context.ts

// -----------------------------------------------------------------------
// Contrat du contexte global React.
//
// SystemProvider.tsx remplira réellement
// toutes ces valeurs avec FastAPI.
// -----------------------------------------------------------------------


import {
  createContext,
} from 'react'


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


export type SystemContextValue = {

  // Surveillance globale.
  isArmed:
    boolean


  // Matériel déclaré par les Raspberry.
  equipment:
    Equipment[]


  // Événements bruts venant de SQLite.
  rawEvents:
    BackendEvent[]


  // Dernière alerte encore en attente.
  activeAlert:
    SecurityAlert | null


  // Captures réelles.
  media:
    MediaItem[]


  // Historique construit
  // à partir des événements réels.
  history:
    HistoryEvent[]


  statistics:
    StatisticsData


  statisticsLoading:
    boolean


  feedback:
    string


  // Connexion React -> FastAPI.
  serverConnection:
    ServerConnection


  // Peut représenter :
  //
  // - perte du serveur central ;
  // - Raspberry hors ligne.

  networkIncident:
    NetworkIncident | null


  isLoading:
    boolean


  dataError:
    string


  // Composants de détection
  // ONLINE + enabled.

  activeDetectionSourceIds:
    string[]


  refreshSystemData:
    () => Promise<boolean>


  checkServerConnection:
    () => Promise<boolean>


  restoreConnection:
    () => Promise<void>


  dismissNetworkIncident:
    () => void


  clearFeedback:
    () => void


  answerAlert: (
    decision:
      Exclude<
        BackendDecision,
        'en_attente'
      >,
  ) => Promise<void>


  loadStatistics: (
    period:
      StatisticsPeriod,
  ) => Promise<void>


  toggleSecuritySystem:
    () => Promise<void>


  toggleEquipment: (
    equipmentId:
      string,
  ) => Promise<void>


  sendRobotCommand: (
    robotId:
      string,

    command:
      string,

    speed:
      number,
  ) => Promise<void>


  takeScreenshot: (
    cameraId:
      string,
  ) => Promise<void>


  toggleMediaSaved: (
    mediaId:
      string,
  ) => Promise<void>
}


export const SystemContext =
  createContext<
    SystemContextValue |
    undefined
  >(
    undefined,
  )