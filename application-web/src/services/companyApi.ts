// companyApi.ts

// -----------------------------------------------------------------------
// API DE L'ESPACE ENTREPRISE - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Ce fichier centralise TOUTES les requêtes HTTP spécifiques au centre
// de supervision.
//
// Les pages entreprise ne doivent pas faire de fetch() directement.
//
// Exemple :
//
// CompanyCustomersPage
//        ↓
// getCustomers()
//        ↓
// companyApi.ts
//        ↓
// GET /api/company/customers
//        ↓
// FastAPI
//
//
// Ce fichier gère également les ACTIONS MATÉRIELLES ENTREPRISE
// lorsqu'elles sont effectuées dans le contexte d'une alerte.
//
// Exemple :
//
// - consultation d'une caméra ;
// - capture caméra ;
// - commande du robot ;
// - activation / désactivation d'un équipement.
//
// Ces routes spécifiques permettent au backend d'effectuer l'action
// réelle ET d'enregistrer automatiquement la timeline / l'audit.
//
// Les routes matérielles génériques de systemApi.ts restent utilisées
// par l'espace utilisateur.
//
// -----------------------------------------------------------------------

import type {
  AlertAction,
  ClientCall,
  ClientCallResult,
  CompanyAlert,
  CompanyAlertDetail,
  CompanyAlertStatus,
  CompanyComment,
  CompanyCommentTarget,
  CompanyDashboardStatistics,
  CompanyController,
  CreateCustomerInstallationInput,
  Customer,
  CustomerActivity,
  CustomerDetail,
  CustomerStatistics,
  CustomerStatisticsPeriod,
  EmergencyEscalation,
  FieldAgent,
  Intervention,
  Priority,
  SupportMessage,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
} from '../types/company'

import type {
  MediaItem,
} from '../types/dashboard'


// =========================================================================
// ADRESSE API
// =========================================================================
//
// On réutilise exactement la même configuration que systemApi.ts.
//
// Dans .env.local :
//
// VITE_API_BASE_URL=/api
//
// Le navigateur appelle donc :
//
// /api/company/...
//
// puis Vite transmet la requête au serveur FastAPI.
//
// Il n'y a volontairement aucune IP dans ce fichier.
// =========================================================================

const configuredApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL


const cleanedApiBaseUrl =
  configuredApiBaseUrl
    ?.trim()


if (
  !cleanedApiBaseUrl
) {

  throw new Error(
    (
      'VITE_API_BASE_URL est absente. '
      + 'Vérifie application-web/.env.local.'
    ),
  )
}


const API_BASE_URL =
  cleanedApiBaseUrl


// =========================================================================
// DEBUG
// =========================================================================
//
// En développement, chaque requête est visible dans :
//
// F12 -> Console
//
// Exemple :
//
// [COMPANY API →] GET /company/customers
// [COMPANY API ←] GET /company/customers → 200
//
// Le proxy Vite affiche parallèlement les requêtes
// dans le terminal VS Code.
// =========================================================================

const API_DEBUG =
  import.meta.env.DEV


// =========================================================================
// TYPES INTERNES
// =========================================================================

type OkResponse = {
  ok:
    boolean
}


type CompanyCameraViewResponse = {
  ok:
    boolean

  streamUrl:
    string
}


// =========================================================================
// FILTRES
// =========================================================================
//
// Ces types servent aux pages qui proposent :
//
// - recherche ;
// - filtre statut ;
// - filtre priorité ;
// - filtre client.
//
// Ils permettent de construire les query params proprement.
// =========================================================================

export type CompanyAlertFilters = {
  status?:
    CompanyAlertStatus

  priority?:
    Priority

  customerId?:
    string

  search?:
    string
}


export type CustomerFilters = {
  search?:
    string

  status?:
    'ACTIVE'
    | 'SUSPENDED'
    | 'INACTIVE'
}


export type SupportTicketFilters = {
  status?:
    SupportTicketStatus

  priority?:
    Priority

  customerId?:
    string

  search?:
    string
}


// =========================================================================
// PAYLOADS D'ACTION
// =========================================================================
//
// Comme l'authentification réelle n'existe pas encore,
// les informations de l'opérateur sont envoyées explicitement.
//
// Plus tard, actorId / operatorId pourront venir automatiquement
// du token de session côté FastAPI.
// =========================================================================

