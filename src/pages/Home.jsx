import { lazy, Suspense, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getVenues, getVenueBySlug } from '../lib/venues'
import { getLatestRelease } from '../lib/novinky'
import { KRAJE, CATEGORIES, CATEGORY_LABEL, TIERS, TIER_FILTERS, krajFull, formatDate } from '../lib/constants'
import { homeMeta, krajPath, byTierThenName } from '../lib/seo'
import { useHead } from '../lib/useHead'
import VenueCard from '../components/VenueCard'
import ViewToggle from '../components/ViewToggle'
import { trackOnce, trackDebounced } from '../lib/track'

// Leaflet se stáhne až po přepnutí na mapu (samostatný chunk)
const VenueMap = lazy(() => import('../components/VenueMap'))

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export default function Home() {
  const { data: venues, demo } = getVenues()
  const [params, setParams] = useSearchParams()

  // Všechny filtry žijí v URL: /?kraj=Vysočina&kat=zoo,hrad&uroven=5&q=…
  const kraj = params.get('kraj') || ''
  const kats = (params.get('kat') || '').split(',').filter(Boolean)
  const uroven = params.get('uroven') || ''
  const q = params.get('q') || ''
  const view = params.get('zobrazeni') === 'mapa' ? 'mapa' : 'seznam'
  useHead(homeMeta())
  const latest = getLatestRelease()
  const latestVenues = useMemo(() => (latest?.added || []).map(getVenueBySlug).filter(Boolean)
    .sort(byTierThenName).slice(0, 6), [latest])

  const update = (patch) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) next.delete(k)
      else next.set(k, Array.isArray(v) ? v.join(',') : v)
    }
    setParams(next, { replace: 'q' in patch })
    // Měříme jen, že filtr někdo použil (jednou za relaci), ne jeho hodnotu.
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue
      if (k === 'q') trackDebounced('filtr-q', 'filtr-q')
      else trackOnce(`filtr-${k}`)
    }
  }
  const toggleKat = (k) => update({ kat: kats.includes(k) ? kats.filter((x) => x !== k) : [...kats, k] })

  const minRank = (TIER_FILTERS.find((t) => t.value === uroven) || TIER_FILTERS[0]).minRank

  const filtered = useMemo(() => {
    const nq = norm(q)
    return venues.filter((v) => {
      if (kraj && v.kraj !== kraj) return false
      if (kats.length && !kats.includes(v.category)) return false
      if ((TIERS[v.tier]?.rank || 0) < minRank) return false
      if (nq) {
        const hay = norm(`${v.name} ${v.city || ''} ${v.kraj || ''} ${CATEGORY_LABEL[v.category] || ''}`)
        if (!hay.includes(nq)) return false
      }
      return true
    })
  }, [venues, kraj, kats.join(','), minRank, q])

  const applied = [
    kraj && { key: 'kraj', label: `Kraj: ${kraj}`, clear: () => update({ kraj: '' }) },
    ...kats.map((k) => ({ key: `kat-${k}`, label: CATEGORY_LABEL[k] || k, clear: () => toggleKat(k) })),
    uroven && { key: 'uroven', label: TIER_FILTERS.find((t) => t.value === uroven)?.label, clear: () => update({ uroven: '' }) },
    q && { key: 'q', label: `„${q}“`, clear: () => update({ q: '' }) },
  ].filter(Boolean)

  const countLabel = (n) => (n === 1 ? '1 místo' : n >= 2 && n <= 4 ? `${n} místa` : `${n} míst`)

  return (
    <>
      <section className="hero">
        <h1>Kam na výlet, když dětí máte víc než dvě</h1>
        <p className="lead">
          Místa po celé ČR, kde rodinné vstupné platí aspoň pro 4 děti. U každého uvádíme cenu
          pro celou rodinu, odkud ji máme a kdy jsme ji ověřili.
        </p>
      </section>

      {demo && (
        <div className="notice notice--warn" role="status">
          <strong>Ukázka.</strong> Katalog zatím plníme, proto tu vidíte smyšlená ukázková místa.
          Slouží jen k náhledu webu, nejsou to skutečné ceny.
        </div>
      )}

      <section className="filters" aria-label="Filtry">
        <div className="filters-row">
          <label className="field field--search">
            <span className="sr-only">Hledat</span>
            <input type="search" placeholder="Hledat podle názvu nebo města" value={q}
              onChange={(e) => update({ q: e.target.value })} />
          </label>
          <label className="field">
            <span className="sr-only">Kraj</span>
            <select value={kraj} onChange={(e) => update({ kraj: e.target.value })}>
              <option value="">Všechny kraje</option>
              {KRAJE.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        </div>

        <div className="filters-group">
          <span className="filters-label" id="lbl-uroven">Rodinná vstupenka platí pro</span>
          <div className="segmented" role="radiogroup" aria-labelledby="lbl-uroven">
            {TIER_FILTERS.map((t) => (
              <button key={t.value || 'all'} type="button" role="radio" aria-checked={uroven === t.value}
                className={uroven === t.value ? 'is-on' : ''} onClick={() => update({ uroven: t.value })}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filters-group">
          <span className="filters-label" id="lbl-kat">Typ místa</span>
          <div className="chips" role="group" aria-labelledby="lbl-kat">
            {CATEGORIES.map((c) => (
              <button key={c.value} type="button" aria-pressed={kats.includes(c.value)}
                className={`chip ${kats.includes(c.value) ? 'is-on' : ''}`} onClick={() => toggleKat(c.value)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="results-head">
        <p className="count" aria-live="polite">{countLabel(filtered.length)}</p>
        <ViewToggle value={view} onChange={(v) => update({ zobrazeni: v === 'mapa' ? 'mapa' : '' })} />
        {applied.length > 0 && (
          <div className="applied" aria-label="Použité filtry">
            {applied.map((a) => (
              <button key={a.key} type="button" className="applied-chip" onClick={a.clear}
                aria-label={`Zrušit filtr ${a.label}`}>
                {a.label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" className="link-btn" onClick={() => setParams(new URLSearchParams(view === 'mapa' ? { zobrazeni: 'mapa' } : {}))}>
              Zrušit vše
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>Tomuhle výběru zatím nic neodpovídá.</p>
          <div className="empty-actions">
            {kraj && <button className="btn btn--ghost" onClick={() => update({ kraj: '' })}>Zrušit filtr Kraj</button>}
            {uroven && <button className="btn btn--ghost" onClick={() => update({ uroven: '' })}>Zobrazit i místa pro 4 děti</button>}
            <Link className="btn btn--ghost" to="/tip/">Poslat tip na místo</Link>
          </div>
        </div>
      ) : view === 'mapa' ? (
        <Suspense fallback={<div className="map map--loading" role="status">Načítáme mapu…</div>}>
          <VenueMap venues={filtered} />
        </Suspense>
      ) : (
        <div className="grid">
          {filtered.map((v) => <VenueCard key={v.slug} venue={v} />)}
        </div>
      )}

      {latest && latestVenues.length > 0 && (
        <section className="latest" aria-labelledby="latest-h">
          <div className="latest-head">
            <h2 id="latest-h" className="h-sm">Naposledy přidáno</h2>
            <p className="meta">
              <time dateTime={latest.date}>{formatDate(latest.date)}</time> · {latest.headline}
            </p>
            <Link className="link-btn" to="/novinky/">Všechny novinky</Link>
          </div>
          <div className="grid">
            {latestVenues.map((v) => <VenueCard key={v.slug} venue={v} />)}
          </div>
        </section>
      )}

      <section className="tip-cta" aria-labelledby="tip-cta-h">
        <div>
          <h2 id="tip-cta-h" className="h-sm">Znáte místo s férovým vstupným?</h2>
          <p className="meta">Kde rodinná vstupenka platí pro 4 a více dětí. Ověříme to na ceníku a přidáme.</p>
        </div>
        <Link className="btn" to="/tip/">Pošlete tip</Link>
      </section>

      <nav className="kraj-links" aria-labelledby="kraje-h">
        <h2 id="kraje-h" className="h-sm">Výlety podle krajů</h2>
        <ul>
          {KRAJE.map((k) => <li key={k}><Link to={krajPath(k)}>{krajFull(k)}</Link></li>)}
        </ul>
      </nav>
    </>
  )
}
