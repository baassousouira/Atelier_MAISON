// main.tsx

// -----------------------------------------------------------------------
// POINT D'ENTRÉE REACT
// -----------------------------------------------------------------------
//
// Vite charge ce fichier en premier. Il monte l'application React dans la
// balise <div id="root"> définie dans index.html.
//
// L'ancien AuthProvider a été retiré car il simulait une authentification
// locale. Une vraie authentification pourra être réintroduite quand le
// serveur FastAPI exposera des routes dédiées.
// -----------------------------------------------------------------------

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error("L'élément racine #root est introuvable.")
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