export type OperatorIdentity = {
  operatorId:
    string

  operatorName:
    string
}


// =========================================================================
// CRÉATION CLIENT / INSTALLATION
// =========================================================================
//
// On réexporte le type depuis company.ts afin que le Context et le Provider
// puissent partager exactement le même contrat.
// =========================================================================

export type CustomerInstallationPayload =
  CreateCustomerInstallationInput


export type TakeAlertPayload =
  OperatorIdentity


export type UpdateAlertStatusPayload =
  OperatorIdentity
  & {
    status:
      CompanyAlertStatus

    comment?:
      string
  }


export type RegisterClientCallPayload =
  OperatorIdentity
  & {
    result:
      ClientCallResult

    comment?:
      string
  }


export type DispatchAgentPayload =
  OperatorIdentity
  & {
    agentId:
      string

    comment?:
      string
  }


export type EmergencyEscalationPayload =
  OperatorIdentity
  & {
    reason:
      string
  }


export type CreateCommentPayload =
  OperatorIdentity
  & {
    message:
      string
  }


export type CreateSupportMessagePayload =
  OperatorIdentity
  & {
    message:
      string

    internal:
      boolean
  }


// =========================================================================
// CONSTRUCTION URL
// =========================================================================

function buildUrl(
  path:
    string,
): string {

  const base =
    API_BASE_URL.endsWith(
      '/',
    )
      ? API_BASE_URL.slice(
          0,
          -1,
        )
      : API_BASE_URL


  const normalizedPath =
    path.startsWith(
      '/',
    )
      ? path
      : `/${path}`


  return (
    `${base}${normalizedPath}`
  )
}


// =========================================================================
// URL D'UNE RESSOURCE SERVEUR
// =========================================================================
//
// FastAPI renvoie parfois une URL relative, par exemple :
//
// /api/cameras/.../stream
// /api/media/files/...jpg
//
// Comme l'application utilise le proxy Vite, on construit l'URL à partir
// de l'origine du navigateur :
//
// PC :
//   http://localhost:5173
//
// téléphone :
//   http://192.168.137.1:5173
//
// Dans les deux cas, /api est ensuite relayé par Vite vers FastAPI.
// =========================================================================

function serverResourceUrl(
  value:
    string | undefined,
): string | undefined {

  if (
    !value
  ) {

    return undefined
  }


  if (
    value.startsWith(
      'http://',
    )
    ||
    value.startsWith(
      'https://',
    )
  ) {

    return value
  }


  return new URL(
    value,
    `${window.location.origin}/`,
  ).toString()
}


// =========================================================================
// QUERY PARAMS
// =========================================================================
//
// Exemple :
//
// {
//   status: 'NEW',
//   priority: 'CRITICAL'
// }
//
// devient :
//
// ?status=NEW&priority=CRITICAL
// =========================================================================

function buildQuery(
  values:
    Record<
      string,
      string | undefined
    >,
): string {

  const params =
    new URLSearchParams()


  Object.entries(
    values,
  ).forEach(
    (
      [
        key,
        value,
      ],
    ) => {

      if (
        value !==
          undefined
        &&
        value.trim() !==
          ''
      ) {

        params.set(
          key,
          value,
        )
      }
    },
  )


  const query =
    params.toString()


  return (
    query
      ? `?${query}`
      : ''
  )
}


// =========================================================================
// HEADERS
// =========================================================================

function buildHeaders(
  init?:
    RequestInit,
): Headers {

  const headers =
    new Headers(
      init?.headers,
    )


  if (
    init?.body !==
      undefined
    &&
    !headers.has(
      'Content-Type',
    )
  ) {

    headers.set(
      'Content-Type',
      'application/json',
    )
  }


  return headers
}


// =========================================================================
// LECTURE DES ERREURS FASTAPI
// =========================================================================
//
// FastAPI renvoie généralement :
//
// {
//   "detail": "..."
// }
//
// On récupère ce message afin de pouvoir l'afficher proprement
// dans l'interface entreprise.
// =========================================================================

