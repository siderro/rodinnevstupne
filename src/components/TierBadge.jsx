import goldSvg from '../../brand/icons/tier-gold.svg?raw'
import silverSvg from '../../brand/icons/tier-silver.svg?raw'
import baseSvg from '../../brand/icons/tier-base.svg?raw'
import { tierOf, tierLabel } from '../lib/constants'

const ICONS = { gold: goldSvg, silver: silverSvg, base: baseSvg }

export function TierIcon({ tier }) {
  return <span className="tier-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[tier] }} />
}

// Odznak úrovně: ikona + horní mez počtu dětí („až 4 děti“, „neomezeně dětí“, „děti zdarma“).
// Názvy úrovní (Čtyřlístek…) na webu nepoužíváme, lidé je četli jako komiks.
// condition = podmíněná úroveň (např. „s Rodinným pasem“).
export default function TierBadge({ venue, condition = null }) {
  const t = tierOf(venue)
  if (!t) return null
  return (
    <span className={`tier tier--${t.key}${condition ? ' tier--conditional' : ''}`}>
      <TierIcon tier={t.key} />
      <span>{condition || tierLabel(venue)}</span>
    </span>
  )
}
