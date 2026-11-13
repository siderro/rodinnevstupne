// Mapa míst (Leaflet + OpenStreetMap). Načítá se líně přes React.lazy, aby Leaflet
// nezvětšoval hlavní balík – stáhne se až po přepnutí na „Mapa“.
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import goldSvg from '../../brand/icons/tier-gold.svg?raw'
import silverSvg from '../../brand/icons/tier-silver.svg?raw'
import baseSvg from '../../brand/icons/tier-base.svg?raw'
import TierBadge from './TierBadge'
import { TIERS, tierOf, formatPrice, CATEGORY_LABEL } from '../lib/constants'

const ICON_SVG = { gold: goldSvg, silver: silverSvg, base: baseSvg }
const CZ_CENTER = [49.8, 15.5]

// Špendlík jako HTML (divIcon): barva podle úrovně z brand tokenů, uvnitř ikona úrovně.
const icons = Object.fromEntries(Object.keys(TIERS).map((k) => [k, L.divIcon({
  className: 'map-pin-wrap',
  html: `<span class="map-pin map-pin--${k}">${ICON_SVG[k]}</span>`,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
  popupAnchor: [0, -28],
})]))

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) map.setView(CZ_CENTER, 7)
    else if (points.length === 1) map.setView(points[0], 11)
    else map.fitBounds(points, { padding: [32, 32], maxZoom: 12 })
  }, [map, points])
  return null
}

export default function VenueMap({ venues }) {
  const located = useMemo(() => venues.filter((v) => v.lat != null && v.lng != null), [venues])
  const points = useMemo(() => located.map((v) => [Number(v.lat), Number(v.lng)]), [located])
  const missing = venues.length - located.length

  return (
    <section className="map-wrap" aria-label="Mapa míst s rodinným vstupným">
      <MapContainer className="map" center={CZ_CENTER} zoom={7} scrollWheelZoom={false}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; přispěvatelé <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        <FitBounds points={points} />
        {located.map((v) => {
          const t = tierOf(v)
          return (
            <Marker key={v.slug} position={[Number(v.lat), Number(v.lng)]} icon={icons[t?.key || 'base']}
              title={`${v.name}${t ? ` – ${t.name}, ${t.label}` : ''}`} alt={v.name} keyboard>
              <Popup>
                <div className="map-popup">
                  <TierBadge venue={v} compact />
                  <p className="map-popup-name"><Link to={`/misto/${v.slug}/`}>{v.name}</Link></p>
                  <p className="meta">{[CATEGORY_LABEL[v.category], v.city].filter(Boolean).join(' · ')}</p>
                  {v.price_family != null && <p className="map-popup-price">Rodina: <strong>{formatPrice(v.price_family)}</strong></p>}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      <ul className="map-legend" aria-label="Legenda mapy">
        {['gold', 'silver', 'base'].map((k) => (
          <li key={k}>
            <span className={`map-pin map-pin--${k} map-pin--sm`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_SVG[k] }} />
            {TIERS[k].name} · {TIERS[k].label}
          </li>
        ))}
      </ul>
      {missing > 0 && (
        <p className="meta">
          {missing === 1 ? '1 místo zatím nemá' : missing <= 4 ? `${missing} místa zatím nemají` : `${missing} míst zatím nemá`} na mapě polohu, najdete {missing === 1 ? 'ho' : 'je'} v seznamu.
        </p>
      )}
    </section>
  )
}