async function readErrorDetail(
  response:
    Response,
): Promise<string> {

  try {

    const data =
      (
        await response.json()
      ) as {
        detail?:
          unknown
      }


    if (
      typeof data.detail ===
      'string'
    ) {

      return data.detail
    }

  } catch {

    // Réponse non JSON.
  }


  return (
    `Erreur HTTP ${response.status}`
  )
}


// =========================================================================
// LOGS
// =========================================================================

function logRequest(
  method:
    string,

  path:
    string,
): void {

  if (
    !API_DEBUG
  ) {

    return
  }


  console.log(
    (
      `[COMPANY API →] `
      + `${method} ${path}`
    ),
  )
}


function logSuccess(
  method:
    string,

  path:
    string,

  response:
    Response,

  duration:
    number,
): void {

  if (
    !API_DEBUG
  ) {

    return
  }


  console.log(
    (
      `[COMPANY API ←] `
      + `${method} ${path} `
      + `→ ${response.status} `
      + `(${Math.round(duration)} ms)`
    ),
  )
}


function logHttpError(
  method:
    string,

  path:
    string,

  status:
    number,

  detail:
    string,
): void {

  console.error(
    (
      `[COMPANY API ✗] `
      + `${method} ${path} `
      + `→ HTTP ${status}`
    ),

    detail,
  )
}


function logNetworkError(
  method:
    string,

  path:
    string,

  error:
    unknown,
): void {

  console.error(
    (
      `[COMPANY API ✗] `
      + `${method} ${path} `
      + '→ erreur réseau'
    ),

    error,
  )
}


// =========================================================================
// REQUÊTE JSON GÉNÉRIQUE
// =========================================================================
//
// Toutes les fonctions de ce fichier passent ici.
//
// Cela permet d'avoir au même endroit :
//
// - construction URL ;
// - headers ;
// - logs ;
// - gestion erreur réseau ;
// - gestion erreur HTTP ;
// - parsing JSON.
//
// =========================================================================

async function requestJson<T>(
  path:
    string,

  init?:
    RequestInit,
): Promise<T> {

  const method =
    init?.method
      ?.toUpperCase()
    ??
    'GET'


  const url =
    buildUrl(
      path,
    )


  const startTime =
    performance.now()


  logRequest(
    method,
    path,
  )


  let response:
    Response


  try {

    response =
      await fetch(
        url,
        {
          ...init,

          headers:
            buildHeaders(
              init,
            ),
        },
      )

  } catch (
    error
  ) {

    logNetworkError(
      method,
      path,
      error,
    )


    throw error
  }


  const duration =
    performance.now()
    -
    startTime


  if (
    !response.ok
  ) {

    const detail =
      await readErrorDetail(
        response,
      )


    logHttpError(
      method,
      path,
      response.status,
      detail,
    )


    throw new Error(
      detail,
    )
  }


  logSuccess(
    method,
    path,
    response,
    duration,
  )


  return (
    await response.json()
  ) as T
}


// =========================================================================
// ACTION SIMPLE
// =========================================================================
//
// Certaines routes renvoient simplement :
//
// {
//   "ok": true
// }
//
// =========================================================================

async function requestAction(
  path:
    string,

  init?:
    RequestInit,
): Promise<void> {

  const result =
    await requestJson<
      OkResponse
    >(
      path,
      init,
    )


  if (
    result.ok !==
      true
  ) {

    throw new Error(
      (
        "Le serveur n'a pas "
        + "confirmé l'action."
      ),
    )
  }
}


// =========================================================================
// DASHBOARD ENTREPRISE
// =========================================================================
//
// Résumé global du centre de supervision.
//
// GET /api/company/dashboard
// =========================================================================

export async function getCompanyDashboardStatistics():
  Promise<CompanyDashboardStatistics> {

  return requestJson<
    CompanyDashboardStatistics
  >(
    '/company/dashboard',
  )
}


// =========================================================================
// ALERTES ENTREPRISE
// =========================================================================

