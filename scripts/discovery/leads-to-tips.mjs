// Fáze 2c: out/leads-<datum>.json → tipy pro workflow objevovani-mist (mode "tipy").
// Kraj se jen odhadne podle nejbližšího místa z katalogu (slouží k rozdělení na skupiny, validátor ho opraví).
// Použití: node scripts/discovery/leads-to-tips.mjs <datum> [--verdicts HIT4,HIT3] [--limit N] [--skip N]
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { root } from './known.mjs'

const argv = process.argv.slice(2)
const DATE = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
const opt = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1] }
const VERDICTS = (opt('--verdicts') || 'HIT4,HIT3').split(',')
const LIMIT = Number(opt('--limit')) || Infinity
const SKIP = Number(opt('--skip')) || 0
const OUT = path.join(root, 'scripts', 'discovery', 'out')

const leads = JSON.parse(await readFile(path.join(OUT, `leads-${DATE}.json`), 'utf8'))
const venues = JSON.parse(await readFile(path.join(root, 'src', 'data', 'venues.json'), 'utf8')).filter((v) => v.lat && v.lng)
const nearestKraj = (lat, lng) => {
  if (lat == null) return null
  let best = null, bd = Infinity
  for (const v of venues) { const d = (v.lat - lat) ** 2 + ((v.lng - lng) * 0.64) ** 2; if (d < bd) { bd = d; best = v } }
  return best?.kraj || null
}

const picked = leads.filter((l) => VERDICTS.includes(l.scan.verdict)).slice(SKIP, SKIP + LIMIT)
const tips = picked.map((l) => ({
  name: l.name,
  city: l.city || null,
  kraj: nearestKraj(l.lat, l.lng),
  url: l.scan.url || l.website,
  note: `Síto ${DATE}: ${l.scan.verdict} (${l.scan.rule}) – „${(l.scan.snippet || '').slice(0, 220)}“. Web: ${l.website}${l.known_domain ? ' (doména provozovatele už je v katalogu – možná pobočka)' : ''}`,
}))
const file = path.join(OUT, `tips-${DATE}-${SKIP}.json`)
await writeFile(file, JSON.stringify(tips, null, 1) + '\n')
const by = tips.reduce((m, t) => ((m[t.kraj] = (m[t.kraj] || 0) + 1), m), {})
console.log(`Tipů ${tips.length} (z ${leads.length} leadů) → ${path.relative(root, file)}`, by)
