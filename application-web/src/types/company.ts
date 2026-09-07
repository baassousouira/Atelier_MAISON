// company.ts

// -----------------------------------------------------------------------
// TYPES DE L'ESPACE ENTREPRISE - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Ce fichier contient les structures de données utilisées par le centre
// de supervision et donc le serveur.
//
// Il ne contient :
//
// - aucun appel HTTP ;
// - aucun état React ;
// - aucune logique d'affichage.
//
// Son rôle est uniquement de définir clairement les données manipulées
// par l'espace entreprise.
//
// Cela permet d'avoir le même contrat entre :
//
// FastAPI
//    ↓
// companyApi.ts
//    ↓
// CompanyProvider
//    ↓
// pages / composants React
//
// -----------------------------------------------------------------------


// =========================================================================
// RÔLES ENTREPRISE
// =========================================================================
//
// L'authentification réelle n'est PAS encore mise en place.
//
// Ces rôles préparent simplement la structure future.
//
// Plus tard :
// - ADMIN pourra administrer la plateforme ;
// - SUPERVISOR supervisera les opérateurs ;
// - OPERATOR traitera les alertes ;
// - FIELD_AGENT représentera les intervenants terrain.
// =========================================================================

export type CompanyRole =
  | 'ADMIN'
  | 'SUPERVISOR'
  | 'OPERATOR'
  | 'FIELD_AGENT'


// =========================================================================
// UTILISATEUR INTERNE DE L'ENTREPRISE
// =========================================================================

export type CompanyUserStatus =
  | 'AVAILABLE'
  | 'BUSY'
  | 'OFFLINE'


export type CompanyUser = {
  id:
    string

  firstName:
    string

  lastName:
    string

  email:
    string

  phone?:
    string

  role:
    CompanyRole

  status:
    CompanyUserStatus

  createdAt:
    string

  lastActivityAt?:
    string
}


// =========================================================================
// CLIENT
// =========================================================================
//
// Un client peut posséder plusieurs sites surveillés.
//
// Exemple :
//
// Client
//   ├── résidence principale
//   └── résidence secondaire
//
// Les équipements sont donc rattachés à un SITE,
// et non directement au client.
// =========================================================================

export type CustomerStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'INACTIVE'


export type Customer = {
  id:
    string

  firstName:
    string

  lastName:
    string

  email:
    string

  phone:
    string

  status:
    CustomerStatus

  createdAt:
    string

  notes?:
    string
}


// =========================================================================
// CONTACT D'URGENCE
// =========================================================================

export type EmergencyContact = {
  id:
    string

  customerId:
    string

  firstName:
    string

  lastName:
    string

  relationship:
    string

  phone:
    string

  priority:
    number
}


// =========================================================================
// SITE SURVEILLÉ
// =========================================================================

export type MonitoredSiteStatus =
  | 'ONLINE'
  | 'DEGRADED'
  | 'OFFLINE'


// =========================================================================
// CONTRÔLEURS / RASPBERRY INSTALLÉS
// =========================================================================
//
// Un "contrôleur" correspond ici à un Raspberry.
//
// Le Raspberry constitue le pont entre le serveur central et les composants
// physiques installés dans un logement.
//
// Exemple :
//
// Client
//   └── Site "Maison principale"
//        ├── Raspberry fixe 192.168.1.4
//        │    ├── camera
//        │    └── motion_sensor
//        └── Raspberry mobile 192.168.1.2
//             ├── camera
//             ├── robot
//             └── servo
//
// IMPORTANT :
// L'IP n'est jamais codée en dur dans React. Elle vient toujours de FastAPI.
// =========================================================================

export type CompanyControllerStatus =
  | 'ONLINE'
  | 'OFFLINE'


export type CompanyControllerType =
  | 'FIXED'
  | 'MOBILE'


