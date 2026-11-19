import { Link } from 'react-router-dom'
import { NEIGHBORS, krajFull, tierLabel, familyQuote, formatPrice, QUOTE_KIDS } from '../lib/constants'
import { useMonth } from '../lib/useMonth'

// Těžiště míst kraje; sousední místa řadíme podle vzdálenosti od něj (kilometry neukazujeme,
// rodina nebydlí v krajském městě). Bez polohy jdou na konec.
const located = (v) => v.lat != null && v.lng != null
function centroid(list) {
  const pts = list.filter(located)
  if (!pts.length) return null
  return [pts.reduce((s, v) => s + Number(v.lat), 0) / pts.length, pts.reduce((s, v) => s + Number(v.lng), 0) / pts.length]
}
const dist = (c, v) => (c && located(v) ? Math.hypot(Number(v.lat) - c[0], (Number(v.lng) - c[1]) * 0.64) : Infinity)

export function nearbyFor(kraj, all, fits) {
  const neighbors = NEIGHBORS[kraj] || []
  const c = centroid(all.filter((v) => v.kraj === kraj)) || centroid(all.filter((v) => neighbors.includes(v.kraj)))
  const pool = all.filter((v) => neighbors.includes(v.kraj) && fits(v))
  const kraje = neighbors.map((k) => [k, pool.filter((v) => v.kraj === k).length]).filter(([, n]) => n > 0)
  const venues = pool.slice().sort((a, b) => dist(c, a) - dist(c, b)).slice(0, 3)
  return { kraje, venues, total: pool.length }
}

// „V sousedních krajích“: odkazy na kraje s počty + nanejvýš 3 nejbližší místa jako řádky (ne plné karty,
// aby se nepletla s výsledky). krajLink(k) vrací adresu kraje (se zachovanými filtry).
export default function NearbyKraje({ nearby, krajLink, kids = null }) {
  const month = useMonth()
  if (!nearby.total) return null
  return (
    <section className="nearby" aria-labelledby="nearby-h">
      <h2 id="nearby-h" className="h-sm">V sousedních krajích</h2>
      <p className="nearby-kraje">
        {nearby.kraje.map(([k, n], i) => <span key={k}>{i > 0 && ' · '}<Link to={krajLink(k)}>{krajFull(k)} ({n})</Link></span>)}
      </p>
      <ul className="nearby-list">
        {nearby.venues.map((v) => {
          const q = familyQuote(v, month, kids || QUOTE_KIDS)
          return (
            <li key={v.slug}>
              <Link to={`/misto/${v.slug}/${kids ? `?deti=${kids}` : ''}`}>
                <strong>{krajFull(v.kraj)}</strong> · {v.city ? `${v.city} · ` : ''}{v.name}
              </Link>
              <span className="meta"> · {tierLabel(v)}{q.price != null && ` · ${q.price === 0 ? 'zdarma' : formatPrice(q.price)}`}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
