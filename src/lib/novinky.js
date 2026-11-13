// Novinky v katalogu: src/data/novinky.json (generuje `npm run novinky`, viz docs/ops/novinky.md).
// Pole vydání, nejnovější první.
import NOVINKY from '../data/novinky.json'

const DATA = (Array.isArray(NOVINKY) ? NOVINKY : [])
  .filter((r) => r && r.date)
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

export function getNovinky() {
  return DATA
}

export function getLatestRelease() {
  return DATA[0] || null
}