export async function getCompanyAlerts(
  filters:
    CompanyAlertFilters = {},
): Promise<CompanyAlert[]> {

  const query =
    buildQuery(
      {
        status:
          filters.status,

        priority:
          filters.priority,

        customerId:
          filters.customerId,

        search:
          filters.search,
      },
    )


  return requestJson<
    CompanyAlert[]
  >(
    `/company/alerts${query}`,
  )
}


// -----------------------------------------------------------------------
// FICHE COMPLÈTE D'UNE ALERTE
// -----------------------------------------------------------------------

export async function getCompanyAlert(
  alertId:
    string,
): Promise<CompanyAlertDetail> {

  const encodedId =
    encodeURIComponent(
      alertId,
    )


  return requestJson<
    CompanyAlertDetail
  >(
    `/company/alerts/${encodedId}`,
  )
}


// -----------------------------------------------------------------------
// PRENDRE EN CHARGE UNE ALERTE
// -----------------------------------------------------------------------
//
// Exemple :
//
// POST /api/company/alerts/42/take
//
// {
//   "operatorId": "operator-1",
//   "operatorName": "Sarah M."
// }
//
// =========================================================================

export async function takeCompanyAlert(
  alertId:
    string,

  payload:
    TakeAlertPayload,
): Promise<CompanyAlert> {

  const encodedId =
    encodeURIComponent(
      alertId,
    )


  return requestJson<
    CompanyAlert
  >(
    `/company/alerts/${encodedId}/take`,
    {
      method:
        'POST',

      body:
        JSON.stringify(
          payload,
        ),
    },
  )
}


// -----------------------------------------------------------------------
// MODIFIER LE STATUT D'UNE ALERTE
// -----------------------------------------------------------------------

export async function updateCompanyAlertStatus(
  alertId:
    string,

  payload:
    UpdateAlertStatusPayload,
): Promise<CompanyAlert> {

  const encodedId =
    encodeURIComponent(
      alertId,
    )


  return requestJson<
    CompanyAlert
  >(
    `/company/alerts/${encodedId}/status`,
    {
      method:
        'PUT',

      body:
        JSON.stringify(
          payload,
        ),
    },
  )
}


// -----------------------------------------------------------------------
// HISTORIQUE / TIMELINE D'UNE ALERTE
// -----------------------------------------------------------------------

export async function getAlertActions(
  alertId:
    string,
): Promise<AlertAction[]> {

  const encodedId =
    encodeURIComponent(
      alertId,
    )


  return requestJson<
    AlertAction[]
  >(
    `/company/alerts/${encodedId}/actions`,
  )
}


// =========================================================================
// APPELER LE CLIENT
// =========================================================================
//
// Cette route ne doit pas forcément lancer réellement un appel.
//
// Pour notre prototype, elle peut enregistrer :
//
// - qui a tenté d'appeler ;
// - le résultat ;
// - le commentaire ;
// - la date.
//
// Plus tard une intégration téléphonique pourra être ajoutée.
// =========================================================================

export async function registerClientCall(
  alertId:
    string,

  payload:
    RegisterClientCallPayload,
): Promise<ClientCall> {

  const encodedId =
    encodeURIComponent(
      alertId,
    )


  return requestJson<
    ClientCall
  >(
    `/company/alerts/${encodedId}/client-call`,
    {
      method:
        'POST',

      body:
        JSON.stringify(
          payload,
        ),
    },
  )
}


// =========================================================================
// INTERVENANT TERRAIN
// =========================================================================

export async function dispatchFieldAgent(
  alertId:
    string,

  payload:
    DispatchAgentPayload,
): Promise<Intervention> {

  const encodedId =
    encodeURIComponent(
      alertId,
    )


  return requestJson<
    Intervention
  >(
    `/company/alerts/${encodedId}/dispatch`,
    {
      method:
        'POST',

      body:
        JSON.stringify(
          payload,
        ),
    },
  )
}


// =========================================================================
// ESCALADE URGENCE / POLICE
// =========================================================================
//
// IMPORTANT :
//
// Dans le prototype cette route ENREGISTRE une escalade.
//
// Elle ne doit pas appeler réellement les forces de l'ordre.
// =========================================================================