// =========================================================================
// TÉLÉMÉTRIE RÉSEAU OPTIONNELLE
// =========================================================================
//
// Ces informations sont destinées à la page Entreprise / Infrastructure.
//
// Elles sont OPTIONNELLES afin que le frontend continue de fonctionner avec
// le backend actuel, qui sait déjà fournir ONLINE / OFFLINE via les
// heartbeats mais ne fournit pas encore toutes les données physiques du
// lien Ethernet.
//
// Le prochain contrat Raspberry / FastAPI pourra renseigner :
//
// - physicalLinkState : état du carrier Ethernet ;
// - networkInterface : ex. eth0 ;
// - networkMedium : ex. RJ45 ;
// - localApiStatus : accessibilité de l'API Raspberry sur le port 8001 ;
// - linkSpeedMbps : vitesse du lien si elle est connue.
//
// IMPORTANT :
// OFFLINE ne signifie pas automatiquement « câble débranché ».
// Un Raspberry peut être éteint, bloqué ou avoir son service arrêté alors
// que le câble est physiquement présent.
// =========================================================================

export type CompanyPhysicalLinkState =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'UNKNOWN'


export type CompanyNetworkMedium =
  | 'RJ45'
  | 'WIFI'
  | 'OTHER'
  | 'UNKNOWN'


export type CompanyLocalApiStatus =
  | 'REACHABLE'
  | 'UNREACHABLE'
  | 'UNKNOWN'


export type CompanyControllerComponent = {
  id:
    string

  controllerIp:
    string

  // Nom technique envoyé dans le heartbeat.
  // Exemple : camera, motion_sensor, robot...
  name:
    string

  // Type normalisé calculé par le serveur.
  // Exemple : CAMERA, ROBOT_CAMERA, MOTION_SENSOR...
  kind:
    string

  enabled:
    boolean

  value:
    string | null

  status:
    CompanyControllerStatus

  lastSeen:
    string | null
}


export type CompanyController = {
  ip:
    string

  controllerType:
    CompanyControllerType

  hasServo:
    boolean | null

  status:
    CompanyControllerStatus

  lastSeen:
    string | null

  // ---------------------------------------------------------------------
  // TÉLÉMÉTRIE RÉSEAU OPTIONNELLE
  // ---------------------------------------------------------------------
  //
  // Tant que FastAPI ne renvoie pas ces champs, ils restent undefined.
  // La page Infrastructure affiche alors « non télémétré ».

  networkInterface?:
    string | null

  networkMedium?:
    CompanyNetworkMedium | null

  physicalLinkState?:
    CompanyPhysicalLinkState | null

  localApiStatus?:
    CompanyLocalApiStatus | null

  linkSpeedMbps?:
    number | null

  // false = Raspberry découvert mais pas encore attribué à un logement.
  assigned:
    boolean

  siteId:
    string | null

  siteName:
    string | null

  customerId:
    string | null

  customerName:
    string | null

  components:
    CompanyControllerComponent[]
}


// =========================================================================
// DONNÉES DE CRÉATION D'UNE INSTALLATION CLIENT
// =========================================================================
//
// Ces types servent au formulaire "Nouveau client".
//
// Le Provider orchestre ensuite :
//
// 1. création du client ;
// 2. création du site ;
// 3. rattachement des Raspberry sélectionnés.
// =========================================================================

export type NewCustomerData = {
  firstName:
    string

  lastName:
    string

  email:
    string

  phone:
    string

  notes?:
    string
}


export type NewMonitoredSiteData = {
  name:
    string

  address:
    string

  city:
    string

  postalCode:
    string

  country:
    string
}


export type CreateCustomerInstallationInput = {
  customer:
    NewCustomerData

  site:
    NewMonitoredSiteData

  controllerIps:
    string[]
}


export type MonitoredSite = {
  id:
    string

  customerId:
    string

  name:
    string

  address:
    string

  city:
    string

  postalCode:
    string

  country:
    string

  status:
    MonitoredSiteStatus

  armed:
    boolean

  createdAt:
    string

  // Présent lorsque companyApi charge la fiche client complète.
  // Une alerte peut contenir un MonitoredSite sans ce tableau.
  controllers?:
    CompanyController[]
}


// =========================================================================
// NIVEAU DE PRIORITÉ
// =========================================================================

export type Priority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'


// =========================================================================
// ALERTE ENTREPRISE
// =========================================================================
//
// Une alerte entreprise représente le DOSSIER OPÉRATIONNEL traité
// par le centre de supervision.
//
// L'événement brut venant d'un Raspberry reste un BackendEvent.
//
// CompanyAlert représente ce que l'entreprise fait ensuite de cet
// événement.
// =========================================================================

