// SEO metadata pro jednotlivé stránky. Sdílí je klient (document.title při přechodu mezi stránkami)
// i prerender (scripts/postbuild.mjs → statické HTML v dist/).
import {
  SITE_URL, CATEGORY_LABEL, TIERS, tierOf, krajFull, krajLocative, krajSlug,
  familyTicketSummary, formatPrice, formatDate,
} from './constants'

export const SITE_NAME = 'Rodinné vstupné'
export const DEFAULT_TITLE = 'Rodinné vstupné – kam na výlet, když dětí máte víc než dvě'
export const DEFAULT_DESCRIPTION =
  'Katalog výletů po celé ČR, kde rodinné vstupné platí aspoň pro 4 děti. U každého místa ověřená cena pro celou rodinu, zdroj a datum ověření. Zdarma a bez registrace.'

export const venuePath = (v) => `/misto/${v.slug}/`
export const krajPath = (k) => `/kraj/${krajSlug(k)}/`

const clip = (s, n = 158) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…')

export function homeMeta() {
  return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: '/' }
}

export function aboutMeta() {
  return {
    title: `O projektu a jak ověřujeme – ${SITE_NAME}`,
    description: 'Jak vybíráme místa, co znamenají úrovně Čtyřlístek, Plná posádka a Všichni dovnitř a jak ověřujeme ceny rodinného vstupného.',
    path: '/o-projektu/',
  }
}

export function tipMeta() {
  return {
    title: `Nahlásit místo · ${SITE_NAME}`,
    description: 'Znáte místo, kde rodinná vstupenka platí pro 4 a více dětí? Pošlete nám tip, ověříme ho a přidáme.',
    path: '/tip/',
  }
}

export function novinkyMeta() {
  return {
    title: `Novinky v katalogu – ${SITE_NAME}`,
    description: 'Která místa jsme do katalogu nově přidali a kde jsme opravili cenu nebo pravidla rodinného vstupného. Přehled podle data.',
    path: '/novinky/',
  }
}

export function venueMeta(v) {
  const t = tierOf(v)
  const price = formatPrice(v.price_family)
  const where = [v.city, v.kraj && krajFull(v.kraj)].filter(Boolean).join(', ')
  // Věty v pořadí důležitosti; přidáváme, dokud se vejdou do ~158 znaků (bez useknutých vět)
  const parts = [
    `${CATEGORY_LABEL[v.category] || 'Výlet'}${where ? ` (${where})` : ''}.`,
    `Rodinné vstupné: ${familyTicketSummary(v)}${price ? ` za ${price}` : ''}.`,
    v.verified_at ? `Ověřeno ${formatDate(v.verified_at)}.` : '',
    t ? `Úroveň ${t.name}.` : '',
    'Kalkulačka ceny pro celou rodinu.',
  ].filter(Boolean)
  let description = parts[0]
  for (const p of parts.slice(1)) if ((description + ' ' + p).length <= 158) description += ' ' + p
  return {
    title: `${v.name}${v.city ? `, ${v.city}` : ''} – rodinné vstupné | ${SITE_NAME}`,
    description: clip(description),
    path: venuePath(v),
    noindex: Boolean(v.sample),
  }
}

export function krajMeta(kraj, venues) {
  const n = venues.filter((v) => !v.sample).length
  const loc = krajLocative(kraj)
  return {
    title: `Výlety pro velké rodiny ${loc} – ${SITE_NAME}`,
    description: clip(n
      ? `${n === 1 ? '1 místo' : n <= 4 ? `${n} místa` : `${n} míst`} ${loc}, kde rodinné vstupné platí aspoň pro 4 děti. Ověřené ceny pro celou rodinu se zdrojem a datem ověření.`
      : `Výlety ${loc}, kde rodinné vstupné platí aspoň pro 4 děti. Katalog pro tento kraj právě plníme.`),
    path: krajPath(kraj),
    // Prázdné krajské stránky neindexujeme (tenký obsah); zaindexují se samy, až budou mít místa.
    noindex: n === 0,
  }
}

const abs = (path) => SITE_URL + path

// schema.org JSON-LD: TouristAttraction s nabídkami vstupného
export function venueJsonLd(v) {
  const offers = []
  const base = { '@type': 'Offer', priceCurrency: 'CZK', availability: 'https://schema.org/InStock' }
  if (v.source_url) base.url = v.source_url
  if (v.verified_at) base.validFrom = v.verified_at
  if (v.price_family != null) offers.push({ ...base, name: 'Rodinné vstupné', price: v.price_family, description: familyTicketSummary(v) })
  if (v.price_adult != null) offers.push({ ...base, name: 'Dospělý', price: v.price_adult })
  if (v.price_child != null) offers.push({ ...base, name: 'Dítě', price: v.price_child })

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: v.name,
    url: abs(venuePath(v)),
    description: venueMeta(v).description,
    touristType: 'Rodiny s dětmi',
    isAccessibleForFree: false,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CZ',
      ...(v.address ? { streetAddress: v.address } : {}),
      ...(v.city ? { addressLocality: v.city } : {}),
      ...(v.kraj ? { addressRegion: krajFull(v.kraj) } : {}),
    },
  }
  if (v.lat != null && v.lng != null) ld.geo = { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng }
  if (v.website) ld.sameAs = v.website
  if (offers.length) ld.offers = offers
  return [ld, breadcrumbs([[SITE_NAME, '/'], ...(v.kraj ? [[krajFull(v.kraj), krajPath(v.kraj)]] : []), [v.name, venuePath(v)]])]
}

export function krajJsonLd(kraj, venues) {
  return [{
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Výlety pro velké rodiny ${krajLocative(kraj)}`,
    numberOfItems: venues.length,
    itemListElement: venues.map((v, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(venuePath(v)), name: v.name })),
  }, breadcrumbs([[SITE_NAME, '/'], [krajFull(kraj), krajPath(kraj)]])]
}

export function homeJsonLd() {
  return [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: abs('/'), inLanguage: 'cs' }]
}

function breadcrumbs(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
  }
}

// Řazení v seznamech: nejlepší úroveň první, pak abecedně
export const byTierThenName = (a, b) =>
  (TIERS[b.tier]?.rank || 0) - (TIERS[a.tier]?.rank || 0) || a.name.localeCompare(b.name, 'cs')
