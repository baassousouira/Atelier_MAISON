// systemApi.ts

// -----------------------------------------------------------------------
// Couche de communication HTTP du frontend.
//
// Les composants React n'appellent jamais fetch() directement.
//
// Ils appellent :
//
// getEquipments()
// setEquipmentEnabled()
// sendRobotMovement()
// etc.
//
// systemApi.ts transforme ensuite cela
// en requête HTTP vers l'API.
//
// IMPORTANT :
//
// Le navigateur ne connaît plus directement l'adresse IP de FastAPI.
//
// Il appelle simplement :
//
// /api/...
//
// Vite reçoit la requête puis la transmet au serveur FastAPI.
// -----------------------------------------------------------------------

import type {
  BackendDecision,
  BackendEvent,
  Equipment,
  MediaItem,
  SystemState,
} from '../types/dashboard'


// =========================================================================
// ADRESSE API UTILISÉE PAR LE NAVIGATEUR
// =========================================================================
//
// Dans .env.local :
//
// VITE_API_BASE_URL=/api
//
// Nous utilisons volontairement une URL relative.
//
// PC :
//
//   http://localhost:5173/api/...
//
// Téléphone :
//
//   http://192.168.137.1:5173/api/...
//
// Vite transmet ensuite la requête au véritable serveur FastAPI.
//
// Aucune adresse IP Raspberry n'est connue du frontend.
// =========================================================================

const configuredApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL


const cleanedApiBaseUrl =
  configuredApiBaseUrl
    ?.trim()


// Si la variable n'existe pas,
// on préfère une erreur explicite.

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


export const API_BASE_URL =
  cleanedApiBaseUrl


// =========================================================================
// DEBUG API
// =========================================================================
//
// Ces logs s'affichent dans F12 -> Console.
//
// Les logs du proxy Vite s'affichent parallèlement
// dans le terminal VS Code.
// =========================================================================

const API_DEBUG =
  import.meta.env.DEV


// =========================================================================
// TYPES INTERNES
// =========================================================================

type OkResponse = {
  ok: boolean
}


type HealthResponse = {
  status: string
}


// =========================================================================
// CONSTRUCTION URL
// =========================================================================
//
// Exemple :
//
// API_BASE_URL = /api
// path = /system
//
// résultat :
//
// /api/system
// =========================================================================

function buildUrl(
  path: string,
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
// URL ABSOLUE D'UNE RESSOURCE DU SERVEUR
// =========================================================================
//
// FastAPI peut renvoyer :
//
// /api/cameras/.../stream
//
// ou :
//
// /api/media/files/....jpg
//
// Nous devons transformer cette URL relative
// en une URL utilisable par le navigateur.
//
// Sur le PC :
//
// window.location.origin
// = http://localhost:5173
//
// donc :
//
// /api/media/...
// devient
// http://localhost:5173/api/media/...
//
// Sur le téléphone :
//
// window.location.origin
// = http://192.168.137.1:5173
//
// donc :
//
// /api/media/...
// devient
// http://192.168.137.1:5173/api/media/...
//
// Dans les deux cas, Vite proxyfie ensuite /api vers FastAPI.
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


  // Si le serveur fournit déjà une URL complète,
  // on ne la modifie pas.

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


  // On ajoute Content-Type uniquement
  // lorsqu'une requête contient réellement un body.

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
// LECTURE D'UNE ERREUR HTTP
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

    // La réponse ne contient pas
    // de JSON exploitable.
  }


  return (
    `Erreur HTTP ${response.status}`
  )
}


// =========================================================================
// LOG : REQUÊTE
// =========================================================================

function logApiRequest(
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
    `[API →] ${method} ${path}`,
  )
}


// =========================================================================
// LOG : SUCCÈS
// =========================================================================

function logApiSuccess(
  method:
    string,

  path:
    string,

  status:
    number,

  statusText:
    string,

  durationMs:
    number,
): void {

  if (
    !API_DEBUG
  ) {

    return
  }


  console.log(
    (
      `[API ←] ${method} ${path} `
      + `→ ${status} ${statusText} `
      + `(${Math.round(durationMs)} ms)`
    ),
  )
}


// =========================================================================
// LOG : ERREUR HTTP
// =========================================================================

function logApiHttpError(
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
      `[API ✗] ${method} ${path} `
      + `→ HTTP ${status}`
    ),

    detail,
  )
}


// =========================================================================
// LOG : ERREUR RÉSEAU
// =========================================================================

function logApiNetworkError(
  method:
    string,

  path:
    string,

  error:
    unknown,
): void {

  console.error(
    (
      `[API ✗] ${method} ${path} `
      + '→ requête impossible'
    ),

    error,
  )
}


// =========================================================================
// FETCH GÉNÉRIQUE
// =========================================================================
//
// Toutes les requêtes JSON passent ici.
//
// Exemple :
//
// getEquipments()
//
// ↓
//
// requestJson('/equipements')
//
// ↓
//
// fetch('/api/equipements')
//
// ↓
//
// Vite
//
// ↓
//
// http://192.168.1.1:8000/api/equipements
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


  logApiRequest(
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

    // Ici la requête n'a pas obtenu
    // de réponse HTTP exploitable.

    logApiNetworkError(
      method,
      path,
      error,
    )


    throw error
  }


  const durationMs =
    performance.now()
    -
    startTime


  // ---------------------------------------------------------------------
  // ERREUR HTTP
  // ---------------------------------------------------------------------

  if (
    !response.ok
  ) {

    const detail =
      await readErrorDetail(
        response,
      )


    logApiHttpError(
      method,
      path,
      response.status,
      detail,
    )


    throw new Error(
      detail,
    )
  }


  // ---------------------------------------------------------------------
  // SUCCÈS
  // ---------------------------------------------------------------------

  logApiSuccess(
    method,
    path,
    response.status,
    response.statusText,
    durationMs,
  )


  const data =
    await response.json()


  return data as T
}


