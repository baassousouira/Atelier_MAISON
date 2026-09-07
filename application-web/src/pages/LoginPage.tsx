// LoginPage.tsx

// -----------------------------------------------------------------------
// PAGE D'ENTRÉE DU PROTOTYPE
// -----------------------------------------------------------------------
//
// Il n'existe actuellement aucune API d'authentification dans main.py.
// On ne conserve donc pas l'ancien faux système email/mot de passe.
//
// Cette page sert uniquement à choisir l'interface à ouvrir pendant
// l'intégration : espace particulier ou centre de surveillance.
//
// Quand une vraie route /api/auth/login sera développée, cette page pourra
// redevenir une page de connexion réelle sans changer le reste du système.
// -----------------------------------------------------------------------

import { Building2, House } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import '../styles/login.css'

function LoginPage() {
  const navigate = useNavigate()

  return (
    <main className="login-shell">
      <section
        className="login-introduction"
        aria-label="Présentation d’Atelier Maison"
      >
        <header className="brand">
          <span className="brand-mark" aria-hidden="true">AM</span>

          <div>
            <p className="brand-name">Safeplace</p>
            <p className="brand-description">Supervision domestique</p>
          </div>
        </header>

        <div className="introduction-content">
          <p className="introduction-label">Système de surveillance connecté</p>
          <h1>Gardez le contrôle de votre installation.</h1>
          <p className="introduction-text">
            Consultez vos équipements, vérifiez les alertes et pilotez
            votre système depuis une interface centralisée.
          </p>

          <div className="network-card">
            <div className="network-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div>
              <p className="network-title">Architecture centralisée</p>
              <p className="network-text">
                L’interface communique avec FastAPI, qui relaie ensuite les
                informations vers les Raspberry du réseau local.
              </p>
            </div>
          </div>
        </div>

        <div className="system-summary" aria-label="Fonctions du système">
          <div>
            <strong>FIXED</strong>
            <span>Système sans servo</span>
          </div>
          <div>
            <strong>MOBILE</strong>
            <span>Système avec servo</span>
          </div>
          <div>
            <strong>1</strong>
            <span>Serveur central</span>
          </div>
        </div>
      </section>

      <section className="login-area">
        <div className="mobile-brand">
          <span className="brand-mark" aria-hidden="true">AM</span>
          <span>Atelier Maison</span>
        </div>

        <div className="login-card">
          <div className="login-heading">
            <p className="login-eyebrow">Prototype d’intégration</p>
            <h2>Choisir un espace</h2>
            <p>
              L’authentification n’est pas mise en place : choisissez simplement
              l’interface à tester.
            </p>
          </div>

          <div className="form-field">
            <button
              className="login-button"
              type="button"
              onClick={() => navigate('/utilisateur')}
            >
              <House aria-hidden="true" />
              Ouvrir l’espace particulier
            </button>
          </div>

          <div className="form-field">
            <button
              className="login-button"
              type="button"
              onClick={() => navigate('/entreprise')}
            >
              <Building2 aria-hidden="true" />
              Ouvrir le centre de surveillance
            </button>
          </div>

          <div className="access-information">
            <span className="information-icon" aria-hidden="true">i</span>
            <p>
              Une vraie authentification devra être ajoutée au serveur avant
              une utilisation hors prototype.
            </p>
          </div>
        </div>

        <p className="login-footer">
          Prototype Atelier MAISON · Mariam Sara Kevidu Lyna Maïwenne
        </p>
      </section>
    </main>
  )
}

export default LoginPage
