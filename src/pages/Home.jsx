import { lazy, Suspense, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getVenues, getVenueBySlug } from '../lib/venues'
import { getLatestRelease } from '../lib/novinky'
import { KRAJE, CATEGORIES, CATEGORY_LABEL, KIDS_FILTERS, parseKids, pluralKids, kidsPhrase, kidsChip, fitsKids, isClosed, krajFull, krajLocative, formatDate } from '../lib/constants'
import { homeMeta, krajPath, byTierThenName } from '../lib/seo'
import { useHead } from '../lib/useHead'
import { useMonth } from '../lib/useMonth'
import VenueCard from '../components/VenueCard'
import NearbyKraje, { nearbyFor } from '../components/NearbyKraje'
import ViewToggle from '../components/ViewToggle'
import { trackOnce, trackDebounced } from '../lib/track'

// Leaflet se stáhne až po přepnutí na mapu (samostatný chunk)
const VenueMap = lazy(() => import('../components/VenueMap'))

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export default function Home() {
  const { data: venues, demo } = getVenues()
  const [params, setParams] = useSearchParams()

  // Všechny filtry žijí v URL: /?kraj=Vysočina&kat=zoo,hrad&deti=5&q=…
  const kraj = params.get('kraj') || ''
  const kats = (params.get('kat') || '').split(',').filter(Boolean)
  const deti = parseKids(params.get('deti'))
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

  // Hledáme jen v názvu, obci a typu místa (kraj má vlastní výběr; „hrad“ by jinak našel celý Královéhradecký kraj).
  const hay = (v) => norm(`${v.name} ${v.city || ''} ${CATEGORY_LABEL[v.category] || ''}`)
  // Když slovo nic nenajde, zkusíme ho bez koncovky („Prahu“ → „prah“, „Ostravě“ → „ostrav“).
  const nq = useMemo(() => {
    let w = norm(q).trim()
    for (let i = 0; i < 2 && w.length >= 5 && !venues.some((v) => hay(v).includes(w)); i++) w = w.slice(0, -1)
    return w
  }, [venues, q])

  // Shoda se všemi filtry kromě vynechaného (pro počty na čipech a tlačítka v prázdném stavu)
  const matches = (v, skip = null) => (skip === 'kraj' || !kraj || v.kraj === kraj)
    && (skip === 'kat' || !kats.length || kats.includes(v.category))
    && (skip === 'deti' || fitsKids(v, deti))
    && (skip === 'q' || !nq || hay(v).includes(nq))
  const countWithout = (skip) => venues.filter((v) => matches(v, skip)).length

  // Pořadí z dat (kraj → název); místa „až 3 děti“ a teď zavřená místa jdou na konec
  const month = useMonth()
  const filtered = useMemo(() => {
    const last = (v) => (v.tier === 'three' ? 2 : 0) + (isClosed(v, month) ? 1 : 0)
    return venues.filter((v) => matches(v)).sort((a, b) => last(a) - last(b))
  }, [venues, kraj, kats.join(','), deti, nq, month])
  const katCounts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.value,
    venues.filter((v) => v.category === c.value && matches(v, 'kat')).length])), [venues, kraj, deti, nq])
  // Typy, které v katalogu zatím nemají žádné místo, nenabízíme
  const shownCats = CATEGORIES.filter((c) => kats.includes(c.value) || venues.some((v) => v.category === c.value))
  // Hledané slovo, které je vlastně kraj („jihomoravsky“) → nabídneme filtr kraje
  const krajHit = nq.length >= 4 ? KRAJE.find((k) => k !== kraj && norm(k).startsWith(nq)) : null

  const applied = [
    kraj && { key: 'kraj', label: `Kraj: ${kraj}`, clear: () => update({ kraj: '' }) },
    ...kats.map((k) => ({ key: `kat-${k}`, label: CATEGORY_LABEL[k] || k, clear: () => toggleKat(k) })),
    deti && { key: 'deti', label: kidsChip(deti), clear: () => update({ deti: '' }) },
    q && { key: 'q', label: `„${q}“`, clear: () => update({ q: '' }) },
  ].filter(Boolean)

  const countLabel = (n) => (n === 1 ? '1 místo' : n >= 2 && n <= 4 ? `${n} místa` : `${n} míst`)
  // „12 míst v Praze pro 5 dětí“
  const countLine = (n) => [countLabel(n), kraj ? krajLocative(kraj) : 'po celé ČR', deti && kidsPhrase(deti)].filter(Boolean).join(' ')
  // Tlačítka, která z prázdného výsledku vedou k nenulovému (nanejvýš 3, podle počtu)
  // Sousední kraje: při 0 výsledcích otevřeně, při 1–3 (bez hledání) sbaleně. Typ místa se neuvolňuje.
  const nearby = useMemo(() => {
    if (!kraj || filtered.length > 3 || (filtered.length > 0 && q)) return null
    const n = nearbyFor(kraj, venues, (v) => (!kats.length || kats.includes(v.category)) && fitsKids(v, deti))
    return n.total ? n : null
  }, [venues, kraj, kats.join(','), deti, nq, filtered.length])
  const krajLink = (k) => {
    const next = new URLSearchParams(params)
    next.set('kraj', k)
    next.delete('q')
    return `/?${next}`
  }
  const relax = [
    kraj && { label: 'Celá ČR', n: countWithout('kraj'), patch: { kraj: '' } },
    kats.length > 0 && { label: kraj ? `Všechny typy ${krajLocative(kraj)}` : 'Všechny typy míst', n: countWithout('kat'), patch: { kat: [] } },
    deti && { label: 'Pro jakýkoli počet dětí', n: countWithout('deti'), patch: { deti: '' } },
    q && { label: 'Zrušit hledání', n: countWithout('q'), patch: { q: '' } },
  ].filter((r) => r && r.n > 0).sort((a, b) => b.n - a.n).slice(0, 3)

  return (
    <>
      <section className="hero hero--home">
        <div className="hero-text">
          <h1>Kam na výlet, když je dětí spousta</h1>
          <p className="hero-sub">Rodinné vstupné aspoň pro 4 děti, s ověřenou cenou. Máte tři? Platí i pro vás.</p>
          <p className="lead">
            Místa po celé ČR. U každého uvádíme cenu pro celou rodinu, odkud ji máme a kdy jsme
            ji ověřili.
          </p>
        </div>
        {/* Kresba jako od dítěte: mapa ČR s výlety a rodina se sedmi dětmi (brand/illustration/gen-hero.py).
            Vykresluje se maskou v barvě textu, takže sedí i v tmavém režimu. Čistě dekorativní. */}
        <div className="hero-art" aria-hidden="true"
          style={{ '--hero-art': `url(${import.meta.env.BASE_URL}hero-cr.svg)` }} />
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
          <span className="filters-label" id="lbl-deti">Kolik dětí jede?</span>
          <div className="segmented segmented--num" role="radiogroup" aria-labelledby="lbl-deti">
            {KIDS_FILTERS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={deti === n} aria-label={pluralKids(n)}
                className={deti === n ? 'is-on' : ''} onClick={() => update({ deti: deti === n ? '' : String(n) })}>
                {n}
              </button>
            ))}
          </div>
          {!deti && <p className="filters-hint">Vyberte a ceny přepočítáme pro vaši rodinu.</p>}
        </div>

        <div className="filters-group">
          <span className="filters-label" id="lbl-kat">Typ místa</span>
          <div className="chips" role="group" aria-labelledby="lbl-kat">
            {shownCats.map((c) => (
              <button key={c.value} type="button" aria-pressed={kats.includes(c.value)}
                aria-label={`${c.label}, v tomto výběru ${countLabel(katCounts[c.value])}`}
                className={`chip ${kats.includes(c.value) ? 'is-on' : ''} ${katCounts[c.value] === 0 ? 'is-empty' : ''}`} onClick={() => toggleKat(c.value)}>
                {c.label} <span className="chip-n" aria-hidden="true">{katCounts[c.value]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {applied.length > 0 && (
        <div className="applied" aria-label="Použité filtry">
          {applied.map((a) => (
            <button key={a.key} type="button" className="applied-chip" onClick={a.clear}
              aria-label={`Zrušit filtr ${a.label}`}>
              {a.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          {applied.length > 1 && (
            <button type="button" className="link-btn" onClick={() => setParams(new URLSearchParams(view === 'mapa' ? { zobrazeni: 'mapa' } : {}))}>
              Zrušit vše
            </button>
          )}
        </div>
      )}
      <div className="results-head">
        <p className="count" aria-live="polite">{countLine(filtered.length)}</p>
        <ViewToggle value={view} onChange={(v) => update({ zobrazeni: v === 'mapa' ? 'mapa' : '' })} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h2 className="h-sm">Pro tenhle výběr zatím nemáme žádné místo</h2>
          {q
            ? <p>Na „{q}“ jsme nic nenašli. Hledáme v názvech míst a obcí. Zkuste základní tvar slova nebo vyberte kraj.</p>
            : <p>Do katalogu dáváme jen místa, kde rodinná vstupenka pokryje aspoň 4 děti, a ceníky ověřujeme postupně.</p>}
          <div className="empty-actions">
            {krajHit && <button className="btn" onClick={() => update({ kraj: krajHit, q: '' })}>
              Výlety {krajLocative(krajHit)} ({venues.filter((v) => v.kraj === krajHit && fitsKids(v, deti)).length})</button>}
            {relax.map((r) => <button key={r.label} className="btn btn--ghost" onClick={() => update(r.patch)}>{r.label} ({countLabel(r.n)})</button>)}
          </div>
          {nearby && <NearbyKraje nearby={nearby} krajLink={krajLink} kids={deti} />}
          <p className="tip-nudge">
            Znáte {kraj ? krajLocative(kraj) : 'nějaké'} místo, kde rodinná vstupenka pokryje aspoň 4 děti? <Link to="/tip/">Pošlete tip</Link>
          </p>
        </div>
      ) : view === 'mapa' ? (
        <Suspense fallback={<div className="map map--loading" role="status">Načítáme mapu…</div>}>
          <VenueMap venues={filtered} kids={deti} />
        </Suspense>
      ) : (
        <div className="grid">
          {filtered.map((v) => <VenueCard key={v.slug} venue={v} kids={deti} />)}
        </div>
      )}

      {/* Málo výsledků v kraji: sousedy nabídneme jen sbaleně, aby se nepletli s výsledky */}
      {nearby && filtered.length > 0 && (
        <details className="nearby-more">
          <summary>Ukázat i místa v sousedních krajích ({nearby.total})</summary>
          <NearbyKraje nearby={nearby} krajLink={krajLink} kids={deti} />
        </details>
      )}

      {/* Při filtrování by místa z jiných krajů pod výsledky mátla, proto jen bez filtrů. */}
      {latest && latestVenues.length > 0 && !kraj && !kats.length && !q && (
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
