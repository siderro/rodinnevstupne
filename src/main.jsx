import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../brand/tokens.css'
import '../brand/typography.css'
import './styles.css'
import App from './App'

// basename = Vite base (VITE_BASE), bez koncového lomítka
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

const app = (
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

// Prerenderované stránky (dist/misto/…, dist/kraj/…, dist/index.html) mají v #root hotové HTML
// a v data-prerendered cestu, pro kterou vzniklo. Hydratujeme jen při shodě cesty a bez filtrů v URL;
// jinak (např. 404.html fallback nebo /?kraj=…) vykreslíme od nuly, ať se nic neliší.
const root = document.getElementById('root')
const strip = (p) => p.replace(/\/+$/, '') || '/'
const prerendered = root.dataset.prerendered
const canHydrate = root.hasChildNodes() && prerendered != null &&
  strip(window.location.pathname) === strip(basename === '/' ? prerendered : basename + prerendered) &&
  !window.location.search

if (canHydrate) {
  ReactDOM.hydrateRoot(root, app)
} else {
  root.textContent = ''
  ReactDOM.createRoot(root).render(app)
}
