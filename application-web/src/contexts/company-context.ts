// company-context.ts

// -----------------------------------------------------------------------
// CONTRAT DU CONTEXTE ENTREPRISE - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Ce fichier décrit tout ce que CompanyProvider met à disposition
// des pages de l'espace entreprise.
//
// Il ne contient :
//
// - aucun fetch() ;
// - aucune logique métier ;
// - aucun composant visuel.
//
// Son rôle est uniquement de définir le contrat entre :
//
// CompanyProvider
//       ↓
// useCompany()
//       ↓
// pages / composants entreprise
//
// -----------------------------------------------------------------------

import {
  createContext,
} from 'react'

import type {
  AuditLog,
  ClientCallResult,
  CompanyAlert,
  CompanyAlertDetail,
  CompanyAlertStatus,
  CompanyDashboardStatistics,
  CompanyController,
  CreateCustomerInstallationInput,
  Customer,
  CustomerDetail,
  CustomerStatisticsPeriod,
  FieldAgent,
  Intervention,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
} from '../types/company'

import type {
  CompanyAlertFilters,
  CustomerFilters,
  OperatorIdentity,
  SupportTicketFilters,
} from '../services/companyApi'


// =========================================================================
// ÉTAT DE CHARGEMENT
// =========================================================================
//
// On sépare les différents chargements.
//
// Exemple :
//
// si la fiche client charge ses statistiques,
// on ne veut pas bloquer tout le dashboard entreprise.
//
// =========================================================================

export type CompanyLoadingState = {
  dashboard:
    boolean

  alerts:
    boolean

  alertDetail:
    boolean

  customers:
    boolean

  customerDetail:
    boolean

  controllers:
    boolean

  customerCreation:
    boolean

  support:
    boolean

  supportDetail:
    boolean

  agents:
    boolean

  audit:
    boolean

  interventions:
    boolean

  action:
    boolean
}


// =========================================================================
// ÉTAT DE CONNEXION À L'API ENTREPRISE
// =========================================================================

export type CompanyConnectionStatus =
  | 'UNKNOWN'
  | 'CHECKING'
  | 'CONNECTED'
  | 'DISCONNECTED'


// =========================================================================
// MESSAGE TEMPORAIRE AFFICHABLE DANS L'INTERFACE
// =========================================================================
//
// Exemple :
//
// SUCCESS
// "Alerte prise en charge."
//
// ERROR
// "Impossible de contacter le serveur."
//
// INFO
// "Vérification en cours..."
// =========================================================================

export type CompanyFeedback = {
  type:
    'SUCCESS'
    | 'ERROR'
    | 'INFO'

  message:
    string
}


// =========================================================================
// CONTRAT GLOBAL DU CONTEXTE
// =========================================================================