export type CompanyAlertStatus =
  | 'NEW'
  | 'IN_REVIEW'
  | 'CLIENT_CONTACT'
  | 'FALSE_ALARM'
  | 'CONFIRMED'
  | 'ESCALATED'
  | 'AGENT_DISPATCHED'
  | 'RESOLVED'


export type CompanyAlert = {
  id:
    string

  // Événement technique ayant déclenché l'alerte.
  sourceEventId:
    string

  customerId:
    string

  siteId:
    string

  title:
    string

  description:
    string

  sourceSensor:
    string

  sourceEquipmentId?:
    string

  cameraId?:
    string

  priority:
    Priority

  status:
    CompanyAlertStatus

  createdAt:
    string

  updatedAt:
    string

  resolvedAt?:
    string

  // Opérateur ayant pris en charge l'alerte.
  assignedOperatorId?:
    string
}


// =========================================================================
// ACTIONS EFFECTUÉES SUR UNE ALERTE
// =========================================================================
//
// Ce type sert à constituer la timeline d'une alerte.
//
// Exemple :
//
// 21:14 détection reçue
// 21:15 opérateur prend en charge
// 21:16 caméra consultée
// 21:17 client appelé
// 21:18 intervenant envoyé
//
// =========================================================================

export type AlertActionType =
  | 'ALERT_CREATED'
  | 'ALERT_TAKEN'
  | 'STATUS_CHANGED'
  | 'CAMERA_VIEWED'
  | 'SCREENSHOT_TAKEN'
  | 'ROBOT_COMMAND'
  | 'CLIENT_CALL'
  | 'EMERGENCY_CONTACT_CALL'
  | 'POLICE_ESCALATION'
  | 'AGENT_DISPATCH'
  | 'COMMENT_ADDED'
  | 'ALERT_RESOLVED'


export type AlertAction = {
  id:
    string

  alertId:
    string

  type:
    AlertActionType

  // Qui a déclenché l'action.
  actorType:
    'CUSTOMER'
    | 'COMPANY'
    | 'SYSTEM'

  actorId?:
    string

  actorName:
    string

  description:
    string

  createdAt:
    string

  // Permet de conserver des détails techniques sans multiplier
  // les propriétés.
  //
  // Exemple :
  //
  // {
  //   command: "LEFT",
  //   speed: 50
  // }
  details?:
    Record<
      string,
      string | number | boolean | null
    >
}


// =========================================================================
// APPEL CLIENT
// =========================================================================

export type ClientCallResult =
  | 'ANSWERED'
  | 'NO_ANSWER'
  | 'UNAVAILABLE'
  | 'FALSE_ALARM_CONFIRMED'
  | 'SUSPICIOUS_SITUATION_CONFIRMED'


export type ClientCall = {
  id:
    string

  customerId:
    string

  alertId?:
    string

  operatorId:
    string

  result:
    ClientCallResult

  comment?:
    string

  createdAt:
    string
}


// =========================================================================
// INTERVENANTS TERRAIN
// =========================================================================

export type FieldAgentStatus =
  | 'AVAILABLE'
  | 'DISPATCHED'
  | 'ON_SITE'
  | 'OFF_DUTY'


export type FieldAgent = {
  id:
    string

  firstName:
    string

  lastName:
    string

  phone:
    string

  area:
    string

  status:
    FieldAgentStatus

  currentInterventionId?:
    string
}


// =========================================================================
// INTERVENTION TERRAIN
// =========================================================================

export type InterventionStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'ON_THE_WAY'
  | 'ON_SITE'
  | 'COMPLETED'
  | 'CANCELLED'


export type Intervention = {
  id:
    string

  alertId:
    string

  customerId:
    string

  siteId:
    string

  agentId:
    string

  status:
    InterventionStatus

  requestedAt:
    string

  acceptedAt?:
    string

  arrivedAt?:
    string

  completedAt?:
    string

  report?:
    string
}


// =========================================================================
// ESCALADE SERVICES D'URGENCE
// =========================================================================
//
// Pour le prototype, cette structure trace la demande.
//
// Elle ne déclenche PAS réellement un appel vers les forces de l'ordre.
// =========================================================================

