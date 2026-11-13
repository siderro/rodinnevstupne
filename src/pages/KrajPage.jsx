import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getVenuesByKraj, getVenues } from '../lib/venues'
import { KRAJE, TIERS, krajBySlug, krajFull, krajLocative, reportMailto } from '../lib/constants'
import { krajMeta, krajPath, byTierThenName } from '../lib/seo'
import { useHead } from '../lib/useHead'
import VenueCard from '../components/VenueCard'
import ViewToggle from '../components/ViewToggle'
import NotFound from './NotFound'

const VenueMap = lazy(() => import('../components/VenueMap'))

const countPlaces = (n) => (n === 1 ? '1 místo' : n >= 2 && n <= 4 ? `${n} místa` : `${n} míst`)

export default function KrajPage() {
  const { krajSlug } = useParams()
  const kraj = krajBySlug(krajSlug)
  const { demo } = getVenues()
  const venues = useMemo(() => (kraj ? getVenuesByKraj(kraj).slice().sort(byTierThenName) : []), [kraj])
  const [view, setView] = useState('seznam')
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
            ? <>Vybrali jsme {countPlaces(venues.length)} {loc}, kde rodinné vstupné platí aspoň pro 4 děti.
              U každého uvádíme cenu pro celou rodinu, odkaz na oficiální ceník a datum, kdy jsme ji ověřili.</>
            : <>{krajFull(kraj)} zatím v katalogu nemá žádné místo. Ověřujeme ceníky postupně a tenhle kraj doplníme.
              Znáte tu místo, kde rodinná vstupenka pokryje aspoň 4 děti? Pošlete nám ho.</>}
        </p>
        {counts.length > 0 && (
          <ul className="kraj-tiers" aria-label="Počet míst podle úrovně">
            {counts.map(([k, n]) => <li key={k}><strong>{n}</strong> {TIERS[k].name} ({TIERS[k].label})</li>)}
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
            <a className="btn" href={reportMailto(`Tip na místo – ${krajFull(kraj)}`, 'Název místa:\nOdkaz na ceník:\n')}>Poslat tip na místo</a>
            <Link className="btn btn--ghost" to="/">Prohlédnout ostatní kraje</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="results-head">
            <p className="count">{countPlaces(venues.length)}</p>
            <ViewToggle value={view} onChange={setView} />
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

      <nav className="kraj-links" aria-labelledby="kraje-h">
        <h2 id="kraje-h" className="h-sm">Další kraje</h2>
        <ul>
          {KRAJE.filter((k) => k !== kraj).map((k) => <li key={k}><Link to={krajPath(k)}>{krajFull(k)}</Link></li>)}
        </ul>
      </nav>
    </>
  )
}
