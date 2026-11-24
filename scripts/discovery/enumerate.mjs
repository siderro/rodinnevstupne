// Fáze 2a: úplný výčet míst v ČR z OpenStreetMap (Overpass) + Wikidata → out/universe-<datum>.json
// Použití: node scripts/discovery/enumerate.mjs [YYYY-MM-DD]
// Bere jen místa s vlastním webem (bez webu nejde ceník přečíst strojově). Odečte známá místa (known.mjs).
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { known, root, slugify, domainOf } from './known.mjs'

const DATE = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10)
const UA = 'rodinnevstupne.cz-bot (+https://rodinnevstupne.cz; tipy@rodinnevstupne.cz)'
const OUT = path.join(root, 'scripts', 'discovery', 'out')

const OVERPASS_PARTS = [
  'nwr["tourism"~"^(museum|gallery)$"](area.cz);',
  'nwr["tourism"~"^(zoo|theme_park|aquarium)$"](area.cz); nwr["leisure"~"^(water_park|trampoline_park)$"](area.cz); nwr["amenity"="planetarium"](area.cz);',
  'nwr["historic"~"^(castle|manor|fort)$"]["website"](area.cz);',
  'nwr["tourism"="attraction"]["website"](area.cz);',
  'nwr["man_made"="observatory"]["website"](area.cz); nwr["tourism"="viewpoint"]["fee"="yes"](area.cz); nwr["natural"="cave_entrance"]["fee"="yes"](area.cz); nwr["leisure"="garden"]["garden:type"="botanical"](area.cz);',
]
// --set volny-cas (23. 11.): typy, kde je rodinné vstupné 2 + 3 nejčastější – koupaliště a bazény, lanová centra,
// bobové dráhy, dětské herny, kluziště, minigolf, lezecké stěny
const EXTRA_PARTS = [
  'nwr["leisure"="sports_centre"]["sport"~"swimming"]["website"](area.cz); nwr["amenity"="public_bath"]["website"](area.cz); nwr["leisure"="swimming_area"]["website"](area.cz);',
  'nwr["leisure"="swimming_pool"]["access"!~"private|customers|no"]["website"](area.cz);',
  'nwr["leisure"~"^(high_ropes_course|indoor_play|miniature_golf|ice_rink)$"]["website"](area.cz); nwr["attraction"~"^(summer_toboggan|alpine_coaster)$"](area.cz); nwr["playground"="indoor"]["website"](area.cz);',
  'nwr["leisure"="sports_centre"]["sport"~"climbing|bowling"]["website"](area.cz); nwr["leisure"="playground"]["fee"="yes"]["website"](area.cz);',
]
const overpassQuery = (body) => `[out:json][timeout:180];\narea["ISO3166-1"="CZ"][admin_level=2]->.cz;\n(${body});\nout center tags;`

// Wikidata: instance (podtřídy) muzea, zoo, hradu, zámku, zábavního parku, aquaparku, hvězdárny, jeskyně, botanické zahrady v ČR s oficiálním webem
const WD_TYPES = ['wd:Q33506', 'wd:Q43501', 'wd:Q23413', 'wd:Q751876', 'wd:Q194195', 'wd:Q740326', 'wd:Q1144661', 'wd:Q35509', 'wd:Q167346', 'wd:Q207694', 'wd:Q1007870', 'wd:Q2087181',
  // rozšíření 23. 11.: rozhledna, hvězdárna, planetárium, akvárium, skanzen, klášter, zřícenina hradu, památník, arboretum, zpřístupněný důl/jeskyně, technické muzeum, science centrum
  'wd:Q1440300', 'wd:Q1254933', 'wd:Q148319', 'wd:Q2281788', 'wd:Q756102', 'wd:Q44613', 'wd:Q17715832', 'wd:Q5003624', 'wd:Q216344', 'wd:Q2232001', 'wd:Q1595639', 'wd:Q1060829', 'wd:Q2516357']
const SPARQL = `SELECT ?item ?itemLabel ?web ?coord ?typeLabel WHERE {
  VALUES ?type { TYPE }
  ?item wdt:P17 wd:Q213; wdt:P856 ?web; wdt:P31 ?t. ?t wdt:P279? ?type.
  OPTIONAL { ?item wdt:P625 ?coord }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "cs,en". }
}`

function osmCategory(t) {
  if (/swimming/.test(t.sport || '') || t.amenity === 'public_bath' || t.leisure === 'swimming_pool' || t.leisure === 'swimming_area') return 'aquapark'
  if (['high_ropes_course', 'indoor_play', 'playground'].includes(t.leisure) || t.attraction === 'summer_toboggan' || t.attraction === 'alpine_coaster') return 'zabavni_park'
  if (['miniature_golf', 'ice_rink'].includes(t.leisure) || /climbing|bowling/.test(t.sport || '')) return 'sport'
  if (t.tourism === 'zoo' || t.tourism === 'aquarium') return 'zoo'
  if (t.leisure === 'water_park') return 'aquapark'
  if (t.tourism === 'theme_park' || t.leisure === 'amusement_arcade' || t.leisure === 'trampoline_park') return 'zabavni_park'
  if (t.historic === 'castle' || t.historic === 'manor' || t.historic === 'fort') return 'hrad'
  if (t.amenity === 'planetarium' || t.man_made === 'observatory') return 'science'
  if (t.natural === 'cave_entrance' || t.leisure === 'garden') return 'priroda'
  if (t.tourism === 'museum' || t.tourism === 'gallery') return 'muzeum'
  return 'jine'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function fetchRetry(label, fn, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try { return await fn() } catch (err) { console.warn(`${label}: pokus ${i}/${tries} selhal (${err.message})`); await sleep(15000 * i) }
  }
  return null
}