export async function requestEmergencyEscalation(
  alertId:
    string,

  payload:
    EmergencyEscalationPayload,
): Promise<EmergencyEscalation> {

  const encodedId =
    encodeURIComponent(
      alertId,
    )


  return requestJson<
    EmergencyEscalation
  >(
    `/company/alerts/${encodedId}/emergency-escalation`,
    {
      method:
        'POST',

      body:
        JSON.stringify(
          payload,
        ),
    },
  )
}


// =========================================================================
// ACTIONS MATÉRIELLES DEPUIS UNE ALERTE ENTREPRISE
// =========================================================================
//
// Ces fonctions utilisent les routes /api/company/... du backend.
//
// L'objectif n'est pas seulement de commander le matériel.
//
// FastAPI effectue deux responsabilités :
//
// 1. exécuter réellement l'action sur le Raspberry ;
// 2. conserver la trace de l'action dans la timeline et l'audit.
//
// Exemple :
//
// Opérateur
//     ↓
// companyApi.ts
//     ↓
// FastAPI
//     ├── commande Raspberry
//     ├── AlertAction
//     └── AuditLog
//
// =========================================================================


// =========================================================================
// CONSULTER UNE CAMÉRA DEPUIS UNE ALERTE
// =========================================================================
//
// Le backend enregistre la consultation puis renvoie l'URL du flux réel.
//
// POST
// /api/company/alerts/{alertId}/cameras/{cameraId}/view
// =========================================================================

export async function openCompanyAlertCamera(
  alertId:
    string,

  cameraId:
    string,

  operator:
    OperatorIdentity,
): Promise<string> {

  const encodedAlertId =
    encodeURIComponent(
      alertId,
    )


  const encodedCameraId =
    encodeURIComponent(
      cameraId,
    )


  const response =
    await requestJson<
      CompanyCameraViewResponse
    >(
      (
        `/company/alerts/${encodedAlertId}`
        + `/cameras/${encodedCameraId}/view`
      ),
      {
        method:
          'POST',

        body:
          JSON.stringify(
            operator,
          ),
      },
    )


  if (
    response.ok !==
      true
  ) {

    throw new Error(
      (
        "Le serveur n'a pas confirmé "
        + "l'ouverture de la caméra."
      ),
    )
  }


  const streamUrl =
    serverResourceUrl(
      response.streamUrl,
    )


  if (
    !streamUrl
  ) {

    throw new Error(
      (
        "Le serveur n'a pas fourni "
        + "d'URL de flux caméra."
      ),
    )
  }


  return streamUrl
}


// =========================================================================
// CAPTURE CAMÉRA DEPUIS UNE ALERTE
// =========================================================================
//
// Le backend réalise la vraie capture puis écrit :
//
// - SCREENSHOT_TAKEN dans la timeline ;
// - SCREENSHOT_CREATED dans les logs d'audit.
//
// POST
// /api/company/alerts/{alertId}/cameras/{cameraId}/screenshot
// =========================================================================

export async function takeCompanyAlertScreenshot(
  alertId:
    string,

  cameraId:
    string,

  operator:
    OperatorIdentity,
): Promise<MediaItem> {

  const encodedAlertId =
    encodeURIComponent(
      alertId,
    )


  const encodedCameraId =
    encodeURIComponent(
      cameraId,
    )


  const media =
    await requestJson<
      MediaItem
    >(
      (
        `/company/alerts/${encodedAlertId}`
        + `/cameras/${encodedCameraId}/screenshot`
      ),
      {
        method:
          'POST',

        body:
          JSON.stringify(
            operator,
          ),
      },
    )


  return {
    ...media,

    mediaUrl:
      serverResourceUrl(
        media.mediaUrl,
      ),
  }
}


// =========================================================================
// COMMANDER LE ROBOT DEPUIS UNE ALERTE
// =========================================================================
//
// Le backend réutilise la vraie logique du robot puis écrit :
//
// - ROBOT_COMMAND dans la timeline ;
// - ROBOT_COMMAND_SENT dans l'audit.
//
// POST
// /api/company/alerts/{alertId}/robot-command
// =========================================================================

