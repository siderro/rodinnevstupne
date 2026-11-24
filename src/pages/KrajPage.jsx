import { lazy, Suspense, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getVenuesByKraj, getVenues } from '../lib/venues'
import { KRAJE, TIERS, krajBySlug, krajFull, krajLocative } from '../lib/constants'
import { krajMeta, krajPath, byTierThenName } from '../lib/seo'
import { useHead } from '../lib/useHead'
import VenueCard from '../components/VenueCard'
import ViewToggle from '../components/ViewToggle'
import NearbyKraje, { nearbyFor } from '../components/NearbyKraje'
import { trackOnce } from '../lib/track'
import NotFound from './NotFound'

const VenueMap = lazy(() => import('../components/VenueMap'))

// „12 míst se vstupenkou 2 + 4“
const TIER_COUNT = { gold: 'se vstupenkou pro všechny děti', silver: 'se vstupenkou 2 + 5', base: 'se vstupenkou 2 + 4' }
const countPlaces = (n) => (n === 1 ? '1 místo' : n >= 2 && n <= 4 ? `${n} místa` : `${n} míst`)

export default function KrajPage() {
  const { krajSlug } = useParams()
  const kraj = krajBySlug(krajSlug)
  const { demo } = getVenues()
  const venues = useMemo(() => (kraj ? getVenuesByKraj(kraj).slice().sort(byTierThenName) : []), [kraj])
  // Zobrazení drží URL, aby tlačítko Zpět vrátilo mapu
  const [params, setParams] = useSearchParams()
  const view = params.get('zobrazeni') === 'mapa' ? 'mapa' : 'seznam'
  const setView = (v) => setParams(v === 'mapa' ? { zobrazeni: 'mapa' } : {}, { replace: true })
  const nearby = useMemo(() => (kraj && venues.length < 4 ? nearbyFor(kraj, getVenues().data, () => true) : null), [kraj, venues])
  useHead(kraj ? krajMeta(kraj, venues) : { title: 'Stránka nenalezena – Rodinné vstupné', noindex: true })

  if (!kraj) return <NotFound />

  const loc = krajLocative(kraj)
  const counts = Object.keys(TIERS).map((k) => [k, venues.filter((v) => v.tier === k).length]).filter(([, n]) => n > 0)

  return (
    <>
      <p className="crumbs"><Link to="/">← Všechny výlety</Link></p>
      <section className="hero hero--kraj">
        <h1>Výlety pro velké rodiny {loc}</h1>
        <p className="lead">
          {venues.length > 0
            ? <>Vybrali jsme {countPlaces(venues.length)} {loc}, kde rodinné vstupné platí aspoň pro 3 děti.
              U každého uvádíme cenu pro celou rodinu, odkaz na oficiální ceník a datum, kdy jsme ji ověřili.</>
            : <>{krajFull(kraj)} zatím v katalogu nemá žádné místo. Ověřujeme ceníky postupně a tenhle kraj doplníme.
              Znáte tu místo, kde rodinná vstupenka pokryje aspoň 3 děti? Pošlete nám ho.</>}
        </p>
        {counts.length > 0 && (
          <ul className="kraj-tiers" aria-label="Počet míst podle úrovně">
            {counts.map(([k, n]) => <li key={k}><strong>{countPlaces(n)}</strong> {TIER_COUNT[k]}</li>)}
          </ul>
        )}
      </section>

      {demo && venues.length > 0 && (
        <div className="notice notice--warn" role="status">
          <strong>Ukázka.</strong> Katalog zatím plníme, proto tu vidíte smyšlená ukázková místa.
        </div>
      )}

      {venues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-actions">
            <Link className="btn" to="/tip/">Poslat tip na místo</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="results-head">
            <p className="count">{countPlaces(venues.length)} {loc}</p>
            <ViewToggle value={view} onChange={(v) => { if (v === 'mapa') trackOnce('filtr-zobrazeni'); setView(v) }} />
            <Link className="link-btn" to={`/?kraj=${encodeURIComponent(kraj)}`}>Filtrovat podrobněji</Link>
          </div>
          {view === 'mapa' ? (
            <Suspense fallback={<div className="map map--loading" role="status">Načítáme mapu…</div>}>
              <VenueMap venues={venues} />
            </Suspense>
          ) : (
            <div className="grid">
              {venues.map((v) => <VenueCard key={v.slug} venue={v} />)}
            </div>
          )}
        </>
      )}

      {nearby && <NearbyKraje nearby={nearby} krajLink={krajPath} />}
      {venues.length > 0 && venues.length < 4 && (
        <p className="tip-nudge">Znáte místo {loc}? <Link to="/tip/">Pošlete tip</Link></p>
      )}

      <nav className="kraj-links" aria-labelledby="kraje-h">
        <h2 id="kraje-h" className="h-sm">Další kraje</h2>
        <ul>
          {KRAJE.filter((k) => k !== kraj).map((k) => <li key={k}><Link to={krajPath(k)}>{krajFull(k)}</Link></li>)}
        </ul>
      </nav>
    </>
  )
}
