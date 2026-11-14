// Sestaví statická data webu: sloučí scripts/candidates/verified-*.json do src/data/venues.json.
// Použití:  npm run data
//
// - deduplikace podle slugu (při shodě vyhrává záznam ze souboru, který je abecedně později,
//   takže novější ověření přepíše starší),
// - úroveň (tier) se počítá deterministicky:
//     family_policy = "unlimited"      → "gold"   (Všichni dovnitř · neomezeně dětí)
//     max_children >= 5                → "silver" (Plná posádka · 5+ dětí)
//     max_children == 4                → "base"   (Čtyřlístek · 4 děti)
//     cokoli jiného                    → vyřazeno (nesplňuje kritérium zařazení)
// - řazení podle kraje (pořadí 14 krajů jako ve filtru) a pak podle názvu (česká kolace).

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const candDir = path.join(root, 'scripts', 'candidates')
const outFile = path.join(root, 'src', 'data', 'venues.json')

const KRAJE = [
  'Praha', 'Středočeský', 'Jihočeský', 'Plzeňský', 'Karlovarský', 'Ústecký', 'Liberecký',
  'Královéhradecký', 'Pardubický', 'Vysočina', 'Jihomoravský', 'Olomoucký', 'Zlínský', 'Moravskoslezský',
]
const CATEGORIES = ['zoo', 'aquapark', 'hrad', 'muzeum', 'zabavni_park', 'science', 'priroda', 'sport', 'jine']

const slugify = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const toNum = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))
const toInt = (v) => (toNum(v) == null ? null : Math.trunc(Number(v)))
// Seznam měsíců 1–12 (např. sezóna nebo zavřeno); prázdný/neplatný → null
const toMonths = (v) => {
  if (!Array.isArray(v)) return null
  const m = [...new Set(v.map(toInt).filter((n) => n >= 1 && n <= 12))].sort((a, b) => a - b)
  return m.length && m.length < 12 ? m : null
}

export function computeTier(v) {
  if (v.family_policy === 'unlimited') return 'gold'
  // Děti zdarma do 15 a více let = libovolný počet dětí, tedy nejvyšší úroveň
  if (v.family_policy === 'kids_free_age' && (toInt(v.kids_age_limit) ?? 0) >= 15) return 'gold'
  const max = toInt(v.max_children)
  if (max != null && max >= 5) return 'silver'
  if (max === 4) return 'base'
  return null
}

let files = []
try {
  files = (await readdir(candDir)).filter((f) => /^verified-.*\.json$/.test(f)).sort()
} catch {
  console.warn(`Složka ${path.relative(root, candDir)} neexistuje, výstup bude prázdný.`)
}

const bySlug = new Map()
const warnings = []
let total = 0

for (const f of files) {
  let arr
  try {
    arr = JSON.parse(await readFile(path.join(candDir, f), 'utf8'))
  } catch (e) {
    warnings.push(`${f}: nelze načíst JSON (${e.message})`)
    continue
  }
  if (!Array.isArray(arr)) { warnings.push(`${f}: obsah není pole, přeskakuji`); continue }

  for (const raw of arr) {
    total++
    if (!raw || !raw.name) { warnings.push(`${f}: záznam bez názvu přeskočen`); continue }
    const slug = slugify(raw.slug || raw.name)
    const rec = {
      name: String(raw.name).trim(),
      slug,
      category: CATEGORIES.includes(raw.category) ? raw.category : 'jine',
      kraj: raw.kraj,
      city: raw.city ?? null,
      address: raw.address ?? null,
      lat: toNum(raw.lat),
      lng: toNum(raw.lng),
      website: raw.website ?? null,
      family_policy: raw.family_policy,
      max_children: raw.family_policy === 'unlimited' ? null : toInt(raw.max_children),
      adults_in_family_ticket: toInt(raw.adults_in_family_ticket) ?? 2,
      kids_age_limit: toInt(raw.kids_age_limit),
      price_adult: toNum(raw.price_adult),
      price_child: toNum(raw.price_child),
      price_family: toNum(raw.price_family),
      // Sezónní ceny: price_* platí v season_months, mimo ně price_family_offseason (null = celoročně stejně)
      price_family_offseason: toNum(raw.price_family_offseason),
      season_months: toMonths(raw.season_months),
      closed_months: toMonths(raw.closed_months),
      // Kolik dětí musí být aspoň v rodině, aby rodinná vstupenka platila (null = 1)
      min_children: toInt(raw.min_children),
      // Doplatek za každé dítě nad max_children při rodinné vstupence (null = nejde)
      extra_child_price: toNum(raw.extra_child_price),
      // Jednotlivé vstupné: platí se jen za prvních N dětí, ostatní zdarma (null = za všechny)
      paid_children: toInt(raw.paid_children),
      // Děti mladší než X let mají vstup zdarma a do počtu dětí se nepočítají
      kids_free_under: toInt(raw.kids_free_under),
      // false = price_adult/price_child platí pro jiný rozsah než rodinná (nesrovnávat úsporu)
      compare_ok: raw.compare_ok === false ? false : true,
      // Datum ceníku (YYYY nebo YYYY-MM[-DD]), když ho zdroj uvádí; liší se od verified_at
      source_date: raw.source_date ?? null,
      family_ticket_desc: raw.family_ticket_desc ?? null,
      notes: raw.notes ?? null,
      source_url: raw.source_url ?? null,
      verified_at: raw.verified_at ?? null,
      // Poděkování za tip (max 40 znaků, jen se souhlasem odesílatele), viz docs/ops/tipy.md
      tip_credit: raw.tip_credit ? String(raw.tip_credit).trim().slice(0, 40) : null,
    }
    if (!KRAJE.includes(rec.kraj)) warnings.push(`${f}: „${rec.name}“ má neznámý kraj „${rec.kraj}“`)
    if (!rec.source_url) warnings.push(`${f}: „${rec.name}“ nemá source_url`)
    const tier = computeTier(rec)
    if (!tier) { warnings.push(`${f}: „${rec.name}“ vyřazeno (nesplňuje kritérium 4+ dětí)`); continue }
    rec.tier = tier
    // Při stejném slugu vyhrává novější ověření (při shodě pozdější soubor)
    const prev = bySlug.get(slug)
    if (prev) {
      warnings.push(`${f}: duplicitní slug „${slug}“, ponechávám novější ověření`)
      if ((prev.verified_at || '') > (rec.verified_at || '')) continue
    }
    bySlug.set(slug, rec)
  }
}

const krajIdx = (k) => { const i = KRAJE.indexOf(k); return i === -1 ? KRAJE.length : i }
const out = [...bySlug.values()].sort((a, b) =>
  krajIdx(a.kraj) - krajIdx(b.kraj) || a.name.localeCompare(b.name, 'cs'))

await mkdir(path.dirname(outFile), { recursive: true })
await writeFile(outFile, JSON.stringify(out, null, 2) + '\n', 'utf8')

for (const w of warnings) console.warn('  ! ' + w)
const counts = out.reduce((m, v) => ((m[v.tier] = (m[v.tier] || 0) + 1), m), {})
console.log(`Soubory: ${files.length}, záznamy: ${total}, do webu: ${out.length} ` +
  `(gold ${counts.gold || 0}, silver ${counts.silver || 0}, base ${counts.base || 0}) → ${path.relative(root, outFile)}`)