async function overpass() {
  const EPS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
  const out = []
  const PARTS = process.argv.includes('--set') && process.argv[process.argv.indexOf('--set') + 1] === 'volny-cas' ? EXTRA_PARTS : OVERPASS_PARTS
  for (const [n, part] of PARTS.entries()) {
    const els = await fetchRetry(`Overpass část ${n + 1}`, async () => {
      for (const ep of EPS) {
        const r = await fetch(ep, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(overpassQuery(part)) })
        if (r.ok) return (await r.json()).elements
        console.warn(`  ${ep}: HTTP ${r.status}`)
      }
      throw new Error('všechny servery selhaly')
    })
    console.log(`Overpass část ${n + 1}: ${els ? els.length : 'SELHALO'}`)
    for (const e of els || []) {
      const t = e.tags || {}
      out.push({
        name: t.name, website: t.website || t['contact:website'] || t.url || null,
        lat: e.lat ?? e.center?.lat ?? null, lng: e.lon ?? e.center?.lon ?? null,
        city: t['addr:city'] || null, category: osmCategory(t), src: `osm:${e.type}/${e.id}`,
        operator: t.operator || null,
      })
    }
  }
  return out
}

async function wikidata() {
  const rows = []
  for (const t of WD_TYPES) {
    const b = await fetchRetry(`Wikidata ${t}`, async () => {
      const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(SPARQL.replace('TYPE', t)), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return (await r.json()).results.bindings
    }, 2)
    console.log(`Wikidata ${t}: ${b ? b.length : 'SELHALO'}`)
    rows.push(...(b || []))
  }
  {
    return rows.map((b) => {
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value || '')
      const tl = (b.typeLabel?.value || '').toLowerCase()
      const category = /zoo/.test(tl) ? 'zoo' : /hrad|zámek|castle/.test(tl) ? 'hrad' : /zábav|amusement|aqua/.test(tl) ? 'zabavni_park' : /jeskyn|botan/.test(tl) ? 'priroda' : /hvězd|observ/.test(tl) ? 'science' : 'muzeum'
      return { name: b.itemLabel?.value, website: b.web?.value, lat: m ? Number(m[2]) : null, lng: m ? Number(m[1]) : null, city: null, category, src: b.item.value.replace('http://www.wikidata.org/entity/', 'wd:') }
    })
  }
}

// --wikidata-only: přeskočit Overpass; --exclude <universe.json>: vynechat místa, která už jsou v dřívějším výčtu
const ONLY_WD = process.argv.includes('--wikidata-only')
const exIdx = process.argv.indexOf('--exclude')
const EXCLUDE = exIdx === -1 ? null : process.argv[exIdx + 1]
const osm = ONLY_WD ? [] : await overpass()
const wd = process.argv.includes('--set') ? [] : await wikidata()
const k = await known()

// Sloučit podle webu (doména + cesta); místa bez webu nebo s webem na sociální síti vynechat
const SOCIAL = /(facebook|instagram|youtube|twitter|x)\.com|wikipedia\.org|mapy\.cz|google\./i
const byUrl = new Map()
let noWeb = 0
for (const p of [...osm, ...wd]) {
  if (!p.name || !p.website || SOCIAL.test(p.website)) { noWeb++; continue }
  let url = p.website.trim().split(/[;\s]/)[0]
  if (!/^https?:/i.test(url)) url = 'https://' + url
  let key
  try { const u = new URL(url); key = (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '')).toLowerCase() } catch { continue }
  const prev = byUrl.get(key)
  if (prev) { prev.src.push(p.src); prev.lat ??= p.lat; prev.lng ??= p.lng; prev.city ??= p.city; continue }
  byUrl.set(key, { ...p, website: url, src: [p.src] })
}

const prevWebs = new Set()
if (EXCLUDE) { const { readFile } = await import('node:fs/promises'); for (const p of JSON.parse(await readFile(EXCLUDE, 'utf8'))) prevWebs.add(p.website) }
const universe = [], skipped = { known_name: 0, known_domain: 0, in_previous: 0 }
for (const p of byUrl.values()) {
  const d = domainOf(p.website)
  if (prevWebs.has(p.website)) { skipped.in_previous++; continue }
  if (k.names.has(slugify(p.name)) || k.slugs.has(slugify(p.name))) { skipped.known_name++; continue }
  // Sdílená doména provozovatele (nm.cz, ntm.cz…) = možná nová pobočka → ponechat, ale označit
  p.known_domain = k.domains.has(d)
  if (p.known_domain) skipped.known_domain++
  p.domain = d
  universe.push(p)
}

await mkdir(OUT, { recursive: true })
const file = path.join(OUT, `universe-${DATE}.json`)
await writeFile(file, JSON.stringify(universe, null, 1) + '\n')
const cats = universe.reduce((m, p) => ((m[p.category] = (m[p.category] || 0) + 1), m), {})
console.log(`Celkem OSM ${osm.length} + Wikidata ${wd.length}; bez webu ${noWeb}; unikátních webů ${byUrl.size}; ` +
  `známé podle názvu ${skipped.known_name}; v dřívějším výčtu ${skipped.in_previous}; zbývá ${universe.length} (z toho na známé doméně ${skipped.known_domain})`)
console.log('Kategorie:', cats, '→', path.relative(root, file))
