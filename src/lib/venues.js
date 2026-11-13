// Veřejný web čte statická data ze src/data/venues.json (generuje `npm run data`).
// Supabase se používá jen v /admin (viz lib/supabase.js), veřejná část na něm nezávisí.
import VENUES from '../data/venues.json'
import { SAMPLE_VENUES } from './sampleVenues'

const isDemo = !Array.isArray(VENUES) || VENUES.length === 0
const DATA = isDemo ? SAMPLE_VENUES : VENUES

export function getVenues() {
  return { data: DATA, demo: isDemo }
}

export function getVenueBySlug(slug) {
  return DATA.find((v) => v.slug === slug) || null
}

export function getVenuesByKraj(kraj) {
  return DATA.filter((v) => v.kraj === kraj)
}
