// Lokální import kandidátů do rv_venues jako drafty (status='draft').
// Použití:  node scripts/import.mjs scripts/candidates.json
//
// Vstup je JSON pole objektů s poli z rv_venues (name je povinné).
// Skript používá SERVICE_ROLE klíč (obchází RLS) — pouští se jen lokálně.
// Reálná místa najdeš ručně / research nástrojem a uložíš je do candidates.json.

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

// Načti scripts/.env (jednoduchý parser, bez extra závislosti)
try {
  const env = await readFile(new URL('./.env', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* .env nemusí existovat, když jsou proměnné v shellu */ }

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Chybí SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY (viz scripts/.env.example).')
  process.exit(1)
}

const file = process.argv[2] || 'scripts/candidates.json'
const candidates = JSON.parse(await readFile(file, 'utf8'))
if (!Array.isArray(candidates)) throw new Error('Vstup musí být JSON pole.')

const slugify = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const rows = candidates
  .filter((c) => c.name)
  .map((c) => ({ status: 'draft', ...c, slug: c.slug || slugify(c.name) }))

const supabase = createClient(url, key)
const { data, error } = await supabase
  .from('rv_venues')
  .upsert(rows, { onConflict: 'slug' })
  .select('id, name')

if (error) { console.error('Chyba:', error.message); process.exit(1) }
console.log(`Naimportováno/aktualizováno ${data.length} míst (jako draft):`)
for (const r of data) console.log('  •', r.name)
console.log('\nSchval je v /admin.')
