import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Kanonická adresa webu (canonical, og:url, sitemap). Lze přepsat env SITE_URL nebo VITE_SITE_URL.
process.env.VITE_SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://rodinnevstupne.cz').replace(/\/$/, '')

// Base cesta: '/' pro vlastní doménu, '/<repo>/' pro <user>.github.io/<repo>/ (nastavuje deploy.yml).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