export async function sendCompanyAlertRobotCommand(
  alertId:
    string,

  command:
    string,

  speed:
    number,

  operator:
    OperatorIdentity,
): Promise<void> {

  const encodedAlertId =
    encodeURIComponent(
      alertId,
    )


  await requestAction(
    (
      `/company/alerts/${encodedAlertId}`
      + '/robot-command'
    ),
    {
      method:
        'POST',

      body:
        JSON.stringify(
          {
            ...operator,

            command,

            speed,
          },
        ),
    },
  )
}


// =========================================================================
// ACTIVER / DÉSACTIVER UN ÉQUIPEMENT DEPUIS UNE ALERTE
// =========================================================================
//
// Le backend effectue réellement l'action puis génère :
//
// EQUIPMENT_ENABLED
// ou
// EQUIPMENT_DISABLED
//
// dans les logs d'audit.
//
// PUT
// /api/company/alerts/{alertId}/equipments/{equipmentId}/enabled
// =========================================================================

export async function setCompanyAlertEquipmentEnabled(
  alertId:
    string,

  equipmentId:
    string,

  enabled:
    boolean,

  operator:
    OperatorIdentity,
): Promise<void> {

  const encodedAlertId =
    encodeURIComponent(
      alertId,
    )


  const encodedEquipmentId =
    encodeURIComponent(
      equipmentId,
    )


  await requestAction(
    (
      `/company/alerts/${encodedAlertId}`
      + `/equipments/${encodedEquipmentId}/enabled`
    ),
    {
      method:
        'PUT',

      body:
        JSON.stringify(
          {
            ...operator,

            enabled,
          },
        ),
    },
  )
}


// =========================================================================
// CLIENTS
// =========================================================================

export async function getCustomers(
  filters:
    CustomerFilters = {},
): Promise<Customer[]> {

  const query =
    buildQuery(
      {
        search:
          filters.search,

        status:
          filters.status,
      },
    )


  return requestJson<
    Customer[]
  >(
    `/company/customers${query}`,
  )
}


// -----------------------------------------------------------------------
// CRÉER UN CLIENT
// -----------------------------------------------------------------------
//
// Cette route crée uniquement l'identité du client.
//
// Le site et les Raspberry sont volontairement traités séparément,
// car un client peut posséder plusieurs sites.
// -----------------------------------------------------------------------

export async function createCustomer(
  input:
    CreateCustomerInstallationInput['customer'],
): Promise<Customer> {

  return requestJson<
    Customer
  >(
    '/company/customers',
    {
      method:
        'POST',

      body:
        JSON.stringify(
          input,
        ),
    },
  )
}


// -----------------------------------------------------------------------
// CRÉER UN SITE POUR UN CLIENT
// -----------------------------------------------------------------------

export async function createCustomerSite(
  customerId:
    string,

  input:
    CreateCustomerInstallationInput['site'],
): Promise<
  CustomerDetail['sites'][number]
> {

  const encodedCustomerId =
    encodeURIComponent(
      customerId,
    )


  return requestJson<
    CustomerDetail['sites'][number]
  >(
    `/company/customers/${encodedCustomerId}/sites`,
    {
      method:
        'POST',

      body:
        JSON.stringify(
          input,
        ),
    },
  )
}


// -----------------------------------------------------------------------
// LISTER LES RASPBERRY DÉCOUVERTS PAR LE SERVEUR
// -----------------------------------------------------------------------
//
// Cette route ne contient aucune IP codée en dur.
//
// La liste est construite depuis les heartbeats réellement reçus.
// -----------------------------------------------------------------------

export async function getCompanyControllers():
Promise<CompanyController[]> {

  return requestJson<
    CompanyController[]
  >(
    '/company/controllers',
  )
}


// -----------------------------------------------------------------------
// LISTER LES RASPBERRY D'UN SITE
// -----------------------------------------------------------------------

export async function getSiteControllers(
  siteId:
    string,
): Promise<CompanyController[]> {

  const encodedSiteId =
    encodeURIComponent(
      siteId,
    )


  return requestJson<
    CompanyController[]
  >(
    `/company/sites/${encodedSiteId}/controllers`,
  )
}


// -----------------------------------------------------------------------
// RATTACHER UN RASPBERRY À UN SITE
// -----------------------------------------------------------------------
//
// Le backend garantit qu'une IP ne peut être rattachée qu'à un seul site.
// Si l'IP était affectée ailleurs, elle est déplacée vers le nouveau site.
// -----------------------------------------------------------------------

