import { Link } from 'react-router-dom'
import TierBadge from './TierBadge'
import { CATEGORY_LABEL, formatPrice, formatDate, dataAge, familyTicketSummary } from '../lib/constants'

export default function VenueCard({ venue }) {
  const age = dataAge(venue.verified_at)
  const price = formatPrice(venue.price_family)
  return (
    <article className="card">
      <div className="card-top">
        <TierBadge venue={venue} />
        <span className="card-cat">{CATEGORY_LABEL[venue.category] || 'Místo'}</span>
      </div>
      <h3 className="card-name">
        <Link to={`/misto/${venue.slug}/`} className="card-link">{venue.name}</Link>
      </h3>
      <p className="meta">{[venue.city, venue.kraj].filter(Boolean).join(' · ')}</p>
      <div className="card-price">
        <span className="meta">Rodinné vstupné {familyTicketSummary(venue)}</span>
        {price ? <span className="price">{price}</span> : <span className="price price--na">cena na webu místa</span>}
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
