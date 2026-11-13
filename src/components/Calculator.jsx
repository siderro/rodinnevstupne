import { useId, useState } from 'react'
import { calculate, formatPrice, pluralKids, pluralAdults } from '../lib/constants'

function Stepper({ label, value, min, max, onChange, unit }) {
  const id = useId()
  return (
    <div className="stepper">
      <span className="stepper-label" id={id}>{label}</span>
      <div className="stepper-ctrl" role="group" aria-labelledby={id}>
        <button type="button" aria-label={`Ubrat: ${label.toLowerCase()}`} disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <output aria-live="polite" className="num">{value}</output>
        <button type="button" aria-label={`Přidat: ${label.toLowerCase()}`} disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
      <span className="sr-only">{unit(value)}</span>
    </div>
  )
}

export default function Calculator({ venue, initialKids = 4 }) {
  const [adults, setAdults] = useState(Math.min(2, venue.adults_in_family_ticket || 2))
  const [kids, setKids] = useState(initialKids)
  const r = calculate(venue, adults, kids)
  const fam = formatPrice(r.family)
  const ind = formatPrice(r.individual)

  return (
    <section className="calc" aria-labelledby="calc-h">
      <h2 id="calc-h">Kolik zaplatíme my?</h2>
      <div className="calc-inputs">
        <Stepper label="Dospělí" value={adults} min={1} max={6} onChange={setAdults} unit={pluralAdults} />
        <Stepper label="Děti" value={kids} min={0} max={15} onChange={setKids} unit={pluralKids} />
      </div>

      <div className="calc-rows">
        <div className={`calc-row ${r.best === 'family' ? 'is-best' : ''}`}>
          <span>Rodinná vstupenka</span>
          <span className="price">
            {r.familyApplies ? (fam || 'cena není v ceníku') : 'neplatí'}
          </span>
        </div>
        <div className={`calc-row ${r.best === 'individual' ? 'is-best' : ''}`}>
          <span>
            Jednotlivé vstupenky
            {venue.price_adult != null && venue.price_child != null && (
              <span className="meta"> ({adults} × {formatPrice(venue.price_adult)} + {kids} × {formatPrice(venue.price_child)})</span>
            )}
          </span>
          <span className="price">{ind || 'cena není v ceníku'}</span>
        </div>
      </div>

      <p className="calc-result" aria-live="polite">
        {r.reason && <>{r.reason} </>}
        {r.best === 'family' && r.saving != null && r.saving > 0 &&
          <>Pro {pluralAdults(adults)} a {pluralKids(kids)} vychází rodinná vstupenka o {formatPrice(r.saving)} lépe než jednotlivé.</>}
        {r.best === 'family' && r.saving == null && <>Pro vaši rodinu platí jedna rodinná vstupenka.</>}
        {r.best === 'individual' && r.familyApplies && r.family != null &&
          <>Pro {pluralAdults(adults)} a {pluralKids(kids)} vycházejí jednotlivé vstupenky lépe.</>}
      </p>
      <p className="meta">
        {venue.kids_age_limit ? `Ceník počítá s dětmi do ${venue.kids_age_limit} let. ` : ''}
        Orientační výpočet z ceníku, nezahrnuje zlevněné ani sezónní vstupenky.
      </p>
    </section>
  )
}