export async function assignControllerToSite(
  siteId:
    string,

  controllerIp:
    string,
): Promise<void> {

  const encodedSiteId =
    encodeURIComponent(
      siteId,
    )


  const encodedControllerIp =
    encodeURIComponent(
      controllerIp,
    )


  await requestAction(
    (
      `/company/sites/${encodedSiteId}`
      + `/controllers/${encodedControllerIp}`
    ),
    {
      method:
        'PUT',
    },
  )
}


// -----------------------------------------------------------------------
// FICHE CLIENT COMPLÈTE
// -----------------------------------------------------------------------
//
// Elle contient notamment :
//
// - identité ;
// - sites ;
// - contacts urgence ;
// - alertes récentes ;
// - historique alertes ;
// - historique actions ;
// - support ;
// - commentaires ;
// - statistiques.
//
// =========================================================================

export async function getCustomerDetail(
  customerId:
    string,
): Promise<CustomerDetail> {

  const encodedId =
    encodeURIComponent(
      customerId,
    )


  const detail =
    await requestJson<
      CustomerDetail
    >(
      `/company/customers/${encodedId}`,
    )


  // ---------------------------------------------------------------------
  // ENRICHISSEMENT DE LA FICHE CLIENT
  // ---------------------------------------------------------------------
  //
  // La route client renvoie les sites métier.
  //
  // Les Raspberry sont chargés avec une route dédiée par site afin de
  // conserver une responsabilité claire côté backend.
  //
  // L'interface obtient ainsi :
  //
  // client
  //   └── sites
  //        └── controllers
  //             └── components
  // ---------------------------------------------------------------------

  const sites =
    await Promise.all(
      detail.sites.map(
        async (
          site,
        ) => {

          const controllers =
            await getSiteControllers(
              site.id,
            )


          return {
            ...site,

            controllers,
          }
        },
      ),
    )


  return {
    ...detail,

    sites,
  }
}


// -----------------------------------------------------------------------
// HISTORIQUE DES ALERTES D'UN CLIENT
// -----------------------------------------------------------------------

export async function getCustomerAlerts(
  customerId:
    string,
): Promise<CompanyAlert[]> {

  const encodedId =
    encodeURIComponent(
      customerId,
    )


  return requestJson<
    CompanyAlert[]
  >(
    `/company/customers/${encodedId}/alerts`,
  )
}


// -----------------------------------------------------------------------
// HISTORIQUE GLOBAL CLIENT
// -----------------------------------------------------------------------

export async function getCustomerActivity(
  customerId:
    string,
): Promise<CustomerActivity[]> {

  const encodedId =
    encodeURIComponent(
      customerId,
    )


  return requestJson<
    CustomerActivity[]
  >(
    `/company/customers/${encodedId}/activity`,
  )
}


// -----------------------------------------------------------------------
// STATISTIQUES AVANCÉES
// -----------------------------------------------------------------------

export async function getCustomerStatistics(
  customerId:
    string,

  period:
    CustomerStatisticsPeriod,
): Promise<CustomerStatistics> {

  const encodedId =
    encodeURIComponent(
      customerId,
    )


  const encodedPeriod =
    encodeURIComponent(
      period,
    )


  return requestJson<
    CustomerStatistics
  >(
    (
      `/company/customers/${encodedId}`
      + `/statistics?period=${encodedPeriod}`
    ),
  )
}


// =========================================================================
// COMMENTAIRES INTERNES
// =========================================================================
//
// Les commentaires sont du contenu humain.
//
// Ils sont différents des logs.
//
// Exemple :
//
// "Le client est actuellement à l'étranger."
//
// =========================================================================

export async function getComments(
  targetType:
    CompanyCommentTarget,

  targetId:
    string,
): Promise<CompanyComment[]> {

  const encodedType =
    encodeURIComponent(
      targetType,
    )


  const encodedId =
    encodeURIComponent(
      targetId,
    )


  return requestJson<
    CompanyComment[]
  >(
    (
      '/company/comments'
      + `?targetType=${encodedType}`
      + `&targetId=${encodedId}`
    ),
  )
}


