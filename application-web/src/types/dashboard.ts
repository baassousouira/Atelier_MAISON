// dashboard.ts

// -----------------------------------------------------------------------
// Ce fichier contient uniquement des TYPES TypeScript.
//
// Les types n'inventent aucune donnée.
//
// Ils décrivent le contrat entre :
//
// FastAPI
//    ↓
// React
// -----------------------------------------------------------------------


// =========================================================================
// TYPES D'ÉQUIPEMENTS
// =========================================================================

export type EquipmentKind =
  | 'CAMERA'
  | 'ROBOT_CAMERA'
  | 'PHOTORESISTOR'
  | 'MOTION_SENSOR'
  | 'BUTTON'
  | 'LED'
  | 'SERVO'
  | 'ROBOT'
  | 'OTHER'


// =========================================================================
// CATÉGORIE
// =========================================================================
//
// La catégorie n'est pas choisie manuellement.
//
// FastAPI applique simplement :
//
// has_servo = true
//        ↓
//      MOBILE
//
// has_servo = false
//        ↓
//      FIXED
// =========================================================================

export type EquipmentGroupKind =
  | 'FIXED'
  | 'MOBILE'


// =========================================================================
// ÉTAT RÉSEAU
// =========================================================================

export type EquipmentStatus =
  | 'ONLINE'
  | 'OFFLINE'


// =========================================================================
// ÉQUIPEMENT
// =========================================================================
//
// C'est exactement le format renvoyé par :
//
// GET /api/equipements
// =========================================================================

export type Equipment = {

  id:
    string

  name:
    string

  location:
    string

  // Identifiant du Raspberry responsable.
  //
  // Actuellement il correspond à son IP.
  //
  // React ne doit PAS l'utiliser
  // pour envoyer directement des requêtes.

  controllerId:
    string

  kind:
    EquipmentKind

  status:
    EquipmentStatus

  // État réel transmis par le Raspberry.

  enabled:
    boolean

  // true si notre API sait envoyer une commande
  // à cet équipement.

  controllable:
    boolean

  // Valeur éventuelle.
  //
  // Exemple :
  //
  // photorésistance -> "632"

  value?:
    string

  lastSeen:
    string

  groupId:
    string

  groupName:
    string

  groupDescription:
    string

  groupKind:
    EquipmentGroupKind

  groupOrder?:
    number

  displayOrder?:
    number

  // URL du flux SERVEUR CENTRAL.
  //
  // Jamais URL directe du Raspberry.

  streamUrl?:
    string

  parentDeviceId?:
    string
}


// =========================================================================
// ÉTAT GLOBAL
// =========================================================================

export type SystemState = {

  armed:
    boolean
}


// =========================================================================
// ÉVÉNEMENTS FASTAPI / SQLITE
// =========================================================================

export type BackendDecision =
  | 'en_attente'
  | 'fausse_alerte'
  | 'vraie_alerte'


export type BackendEvent = {

  id:
    string

  capteur:
    string

  zone:
    string

  horodatage:
    number

  decision:
    BackendDecision

  horodatage_decision:
    number | null
}


// =========================================================================
// ALERTES
// =========================================================================

export type AlertStatus =
  | 'ACTIVE'
  | 'RESOLVED'


export type SecurityAlert = {

  id:
    string

  title:
    string

  description:
    string

  location:
    string

  detectedAt:
    string

  sourceSensor:
    string

  cameraId?:
    string

  confidence?:
    number

  status:
    AlertStatus
}


// =========================================================================
// HISTORIQUE
// =========================================================================

export type EventStatus =
  | 'SUCCESS'
  | 'WARNING'
  | 'INFO'


export type HistoryCategory =
  | 'ALERT'
  | 'COMMAND'
  | 'SYSTEM'
  | 'MEDIA'


export type HistoryEvent = {

  id:
    string

  timestamp:
    string

  title:
    string

  description:
    string

  actor:
    string

  category:
    HistoryCategory

  status:
    EventStatus
}


// =========================================================================
// STATISTIQUES
// =========================================================================

export type MotionActivityPoint = {

  day:
    string

  detections:
    number

  alertes:
    number
}


export type AvailabilityPoint = {

  day:
    string

  disponibilite:
    number
}


export type StatisticsPeriod =
  | '7D'
  | '30D'
  | '90D'


export type StatisticsData = {

  period:
    StatisticsPeriod

  motionActivity:
    MotionActivityPoint[]

  availabilityActivity:
    AvailabilityPoint[]

  averageResponseTime:
    number | null
}


// =========================================================================
// MÉDIAS
// =========================================================================

export type MediaKind =
  | 'SCREENSHOT'
  | 'VIDEO'


export type MediaItem = {

  id:
    string

  cameraId:
    string

  cameraName:
    string

  kind:
    MediaKind

  createdAt:
    string

  expiresAt:
    string

  saved:
    boolean

  mediaUrl?:
    string
}


// =========================================================================
// CONNEXION REACT -> SERVEUR CENTRAL
// =========================================================================

export type ServerConnectionStatus =
  | 'CHECKING'
  | 'CONNECTED'
  | 'DISCONNECTED'


export type ServerConnection = {

  status:
    ServerConnectionStatus

  lastContact:
    string

  failedChecks:
    number
}


// =========================================================================
// INCIDENT RÉSEAU
// =========================================================================

export type NetworkIncident = {

  id:
    string

  detectedAt:
    string

  reason:
    string

  dismissed:
    boolean
}