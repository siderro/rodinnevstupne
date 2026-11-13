// Propíše výsledky přeověření (scripts/candidates/reverify-<tag>-*.json) do verified-*.json.
// Použití:  node scripts/apply-reverify.mjs <tag> [--dry-run]
//   např.   node scripts/apply-reverify.mjs 2027-02-reverify-20 --dry-run
//
// Proč zvlášť: přeověřovatelé ve workflow běží souběžně, a proto verified-*.json needitují.
// Záznam se upraví PŘÍMO v souboru, kde je (pole "file", jinak se dohledá podle slugu),
// protože build-data.mjs při duplicitním slugu bere abecedně pozdější soubor
// a "verified-2027-02-…" by prohrál se starším "verified-zapad.json".
//
// Stavy:
//   unchanged        → verified_at = checked_at
//   updated          → sloučí "record" do záznamu (slug zůstává), verified_at = checked_at
//   below_threshold  → přesune záznam do rejected-<tag>-reverify.json s důvodem
//   closed           → přesune záznam do rejected-<tag>-reverify.json s důvodem
//   unreachable      → beze změny, jen vypíše (ověřit ručně do 30 dní)

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'scripts', 'candidates')
const tag = process.argv[2]
const dry = process.argv.includes('--dry-run')
if (!tag || tag.startsWith('--')) {
  console.error('Použití: node scripts/apply-reverify.mjs <tag> [--dry-run]')
  process.exit(1)
}

const all = await readdir(dir)
const reportFiles = all.filter((f) => f.startsWith(`reverify-${tag}-`) && f.endsWith('.json')).sort()
if (!reportFiles.length) { console.error(`Žádné soubory reverify-${tag}-*.json`); process.exit(1) }

const verifiedFiles = all.filter((f) => /^verified-.*\.json$/.test(f)).sort()
const data = new Map()
for (const f of verifiedFiles) data.set(f, JSON.parse(await readFile(path.join(dir, f), 'utf8')))
const findFile = (slug, hint) => {
  if (hint && data.has(hint) && data.get(hint).some((r) => r.slug === slug)) return hint
  // stejně jako build-data: platí abecedně poslední výskyt
  return [...verifiedFiles].reverse().find((f) => data.get(f).some((r) => r.slug === slug)) || null
}

const moved = []
const touched = new Set()
const stats = {}
const problems = []

for (const rf of reportFiles) {
  const items = JSON.parse(await readFile(path.join(dir, rf), 'utf8'))
  for (const it of items) {
    stats[it.status] = (stats[it.status] || 0) + 1
    const file = findFile(it.slug, it.file && path.basename(it.file))
    if (!file) { problems.push(`${it.slug}: v žádném verified-*.json`); continue }
    const arr = data.get(file)
    const idx = arr.findIndex((r) => r.slug === it.slug)
    const rec = arr[idx]
    const when = it.checked_at || null
    if (!when && it.status !== 'unreachable') { problems.push(`${it.slug}: chybí checked_at`); continue }

    if (it.status === 'unchanged') {
      rec.verified_at = when
    } else if (it.status === 'updated') {
      if (!it.record || !it.record.source_url) { problems.push(`${it.slug}: updated bez record.source_url – přeskočeno`); continue }
      Object.assign(rec, it.record, { slug: rec.slug, verified_at: when })
      console.log(`  ~ ${rec.name}: aktualizováno`)
    } else if (it.status === 'below_threshold' || it.status === 'closed') {
      arr.splice(idx, 1)
      moved.push({ ...rec, reason: `${it.status}: ${it.reason || ''}`.trim(), checked_at: when })
      console.log(`  - ${rec.name}: ${it.status} → rejected (${it.reason || 'bez důvodu'})`)
    } else if (it.status === 'unreachable') {
      console.log(`  ? ${rec.name}: nedostupné – ověřit ručně do 30 dní (${it.reason || ''})`)
      continue
    } else {
      problems.push(`${it.slug}: neznámý stav „${it.status}“`); continue
    }
    touched.add(file)
  }
}

if (!dry) {
  for (const f of touched) await writeFile(path.join(dir, f), JSON.stringify(data.get(f), null, 2) + '\n', 'utf8')
  if (moved.length) {
    const rf = path.join(dir, `rejected-${tag}-reverify.json`)
    let prev = []
    try { prev = JSON.parse(await readFile(rf, 'utf8')) } catch {}
    await writeFile(rf, JSON.stringify([...prev, ...moved], null, 2) + '\n', 'utf8')
  }
}

for (const p of problems) console.warn('  ! ' + p)
console.log(`${dry ? '[dry-run] ' : ''}Stavy: ${JSON.stringify(stats)}; upravené soubory: ${[...touched].join(', ') || '–'}; vyřazeno: ${moved.length}`)
if (!dry) console.log('Dál: npm run data → kontrola → commit/PR.')
