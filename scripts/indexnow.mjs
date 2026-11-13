// Oznámí URL ze živé sitemapy vyhledávačům přes IndexNow (Bing, Seznam, Yandex…).
// Použití: npm run indexnow            – všechny URL ze sitemapy
//          npm run indexnow -- <url>…  – jen vybrané URL
const SITE = process.env.SITE_URL || 'https://rodinnevstupne.cz'
const KEY = '4faa8856e35c8079701c7b50fe2a5eb6' // klíč je veřejný, leží v public/4faa8856e35c8079701c7b50fe2a5eb6.txt

const host = new URL(SITE).host
let urls = process.argv.slice(2)
if (!urls.length) {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text()
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
})
console.log(`IndexNow: ${urls.length} URL → HTTP ${res.status}`)
if (!res.ok) process.exit(1)
