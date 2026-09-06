// CompanyProvider.tsx

// -----------------------------------------------------------------------
// PROVIDER DE L'ESPACE ENTREPRISE - ATELIER MAISON
// -----------------------------------------------------------------------
//
// Ce composant contient l'état React partagé par toutes les pages du
// centre de supervision.
//
// Architecture :
//
// Page entreprise
//       ↓
// useCompany()
//       ↓
// CompanyProvider
//       ↓
// companyApi.ts
//       ↓
// Vite /api
//       ↓
// FastAPI
//
//
// Les pages ne doivent donc pas appeler companyApi.ts directement
// lorsqu'une donnée doit être partagée entre plusieurs pages.
//
// -----------------------------------------------------------------------

import {
  useCallback,
  useMemo,
  useState,
} from 'react'

import type {
  ReactNode,
} from 'react'


import {
  addSupportMessage,
  assignControllerToSite,
  createComment,
  createCustomer,
  createCustomerSite,
  dispatchFieldAgent,
  getAuditLogs,
  getCompanyAlert,
  getCompanyAlerts,
  getCompanyDashboardStatistics,
  getCompanyControllers,
  getCustomerDetail,
  getCustomers,
  getCustomerStatistics,
  getFieldAgents,
  getInterventions,
  getSupportTicket,
  getSupportTickets,
  openCompanyAlertCamera,
  pingCompanyApi,
  registerClientCall,
  requestEmergencyEscalation,
  sendCompanyAlertRobotCommand,
  setCompanyAlertEquipmentEnabled,
  takeCompanyAlert,
  takeCompanyAlertScreenshot,
  updateCompanyAlertStatus,
  updateSupportTicketStatus,
} from '../services/companyApi'


import type {
  CompanyAlertFilters,
  CustomerFilters,
  OperatorIdentity,
  SupportTicketFilters,
} from '../services/companyApi'


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


import {
  CompanyContext,
} from './company-context'


import type {
  CompanyConnectionStatus,
  CompanyFeedback,
  CompanyLoadingState,
} from './company-context'


// =========================================================================
// PROPS
// =========================================================================

type CompanyProviderProps = {
  children:
    ReactNode
}


// =========================================================================
// IDENTITÉ OPÉRATEUR TEMPORAIRE
// =========================================================================
//
// IMPORTANT :
//
// Il ne s'agit PAS d'une authentification.
//
// Pour le moment, l'espace entreprise n'a pas encore de vraie connexion.
//
// On utilise donc une identité technique temporaire afin que les actions
// puissent déjà être associées à quelqu'un dans :
//
// - les timelines ;
// - les commentaires ;
// - les appels ;
// - les logs.
//
// Plus tard, cette constante disparaîtra.
//
// currentOperator proviendra alors de l'utilisateur réellement connecté.
// =========================================================================

const TEMPORARY_OPERATOR:
  OperatorIdentity = {

    operatorId:
      'demo-operator',

    operatorName:
      'Opérateur Atelier Maison',
  }


// =========================================================================
// ÉTAT INITIAL DES CHARGEMENTS
// =========================================================================

const INITIAL_LOADING_STATE:
  CompanyLoadingState = {

    dashboard:
      false,

    alerts:
      false,

    alertDetail:
      false,

    customers:
      false,

    customerDetail:
      false,

    controllers:
      false,

    customerCreation:
      false,

    support:
      false,

    supportDetail:
      false,

    agents:
      false,

    audit:
      false,

    interventions:
      false,

    action:
      false,
  }


// =========================================================================
// PROVIDER
// =========================================================================

