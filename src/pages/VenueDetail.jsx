import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getVenueBySlug } from '../lib/venues'
import TierBadge from '../components/TierBadge'
import Calculator from '../components/Calculator'
import ShareButton from '../components/ShareButton'
import {
  CATEGORY_LABEL, BUY_ME_A_COFFEE_URL, SITE_URL, formatPrice, formatDate, dataAge, familyTicketSummary, krajFull, monthRange, sourceDate,
  familyQuote, reopensIn, conditionChips, parseKids, pluralKids, QUOTE_KIDS,
} from '../lib/constants'
import { useMonth } from '../lib/useMonth'
import { venueMeta, krajPath, venuePath } from '../lib/seo'
import { useHead } from '../lib/useHead'
import { track } from '../lib/track'

export default function VenueDetail() {
  const { slug } = useParams()
  const venue = getVenueBySlug(slug)
  const month = useMonth()
  // ?deti=N z filtru „Kolik dětí jede?“ přepočítá odpověď i kalkulačku
  const [params] = useSearchParams()
  const kids = parseKids(params.get('deti')) || QUOTE_KIDS
  useHead(venue ? venueMeta(venue) : { title: 'Místo nenalezeno – Rodinné vstupné', noindex: true })

  if (!venue) return (
    <div className="empty-state">
      <h1>Místo jsme nenašli</h1>
      <p>Možná se změnila adresa, nebo místo z katalogu vypadlo.</p>
      <Link className="btn" to="/">Zpět na výlety</Link>
    </div>
  )

  const age = dataAge(venue.verified_at)
  const q = familyQuote(venue, month, kids)
  const reopens = reopensIn(venue, month)
  const priceOrFree = (n) => (n === 0 ? 'zdarma' : formatPrice(n))
  const mapsUrl = venue.lat != null && venue.lng != null
    ? `https://mapy.com/fnc/v1/route?end=${venue.lng},${venue.lat}`
    : venue.address ? `https://mapy.com/fnc/v1/search?query=${encodeURIComponent(venue.address)}` : null

  return (
    <article className="detail">
      <nav className="crumbs" aria-label="Drobečková navigace">
        <Link to="/">Všechny výlety</Link>
        {venue.kraj && <> <span aria-hidden="true">›</span> <Link to={krajPath(venue.kraj)}>{krajFull(venue.kraj)}</Link></>}
      </nav>

      {venue.sample && (
        <div className="notice notice--warn" role="status">
          <strong>Ukázka.</strong> Smyšlené místo pro náhled webu, ceny nejsou skutečné.
        </div>
      )}

      {venue.alert && (
        <div className="notice notice--warn" role="status">
          <strong>Upozornění:</strong> {venue.alert}
        </div>
      )}

      <header className="detail-head">
        <TierBadge venue={venue} />
        <h1>{venue.name}</h1>
        <p className="meta">
          {CATEGORY_LABEL[venue.category] || 'Místo'} · {[venue.city, venue.kraj && `${venue.kraj}${venue.kraj === 'Praha' || venue.kraj === 'Vysočina' ? '' : ' kraj'}`].filter(Boolean).join(', ')}
        </p>

        <div className="answer">
          <p className="answer-line">
            {q.price != null
              ? <>2 dospělí + {pluralKids(q.kids)} {q.price === 0 ? 'mají vstup' : 'zaplatí'} <strong className="answer-price">{priceOrFree(q.price)}</strong>
                {q.offseason && <span className="meta"> (mimo sezónu)</span>}
                {q.extraKids > 0 && <span className="meta"> (s doplatkem za {q.extraKids === 1 ? 'dítě' : 'děti'} navíc)</span>}</>
              : <>Rodinné vstupné {familyTicketSummary(venue)}. Cenu najdete na webu místa.</>}
          </p>
          {reopens && !venue.alert && <p className="answer-closed">Teď je zavřeno, otevírá v {reopens}.</p>}
          {/* první štítek (počet dětí) už říká odznak */}
          {conditionChips(venue).length > 1 && (
            <ul className="cond-chips" aria-label="Podmínky rodinné vstupenky">
              {conditionChips(venue).slice(1).map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
        </div>

        <div className="detail-actions">
          {mapsUrl && <a className="btn" href={mapsUrl} target="_blank" rel="noreferrer">Navigovat<span className="sr-only"> přes Mapy.com (nové okno)</span></a>}
          {venue.website && <a className="btn btn--ghost" href={venue.website} target="_blank" rel="noreferrer" onClick={() => track('web-klik', venue.slug)}>Web místa<span className="sr-only"> (otevře se v novém okně)</span> ↗</a>}
          <ShareButton url={`${SITE_URL}${venuePath(venue)}?utm_source=share`} title={venue.name}
            text={`${venue.name}: rodinné vstupné ${familyTicketSummary(venue)}`} />
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <Calculator key={`${venue.slug}-${kids}`} venue={venue} initialKids={kids} />

          <section className="rule-box" aria-labelledby="rule-h">
            <h2 id="rule-h">Rodinné vstupné</h2>
            <p className="rule-summary">{familyTicketSummary(venue)}</p>

            <table className="prices">
              <tbody>
                {venue.price_family != null &&
                  <tr><th scope="row">Rodinná vstupenka{venue.price_family_offseason != null && venue.season_months && <span className="meta"> ({monthRange(venue.season_months)})</span>}{venue.paid_children != null && <span className="meta"> (platí {venue.paid_children === 1 ? '1 dítě' : `${venue.paid_children} děti`})</span>}</th><td className="price">{formatPrice(venue.price_family)}</td></tr>}
                {venue.price_family_offseason != null && venue.season_months &&
                  <tr><th scope="row">Rodinná mimo sezónu</th><td className="price">{formatPrice(venue.price_family_offseason)}</td></tr>}
                {venue.extra_child_price != null &&
                  <tr><th scope="row">Každé další dítě nad {venue.max_children}</th><td className="num">+ {formatPrice(venue.extra_child_price)}</td></tr>}
                {venue.price_adult != null && <tr><th scope="row">Dospělý</th><td className="num">{priceOrFree(venue.price_adult)}</td></tr>}
                {venue.price_child != null && <tr><th scope="row">Dítě{venue.kids_age_limit ? ` (do ${venue.kids_age_limit} let)` : ''}</th><td className="num">{priceOrFree(venue.price_child)}</td></tr>}
              </tbody>
            </table>

            {(venue.family_ticket_desc || venue.notes) && (
              <details className="rule-details">
                <summary>Podrobnosti z ceníku</summary>
                {venue.family_ticket_desc && <blockquote>{venue.family_ticket_desc}</blockquote>}
                {venue.notes && <p className="meta">{venue.notes}</p>}
              </details>
            )}

            <div className={`trust ${age === 'stale' ? 'is-stale' : ''}`}>
              {age === 'stale' && <p><strong>Ověřte před návštěvou.</strong> Údaj je starší než rok.</p>}
              <p>
                Ověřeno <strong>{formatDate(venue.verified_at) || 'neuvedeno'}</strong>
                {venue.source_url
                  ? <> z <a href={venue.source_url} target="_blank" rel="noreferrer" onClick={() => track('cenik-klik', venue.slug)}>oficiálního ceníku<span className="sr-only"> (otevře se v novém okně)</span> ↗</a></>
                  : ' (zdroj zatím chybí)'}
                {venue.source_date && <> (ceník z {sourceDate(venue.source_date)})</>}
              </p>
              <Link className="trust-fix" to={`/tip/?oprava=${encodeURIComponent(venue.slug)}`}>Víte o změně? Nahlaste ji</Link>
            </div>
            {venue.tip_credit && <p className="tip-credit">Tip od: {venue.tip_credit}. Děkujeme.</p>}
          </section>
        </div>

        <aside className="detail-side">
          {venue.address && <section className="side-box">
            <h2 className="h-sm">Kde to je</h2>
            <p>{venue.address}</p>
          </section>}
          <section className="side-box side-box--support">
            <p>Pomohlo vám to? Provoz drží komunita.</p>
            <a className="btn btn--support" href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">Kupte nám pivo 🍺</a>
          </section>
        </aside>
      </div>

      {/* Reklamní pozice (zatím vypnutá). Nanejvýš jedna, pod obsahem detailu, nikdy v seznamu ani mezi kartami.
      <div className="ad-slot" aria-label="Reklama">
        <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client="ca-pub-XXXX" data-ad-slot="XXXX" data-ad-format="horizontal" />
      </div>
      */}
    </article>
  )
}
