import goldSvg from '../../brand/icons/tier-gold.svg?raw'
import silverSvg from '../../brand/icons/tier-silver.svg?raw'
import baseSvg from '../../brand/icons/tier-base.svg?raw'
import { tierOf } from '../lib/constants'

const ICONS = { gold: goldSvg, silver: silverSvg, base: baseSvg }

export function TierIcon({ tier }) {
  return <span className="tier-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[tier] }} />
}

// Odznak úrovně: vždy ikona + název + počet dětí („Čtyřlístek · 4 děti“).
// compact = jen ikona + počet (úzká místa). condition = podmíněná úroveň (např. „s Rodinným pasem“).
export default function TierBadge({ venue, compact = false, condition = null }) {
  const t = tierOf(venue)
  if (!t) return null
  let label = t.label
  if (t.key === 'gold' && venue.kids_age_limit) label = `neomezeně dětí do ${venue.kids_age_limit} let`
  const text = condition ? condition : label
  return (
    <span className={`tier tier--${t.key}${condition ? ' tier--conditional' : ''}`}>
      <TierIcon tier={t.key} />
      {compact ? <span>{text}</span> : <span>{t.name} · {text}</span>}
    </span>
  )
}
