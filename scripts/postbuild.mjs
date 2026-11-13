// Postbuild: SEO prerender + GitHub Pages fallback.
//
// 1. dist/404.html = prázdná šablona (SPA fallback pro neznámé adresy, noindex).
// 2. Statické HTML s obsahem a vlastními meta značkami pro:
//    dist/index.html, dist/o-projektu/, dist/kraj/<slug>/, dist/misto/<slug>/
//    (title, description, canonical, robots, OG, schema.org JSON-LD).
// 3. dist/sitemap.xml a dist/robots.txt.
//
// Vykresluje se přes SSR balík dist-ssr/entry-server.js (vzniká v `npm run build`).
// Kanonická doména: env SITE_URL / VITE_SITE_URL, výchozí https://rodinnevstupne.cz.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ssrDir = path.join(root, 'dist-ssr')

const ssr = await import(pathToFileURL(path.join(ssrDir, 'entry-server.js')).href)
const {
  render, getVenues, getVenuesByKraj, KRAJE, SITE_URL, SITE_NAME,
  homeMeta, aboutMeta, venueMeta, krajMeta, venueJsonLd, krajJsonLd, homeJsonLd, byTierThenName,
} = ssr

const template = await readFile(path.join(dist, 'index.html'), 'utf8')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// JSON v <script> nesmí obsahovat „</script>“ ani HTML komentáře
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

// Odstraní ze šablony značky, které se na každé stránce liší, a vloží nové.
function buildHead(html, meta, jsonLd = []) {
  const url = SITE_URL + meta.path
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:(title|description|url)"[^>]*>/g, '')
    .replace(/\s*<link rel="canonical"[^>]*>/, '')
    .replace(/\s*<meta name="robots"[^>]*>/, '')
    .replace(/\n\s*\n/g, '\n')
  const tags = [
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex, follow" />' : null,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    ...jsonLd.map((o) => `<script type="application/ld+json">${jsonForScript(o)}</script>`),
  ].filter(Boolean)
  return out.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
}

function withBody(html, routePath, appHtml) {
  return html.replace('<div id="root"></div>',
    `<div id="root" data-prerendered="${esc(routePath)}">${appHtml}</div>`)
}

async function writePage(routePath, meta, jsonLd) {
  const html = withBody(buildHead(template, meta, jsonLd), routePath, render(routePath))
  const dir = path.join(dist, ...routePath.split('/').filter(Boolean))
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), html)
  return routePath
}

// 1) 404.html: prázdná šablona (klient vykreslí sám), neindexovat
await writeFile(path.join(dist, '404.html'), buildHead(template,
  { title: `Stránka nenalezena – ${SITE_NAME}`, description: homeMeta().description, path: '/', noindex: true }))

// 2) Prerender
const { data: venues, demo } = getVenues()
const d = new Date()
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sitemap = []
const pages = []

pages.push(await writePage('/', homeMeta(), homeJsonLd()))
sitemap.push({ loc: '/', lastmod: today, priority: '1.0' })

pages.push(await writePage('/o-projektu/', aboutMeta()))
sitemap.push({ loc: '/o-projektu/', lastmod: today, priority: '0.4' })

for (const kraj of KRAJE) {
  const list = getVenuesByKraj(kraj).slice().sort(byTierThenName)
  const meta = krajMeta(kraj, list)
  pages.push(await writePage(meta.path, meta, list.length ? krajJsonLd(kraj, list) : []))
  if (!meta.noindex) {
    const lastmod = list.map((v) => v.verified_at).filter(Boolean).sort().pop() || today
    sitemap.push({ loc: meta.path, lastmod, priority: '0.8' })
  }
}

for (const v of venues) {
  if (!v.slug) continue
  const meta = venueMeta(v)
  pages.push(await writePage(meta.path, meta, venueJsonLd(v)))
  if (!meta.noindex) sitemap.push({ loc: meta.path, lastmod: v.verified_at || today, priority: '0.7' })
}

// 3) sitemap.xml + robots.txt
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `  <url><loc>${esc(SITE_URL + u.loc)}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`
await writeFile(path.join(dist, 'sitemap.xml'), xml)
await writeFile(path.join(dist, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${SITE_URL}/sitemap.xml
`)

await rm(ssrDir, { recursive: true, force: true })

console.log(`Prerender: ${pages.length} stránek (${venues.length} × místo${demo ? ' – UKÁZKOVÁ data, noindex' : ''}, ${KRAJE.length} krajů)`)
console.log(`sitemap.xml: ${sitemap.length} adres, kanonická doména ${SITE_URL}`)
console.log('dist/404.html: prázdná šablona pro SPA fallback (noindex)')
