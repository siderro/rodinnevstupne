// Novinky: z každé aktualizace dat udělá vydání (release) a hotové návrhy příspěvků.
// Použití:  npm run novinky                     (po `npm run data`)
//           npm run novinky -- --dry-run         (jen vypíše rozdíl, nic nezapíše)
//           npm run novinky -- --date 2026-11-20 (datum vydání, výchozí je dnešek)
//           npm run novinky -- --drafts-dir out/ (kam psát návrhy, výchozí marketing/drafts)
//           npm run novinky -- --no-drafts       (jen snapshot a novinky.json)
// Složku pro návrhy jde nastavit i proměnnou NOVINKY_DRAFTS_DIR (pro cloudové rutiny).
//
// Co dělá:
// 1. Porovná src/data/venues.json s posledním snapshotem ve scripts/releases/<datum>.json
//    (poslední s datem PŘED dneškem; dnešní snapshot se při opakovaném běhu přepíše).
// 2. Spočítá přidaná / změněná (cena nebo pravidlo) / vyřazená místa.
//    Změna jen v verified_at, notes, adrese apod. se za změnu NEPOČÍTÁ.
// 3. Zapíše snapshot, doplní vydání do src/data/novinky.json (nejnovější první)
//    a vygeneruje návrhy marketing/drafts/<datum>/{facebook,instagram,newsletter,x}.md.
// První běh (žádný snapshot) založí výchozí stav a zapíše všechna místa jako vydání „start“.
// Bez změn nezapíše nic.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { KRAJE, TIERS, krajSlug, krajLocative, familyTicketSummary } from '../src/lib/constants.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const venuesFile = path.join(root, 'src', 'data', 'venues.json')
const novinkyFile = path.join(root, 'src', 'data', 'novinky.json')
const releasesDir = path.join(root, 'scripts', 'releases')

const SITE = 'https://rodinnevstupne.cz'
const TIPS_EMAIL = 'tipy@rodinnevstupne.cz'
const BMC_URL = 'https://buymeacoffee.com/siderro'
const NBSP = ' '

// ── Argumenty ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const argVal = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null }
const dryRun = args.includes('--dry-run')
const noDrafts = args.includes('--no-drafts')
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const DATE = argVal('--date') || localToday()
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) { console.error(`Neplatné datum „${DATE}“, čekám YYYY-MM-DD.`); process.exit(1) }
const draftsRoot = path.resolve(root, argVal('--drafts-dir') || process.env.NOVINKY_DRAFTS_DIR || path.join('marketing', 'drafts'))

