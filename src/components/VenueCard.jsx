import { Link } from 'react-router-dom'
import TierBadge from './TierBadge'
import { CATEGORY_LABEL, formatPrice, formatDate, dataAge, familyQuote, reopensIn, pluralKids, QUOTE_KIDS } from '../lib/constants'
import { useMonth } from '../lib/useMonth'

// kids = počet dětí z filtru „Kolik dětí jede?“ (jinak typická velká rodina 2 + 4)
export default function VenueCard({ venue, kids = null }) {
  const month = useMonth()
  const age = dataAge(venue.verified_at)
  const q = familyQuote(venue, month, kids || QUOTE_KIDS)
  const price = q.price === 0 ? 'zdarma' : formatPrice(q.price)
  const reopens = reopensIn(venue, month)
  return (
    <article className="card">
      <div className="card-top">
        <TierBadge venue={venue} />
        <span className="card-cat">{CATEGORY_LABEL[venue.category] || 'Místo'}</span>
      </div>
      <h3 className="card-name">
        <Link to={`/misto/${venue.slug}/${kids ? `?deti=${kids}` : ''}`} className="card-link">{venue.name}</Link>
      </h3>
      <p className="meta">{[venue.city, venue.kraj].filter(Boolean).join(' · ')}</p>
      {venue.alert
        ? <p className="card-alert">{venue.alert}</p>
        : reopens && <p className="card-alert">Teď zavřeno, otevírá v {reopens}.</p>}
      <div className="card-price">
        {price
          ? <span className="card-quote">
              <span className="meta">2 dospělí + {pluralKids(q.kids)}{q.offseason && ' (mimo sezónu)'}{q.extraKids > 0 && ` (vč. doplatku ${formatPrice(q.extraKids * venue.extra_child_price)})`}</span>
              <span className="price">{price}</span>
            </span>
          : <span className="price price--na">cena na webu místa</span>}
      </div>
      <p className={`card-verified ${age === 'stale' ? 'is-stale' : ''}`}>
        {age === 'stale'
          ? `Ověřte před návštěvou · údaj z ${formatDate(venue.verified_at)}`
          : venue.verified_at ? `Ověřeno ${formatDate(venue.verified_at)}` : 'Datum ověření chybí'}
        {venue.sample && ' · ukázka'}
      </p>
    </article>
  )
}