export type EmergencyEscalationStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'CANCELLED'


export type EmergencyEscalation = {
  id:
    string

  alertId:
    string

  operatorId:
    string

  status:
    EmergencyEscalationStatus

  reason:
    string

  createdAt:
    string
}


// =========================================================================
// SUPPORT CLIENT
// =========================================================================

export type SupportTicketStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED'


export type SupportTicketCategory =
  | 'CAMERA'
  | 'ROBOT'
  | 'SENSOR'
  | 'NETWORK'
  | 'ACCOUNT'
  | 'ALERT'
  | 'OTHER'


export type SupportTicket = {
  id:
    string

  customerId:
    string

  siteId?:
    string

  equipmentId?:
    string

  subject:
    string

  description:
    string

  category:
    SupportTicketCategory

  priority:
    Priority

  status:
    SupportTicketStatus

  assignedCompanyUserId?:
    string

  createdAt:
    string

  updatedAt:
    string

  resolvedAt?:
    string
}


// =========================================================================
// MESSAGE / COMMENTAIRE SUPPORT
// =========================================================================
//
// Un message peut être visible par le client.
//
// Un commentaire interne peut être réservé aux opérateurs.
//
// =========================================================================

export type SupportMessageAuthorType =
  | 'CUSTOMER'
  | 'COMPANY'


export type SupportMessage = {
  id:
    string

  ticketId:
    string

  authorType:
    SupportMessageAuthorType

  authorId:
    string

  authorName:
    string

  message:
    string

  // true :
  // visible uniquement par l'entreprise.
  internal:
    boolean

  createdAt:
    string
}


// =========================================================================
// COMMENTAIRES INTERNES
// =========================================================================
//
// Ces commentaires permettent à plusieurs opérateurs de partager du
// contexte.
//
// Ils peuvent être rattachés à :
//
// - une alerte ;
// - un client ;
// - un ticket support.
//
// Ils sont séparés des logs :
//
// COMMENTAIRE
//   = contenu humain.
//
// LOG
//   = trace automatique d'une action.
//
// =========================================================================

export type CompanyCommentTarget =
  | 'ALERT'
  | 'CUSTOMER'
  | 'SUPPORT_TICKET'


export type CompanyComment = {
  id:
    string

  targetType:
    CompanyCommentTarget

  targetId:
    string

  authorId:
    string

  authorName:
    string

  message:
    string

  createdAt:
    string

  updatedAt?:
    string
}


// =========================================================================
// LOGS / AUDIT
// =========================================================================
//
// Le journal d'audit répond à la question :
//
// "Qui a fait quoi, quand et sur quelle ressource ?"
//
// Contrairement à un commentaire, ce log est généré par le système.
//
// Il ne doit pas être modifiable depuis l'interface normale.
// =========================================================================

export type AuditAction =
  | 'CUSTOMER_VIEWED'
  | 'ALERT_VIEWED'
  | 'ALERT_STATUS_CHANGED'
  | 'CAMERA_VIEW_STARTED'
  | 'CAMERA_VIEW_STOPPED'
  | 'SCREENSHOT_CREATED'
  | 'EQUIPMENT_ENABLED'
  | 'EQUIPMENT_DISABLED'
  | 'ROBOT_COMMAND_SENT'
  | 'CLIENT_CALLED'
  | 'EMERGENCY_CONTACT_CALLED'
  | 'POLICE_ESCALATION_REQUESTED'
  | 'FIELD_AGENT_DISPATCHED'
  | 'SUPPORT_TICKET_CREATED'
  | 'SUPPORT_TICKET_UPDATED'
  | 'COMMENT_CREATED'
  | 'COMMENT_UPDATED'


export type AuditLog = {
  id:
    string

  action:
    AuditAction

  actorId?:
    string

  actorName:
    string

  actorType:
    'CUSTOMER'
    | 'COMPANY'
    | 'SYSTEM'

  resourceType:
    string

  resourceId:
    string

  description:
    string

  createdAt:
    string

  metadata?:
    Record<
      string,
      string | number | boolean | null
    >
}