// ── Čeština: čísla, ceny, data ───────────────────────────────────────────────
// Tři tvary podle počtu: 1 / 2–4 / 0 a 5+ (21, 22… taky 3. tvar: „22 nových míst“)
export const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)
export const pocetMist = (n) => `${n}${NBSP}${plural(n, 'místo', 'místa', 'míst')}`
export const pocetNovychMist = (n) => `${n}${NBSP}${plural(n, 'nové místo', 'nová místa', 'nových míst')}`
// „přibylo 1 nové místo“, „přibyla 3 nová místa“, „přibylo 13 nových míst“
export const pribylo = (n) => `${plural(n, 'přibylo', 'přibyla', 'přibylo')} ${pocetNovychMist(n)}`
// „u 1 místa“, „u 3 míst“
const uMist = (n) => `u ${n}${NBSP}${plural(n, 'místa', 'míst', 'míst')}`
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const fmtNum = (n) => Number(n).toLocaleString('cs-CZ').replace(/\s/g, NBSP)
const fmtKc = (n) => `${fmtNum(n)}${NBSP}Kč`
const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${+m[3]}.${NBSP}${+m[2]}.${NBSP}${m[1]}` : null
}

// ── Pole pro snapshot a porovnání ────────────────────────────────────────────
const SNAP_FIELDS = ['slug', 'name', 'kraj', 'city', 'category', 'tier', 'family_policy', 'max_children',
  'kids_age_limit', 'adults_in_family_ticket', 'price_adult', 'price_child', 'price_family', 'verified_at']
// Změnu hlásíme jen u ceny a pravidla rodinné vstupenky
const DIFF_FIELDS = ['tier', 'family_policy', 'max_children', 'kids_age_limit', 'adults_in_family_ticket',
  'price_family', 'price_adult', 'price_child']
const slim = (v) => Object.fromEntries(SNAP_FIELDS.map((k) => [k, v[k] ?? null]))

const tierBadge = (v) => { const t = TIERS[v.tier]; return t ? `${t.name} · ${t.label}` : '' }
const tierShort = (v) => ({ gold: 'neomezeně dětí', silver: '5+ dětí', base: '4 děti' }[v.tier] || '')
const priceText = (v) => {
  if (v.price_family === 0) return 'vstup zdarma'
  if (v.price_family != null) return `rodinné vstupné ${fmtKc(v.price_family)}`
  return null
}

function describeChange(field, a, b) {
  const kc = (x) => (x == null ? 'neuvedeno' : x === 0 ? 'zdarma' : fmtKc(x))
  switch (field) {
    case 'tier': return `úroveň: ${tierBadge({ tier: a })} → ${tierBadge({ tier: b })}`
    case 'family_policy': return null // promítne se do úrovně / počtu dětí
    case 'max_children': return `počet dětí na rodinnou vstupenku: ${a ?? 'neomezeně'} → ${b ?? 'neomezeně'}`
    case 'kids_age_limit': return `věková hranice dětí: ${a == null ? 'bez hranice' : `do ${a} let`} → ${b == null ? 'bez hranice' : `do ${b} let`}`
    case 'adults_in_family_ticket': return `dospělí na rodinnou vstupenku: ${a ?? '?'} → ${b ?? '?'}`
    case 'price_family': return `rodinné vstupné: ${kc(a)} → ${kc(b)}`
    case 'price_adult': return `dospělý: ${kc(a)} → ${kc(b)}`
    case 'price_child': return `dítě: ${kc(a)} → ${kc(b)}`
    default: return null
  }
}

// ── Načtení dat ──────────────────────────────────────────────────────────────
const readJson = async (f, fallback) => { try { return JSON.parse(await readFile(f, 'utf8')) } catch { return fallback } }

const current = await readJson(venuesFile, null)
if (!Array.isArray(current)) { console.error('src/data/venues.json chybí nebo není pole. Spusťte nejdřív `npm run data`.'); process.exit(1) }

let snapFiles = []
try { snapFiles = (await readdir(releasesDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() } catch {}
const prevFile = snapFiles.filter((f) => f.slice(0, 10) < DATE).pop() || null
const prevSnap = prevFile ? await readJson(path.join(releasesDir, prevFile), null) : null
if (prevFile && !prevSnap) { console.error(`Snapshot ${prevFile} nejde načíst.`); process.exit(1) }

// ── Porovnání ────────────────────────────────────────────────────────────────
const isLaunch = !prevSnap
const prevBySlug = new Map((prevSnap?.venues || []).map((v) => [v.slug, v]))
const curBySlug = new Map(current.map((v) => [v.slug, v]))

const added = current.filter((v) => !prevBySlug.has(v.slug)).map((v) => v.slug)
const removed = isLaunch ? [] : [...prevBySlug.keys()].filter((s) => !curBySlug.has(s))
const updated = []
const changes = {}
if (!isLaunch) {
  for (const v of current) {
    const old = prevBySlug.get(v.slug)
    if (!old) continue
    const diffs = DIFF_FIELDS.filter((k) => (old[k] ?? null) !== (v[k] ?? null))
    if (!diffs.length) continue
    updated.push(v.slug)
    changes[v.slug] = diffs.map((k) => describeChange(k, old[k], v[k])).filter(Boolean)
  }
}

if (!isLaunch && !added.length && !updated.length && !removed.length) {
  console.log(`Žádné změny oproti vydání ${prevFile.slice(0, 10)}. Nic nezapisuji.`)
  process.exit(0)
}

// ── Titulek vydání ───────────────────────────────────────────────────────────
const krajeCount = new Set(current.map((v) => v.kraj)).size
function headline() {
  if (isLaunch) {
    return `Na startu je ${pocetMist(current.length)}, kam můžete s dětmi` +
      (krajeCount === 14 ? ', ze všech 14 krajů' : '')
  }
  const parts = []
  if (added.length) parts.push(`${cap(pribylo(added.length))}, kam můžete s dětmi`)
  if (updated.length) parts.push(`${uMist(updated.length)} jsme aktualizovali ceník nebo podmínky`)
  if (removed.length) parts.push(`${pocetMist(removed.length)} jsme z katalogu vyřadili`)
  return parts.map(cap).join('. ')
}
const HEADLINE = headline()

const release = {
  date: DATE,
  type: isLaunch ? 'launch' : 'update',
  headline: HEADLINE,
  added,
  updated,
  removed,
  total: current.length,
  ...(Object.keys(changes).length ? { changes } : {}),
  ...(removed.length ? { removed_names: Object.fromEntries(removed.map((s) => [s, prevBySlug.get(s)?.name || s])) } : {}),
}

// ── Souhrn do konzole ────────────────────────────────────────────────────────
console.log(`Vydání ${DATE}${isLaunch ? ' (start, výchozí stav)' : ` (oproti ${prevFile.slice(0, 10)})`}`)
console.log(`  ${HEADLINE}`)
console.log(`  přidáno ${added.length}, změněno ${updated.length}, vyřazeno ${removed.length}, celkem ${current.length}`)
for (const s of updated) console.log(`  ~ ${curBySlug.get(s).name}: ${changes[s].join('; ')}`)
for (const s of removed) console.log(`  - ${release.removed_names[s]}`)
if (dryRun) { console.log('--dry-run: nic nezapisuji.'); process.exit(0) }

// ── Zápis snapshotu a novinky.json ───────────────────────────────────────────
await mkdir(releasesDir, { recursive: true })
await writeFile(path.join(releasesDir, `${DATE}.json`),
  JSON.stringify({ date: DATE, total: current.length, venues: current.map(slim) }, null, 2) + '\n', 'utf8')

const novinky = (await readJson(novinkyFile, [])).filter((r) => r && r.date !== DATE)
novinky.push(release)
novinky.sort((a, b) => (a.date < b.date ? 1 : -1))
await writeFile(novinkyFile, JSON.stringify(novinky, null, 2) + '\n', 'utf8')
console.log(`  → scripts/releases/${DATE}.json, src/data/novinky.json (${novinky.length} vydání)`)

if (noDrafts) process.exit(0)

// ── Návrhy příspěvků ─────────────────────────────────────────────────────────
const CAMPAIGN = `novinky-${DATE}`
const utm = (source) => `utm_source=${source}&utm_medium=social&utm_campaign=${CAMPAIGN}`
const venueUrl = (slug, source) => `${SITE}/misto/${slug}/?${utm(source)}`
const krajUrl = (kraj, source) => `${SITE}/kraj/${krajSlug(kraj)}/?${utm(source)}`
const homeUrl = (source) => `${SITE}/?${utm(source)}`

const RANK = { gold: 3, silver: 2, base: 1 }
const byTierThenName = (a, b) => (RANK[b.tier] || 0) - (RANK[a.tier] || 0) || a.name.localeCompare(b.name, 'cs')
function groupByKraj(list) {
  const m = new Map()
  for (const k of KRAJE) m.set(k, [])
  for (const v of list) { if (!m.has(v.kraj)) m.set(v.kraj, []); m.get(v.kraj).push(v) }
  return [...m.entries()].filter(([, vs]) => vs.length).map(([k, vs]) => [k, vs.sort(byTierThenName)])
}
const tierCounts = (list) => list.reduce((m, v) => ((m[v.tier] = (m[v.tier] || 0) + 1), m), {})
function tierSentence(list) {
  const c = tierCounts(list)
  const out = []
  if (c.gold) out.push(`${pocetMist(c.gold)} „Všichni dovnitř“ (neomezeně dětí)`)
  if (c.silver) out.push(`${pocetMist(c.silver)} „Plná posádka“ (5+ dětí)`)
  if (c.base) out.push(`${pocetMist(c.base)} „Čtyřlístek“ (4 děti)`)
  return out.length > 1 ? `${out.slice(0, -1).join(', ')} a ${out.at(-1)}` : out[0] || ''
}

const addedV = added.map((s) => curBySlug.get(s))
const updatedV = updated.map((s) => curBySlug.get(s))
const highlights = addedV.filter((v) => v.tier === 'gold' || v.tier === 'silver')
const verifiedDates = [...new Set([...addedV, ...updatedV].map((v) => v.verified_at).filter(Boolean))].sort()
const verifiedRange = verifiedDates.length
  ? (verifiedDates.length === 1 ? fmtDate(verifiedDates[0]) : `${fmtDate(verifiedDates[0])} – ${fmtDate(verifiedDates.at(-1))}`)
  : 'neuvedeno'

const draftHeader = (title, channel, format) => `# ${title}