export function CompanyProvider(
  {
    children,
  }:
    CompanyProviderProps,
) {

  // =====================================================================
  // DASHBOARD
  // =====================================================================

  const [
    dashboardStatistics,
    setDashboardStatistics,
  ] =
    useState<
      CompanyDashboardStatistics | null
    >(
      null,
    )


  // =====================================================================
  // ALERTES
  // =====================================================================

  const [
    alerts,
    setAlerts,
  ] =
    useState<
      CompanyAlert[]
    >(
      [],
    )


  const [
    selectedAlert,
    setSelectedAlert,
  ] =
    useState<
      CompanyAlertDetail | null
    >(
      null,
    )


  // =====================================================================
  // CLIENTS
  // =====================================================================

  const [
    customers,
    setCustomers,
  ] =
    useState<
      Customer[]
    >(
      [],
    )


  const [
    selectedCustomer,
    setSelectedCustomer,
  ] =
    useState<
      CustomerDetail | null
    >(
      null,
    )


  // =====================================================================
  // RASPBERRY DÉCOUVERTS
  // =====================================================================
  //
  // Cette liste provient uniquement des heartbeats enregistrés par
  // FastAPI. Aucun Raspberry n'est défini en dur dans React.
  // =====================================================================

  const [
    controllers,
    setControllers,
  ] =
    useState<
      CompanyController[]
    >(
      [],
    )


  // =====================================================================
  // SUPPORT
  // =====================================================================

  const [
    supportTickets,
    setSupportTickets,
  ] =
    useState<
      SupportTicket[]
    >(
      [],
    )


  const [
    selectedSupportTicket,
    setSelectedSupportTicket,
  ] =
    useState<
      SupportTicketDetail | null
    >(
      null,
    )


  // =====================================================================
  // INTERVENANTS
  // =====================================================================

  const [
    fieldAgents,
    setFieldAgents,
  ] =
    useState<
      FieldAgent[]
    >(
      [],
    )


  // =====================================================================
  // INTERVENTIONS
  // =====================================================================

  const [
    interventions,
    setInterventions,
  ] =
    useState<
      Intervention[]
    >(
      [],
    )


  // =====================================================================
  // AUDIT
  // =====================================================================

  const [
    auditLogs,
    setAuditLogs,
  ] =
    useState<
      AuditLog[]
    >(
      [],
    )


  // =====================================================================
  // CONNEXION API
  // =====================================================================

  const [
    connectionStatus,
    setConnectionStatus,
  ] =
    useState<
      CompanyConnectionStatus
    >(
      'UNKNOWN',
    )


  // =====================================================================
  // CHARGEMENTS
  // =====================================================================

  const [
    loading,
    setLoading,
  ] =
    useState<
      CompanyLoadingState
    >(
      INITIAL_LOADING_STATE,
    )


  // =====================================================================
  // ERREUR
  // =====================================================================

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    )


  // =====================================================================
  // FEEDBACK
  // =====================================================================

  const [
    feedback,
    setFeedback,
  ] =
    useState<
      CompanyFeedback | null
    >(
      null,
    )


  // =====================================================================
  // UTILITAIRE : CHANGEMENT DE LOADING
  // =====================================================================
  //
  // Cela évite de recopier partout :
  //
  // setLoading(previous => ({
  //   ...previous,
  //   alerts: true
  // }))
  //
  // =====================================================================

  const setLoadingValue =
    useCallback(
      (
        key:
          keyof CompanyLoadingState,

        value:
          boolean,
      ) => {

        setLoading(
          (
            previous,
          ) => ({
            ...previous,

            [key]:
              value,
          }),
        )
      },
      [],
    )


  // =====================================================================
  // UTILITAIRE : MESSAGE D'ERREUR
  // =====================================================================

  const getErrorMessage =
    useCallback(
      (
        caughtError:
          unknown,

        fallback:
          string,
      ): string => {

        if (
          caughtError
          instanceof Error
        ) {

          return caughtError.message
        }


        return fallback
      },
      [],
    )


  // =====================================================================
  // CONNEXION
  // =====================================================================

  const checkCompanyConnection =
    useCallback(
      async (): Promise<void> => {

        setConnectionStatus(
          'CHECKING',
        )


        try {

          await pingCompanyApi()


          // Une erreur 502 précédente ne doit pas rester affichée après
          // le retour du serveur.
          setError(
            null,
          )


          setConnectionStatus(
            'CONNECTED',
          )


        } catch (
          caughtError
        ) {

          // L'absence du serveur est un état attendu pendant les tests
          // hors réseau. On évite donc de la présenter comme un crash
          // applicatif à l'utilisateur.
          if (
            import.meta.env.DEV
          ) {

            console.info(
              '[CompanyProvider] Serveur central indisponible.',
              caughtError,
            )
          }


          setError(
            null,
          )


          setConnectionStatus(
            'DISCONNECTED',
          )
        }
      },
      [],
    )


  // =====================================================================
  // DASHBOARD
  // =====================================================================

  const refreshDashboard =
    useCallback(
      async (): Promise<void> => {

        setLoadingValue(
          'dashboard',
          true,
        )

        setError(
          null,
        )


        try {

          const statistics =
            await getCompanyDashboardStatistics()


          setDashboardStatistics(
            statistics,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'le dashboard entreprise.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'dashboard',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // LISTE DES ALERTES
  // =====================================================================

  const refreshAlerts =
    useCallback(
      async (
        filters:
          CompanyAlertFilters = {},
      ): Promise<void> => {

        setLoadingValue(
          'alerts',
          true,
        )

        setError(
          null,
        )


        try {

          const result =
            await getCompanyAlerts(
              filters,
            )


          setAlerts(
            result,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'les alertes entreprise.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'alerts',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // OUVRIR UNE ALERTE
  // =====================================================================

  const openAlert =
    useCallback(
      async (
        alertId:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'alertDetail',
          true,
        )

        setError(
          null,
        )


        try {

          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                "Impossible d'ouvrir "
                + "l'alerte."
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'alertDetail',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // FERMER LA FICHE ALERTE
  // =====================================================================

  const clearSelectedAlert =
    useCallback(
      (): void => {

        setSelectedAlert(
          null,
        )
      },
      [],
    )


  // =====================================================================
  // PRENDRE EN CHARGE UNE ALERTE
  // =====================================================================

  const takeAlert =
    useCallback(
      async (
        alertId:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )

        setError(
          null,
        )


        try {

          await takeCompanyAlert(
            alertId,
            TEMPORARY_OPERATOR,
          )


          // On recharge la fiche complète afin de récupérer :
          //
          // - le nouveau statut ;
          // - l'opérateur ;
          // - la nouvelle action dans la timeline.

          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


          setAlerts(
            (
              previous,
            ) =>
              previous.map(
                (
                  alert,
                ) =>
                  alert.id ===
                    detail.alert.id
                    ? detail.alert
                    : alert,
              ),
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                'Alerte prise en charge.',
            },
          )


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                "Impossible de prendre "
                + "l'alerte en charge."
              ),
            )


          setError(
            message,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // MODIFIER LE STATUT D'UNE ALERTE
  // =====================================================================

  const changeAlertStatus =
    useCallback(
      async (
        alertId:
          string,

        status:
          CompanyAlertStatus,

        comment?:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )


        try {

          await updateCompanyAlertStatus(
            alertId,
            {
              ...TEMPORARY_OPERATOR,

              status,

              comment,
            },
          )


          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


          setAlerts(
            (
              previous,
            ) =>
              previous.map(
                (
                  alert,
                ) =>
                  alert.id ===
                    detail.alert.id
                    ? detail.alert
                    : alert,
              ),
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                "Statut de l'alerte mis à jour.",
            },
          )


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                "Impossible de modifier "
                + "le statut de l'alerte."
              ),
            )


          setError(
            message,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // ENREGISTRER UN APPEL CLIENT
  // =====================================================================

  const registerCall =
    useCallback(
      async (
        alertId:
          string,

        result:
          ClientCallResult,

        comment?:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )


        try {

          await registerClientCall(
            alertId,
            {
              ...TEMPORARY_OPERATOR,

              result,

              comment,
            },
          )


          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                "Résultat de l'appel enregistré.",
            },
          )


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                "Impossible d'enregistrer "
                + "l'appel client."
              ),
            )


          setError(
            message,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // ENVOYER UN INTERVENANT
  // =====================================================================

  const dispatchAgent =
    useCallback(
      async (
        alertId:
          string,

        agentId:
          string,

        comment?:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )


        try {

          await dispatchFieldAgent(
            alertId,
            {
              ...TEMPORARY_OPERATOR,

              agentId,

              comment,
            },
          )


          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                'Intervenant affecté à cette alerte.',
            },
          )


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                "Impossible d'envoyer "
                + "un intervenant."
              ),
            )


          setError(
            message,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // ESCALADE URGENCE
  // =====================================================================

  const escalateAlert =
    useCallback(
      async (
        alertId:
          string,

        reason:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )


        try {

          await requestEmergencyEscalation(
            alertId,
            {
              ...TEMPORARY_OPERATOR,

              reason,
            },
          )


          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                (
                  'Demande d’escalade '
                  + 'enregistrée.'
                ),
            },
          )


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                "Impossible d'enregistrer "
                + "l'escalade."
              ),
            )


          setError(
            message,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // COMMENTAIRE SUR UNE ALERTE
  // =====================================================================

  const addAlertComment =
    useCallback(
      async (
        alertId:
          string,

        message:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )


        try {

          await createComment(
            'ALERT',
            alertId,
            {
              ...TEMPORARY_OPERATOR,

              message,
            },
          )


          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                'Commentaire ajouté.',
            },
          )


        } catch (
          caughtError
        ) {

          const messageErreur =
            getErrorMessage(
              caughtError,
              (
                "Impossible d'ajouter "
                + 'le commentaire.'
              ),
            )


          setError(
            messageErreur,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message:
                messageErreur,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )




  // =====================================================================
  // OUVRIR UNE CAMÉRA DEPUIS UNE ALERTE
  // =====================================================================
  //
  // Cette action passe par une route entreprise spécifique.
  //
  // FastAPI peut ainsi :
  //
  // - enregistrer la consultation dans la timeline ;
  // - créer un log d'audit ;
  // - renvoyer l'URL réelle du flux vidéo.
  // =====================================================================

  const openAlertCamera =
    useCallback(
      async (
        alertId:
          string,

        cameraId:
          string,
      ): Promise<string> => {

        setLoadingValue(
          'action',
          true,
        )

        setError(
          null,
        )


        try {

          const streamUrl =
            await openCompanyAlertCamera(
              alertId,
              cameraId,
              TEMPORARY_OPERATOR,
            )


          // On recharge la fiche complète afin de récupérer
          // la nouvelle entrée CAMERA_VIEWED dans la timeline.
          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                'Accès caméra enregistré.',
            },
          )


          return streamUrl


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                'Impossible d’ouvrir '
                + 'la caméra.'
              ),
            )


          setError(
            message,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


          // Cette fonction doit retourner une URL en cas de succès.
          // En cas d'échec, on laisse donc l'erreur remonter à la page.
          throw caughtError


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // PRENDRE UNE CAPTURE DEPUIS UNE ALERTE
  // =====================================================================
  //
  // Le backend :
  //
  // - demande réellement la capture à la caméra ;
  // - stocke le média ;
  // - ajoute la trace dans la timeline ;
  // - ajoute la trace dans les logs d'audit.
  // =====================================================================

  const takeAlertScreenshot =
    useCallback(
      async (
        alertId:
          string,

        cameraId:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )

        setError(
          null,
        )


        try {

          await takeCompanyAlertScreenshot(
            alertId,
            cameraId,
            TEMPORARY_OPERATOR,
          )


          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                'Capture enregistrée.',
            },
          )


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                'Impossible de prendre '
                + 'la capture.'
              ),
            )


          setError(
            message,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // COMMANDER LE ROBOT DEPUIS UNE ALERTE
  // =====================================================================
  //
  // On ne recharge PAS toute la fiche après chaque commande.
  //
  // Un contrôle directionnel peut envoyer de nombreuses requêtes
  // successives. Recharger toute l'alerte après chaque mouvement
  // créerait beaucoup de trafic inutile.
  //
  // Le backend conserve quand même la trace de chaque commande.
  // =====================================================================

  const sendAlertRobotCommand =
    useCallback(
      async (
        alertId:
          string,

        command:
          string,

        speed:
          number,
      ): Promise<void> => {

        setError(
          null,
        )


        try {

          await sendCompanyAlertRobotCommand(
            alertId,
            command,
            speed,
            TEMPORARY_OPERATOR,
          )


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                'Impossible de commander '
                + 'le robot.'
              ),
            )


          setError(
            message,
          )


          // La page de contrôle peut avoir besoin de savoir
          // immédiatement qu'une commande a échoué.
          throw caughtError
        }
      },
      [
        getErrorMessage,
      ],
    )


  // =====================================================================
  // ACTIVER / DÉSACTIVER UN ÉQUIPEMENT DEPUIS UNE ALERTE
  // =====================================================================

  const setAlertEquipmentEnabled =
    useCallback(
      async (
        alertId:
          string,

        equipmentId:
          string,

        enabled:
          boolean,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )

        setError(
          null,
        )


        try {

          await setCompanyAlertEquipmentEnabled(
            alertId,
            equipmentId,
            enabled,
            TEMPORARY_OPERATOR,
          )


          const detail =
            await getCompanyAlert(
              alertId,
            )


          setSelectedAlert(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                enabled
                  ? 'Équipement activé.'
                  : 'Équipement désactivé.',
            },
          )


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                'Impossible de modifier '
                + "l'équipement."
              ),
            )


          setError(
            message,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )

  // =====================================================================
  // CLIENTS
  // =====================================================================

  const refreshCustomers =
    useCallback(
      async (
        filters:
          CustomerFilters = {},
      ): Promise<void> => {

        setLoadingValue(
          'customers',
          true,
        )


        try {

          const result =
            await getCustomers(
              filters,
            )


          setCustomers(
            result,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'les clients.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'customers',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // FICHE CLIENT
  // =====================================================================

  const openCustomer =
    useCallback(
      async (
        customerId:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'customerDetail',
          true,
        )


        try {

          const detail =
            await getCustomerDetail(
              customerId,
            )


          setSelectedCustomer(
            detail,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'la fiche client.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'customerDetail',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  const clearSelectedCustomer =
    useCallback(
      (): void => {

        setSelectedCustomer(
          null,
        )
      },
      [],
    )


  // =====================================================================
  // RASPBERRY DISPONIBLES
  // =====================================================================
  //
  // La liste est demandée au serveur central.
  //
  // Un Raspberry apparaît ici après au moins un heartbeat reçu par FastAPI.
  // =====================================================================

  const refreshControllers =
    useCallback(
      async (): Promise<void> => {

        setLoadingValue(
          'controllers',
          true,
        )


        try {

          const result =
            await getCompanyControllers()


          setControllers(
            result,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'les Raspberry disponibles.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'controllers',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // CRÉATION CLIENT + SITE + INSTALLATION
  // =====================================================================
  //
  // Le formulaire utilisateur représente une seule opération métier,
  // mais le backend conserve trois ressources séparées :
  //
  // Customer -> MonitoredSite -> Raspberry
  //
  // Cette fonction orchestre donc les trois appels dans le bon ordre.
  // =====================================================================

  const createCustomerInstallation =
    useCallback(
      async (
        input:
          CreateCustomerInstallationInput,
      ): Promise<CustomerDetail | null> => {

        setLoadingValue(
          'customerCreation',
          true,
        )

        setError(
          null,
        )

        setFeedback(
          null,
        )


        try {

          // 1. Création de l'identité client.
          const customer =
            await createCustomer(
              input.customer,
            )


          // 2. Création du site surveillé.
          const site =
            await createCustomerSite(
              customer.id,
              input.site,
            )


          // 3. Affectation des Raspberry sélectionnés.
          //
          // Le tableau peut être vide : cela permet de créer un dossier
          // avant que le matériel soit physiquement connecté.
          for (
            const controllerIp
            of input.controllerIps
          ) {

            await assignControllerToSite(
              site.id,
              controllerIp,
            )
          }


          // 4. Relecture depuis le serveur.
          //
          // On ne fabrique pas la fiche localement : le serveur reste
          // l'unique source de vérité.
          const [
            customerList,
            controllerList,
            detail,
          ] =
            await Promise.all(
              [
                getCustomers(),
                getCompanyControllers(),
                getCustomerDetail(
                  customer.id,
                ),
              ],
            )


          setCustomers(
            customerList,
          )

          setControllers(
            controllerList,
          )

          setSelectedCustomer(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                (
                  input.controllerIps.length > 0
                    ? (
                      'Client, site et installation '
                      + 'créés avec succès.'
                    )
                    : (
                      'Client et site créés. '
                      + 'Le matériel pourra être rattaché plus tard.'
                    )
                ),
            },
          )


          return detail


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                'Impossible de créer '
                + "l'installation client."
              ),
            )


          setError(
            message,
          )

          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


          return null


        } finally {

          setLoadingValue(
            'customerCreation',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // STATISTIQUES CLIENT
  // =====================================================================

  const loadCustomerStatistics =
    useCallback(
      async (
        customerId:
          string,

        period:
          CustomerStatisticsPeriod,
      ): Promise<void> => {

        setLoadingValue(
          'customerDetail',
          true,
        )


        try {

          const statistics =
            await getCustomerStatistics(
              customerId,
              period,
            )


          setSelectedCustomer(
            (
              previous,
            ) => {

              if (
                previous === null
                ||
                previous.customer.id
                  !== customerId
              ) {

                return previous
              }


              return {
                ...previous,

                statistics,
              }
            },
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'les statistiques client.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'customerDetail',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // COMMENTAIRE CLIENT
  // =====================================================================

  const addCustomerComment =
    useCallback(
      async (
        customerId:
          string,

        message:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )


        try {

          await createComment(
            'CUSTOMER',
            customerId,
            {
              ...TEMPORARY_OPERATOR,

              message,
            },
          )


          const detail =
            await getCustomerDetail(
              customerId,
            )


          setSelectedCustomer(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                'Commentaire client ajouté.',
            },
          )


        } catch (
          caughtError
        ) {

          const messageErreur =
            getErrorMessage(
              caughtError,
              (
                "Impossible d'ajouter "
                + 'le commentaire.'
              ),
            )


          setError(
            messageErreur,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message:
                messageErreur,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // SUPPORT : LISTE
  // =====================================================================

  const refreshSupportTickets =
    useCallback(
      async (
        filters:
          SupportTicketFilters = {},
      ): Promise<void> => {

        setLoadingValue(
          'support',
          true,
        )


        try {

          const result =
            await getSupportTickets(
              filters,
            )


          setSupportTickets(
            result,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'les tickets support.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'support',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // SUPPORT : FICHE TICKET
  // =====================================================================

  const openSupportTicket =
    useCallback(
      async (
        ticketId:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'supportDetail',
          true,
        )


        try {

          const detail =
            await getSupportTicket(
              ticketId,
            )


          setSelectedSupportTicket(
            detail,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'le ticket support.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'supportDetail',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  const clearSelectedSupportTicket =
    useCallback(
      (): void => {

        setSelectedSupportTicket(
          null,
        )
      },
      [],
    )


  // =====================================================================
  // SUPPORT : MESSAGE
  // =====================================================================

  const sendSupportMessage =
    useCallback(
      async (
        ticketId:
          string,

        message:
          string,

        internal:
          boolean,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )


        try {

          await addSupportMessage(
            ticketId,
            {
              ...TEMPORARY_OPERATOR,

              message,

              internal,
            },
          )


          const detail =
            await getSupportTicket(
              ticketId,
            )


          setSelectedSupportTicket(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                internal
                  ? 'Note interne ajoutée.'
                  : 'Message envoyé.',
            },
          )


        } catch (
          caughtError
        ) {

          const messageErreur =
            getErrorMessage(
              caughtError,
              (
                "Impossible d'ajouter "
                + 'le message.'
              ),
            )


          setError(
            messageErreur,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message:
                messageErreur,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // SUPPORT : STATUT
  // =====================================================================

  const changeSupportStatus =
    useCallback(
      async (
        ticketId:
          string,

        status:
          SupportTicketStatus,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )


        try {

          await updateSupportTicketStatus(
            ticketId,
            status,
            TEMPORARY_OPERATOR,
          )


          const detail =
            await getSupportTicket(
              ticketId,
            )


          setSelectedSupportTicket(
            detail,
          )


          setSupportTickets(
            (
              previous,
            ) =>
              previous.map(
                (
                  ticket,
                ) =>
                  ticket.id ===
                    detail.ticket.id
                    ? detail.ticket
                    : ticket,
              ),
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                'Statut du ticket mis à jour.',
            },
          )


        } catch (
          caughtError
        ) {

          const message =
            getErrorMessage(
              caughtError,
              (
                'Impossible de modifier '
                + 'le ticket support.'
              ),
            )


          setError(
            message,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // SUPPORT : COMMENTAIRE INTERNE
  // =====================================================================

  const addSupportComment =
    useCallback(
      async (
        ticketId:
          string,

        message:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'action',
          true,
        )


        try {

          await createComment(
            'SUPPORT_TICKET',
            ticketId,
            {
              ...TEMPORARY_OPERATOR,

              message,
            },
          )


          const detail =
            await getSupportTicket(
              ticketId,
            )


          setSelectedSupportTicket(
            detail,
          )


          setFeedback(
            {
              type:
                'SUCCESS',

              message:
                'Commentaire interne ajouté.',
            },
          )


        } catch (
          caughtError
        ) {

          const messageErreur =
            getErrorMessage(
              caughtError,
              (
                "Impossible d'ajouter "
                + 'le commentaire.'
              ),
            )


          setError(
            messageErreur,
          )


          setFeedback(
            {
              type:
                'ERROR',

              message:
                messageErreur,
            },
          )


        } finally {

          setLoadingValue(
            'action',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // INTERVENANTS
  // =====================================================================

  const refreshFieldAgents =
    useCallback(
      async (): Promise<void> => {

        setLoadingValue(
          'agents',
          true,
        )


        try {

          const result =
            await getFieldAgents()


          setFieldAgents(
            result,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'les intervenants.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'agents',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // INTERVENTIONS
  // =====================================================================

  const refreshInterventions =
    useCallback(
      async (
        customerId?:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'interventions',
          true,
        )


        try {

          const result =
            await getInterventions(
              customerId,
            )


          setInterventions(
            result,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + 'les interventions.'
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'interventions',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // AUDIT
  // =====================================================================

  const refreshAuditLogs =
    useCallback(
      async (
        customerId?:
          string,
      ): Promise<void> => {

        setLoadingValue(
          'audit',
          true,
        )


        try {

          const result =
            await getAuditLogs(
              customerId,
            )


          setAuditLogs(
            result,
          )


        } catch (
          caughtError
        ) {

          setError(
            getErrorMessage(
              caughtError,
              (
                'Impossible de charger '
                + "les logs d'audit."
              ),
            ),
          )


        } finally {

          setLoadingValue(
            'audit',
            false,
          )
        }
      },
      [
        getErrorMessage,
        setLoadingValue,
      ],
    )


  // =====================================================================
  // NETTOYAGE DES MESSAGES
  // =====================================================================

  const clearError =
    useCallback(
      (): void => {

        setError(
          null,
        )
      },
      [],
    )


  const clearFeedback =
    useCallback(
      (): void => {

        setFeedback(
          null,
        )
      },
      [],
    )


  // =====================================================================
  // VALEUR DU CONTEXTE
  // =====================================================================
  //
  // useMemo évite de recréer inutilement l'objet complet lorsque les
  // dépendances n'ont pas changé.
  // =====================================================================

  const value =
    useMemo(
      () => ({

        currentOperator:
          TEMPORARY_OPERATOR,


        connectionStatus,

        checkCompanyConnection,


        dashboardStatistics,

        refreshDashboard,


        alerts,

        selectedAlert,

        refreshAlerts,

        openAlert,

        clearSelectedAlert,

        takeAlert,

        changeAlertStatus,

        registerCall,

        dispatchAgent,

        escalateAlert,

        addAlertComment,

        openAlertCamera,

        takeAlertScreenshot,

        sendAlertRobotCommand,

        setAlertEquipmentEnabled,


        customers,

        selectedCustomer,

        refreshCustomers,

        openCustomer,

        clearSelectedCustomer,

        loadCustomerStatistics,

        addCustomerComment,

        controllers,

        refreshControllers,

        createCustomerInstallation,


        supportTickets,

        selectedSupportTicket,

        refreshSupportTickets,

        openSupportTicket,

        clearSelectedSupportTicket,

        sendSupportMessage,

        changeSupportStatus,

        addSupportComment,


        fieldAgents,

        refreshFieldAgents,


        interventions,

        refreshInterventions,


        auditLogs,

        refreshAuditLogs,


        loading,

        error,

        feedback,

        clearError,

        clearFeedback,
      }),
      [
        connectionStatus,
        checkCompanyConnection,

        dashboardStatistics,
        refreshDashboard,

        alerts,
        selectedAlert,
        refreshAlerts,
        openAlert,
        clearSelectedAlert,
        takeAlert,
        changeAlertStatus,
        registerCall,
        dispatchAgent,
        escalateAlert,
        addAlertComment,
        openAlertCamera,
        takeAlertScreenshot,
        sendAlertRobotCommand,
        setAlertEquipmentEnabled,

        customers,
        selectedCustomer,
        refreshCustomers,
        openCustomer,
        clearSelectedCustomer,
        loadCustomerStatistics,
        addCustomerComment,
        controllers,
        refreshControllers,
        createCustomerInstallation,

        supportTickets,
        selectedSupportTicket,
        refreshSupportTickets,
        openSupportTicket,
        clearSelectedSupportTicket,
        sendSupportMessage,
        changeSupportStatus,
        addSupportComment,

        fieldAgents,
        refreshFieldAgents,

        interventions,
        refreshInterventions,

        auditLogs,
        refreshAuditLogs,

        loading,
        error,
        feedback,
        clearError,
        clearFeedback,
      ],
    )


  // =====================================================================
  // PROVIDER
  // =====================================================================

  return (
    <CompanyContext.Provider
      value={
        value
      }
    >
      {
        children
      }
    </CompanyContext.Provider>
  )
}