// =========================================================================
// ACTION {"ok": true}
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
      "Le serveur n'a pas confirmé l'action.",
    )
  }
}


// =========================================================================
// HEALTH
// =========================================================================
//
// GET /api/health
//
// Permet de vérifier que :
//
// navigateur
//      ↓
// Vite
//      ↓
// FastAPI
//
// fonctionne.
// =========================================================================

export async function pingServer():
  Promise<void> {

  const response =
    await requestJson<
      HealthResponse
    >(
      '/health',
    )


  if (
    response.status !==
      'ok'
  ) {

    throw new Error(
      (
        'Le serveur central '
        + 'a répondu avec un état inattendu.'
      ),
    )
  }
}


// =========================================================================
// SYSTÈME GLOBAL
// =========================================================================

export async function getSystemState():
  Promise<SystemState> {

  return requestJson<
    SystemState
  >(
    '/system',
  )
}


export async function setSecurityArmed(
  armed:
    boolean,
): Promise<SystemState> {

  return requestJson<
    SystemState
  >(
    '/system',
    {
      method:
        'PUT',

      body:
        JSON.stringify(
          {
            armed,
          },
        ),
    },
  )
}


// =========================================================================
// ÉQUIPEMENTS
// =========================================================================

export async function getEquipments():
  Promise<Equipment[]> {

  const equipment =
    await requestJson<
      Equipment[]
    >(
      '/equipements',
    )


  // Les URL vidéo retournées par FastAPI
  // sont transformées en URL passant
  // elles aussi par Vite.

  return equipment.map(
    (
      item,
    ) => ({
      ...item,

      streamUrl:
        serverResourceUrl(
          item.streamUrl,
        ),
    }),
  )
}


export async function setEquipmentEnabled(
  equipmentId:
    string,

  enabled:
    boolean,
): Promise<void> {

  const encodedId =
    encodeURIComponent(
      equipmentId,
    )


  await requestAction(
    `/equipements/${encodedId}/enabled`,
    {
      method:
        'PUT',

      body:
        JSON.stringify(
          {
            enabled,
          },
        ),
    },
  )
}


// =========================================================================
// ÉVÉNEMENTS
// =========================================================================

export async function getEvents(
  decision?:
    BackendDecision,
): Promise<BackendEvent[]> {

  if (
    decision ===
      undefined
  ) {

    return requestJson<
      BackendEvent[]
    >(
      '/evenements',
    )
  }


  const encodedDecision =
    encodeURIComponent(
      decision,
    )


  return requestJson<
    BackendEvent[]
  >(
    `/evenements?decision=${encodedDecision}`,
  )
}


export async function sendEventDecision(
  eventId:
    string,

  decision:
    Exclude<
      BackendDecision,
      'en_attente'
    >,
): Promise<void> {

  const encodedId =
    encodeURIComponent(
      eventId,
    )


  await requestAction(
    `/evenements/${encodedId}/decision`,
    {
      method:
        'POST',

      body:
        JSON.stringify(
          {
            decision,
          },
        ),
    },
  )
}


export async function deleteEvent(
  eventId:
    string,
): Promise<void> {

  const encodedId =
    encodeURIComponent(
      eventId,
    )


  await requestAction(
    `/evenements/${encodedId}`,
    {
      method:
        'DELETE',
    },
  )
}


export async function clearEvents():
  Promise<void> {

  await requestAction(
    '/evenements',
    {
      method:
        'DELETE',
    },
  )
}


// =========================================================================
// ROBOT
// =========================================================================
//
// React envoie uniquement la commande au serveur central.
//
// Le frontend ne connaît pas l'adresse IP du Raspberry mobile.
//
// FastAPI choisit le contrôleur déclaré avec has_servo=true.
// =========================================================================

export async function sendRobotMovement(
  command:
    string,

  speed:
    number,
): Promise<void> {

  await requestAction(
    '/robot/command',
    {
      method:
        'POST',

      body:
        JSON.stringify(
          {
            command,
            speed,
          },
        ),
    },
  )
}


// =========================================================================
// CAPTURE CAMÉRA
// =========================================================================

export async function requestScreenshot(
  cameraId:
    string,
): Promise<MediaItem> {

  const encodedId =
    encodeURIComponent(
      cameraId,
    )


  const item =
    await requestJson<
      MediaItem
    >(
      `/cameras/${encodedId}/screenshot`,
      {
        method:
          'POST',
      },
    )


  return {
    ...item,

    mediaUrl:
      serverResourceUrl(
        item.mediaUrl,
      ),
  }
}


// =========================================================================
// MÉDIAS
// =========================================================================

export async function getMedia():
  Promise<MediaItem[]> {

  const media =
    await requestJson<
      MediaItem[]
    >(
      '/media',
    )


  return media.map(
    (
      item,
    ) => ({
      ...item,

      mediaUrl:
        serverResourceUrl(
          item.mediaUrl,
        ),
    }),
  )
}


export async function setMediaSaved(
  mediaId:
    string,

  saved:
    boolean,
): Promise<void> {

  const encodedId =
    encodeURIComponent(
      mediaId,
    )


  await requestAction(
    `/media/${encodedId}/saved`,
    {
      method:
        'PUT',

      body:
        JSON.stringify(
          {
            saved,
          },
        ),
    },
  )
}