| | |
|---|---|
| **Stav** | DRAFT, vygenerováno \`npm run novinky\`, neschváleno, nezveřejňovat |
| **Vydání** | ${fmtDate(DATE)} (${isLaunch ? 'start' : 'aktualizace dat'}) |
| **Kanál** | ${channel} |
| **Formát** | ${format} |
| **Ověřeno** | data ověřena ${verifiedRange} |

## Ověřit před zveřejněním

- Projít ceny a podmínky u zvýrazněných míst (zdroj je v detailu místa). Když se něco změnilo, opravit data, znovu \`npm run data\` a \`npm run novinky\`.
- Odkazy otevřít až po nasazení webu (detail místa musí existovat).
- Bez slevového jazyka (brand.md, kap. 5 a 9); nanejvýš jedno emoji.

`

const HASHTAGS = '#rodinnevstupne #velkarodina #vyletysdetmi #kamsdetmi'
const lineFor = (v, source, { link = true, summary = false } = {}) => {
  const bits = [`${v.name}${v.city ? ` (${v.city})` : ''}`, tierBadge(v)]
  if (summary) bits.push(familyTicketSummary(v))
  const p = priceText(v); if (p) bits.push(p)
  return `– ${bits.join(' · ')}${link ? `\n  ${venueUrl(v.slug, source)}` : ''}`
}

