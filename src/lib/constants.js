// ── Odkazy a kontakty (jediné místo, kde se mění) ─────────────────────────────
export const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/siderro'
export const REPORT_EMAIL = 'info@rodinnevstupne.cz' // schránku/alias založit u hostingu
// Kanonická adresa webu: env VITE_SITE_URL (nastaví vite.config.js ze SITE_URL), výchozí https://rodinnevstupne.cz
export const SITE_URL = (import.meta.env?.VITE_SITE_URL || 'https://rodinnevstupne.cz').replace(/\/$/, '')

export function reportMailto(subject = 'Nahlášení místa nebo opravy', body = '') {
  const q = new URLSearchParams({ subject, body }).toString().replace(/\+/g, '%20')
  return `mailto:${REPORT_EMAIL}?${q}`
}

// ── 14 krajů ČR (primární filtr) ─────────────────────────────────────────────
export const KRAJE = [
  'Praha',
  'Středočeský',
  'Jihočeský',
  'Plzeňský',
  'Karlovarský',
  'Ústecký',
  'Liberecký',
  'Královéhradecký',
  'Pardubický',
  'Vysočina',
  'Jihomoravský',
  'Olomoucký',
  'Zlínský',
  'Moravskoslezský',
]

// Slug kraje pro adresy /kraj/<slug>/ (bez diakritiky) a plný název pro nadpisy
export const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const krajSlug = (k) => slugify(k)
export const krajBySlug = (slug) => KRAJE.find((k) => krajSlug(k) === slug) || null
export const krajFull = (k) => (k === 'Praha' ? 'Praha' : k === 'Vysočina' ? 'Kraj Vysočina' : `${k} kraj`)
// „v Jihomoravském kraji“, „v Praze“, „na Vysočině“
export function krajLocative(k) {
  if (k === 'Praha') return 'v Praze'
  if (k === 'Vysočina') return 'na Vysočině'
  const prep = k === 'Středočeský' || k === 'Zlínský' ? 've' : 'v'
  return `${prep} ${k.replace(/ý$/, 'ém')} kraji`
}

// ── Kategorie míst ───────────────────────────────────────────────────────────
export const CATEGORIES = [
  { value: 'zoo', label: 'Zoo' },
  { value: 'aquapark', label: 'Aquapark' },
  { value: 'hrad', label: 'Hrad / zámek' },
  { value: 'muzeum', label: 'Muzeum' },
  { value: 'zabavni_park', label: 'Zábavní park' },
  { value: 'science', label: 'Science centrum' },
  { value: 'priroda', label: 'Příroda / stezka' },
  { value: 'sport', label: 'Sport / bazén' },
  { value: 'jine', label: 'Jiné' },
]

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

// ── Úrovně míst (klíče jsou interní; v UI vždy název + počet dětí) ──────────
export const TIERS = {
  gold: { key: 'gold', name: 'Všichni dovnitř', label: 'neomezeně dětí', short: 'Neomezeně', rank: 3 },
  silver: { key: 'silver', name: 'Plná posádka', label: '5+ dětí', short: '5+ dětí', rank: 2 },
  base: { key: 'base', name: 'Čtyřlístek', label: '4 děti', short: '4+ dětí', rank: 1 },
}

// Filtr úrovně je kumulativní: „4+“ = vše, „5+“ = Plná posádka + Všichni dovnitř, „neomezeně“ = jen gold.
export const TIER_FILTERS = [
  { value: '', label: '4+ dětí', minRank: 0 },
  { value: '5', label: '5+ dětí', minRank: 2 },
  { value: 'neomezene', label: 'Neomezeně dětí', minRank: 3 },
]

// Deterministický výpočet úrovně (shodný se scripts/build-data.mjs)
export function computeTier(v) {
  if (!v) return null
  if (v.family_policy === 'unlimited') return 'gold'
  const max = v.max_children == null ? null : Number(v.max_children)
  if (max != null && max >= 5) return 'silver'
  if (max === 4) return 'base'
  return null
}

export function tierOf(v) {
  return TIERS[v?.tier] || TIERS[computeTier(v)] || null
}

// Typy rodinného vstupného (používá admin)
export const FAMILY_POLICY = {
  unlimited: { label: 'Neomezeně dětí' },
  max_children: { label: 'Strop počtu dětí' },
  kids_free_age: { label: 'Děti do věku zdarma' },
  per_child: { label: 'Platí se za každé dítě' },
  none: { label: 'Bez rodinné výhody' },
}

// ── Formátování ──────────────────────────────────────────────────────────────
const nbsp = ' '
export function formatPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return null
  return Number(n).toLocaleString('cs-CZ').replace(/\s/g, nbsp) + nbsp + 'Kč'
}

export function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()}.${nbsp}${d.getMonth() + 1}.${nbsp}${d.getFullYear()}`
}

// Stáří údaje: do 6 měsíců „fresh“, 6–12 „aging“, nad 12 „stale“ (zobrazit „Ověřte před návštěvou“)
export function dataAge(iso, now = new Date()) {
  if (!iso) return 'unknown'
  const months = (now - new Date(iso)) / (1000 * 60 * 60 * 24 * 30.44)
  if (months > 12) return 'stale'
  if (months > 6) return 'aging'
  return 'fresh'
}

export function pluralKids(n) {
  if (n === 1) return '1 dítě'
  if (n >= 2 && n <= 4) return `${n} děti`
  return `${n} dětí`
}
export function pluralAdults(n) {
  if (n === 1) return '1 dospělý'
  if (n >= 2 && n <= 4) return `${n} dospělí`
  return `${n} dospělých`
}

// Popis rodinné vstupenky jednou větou: „2 dospělí + až 5 dětí“
export function familyTicketSummary(v) {
  const a = v.adults_in_family_ticket || 2
  const kids = v.family_policy === 'unlimited' ? 'všechny děti' : `až ${pluralKids(v.max_children)}`
  const age = v.kids_age_limit ? ` do ${v.kids_age_limit} let` : ''
  return `${pluralAdults(a)} + ${kids}${age}`
}

// ── Kalkulačka „Kolik zaplatíme my?“ ────────────────────────────────────────
// Rodinná vstupenka se použije, jen když rodina splní její podmínky (počet dospělých i dětí).
// Žádná pravidla „rodinné + doplatek“ nevymýšlíme; pokud je ceník uvádí, jsou v family_ticket_desc.
export function calculate(v, adults, kids) {
  const pa = v.price_adult
  const pc = v.price_child
  const individual = pa != null && pc != null ? adults * pa + kids * pc : null

  const maxAdults = v.adults_in_family_ticket || 2
  const kidsOk = v.family_policy === 'unlimited' || (v.max_children != null && kids <= v.max_children)
  const adultsOk = adults <= maxAdults
  const familyApplies = kidsOk && adultsOk && kids >= 1
  const family = familyApplies ? v.price_family ?? null : null

  let reason = null
  if (!adultsOk) reason = `Rodinná vstupenka platí pro nejvýš ${pluralAdults(maxAdults)}.`
  else if (!kidsOk) reason = `Rodinná vstupenka platí nejvýš pro ${pluralKids(v.max_children)}.`
  else if (kids < 1) reason = 'Rodinná vstupenka počítá aspoň s jedním dítětem.'

  let best = null
  if (family != null && individual != null) best = family <= individual ? 'family' : 'individual'
  else if (family != null) best = 'family'
  else if (individual != null) best = 'individual'

  return { individual, family, familyApplies, reason, best,
    saving: family != null && individual != null ? individual - family : null }
}
