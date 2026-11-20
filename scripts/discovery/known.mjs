// Známá místa (katalog + zamítnutá + kandidáti + tri-deti) – sdílí všechny skripty v scripts/discovery/.
// known() → { slugs:Set, domains:Set, names:Set(normalizované názvy) }
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const candDir = path.join(root, 'scripts', 'candidates')

export const slugify = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// Doména bez www., malými písmeny; null pro neplatné URL
export function domainOf(url) {
  try { return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
}

export async function known() {
  const slugs = new Set(), domains = new Set(), names = new Set()
  const add = (r) => {
    if (!r || !r.name) return
    slugs.add(slugify(r.slug || r.name))
    names.add(slugify(r.name))
    for (const u of [r.website, r.source_url]) { const d = domainOf(u || ''); if (d) domains.add(d) }
  }
  const venues = JSON.parse(await readFile(path.join(root, 'src', 'data', 'venues.json'), 'utf8'))
  venues.forEach(add)
  for (const f of await readdir(candDir)) {
    if (!/^(verified|rejected|raw|tri-deti)-.*\.json$/.test(f)) continue
    try { const arr = JSON.parse(await readFile(path.join(candDir, f), 'utf8')); if (Array.isArray(arr)) arr.forEach(add) } catch {}
  }
  return { slugs, domains, names }
}
