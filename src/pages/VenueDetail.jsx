import { Link, useParams } from 'react-router-dom'
import { getVenueBySlug } from '../lib/venues'
import TierBadge from '../components/TierBadge'
import Calculator from '../components/Calculator'
import ShareButton from '../components/ShareButton'
import {
  CATEGORY_LABEL, BUY_ME_A_COFFEE_URL, SITE_URL, formatPrice, formatDate, dataAge, familyTicketSummary, krajFull,
} from '../lib/constants'
import { venueMeta, krajPath, venuePath } from '../lib/seo'
import { useHead } from '../lib/useHead'

export default function VenueDetail() {
  const { slug } = useParams()
  const venue = getVenueBySlug(slug)
  useHead(venue ? venueMeta(venue) : { title: 'Místo nenalezeno – Rodinné vstupné', noindex: true })

  if (!venue) return (
    <div className="empty-state">
      <h1>Místo jsme nenašli</h1>
      <p>Možná se změnila adresa, nebo místo z katalogu vypadlo.</p>
      <Link className="btn" to="/">Zpět na výlety</Link>
    </div>
  )

  const age = dataAge(venue.verified_at)
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

      <header className="detail-head">
        <TierBadge venue={venue} />
        <h1>{venue.name}</h1>
        <p className="meta">
          {CATEGORY_LABEL[venue.category] || 'Místo'} · {[venue.city, venue.kraj && `${venue.kraj}${venue.kraj === 'Praha' || venue.kraj === 'Vysočina' ? '' : ' kraj'}`].filter(Boolean).join(', ')}
        </p>
        <div className="detail-share">
          <ShareButton url={`${SITE_URL}${venuePath(venue)}?utm_source=share`} title={venue.name}
            text={`${venue.name}: rodinné vstupné ${familyTicketSummary(venue)}`} />
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="rule-box" aria-labelledby="rule-h">
            <h2 id="rule-h">Rodinné vstupné</h2>
            <p className="rule-summary">{familyTicketSummary(venue)}</p>
            {venue.family_ticket_desc && <blockquote>{venue.family_ticket_desc}</blockquote>}
            {venue.notes && <p className="meta">{venue.notes}</p>}

            <table className="prices">
              <tbody>
                <tr><th scope="row">Rodinná vstupenka</th><td className="price">{formatPrice(venue.price_family) || '–'}</td></tr>
                <tr><th scope="row">Dospělý</th><td className="num">{formatPrice(venue.price_adult) || '–'}</td></tr>
                <tr><th scope="row">Dítě</th><td className="num">{formatPrice(venue.price_child) || '–'}</td></tr>
              </tbody>
            </table>

            <div className={`trust ${age === 'stale' ? 'is-stale' : ''}`}>
              {age === 'stale' && <p><strong>Ověřte před návštěvou.</strong> Údaj je starší než rok.</p>}
              <p>
                Ověřeno dne {formatDate(venue.verified_at) || 'neuvedeno'}
                {venue.source_url
                  ? <> z <a href={venue.source_url} target="_blank" rel="noreferrer">oficiálního ceníku<span className="sr-only"> (otevře se v novém okně)</span> ↗</a></>
                  : ' (zdroj zatím chybí)'}
              </p>
              <Link to={`/tip/?oprava=${encodeURIComponent(venue.slug)}`}>Nahlásit chybu</Link>
              <p className="trust-hint">Víte o změně? Napište nám, opravíme to.</p>
            </div>
            {venue.tip_credit && <p className="tip-credit">Tip od: {venue.tip_credit}. Děkujeme.</p>}
          </section>

          <Calculator venue={venue} />
        </div>

        <aside className="detail-side">
          {(venue.address || mapsUrl || venue.website) && <section className="side-box">
            <h2 className="h-sm">Kde to je</h2>
            {venue.address && <p>{venue.address}</p>}
            <div className="side-actions">
              {mapsUrl && <a className="btn btn--ghost" href={mapsUrl} target="_blank" rel="noreferrer">Navigovat<span className="sr-only"> přes Mapy.com (nové okno)</span></a>}
              {venue.website && <a className="btn" href={venue.website} target="_blank" rel="noreferrer">Web místa<span className="sr-only"> (otevře se v novém okně)</span> ↗</a>}
            </div>
          </section>}
          <section className="side-box side-box--support">
            <p>Pomohlo vám to? Provoz drží komunita.</p>
            <a className="btn btn--support" href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">Podpořit projekt kávou</a>
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
