// App.tsx

// -----------------------------------------------------------------------
// ROUTAGE PRINCIPAL DE L'APPLICATION
// -----------------------------------------------------------------------
//
// Deux espaces utilisent le même serveur FastAPI mais possèdent des
// contextes React distincts :
//
// /utilisateur
//   ↓
// SystemProvider
//   ↓
// UserLayout
//
// /entreprise
//   ↓
// CompanyProvider
//   ↓
// CompanyLayout
//
// IMPORTANT :
//
// Il n'existe toujours pas de vraie authentification.
//
// /connexion reste donc uniquement l'écran de choix du prototype.
//
// -----------------------------------------------------------------------

import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import CompanyLayout
  from './components/company/CompanyLayout'

import UserLayout
  from './components/user/UserLayout'

import {
  CompanyProvider,
} from './contexts/CompanyProvider'

import {
  SystemProvider,
} from './contexts/SystemProvider'

import CompanyAlertsPage
  from './pages/CompanyAlertsPage'

import CompanyAuditPage
  from './pages/CompanyAuditPage'

import CompanyCustomersPage
  from './pages/CompanyCustomersPage'

import CompanyDashboardPage
  from './pages/CompanyDashboardPage'

import CompanyInterventionsPage
  from './pages/CompanyInterventionsPage'

import CompanyInfrastructurePage
  from './pages/CompanyInfrastructurePage'

import CompanySupportPage
  from './pages/CompanySupportPage'

import LoginPage
  from './pages/LoginPage'

import UserAlertsPage
  from './pages/UserAlertsPage'

import UserCamerasPage
  from './pages/UserCamerasPage'

import UserDashboardPage
  from './pages/UserDashboardPage'

import UserEquipmentDetailPage
  from './pages/UserEquipmentDetailPage'

import UserEquipmentPage
  from './pages/UserEquipmentPage'

import UserHistoryPage
  from './pages/UserHistoryPage'

import UserRobotPage
  from './pages/UserRobotPage'

import UserStatisticsPage
  from './pages/UserStatisticspage'


// =========================================================================
// APPLICATION
// =========================================================================

function App() {

  return (
    <Routes>

      {/* ================================================================
          ENTRÉE
          ================================================================ */}

      <Route
        path="/"
        element={
          <Navigate
            to="/connexion"
            replace
          />
        }
      />


      <Route
        path="/connexion"
        element={
          <LoginPage />
        }
      />


      {/* ================================================================
          ESPACE PARTICULIER
          ================================================================

          SystemProvider reste partagé entre toutes les sous-pages
          utilisateur.
          ================================================================ */}

      <Route
        path="/utilisateur"
        element={
          <SystemProvider>
            <UserLayout />
          </SystemProvider>
        }
      >
        <Route
          index
          element={
            <UserDashboardPage />
          }
        />

        <Route
          path="alertes"
          element={
            <UserAlertsPage />
          }
        />

        <Route
          path="cameras"
          element={
            <UserCamerasPage />
          }
        />

        <Route
          path="robot"
          element={
            <UserRobotPage />
          }
        />

        <Route
          path="equipements"
          element={
            <UserEquipmentPage />
          }
        />

        <Route
          path="equipements/:equipmentId"
          element={
            <UserEquipmentDetailPage />
          }
        />

        <Route
          path="statistiques"
          element={
            <UserStatisticsPage />
          }
        />

        <Route
          path="historique"
          element={
            <UserHistoryPage />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/utilisateur"
              replace
            />
          }
        />
      </Route>


      {/* ================================================================
          ESPACE ENTREPRISE
          ================================================================

          CompanyProvider est monté UNE SEULE FOIS ici.

          Toutes les sous-pages entreprise partagent donc :

          - les alertes ;
          - le client sélectionné ;
          - le ticket sélectionné ;
          - les intervenants ;
          - les interventions ;
          - l'infrastructure réseau ;
          - les logs ;
          - l'état de connexion ;
          - l'identité opérateur temporaire.
          ================================================================ */}

      <Route
        path="/entreprise"
        element={
          <CompanyProvider>
            <CompanyLayout />
          </CompanyProvider>
        }
      >
        <Route
          index
          element={
            <CompanyDashboardPage />
          }
        />

        <Route
          path="alertes"
          element={
            <CompanyAlertsPage />
          }
        />

        <Route
          path="clients"
          element={
            <CompanyCustomersPage />
          }
        />

        <Route
          path="support"
          element={
            <CompanySupportPage />
          }
        />

        <Route
          path="interventions"
          element={
            <CompanyInterventionsPage />
          }
        />

        <Route
          path="infrastructure"
          element={
            <CompanyInfrastructurePage />
          }
        />

        <Route
          path="audit"
          element={
            <CompanyAuditPage />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/entreprise"
              replace
            />
          }
        />
      </Route>


      {/* ================================================================
          ROUTE INCONNUE
          ================================================================ */}

      <Route
        path="*"
        element={
          <Navigate
            to="/connexion"
            replace
          />
        }
      />
    </Routes>
  )
}


export default App