// =========================================================================
// HISTORIQUE CLIENT
// =========================================================================
//
// Cette structure permet d'avoir sur la fiche client une timeline globale,
// et pas uniquement les alertes.
//
// Elle peut contenir :
//
// - actions du client ;
// - actions de l'entreprise ;
// - changements système ;
// - support ;
// - alertes.
//
// =========================================================================

export type CustomerActivityCategory =
  | 'ALERT'
  | 'CUSTOMER_ACTION'
  | 'COMPANY_ACTION'
  | 'SYSTEM'
  | 'SUPPORT'


export type CustomerActivity = {
  id:
    string

  customerId:
    string

  category:
    CustomerActivityCategory

  title:
    string

  description:
    string

  actor:
    string

  createdAt:
    string
}


// =========================================================================
// STATISTIQUES CLIENT AVANCÉES
// =========================================================================
//
// Elles seront affichées dans la fiche client.
//
// Elles doivent être calculées à partir de données réelles côté serveur,
// et non inventées côté React.
// =========================================================================

export type CustomerStatisticsPeriod =
  | '7D'
  | '30D'
  | '90D'
  | '1Y'


export type DailyAlertPoint = {
  date:
    string

  detections:
    number

  alerts:
    number

  confirmedAlerts:
    number

  falseAlarms:
    number
}


export type CustomerStatistics = {
  customerId:
    string

  period:
    CustomerStatisticsPeriod

  // Volume total.
  totalDetections:
    number

  totalAlerts:
    number

  confirmedAlerts:
    number

  falseAlarms:
    number

  // Temps moyen entre création et première prise en charge.
  averageTakeoverTimeSeconds:
    number | null

  // Temps moyen avant résolution complète.
  averageResolutionTimeSeconds:
    number | null

  // Nombre d'appels réalisés vers le client.
  clientCalls:
    number

  // Nombre d'interventions terrain.
  fieldInterventions:
    number

  // Nombre d'escalades urgence/police.
  emergencyEscalations:
    number

  // Support.
  supportTickets:
    number

  resolvedSupportTickets:
    number

  // Disponibilité globale du système.
  //
  // null tant qu'on n'a pas suffisamment d'historique heartbeat.
  systemAvailabilityPercent:
    number | null

  // Évolution quotidienne.
  dailyActivity:
    DailyAlertPoint[]
}


// =========================================================================
// FICHE CLIENT COMPLÈTE
// =========================================================================
//
// Ce type correspond à ce que pourra consommer
// CompanyCustomerDetailPage.
//
// Il regroupe les différentes informations utiles à un opérateur.
//
// =========================================================================

export type CustomerDetail = {
  customer:
    Customer

  sites:
    MonitoredSite[]

  emergencyContacts:
    EmergencyContact[]

  // Dernières alertes affichées immédiatement.
  recentAlerts:
    CompanyAlert[]

  // Historique complet.
  alertHistory:
    CompanyAlert[]

  // Actions client + entreprise + système.
  activityHistory:
    CustomerActivity[]

  supportTickets:
    SupportTicket[]

  comments:
    CompanyComment[]

  statistics:
    CustomerStatistics
}


// =========================================================================
// STATISTIQUES GLOBALES DU CENTRE DE SUPERVISION
// =========================================================================

export type CompanyDashboardStatistics = {
  activeAlerts:
    number

  criticalAlerts:
    number

  alertsWaitingForOperator:
    number

  monitoredCustomers:
    number

  monitoredSites:
    number

  onlineEquipments:
    number

  offlineEquipments:
    number

  availableAgents:
    number

  activeInterventions:
    number

  openSupportTickets:
    number

  averageAlertTakeoverTimeSeconds:
    number | null
}

// =========================================================================
// FICHE ALERTE ENTREPRISE COMPLÈTE
// =========================================================================

export type CompanyAlertDetail = {
  alert:
    CompanyAlert

  customer:
    Customer

  site:
    MonitoredSite

  actions:
    AlertAction[]

  comments:
    CompanyComment[]

  interventions:
    Intervention[]

  emergencyEscalation?:
    EmergencyEscalation
}


// =========================================================================
// FICHE TICKET SUPPORT COMPLÈTE
// =========================================================================

export type SupportTicketDetail = {
  ticket:
    SupportTicket

  customer:
    Customer

  messages:
    SupportMessage[]

  comments:
    CompanyComment[]
}