export async function createComment(
  targetType:
    CompanyCommentTarget,

  targetId:
    string,

  payload:
    CreateCommentPayload,
): Promise<CompanyComment> {

  return requestJson<
    CompanyComment
  >(
    '/company/comments',
    {
      method:
        'POST',

      body:
        JSON.stringify(
          {
            targetType,

            targetId,

            ...payload,
          },
        ),
    },
  )
}


// =========================================================================
// SUPPORT
// =========================================================================

export async function getSupportTickets(
  filters:
    SupportTicketFilters = {},
): Promise<SupportTicket[]> {

  const query =
    buildQuery(
      {
        status:
          filters.status,

        priority:
          filters.priority,

        customerId:
          filters.customerId,

        search:
          filters.search,
      },
    )


  return requestJson<
    SupportTicket[]
  >(
    `/company/support${query}`,
  )
}


// -----------------------------------------------------------------------
// FICHE TICKET
// -----------------------------------------------------------------------

export async function getSupportTicket(
  ticketId:
    string,
): Promise<SupportTicketDetail> {

  const encodedId =
    encodeURIComponent(
      ticketId,
    )


  return requestJson<
    SupportTicketDetail
  >(
    `/company/support/${encodedId}`,
  )
}


// -----------------------------------------------------------------------
// MESSAGES SUPPORT
// -----------------------------------------------------------------------

export async function addSupportMessage(
  ticketId:
    string,

  payload:
    CreateSupportMessagePayload,
): Promise<SupportMessage> {

  const encodedId =
    encodeURIComponent(
      ticketId,
    )


  return requestJson<
    SupportMessage
  >(
    `/company/support/${encodedId}/messages`,
    {
      method:
        'POST',

      body:
        JSON.stringify(
          payload,
        ),
    },
  )
}


// -----------------------------------------------------------------------
// MODIFIER LE STATUT D'UN TICKET
// -----------------------------------------------------------------------

export async function updateSupportTicketStatus(
  ticketId:
    string,

  status:
    SupportTicketStatus,

  operator:
    OperatorIdentity,
): Promise<SupportTicket> {

  const encodedId =
    encodeURIComponent(
      ticketId,
    )


  return requestJson<
    SupportTicket
  >(
    `/company/support/${encodedId}/status`,
    {
      method:
        'PUT',

      body:
        JSON.stringify(
          {
            status,

            ...operator,
          },
        ),
    },
  )
}


// =========================================================================
// INTERVENANTS
// =========================================================================

export async function getFieldAgents():
  Promise<FieldAgent[]> {

  return requestJson<
    FieldAgent[]
  >(
    '/company/agents',
  )
}


// =========================================================================
// LOGS D'AUDIT
// =========================================================================
//
// Les logs sont générés automatiquement côté backend.
//
// L'utilisateur entreprise doit pouvoir les consulter,
// mais pas les modifier.
//
// On ne crée donc volontairement aucune fonction :
//
// createAuditLog()
//
// depuis React.
//
// Le backend devra générer lui-même les logs lors des actions sensibles.
// =========================================================================

export async function getAuditLogs(
  customerId?:
    string,
): Promise<
  import('../types/company').AuditLog[]
> {

  const query =
    buildQuery(
      {
        customerId,
      },
    )


  return requestJson<
    import('../types/company').AuditLog[]
  >(
    `/company/audit${query}`,
  )
}


// =========================================================================
// INTERVENTIONS
// =========================================================================

export async function getInterventions(
  customerId?:
    string,
): Promise<Intervention[]> {

  const query =
    buildQuery(
      {
        customerId,
      },
    )


  return requestJson<
    Intervention[]
  >(
    `/company/interventions${query}`,
  )
}


// =========================================================================
// RAFRAÎCHISSEMENT SIMPLE
// =========================================================================
//
// Cette fonction est volontairement très légère.
//
// Elle sera utile au CompanyProvider pour vérifier que le backend
// entreprise répond.
//
// La route correspondante devra simplement renvoyer :
//
// {
//   "ok": true
// }
//
// =========================================================================

export async function pingCompanyApi():
  Promise<void> {

  await requestAction(
    '/company/health',
  )
}