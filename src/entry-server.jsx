// SSR vstup pro prerender (scripts/postbuild.mjs). Vykreslí stránku pro danou cestu do HTML řetězce.
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App'

export { getVenues, getVenuesByKraj, getVenueBySlug } from './lib/venues'
export { getNovinky } from './lib/novinky'
export { KRAJE, SITE_URL } from './lib/constants'
export * from './lib/seo'

// Stejný basename jako v klientu (main.jsx), jinak by se při hydrataci lišily odkazy.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export function render(path) {
  const location = basename === '/' ? path : basename + path
  return renderToString(
    <React.StrictMode>
      <StaticRouter basename={basename} location={location}>
        <App />
      </StaticRouter>
    </React.StrictMode>,
  )
}