export type CompanyContextValue = {

  // =====================================================================
  // IDENTITÉ OPÉRATEUR TEMPORAIRE
  // =====================================================================
  //
  // Il ne s'agit PAS d'une authentification réelle.
  //
  // Elle sera remplacée plus tard par l'utilisateur réellement connecté.
  // =====================================================================

  currentOperator:
    OperatorIdentity


  // =====================================================================
  // CONNEXION
  // =====================================================================

  connectionStatus:
    CompanyConnectionStatus

  checkCompanyConnection:
    () => Promise<void>


  // =====================================================================
  // DASHBOARD
  // =====================================================================

  dashboardStatistics:
    CompanyDashboardStatistics | null

  refreshDashboard:
    () => Promise<void>


  // =====================================================================
  // ALERTES
  // =====================================================================

  alerts:
    CompanyAlert[]

  selectedAlert:
    CompanyAlertDetail | null

  refreshAlerts:
    (
      filters?:
        CompanyAlertFilters,
    ) => Promise<void>

  openAlert:
    (
      alertId:
        string,
    ) => Promise<void>

  clearSelectedAlert:
    () => void

  takeAlert:
    (
      alertId:
        string,
    ) => Promise<void>

  changeAlertStatus:
    (
      alertId:
        string,

      status:
        CompanyAlertStatus,

      comment?:
        string,
    ) => Promise<void>

  registerCall:
    (
      alertId:
        string,

      result:
        ClientCallResult,

      comment?:
        string,
    ) => Promise<void>

  dispatchAgent:
    (
      alertId:
        string,

      agentId:
        string,

      comment?:
        string,
    ) => Promise<void>

  escalateAlert:
    (
      alertId:
        string,

      reason:
        string,
    ) => Promise<void>

  addAlertComment:
    (
      alertId:
        string,

      message:
        string,
    ) => Promise<void>


  // ---------------------------------------------------------------------
  // ACTIONS MATÉRIELLES AUDITÉES
  // ---------------------------------------------------------------------
  //
  // Ces actions passent par les routes entreprise afin que FastAPI puisse
  // commander le matériel ET conserver une trace dans l'alerte / l'audit.
  // ---------------------------------------------------------------------

  openAlertCamera:
    (
      alertId:
        string,

      cameraId:
        string,
    ) => Promise<string>

  takeAlertScreenshot:
    (
      alertId:
        string,

      cameraId:
        string,
    ) => Promise<void>

  sendAlertRobotCommand:
    (
      alertId:
        string,

      command:
        string,

      speed:
        number,
    ) => Promise<void>

  setAlertEquipmentEnabled:
    (
      alertId:
        string,

      equipmentId:
        string,

      enabled:
        boolean,
    ) => Promise<void>


  // =====================================================================
  // CLIENTS
  // =====================================================================

  customers:
    Customer[]

  selectedCustomer:
    CustomerDetail | null

  refreshCustomers:
    (
      filters?:
        CustomerFilters,
    ) => Promise<void>

  openCustomer:
    (
      customerId:
        string,
    ) => Promise<void>

  clearSelectedCustomer:
    () => void

  loadCustomerStatistics:
    (
      customerId:
        string,

      period:
        CustomerStatisticsPeriod,
    ) => Promise<void>

  addCustomerComment:
    (
      customerId:
        string,

      message:
        string,
    ) => Promise<void>


  // ---------------------------------------------------------------------
  // INSTALLATION / RASPBERRY
  // ---------------------------------------------------------------------

  controllers:
    CompanyController[]

  refreshControllers:
    () => Promise<void>

  createCustomerInstallation:
    (
      input:
        CreateCustomerInstallationInput,
    ) => Promise<CustomerDetail | null>


  // =====================================================================
  // SUPPORT
  // =====================================================================

  supportTickets:
    SupportTicket[]

  selectedSupportTicket:
    SupportTicketDetail | null

  refreshSupportTickets:
    (
      filters?:
        SupportTicketFilters,
    ) => Promise<void>

  openSupportTicket:
    (
      ticketId:
        string,
    ) => Promise<void>

  clearSelectedSupportTicket:
    () => void

  sendSupportMessage:
    (
      ticketId:
        string,

      message:
        string,

      internal:
        boolean,
    ) => Promise<void>

  changeSupportStatus:
    (
      ticketId:
        string,

      status:
        SupportTicketStatus,
    ) => Promise<void>

  addSupportComment:
    (
      ticketId:
        string,

      message:
        string,
    ) => Promise<void>


  // =====================================================================
  // INTERVENANTS
  // =====================================================================

  fieldAgents:
    FieldAgent[]

  refreshFieldAgents:
    () => Promise<void>


  // =====================================================================
  // INTERVENTIONS
  // =====================================================================

  interventions:
    Intervention[]

  refreshInterventions:
    (
      customerId?:
        string,
    ) => Promise<void>


  // =====================================================================
  // LOGS D'AUDIT
  // =====================================================================

  auditLogs:
    AuditLog[]

  refreshAuditLogs:
    (
      customerId?:
        string,
    ) => Promise<void>


  // =====================================================================
  // ÉTATS TRANSVERSAUX
  // =====================================================================

  loading:
    CompanyLoadingState

  error:
    string | null

  feedback:
    CompanyFeedback | null

  clearError:
    () => void

  clearFeedback:
    () => void
}


// =========================================================================
// CONTEXTE
// =========================================================================
//
// undefined est volontaire.
//
// Cela permet à useCompany() de détecter si une page essaie d'utiliser
// le contexte sans être contenue dans <CompanyProvider>.
// =========================================================================

export const CompanyContext =
  createContext<
    CompanyContextValue | undefined
  >(
    undefined,
  )