// Výběr pro dlouhé seznamy: všechna Všichni dovnitř / Plná posádka, Čtyřlístek do limitu
function pickForKraj(vs, maxPerKraj) {
  if (vs.length <= maxPerKraj) return { shown: vs, rest: 0 }
  const top = vs.filter((v) => v.tier !== 'base')
  const shown = top.length >= maxPerKraj ? top.slice(0, maxPerKraj) : [...top, ...vs.filter((v) => v.tier === 'base').slice(0, maxPerKraj - top.length)]
  return { shown, rest: vs.length - shown.length }
}
const dalsich = (n) => (n === 1 ? `a ještě ${pocetMist(1)}` : `a ${plural(n, 'další', 'další', 'dalších')} ${pocetMist(n)}`)
// Pestrý výběr: nejdřív vyšší úroveň, z každého kraje nanejvýš jedno místo
function diversePick(list, max) {
  const seen = new Set(); const out = []
  for (const v of [...list].sort(byTierThenName)) {
    if (out.length >= max) break
    if (seen.has(v.kraj)) continue
    seen.add(v.kraj); out.push(v)
  }
  return out
}

// ---------- Facebook ----------
function facebook() {
  const src = 'facebook'
  const long = addedV.length > 20
  const lines = []
  if (isLaunch) {
    lines.push(`${HEADLINE}.`, '')
    lines.push('Dětí spousta, vstupenka jedna. Rodinné vstupné je katalog výletů pro velké rodiny. U každého místa uvádíme, pro kolik dětí platí rodinná vstupenka, kolik stojí, odkud údaj máme a kdy jsme ho ověřili.', '')
  } else {
    lines.push(`Dnes ${pribylo(addedV.length)}, kam můžete s dětmi.`.replace(/^Dnes přibylo 0.*$/, 'Aktualizovali jsme katalog.'), '')
  }
  if (addedV.length) {
    lines.push(`${cap(isLaunch ? 'v katalogu je' : 'mezi novými je')} ${tierSentence(addedV)}.`, '')
    for (const [kraj, vs] of groupByKraj(addedV)) {
      const { shown, rest } = long ? pickForKraj(vs, 3) : { shown: vs, rest: 0 }
      lines.push(`${cap(krajLocative(kraj))}${long ? ` (${pocetMist(vs.length)})` : ''}:`)
      for (const v of shown) lines.push(lineFor(v, src))
      if (rest) lines.push(`– ${dalsich(rest)}: ${krajUrl(kraj, src)}`)
      lines.push('')
    }
  }
  if (updatedV.length) {
    lines.push(`${cap(uMist(updatedV.length))} jsme aktualizovali ceník nebo podmínky:`)
    for (const v of updatedV) lines.push(`– ${v.name}: ${changes[v.slug].join('; ')}\n  ${venueUrl(v.slug, src)}`)
    lines.push('')
  }
  lines.push(`Zadejte, kolik máte dětí, a ukážeme vám místa ve vašem kraji: ${homeUrl(src)}`, '')
  lines.push(`Víte o místě, kde rodinná vstupenka platí pro 4 a více dětí? Napište nám na ${TIPS_EMAIL}, ověříme ho a přidáme.`, '')
  lines.push(HASHTAGS.split(' ').slice(0, 3).join(' '))
  return draftHeader(`Novinky ${fmtDate(DATE)} · Facebook`, 'FB stránka', 'text + odkazy (náhled odkazu: první URL v textu)') +
    '## Text\n\n' + lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// ---------- Instagram (karusel) ----------
function instagram() {
  const slides = []
  slides.push(isLaunch
    ? [`${pocetMist(current.length)}, kam můžete s dětmi`, '  Kde rodinná vstupenka platí pro 4 a více dětí. Ověřeno, se zdrojem a datem.']
    : [`Dnes ${pribylo(addedV.length)}`.replace(/^Dnes přibylo 0.*$/, 'Aktualizace katalogu'), '  Dětí spousta, vstupenka jedna.'])
  if (addedV.length) {
    const c = tierCounts(addedV)
    slides.push(['Jak čtete odznaky',
      ...(c.gold ? [`  Všichni dovnitř · neomezeně dětí: ${pocetMist(c.gold)}`] : []),
      ...(c.silver ? [`  Plná posádka · 5+ dětí: ${pocetMist(c.silver)}`] : []),
      ...(c.base ? [`  Čtyřlístek · 4 děti: ${pocetMist(c.base)}`] : [])])
    // Kraje do nanejvýš 7 snímků po 10 řádcích; když se nevejdou, ubereme jména míst
    const groups = groupByKraj(addedV)
    let packed = null
    for (const k of [4, 3, 2, 1, 0]) {
      const blocks = groups.map(([kraj, vs]) => {
        const shown = vs.slice(0, k)
        const rest = vs.length - shown.length
        return [`${cap(krajLocative(kraj))}${vs.length > 1 || rest ? ` · ${pocetMist(vs.length)}` : ''}`,
          ...shown.map((v) => `  ${v.name} · ${tierShort(v)}`),
          ...(rest && k ? [`  ${cap(dalsich(rest))}`] : [])]
      })
      const out = []; let cur = []
      for (const b of blocks) {
        if (cur.length && cur.length + b.length > 10) { out.push(cur); cur = [] }
        cur.push(...b)
      }
      if (cur.length) out.push(cur)
      if (out.length <= (updatedV.length ? 6 : 7)) { packed = out; break }
    }
    for (const s of packed || []) slides.push(s)
  }
  if (updatedV.length) {
    slides.push([`Změna ceníku ${uMist(updatedV.length)}`, ...updatedV.slice(0, 8).map((v) => `  ${v.name}`)])
  }
  slides.push(['Najděte místa pro svou rodinu', '  Zadejte počet dětí na rodinnevstupne.cz', '  Odkaz najdete v biu.', `  Tip na místo: ${TIPS_EMAIL}`])
  const finalSlides = slides.length > 10 ? [...slides.slice(0, 9), slides.at(-1)] : slides

  const caption = [
    isLaunch ? `${HEADLINE}.` : `Dnes ${pribylo(addedV.length)}, kam můžete s dětmi.`.replace(/^Dnes přibylo 0.*$/, `${HEADLINE}.`),
    '',
    addedV.length ? `${cap(isLaunch ? 'v katalogu je' : 'mezi novými je')} ${tierSentence(addedV)}. Seznam podle krajů je v karuselu.` : '',
    highlights.length ? `\nZa zmínku stojí: ${diversePick(highlights, 5).map((v) => `${v.name} (${tierShort(v)})`).join(', ')}.` : '',
    '',
    'Odkaz najdete v biu. Víte o dalším místě? Napište nám na ' + TIPS_EMAIL + '.',
    '',
    HASHTAGS,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim()

  return draftHeader(`Novinky ${fmtDate(DATE)} · Instagram`, 'IG účet', `karusel, ${finalSlides.length} snímků (1080 × 1350)`) +
    '## Snímky\n\nTypografie podle `brand/typography.css`, odznaky s ikonou úrovně (`brand/icons/tier-*.svg`). Bez fotek míst, pokud nemáme svolení.\n\n' +
    // Řádky bez odsazení jsou nadpisy (tučně), odsazené jsou text snímku
    finalSlides.map((s, i) => `### Snímek ${i + 1}\n\n${s.map((l) => (l.startsWith('  ') ? l.trim() : `**${l}**`)).join('\n\n')}\n`).join('\n') +
    `\n## Popisek\n\n${caption}\n\n## Odkaz do bia\n\n${homeUrl('instagram')}\n`
}

// ---------- Newsletter ----------
function newsletter() {
  const src = 'newsletter'
  const long = addedV.length > 40
  const lines = []
  lines.push(`**Předmět:** ${HEADLINE}`)
  lines.push(`**Náhledový text:** ${addedV.length ? tierSentence(addedV) : 'Aktualizovali jsme ceníky a podmínky.'}`, '')
  lines.push('Dobrý den,', '')
  if (isLaunch) {
    lines.push(`spustili jsme Rodinné vstupné, katalog výletů pro velké rodiny. Na startu v něm je ${pocetMist(current.length)}${krajeCount === 14 ? ' ze všech 14 krajů' : ''}. U každého uvádíme, pro kolik dětí platí rodinná vstupenka, kolik stojí, odkud údaj máme a kdy jsme ho ověřili.`, '')
  } else if (addedV.length) {
    lines.push(`do katalogu ${pribylo(addedV.length)}. Teď v něm je celkem ${pocetMist(current.length)}.`, '')
  } else {
    lines.push(`v katalogu jsme aktualizovali ceníky a podmínky. Teď v něm je celkem ${pocetMist(current.length)}.`, '')
  }
  if (addedV.length) {
    lines.push(`${cap(isLaunch ? 'v katalogu je' : 'mezi novými je')} ${tierSentence(addedV)}.`, '')
    lines.push(isLaunch ? '## Místa podle krajů' : '## Nová místa podle krajů', '')
    for (const [kraj, vs] of groupByKraj(addedV)) {
      const shown = long ? vs.filter((v) => v.tier !== 'base') : vs
      const rest = vs.length - shown.length
      lines.push(`### ${cap(krajLocative(kraj))}`, '')
      for (const v of shown) lines.push(lineFor(v, src, { summary: true }))
      if (rest) lines.push(`– ${shown.length ? dalsich(rest) : pocetMist(rest)} s odznakem Čtyřlístek · 4 děti: ${krajUrl(kraj, src)}`)
      lines.push('')
    }
  }
  if (updatedV.length) {
    lines.push('## Změny v cenících', '')
    for (const v of updatedV) lines.push(`– ${v.name}: ${changes[v.slug].join('; ')}\n  ${venueUrl(v.slug, src)}`)
    lines.push('')
  }
  if (removed.length) {
    lines.push('## Vyřadili jsme', '')
    for (const s of removed) lines.push(`– ${release.removed_names[s]} [DOPLNIT důvod, např. „rodinná vstupenka teď platí jen pro 2 děti“]`)
    lines.push('')
  }
  lines.push(`Data jsme ověřili ${verifiedRange}. Ceny se mění, před cestou je radši zkontrolujte na webu místa.`, '')
  lines.push(`Víte o místě, které nám chybí, nebo o změně ceníku? Napište nám na ${TIPS_EMAIL}. Každý tip ověříme a přidáme.`, '')
  lines.push(`Celý katalog: ${homeUrl(src)}`, '')
  lines.push(`Líbí se vám to? Kafe nás drží v chodu: ${BMC_URL}`, '')
  lines.push('Tým Rodinné vstupné')
  return draftHeader(`Novinky ${fmtDate(DATE)} · Newsletter`, 'e-mailový zpravodaj', 'e-mail (Markdown, převést v nástroji pro rozesílku)') +
    '## Text\n\n' + lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// ---------- X ----------
// X počítá každý odkaz jako 23 znaků
const xLen = (s) => s.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length
function x() {
  const src = 'x'
  const posts = []
  let main = isLaunch ? `${HEADLINE}.` : (addedV.length ? `Dnes ${pribylo(addedV.length)}, kam můžete s dětmi.` : `${HEADLINE}.`)
  if (addedV.length) main += `\n\n${cap(tierSentence(addedV))}.`
  if (!isLaunch && updatedV.length && addedV.length) main += `\n${cap(uMist(updatedV.length))} jsme aktualizovali ceník.`
  main += `\n\n${homeUrl(src)}`
  if (xLen(main) > 280) main = `${isLaunch ? HEADLINE : `Dnes ${pribylo(addedV.length)}, kam můžete s dětmi`}.\n\n${homeUrl(src)}`
  posts.push(main)
  // Vlákno: zvýrazněná místa, z každého kraje nanejvýš jedno, max 5
  const pick = diversePick(addedV, 5)
  for (const v of pick) {
    const p = priceText(v)
    let t = `${v.name}, ${krajLocative(v.kraj)}\n${tierBadge(v)}${p ? `, ${p}` : ''}\n${venueUrl(v.slug, src)}`
    if (xLen(t) > 280) t = `${v.name}\n${tierBadge(v)}\n${venueUrl(v.slug, src)}`
    posts.push(t)
  }
  posts.push(`Víte o místě, kde rodinná vstupenka platí pro 4 a více dětí? Napište nám na ${TIPS_EMAIL}.`)
  return draftHeader(`Novinky ${fmtDate(DATE)} · X`, 'X', `vlákno, ${posts.length} příspěvků`) +
    '## Vlákno\n\n' + posts.map((p, i) => `### ${i + 1}/${posts.length} (${xLen(p)} znaků)\n\n${p}\n`).join('\n')
}

const outDir = path.join(draftsRoot, DATE)
await mkdir(outDir, { recursive: true })
const drafts = { 'facebook.md': facebook(), 'instagram.md': instagram(), 'newsletter.md': newsletter(), 'x.md': x() }
for (const [f, body] of Object.entries(drafts)) await writeFile(path.join(outDir, f), body, 'utf8')
console.log(`  → návrhy: ${path.relative(root, outDir) || outDir}/{${Object.keys(drafts).join(',')}}`)
