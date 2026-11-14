// ── Odkazy a kontakty (jediné místo, kde se mění) ─────────────────────────────
export const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/siderro'
export const REPORT_EMAIL = 'tipy@rodinnevstupne.cz' // tipy a opravy (schránka u hostingu, zpracování viz docs/ops/tipy.md)
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

// Pro koho (4. pád): „pro 2 dospělé“, „pro 1 dospělého“
export function pluralAdultsAcc(n) {
  if (n === 1) return '1 dospělého'
  if (n >= 2 && n <= 4) return `${n} dospělé`
  return `${n} dospělých`
}

// Datum ceníku: „2026“ → „2026“, „2025-12“ → „12/2025“, „2025-12-01“ → „1. 12. 2025“
export function sourceDate(s) {
  if (!s) return null
  const m = String(s).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/)
  if (!m) return String(s)
  if (m[3]) return formatDate(s)
  return m[2] ? `${Number(m[2])}/${m[1]}` : m[1]
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
// Doplatek za další dítě, sezónu nebo „platí jen N dětí“ počítáme jen z polí, která uvádí ceník
// (extra_child_price, price_family_offseason + season_months, paid_children); nic nedomýšlíme.
export const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec',
  'srpen', 'září', 'říjen', 'listopad', 'prosinec']
// 6. pád: „v lednu“
export const MONTHS_LOC = ['lednu', 'únoru', 'březnu', 'dubnu', 'květnu', 'červnu', 'červenci',
  'srpnu', 'září', 'říjnu', 'listopadu', 'prosinci']

// Rozsah měsíců slovy: [3,4,…,10] → „březen–říjen“, [11,12,1,2] → „listopad–únor“
export function monthRange(months) {
  if (!months || !months.length) return null
  const set = new Set(months)
  // začátek = měsíc, jehož předchůdce v seznamu není (seznam může přecházet přes Nový rok)
  const start = months.find((m) => !set.has(m === 1 ? 12 : m - 1)) ?? months[0]
  const end = months.find((m) => !set.has(m === 12 ? 1 : m + 1)) ?? months[months.length - 1]
  const contiguous = (((end - start + 12) % 12) + 1) === months.length
  return contiguous
    ? (start === end ? MONTHS[start - 1] : `${MONTHS[start - 1]}–${MONTHS[end - 1]}`)
    : months.map((m) => MONTHS[m - 1]).join(', ')
}

// Mimo sezónu? (jen když místo má mimosezónní rodinnou cenu)
export function isOffseason(v, month) {
  return !!(v.season_months && v.price_family_offseason != null && month && !v.season_months.includes(month))
}

export function isClosed(v, month) {
  return !!(v.closed_months && month && v.closed_months.includes(month))
}

export function calculate(v, adults, kids, month = null) {
  const pa = v.price_adult
  const pc = v.price_child
  const paidKids = v.paid_children != null ? Math.min(kids, v.paid_children) : kids
  const individual = pa != null && pc != null ? adults * pa + paidKids * pc : null

  const maxAdults = v.adults_in_family_ticket || 2
  const minKids = v.min_children || 1
  const unlimited = v.family_policy === 'unlimited'
  const over = !unlimited && v.max_children != null ? Math.max(0, kids - v.max_children) : 0
  const canTopUp = over > 0 && v.extra_child_price != null
  const kidsOk = unlimited || (v.max_children != null && (over === 0 || canTopUp))
  const adultsOk = adults <= maxAdults
  const familyApplies = kidsOk && adultsOk && kids >= minKids

  const offseason = isOffseason(v, month)
  const base = offseason ? v.price_family_offseason : v.price_family
  const extra = canTopUp ? over * v.extra_child_price : 0
  const family = familyApplies && base != null ? base + extra : null

  let reason = null
  if (!adultsOk) reason = `Rodinná vstupenka platí nejvýš pro ${pluralAdultsAcc(maxAdults)}.`
  else if (!kidsOk) reason = `Rodinná vstupenka platí nejvýš pro ${pluralKids(v.max_children)}.`
  else if (kids < minKids) reason = minKids > 1
    ? `Rodinná vstupenka platí až od ${minKids} dětí.`
    : 'Rodinná vstupenka počítá aspoň s jedním dítětem.'

  let best = null
  if (family != null && individual != null) best = family <= individual ? 'family' : 'individual'
  else if (family != null) best = 'family'
  else if (individual != null) best = 'individual'

  // Úsporu ukazujeme jen tam, kde jednotlivé a rodinné vstupné platí pro stejný rozsah
  const comparable = v.compare_ok !== false
  return { individual, family, familyApplies, reason, best, offseason, extra, extraKids: canTopUp ? over : 0,
    closed: isClosed(v, month), comparable,
    saving: comparable && family != null && individual != null ? individual - family : null }
}
