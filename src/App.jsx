import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import VenueDetail from './pages/VenueDetail'
import KrajPage from './pages/KrajPage'
import About from './pages/About'
import NotFound from './pages/NotFound'

// Admin (a s ním Supabase klient) jen jako samostatný chunk – veřejné stránky ho nestahují.
const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/misto/:slug" element={<VenueDetail />} />
        <Route path="/kraj/:krajSlug" element={<KrajPage />} />
        <Route path="/o-projektu" element={<About />} />
        <Route path="/admin" element={<Suspense fallback={<p role="status">Načítáme…</p>}><Admin /></Suspense>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
