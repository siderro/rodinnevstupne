// Fáze 2b: levné síto ceníků. Pro každé místo z out/universe-<datum>.json otevře web, najde stránku
// vstupného/ceníku (odkazy, záloha sitemap.xml), a regexem roztřídí:
//   HIT4 – vypadá na rodinnou vstupenku pro 4+ dětí / neomezeně / děti zdarma do věku
//   HIT3 – vypadá na 2 + 3 děti
//   ROD  – zmínka o rodinném vstupném, počet dětí nejasný
//   NO   – nic (2 + 2 se nezapisuje vůbec)
// Výstup out/leads-<datum>.json. Nic nejde na web přímo: leads → validátor (workflow mode "tipy") → kontrola.
// Slušnost: vlastní User-Agent s kontaktem, robots.txt, max. 1 dotaz/s na doménu, cache, žádné obcházení 403.
// Použití: caffeinate -dimsu node scripts/discovery/scan.mjs <datum-universe> [--limit N] [--domains a.cz,b.cz]
//   Běh jde přerušit a znovu spustit: hotová místa se berou z out/scan-state-<datum>.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { root, domainOf } from './known.mjs'

const run = promisify(execFile)
const argv = process.argv.slice(2)
const DATE = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
if (!DATE) throw new Error('Zadej datum výčtu, např. node scripts/discovery/scan.mjs 2026-11-20')
const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1] }
const LIMIT = Number(opt('--limit')) || Infinity
const ONLY = opt('--domains') ? new Set(opt('--domains').split(',')) : null
const INPUT = opt('--input')

const UA = 'rodinnevstupne.cz-bot (+https://rodinnevstupne.cz; tipy@rodinnevstupne.cz)'
const OUT = path.join(root, 'scripts', 'discovery', 'out')
const CACHE = path.join(OUT, 'cache')
const STATE = path.join(OUT, `scan-state-${DATE}.json`)
const CONCURRENCY = 8
const PER_DOMAIN_MS = 1100
const MAX_PAGES = 4

// --- HTTP s cache, robots.txt a rozestupem na doménu ------------------------
const lastHit = new Map()
const robotsCache = new Map()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function politeFetch(url, { binary = false } = {}) {
  const key = createHash('sha1').update(url).digest('hex')
  const cfile = path.join(CACHE, key + '.txt')
  try { return { ok: true, body: await readFile(cfile, 'utf8'), url, cached: true } } catch {}
  try { return { ok: true, body: await readFile(path.join(CACHE, key + '.bin')), url, cached: true, pdf: true } } catch {}
  const host = new URL(url).host
  const wait = (lastHit.get(host) || 0) + PER_DOMAIN_MS - Date.now()
  lastHit.set(host, Date.now() + Math.max(0, wait))
  if (wait > 0) await sleep(wait)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'cs,en;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
    if (!r.ok) return { ok: false, status: r.status, url }
    const ct = r.headers.get('content-type') || ''
    if (binary || /pdf/.test(ct)) {
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length > 15e6) return { ok: false, status: 'too_big', url }
      await writeFile(path.join(CACHE, key + '.bin'), buf)
      return { ok: true, body: buf, url: r.url, pdf: true }
    }
    if (!/html|text|xml/.test(ct)) return { ok: false, status: 'ctype ' + ct, url }
    const body = (await r.text()).slice(0, 3e6)
    await writeFile(cfile, body)
    return { ok: true, body, url: r.url }
  } catch (e) {
    return { ok: false, status: e.name === 'TimeoutError' ? 'timeout' : e.message, url }
  }
}

// robots.txt: skupiny User-agent (* nebo náš bot), Allow/Disallow s * a $, vyhrává nejdelší shoda
async function allowed(url) {
  const u = new URL(url)
  if (!robotsCache.has(u.host)) {
    const r = await politeFetch(`${u.protocol}//${u.host}/robots.txt`)
    const rules = []
    if (r.ok && typeof r.body === 'string') {
      let agents = [], inRules = false
      for (const line of r.body.split(/\r?\n/)) {
        const m = /^\s*(user-agent|allow|disallow)\s*:\s*(.*?)\s*$/i.exec(line.replace(/#.*/, ''))
        if (!m) continue
        const k = m[1].toLowerCase()
        if (k === 'user-agent') { if (inRules) { agents = []; inRules = false } agents.push(m[2]); continue }
        inRules = true
        if (!m[2] || !agents.some((a) => a === '*' || /rodinnevstupne/i.test(a))) continue
        const rx = new RegExp('^' + m[2].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))
        rules.push({ allow: k === 'allow', rx, len: m[2].length })
      }
    }
    robotsCache.set(u.host, rules)
  }
  const target = u.pathname + u.search
  let best = null
  for (const r of robotsCache.get(u.host)) if (r.rx.test(target) && (!best || r.len > best.len || (r.len === best.len && r.allow))) best = r
  return !best || best.allow
}

// --- text a odkazy -----------------------------------------------------------
const decode = (s) => s.replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/&([a-z]+);/gi, (m, n) => ({ ndash: '–', mdash: '—', plus: '+', times: '×', lt: '<', gt: '>' }[n.toLowerCase()] || ' '))
const htmlText = (h) => decode(h.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|tr|td|th|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n')

const PRICE_LINK = /vstupn|cenik|ceník|ceny|cena|vstupenk|tickets?|price|admission|navstev|návštěv|prohlid|prohlíd|otevir|oteví|info/i
function priceLinks(html, base) {
  const out = []
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = htmlText(m[2]).trim()
    let href
    try { href = new URL(decode(m[1]), base).href } catch { continue }
    if (!/^https?:/.test(href)) continue
    const score = (/vstupn|cen[ií]k|ceny\b|vstupenk/i.test(text) ? 3 : 0) + (/vstupn|cenik|ceny|vstupenk/i.test(href) ? 2 : 0) + (PRICE_LINK.test(text + ' ' + href) ? 1 : 0) + (/\.pdf($|\?)/i.test(href) && /cen|vstup/i.test(href + text) ? 1 : 0)
    if (score > 0) out.push({ href, score })
  }
  const seen = new Set()
  return out.sort((a, b) => b.score - a.score).filter((l) => !seen.has(l.href) && seen.add(l.href))
}

// --- klasifikace -------------------------------------------------------------
const N = '(?:2|dva|dvě|dvou)'
const KIDS = '(?:d[ěe]t[ií]|d[ěe]ti|d[ěe]tmi|d[ií]t[ěe]|ml[áa]de[žz]e|ž[áa]k[ůu]|junio\\S*|deti)'
const RX = {
  unlimited: [
    new RegExp(`neomezen\\S*\\s+po[čc]et\\s+${KIDS}`, 'i'),
    new RegExp(`${KIDS}[^.\\n]{0,25}bez\\s+omezen[ií]\\s+po[čc]tu`, 'i'),
    new RegExp(`(?:rodi[čc]e|${N}\\s+dosp[ěe]l\\S*)\\s+(?:a|\\+|s)\\s+(?:sv[ýy]mi\\s+|v[šs]emi\\s+)?(?:vlastn[ií]mi\\s+)?d[ěe]tmi\\b(?!\\s*\\(?\\s*(?:max|do|a[žz])\\s*\\d)`, 'i'),
    new RegExp(`${N}\\s+dosp[ěe]l\\S*\\s*(?:a|\\+)\\s*d[ěe]ti\\b(?!\\s*\\(?\\s*(?:max|do|a[žz]|\\d))`, 'i'),
    new RegExp(`${KIDS}\\s+do\\s+(?:1[5-9]|2\\d)\\s+let[^.\\n]{0,30}(?:zdarma|vstup\\s+zdarma|0\\s*k[čc])`, 'i'),
    new RegExp(`(?:zdarma|voln\\S*\\s+vstup|bezplatn\\S*)[\\s\\S]{0,80}?(?:do|[–-])\\s*(?:1[5-9]|2\\d)\\s*let`, 'i'),
    new RegExp(`(?:do|[–-])\\s*(?:1[5-9]|2\\d)\\s*let[\\s\\S]{0,60}?(?:zdarma|voln\\S*\\s+vstup|0\\s*k[čc])`, 'i'),
    new RegExp(`\\b(?:\\d|jedn\\S*)\\s+a\\s+v[íi]ce\\s+${KIDS}`, 'i'),
    new RegExp(`dal[šs][íi]\\s+${KIDS}\\s+(?:maj[íi]\\s+vstup\\s+)?zdarma`, 'i'),
    new RegExp(`(?:jejich|sv[ýy]mi|vlastn[íi]mi)\\s+${KIDS}`, 'i'),
  ],
  four: [
    new RegExp(`${N}\\s*(?:dosp[ěe]l\\S*|rodi[čc]\\S*)?\\s*(?:a|\\+|&)\\s*(?:a[žz]\\s+|max(?:im[áa]ln[ěe])?\\.?\\s*|nejv[ýy]\\S*\\s*|1\\s*[–-]\\s*|2\\s*[–-]\\s*|3\\s*[–-]\\s*)?([4-9]|1\\d|čtyři|pět|šest)\\b(?!\\s*(?:Kč|,-|let|%))\\s*(?:a\\s+v[íi]ce\\s+)?${KIDS}?`, 'i'),
    new RegExp(`(?:max(?:im[áa]ln[ěe])?\\.?|a[žz])\\s*([4-9])\\s*${KIDS}`, 'i'),
    new RegExp(`(?:rodinn\\S*|skupin\\S*)[^\\n]{0,160}\\b([6-9]|1\\d)\\s*osob`, 'i'),
    new RegExp(`(?:a[žz]|max\\.?|maxim[áa]ln[ěe]|[0-3]\\s*[–-])\\s*([4-9])\\s*${KIDS}`, 'i'),
  ],
  three: [
    new RegExp(`${N}\\s*(?:dosp[ěe]l\\S*|rodi[čc]\\S*)?\\s*(?:a|\\+|&)\\s*(?:a[žz]\\s+|max\\.?\\s*|1\\s*[–-]\\s*|2\\s*[–-]\\s*)?(3|tři)\\b(?!\\s*(?:Kč|,-|let|%|\\d))\\s*${KIDS}?`, 'i'),
    new RegExp(`(?:max(?:im[áa]ln[ěe])?\\.?|a[žz])\\s*3\\s*${KIDS}`, 'i'),
    new RegExp(`rodinn\\S*[^.\\n]{0,40}\\b5\\s*osob`, 'i'),
  ],
  family: /rodinn\S*\s+(?:vstup|vstupenk|tarif|jízdn|lístek|lístk|permanent)|rodina\b|family\s+ticket/i,
}

// Okna kolem slova „rodinn…“ (tam musí být pravidlo); u „děti do 15 let zdarma“ celé text
function windows(text) {
  const out = []
  for (const m of text.matchAll(/rodin|famil|děti do|dítě do|deti do|zdarma/gi)) out.push(text.slice(Math.max(0, m.index - 160), m.index + 260))
  return out
}

function classify(text) {
  const wins = windows(text)
  const find = (rxs, onlyFamily) => {
    for (const w of wins) {
      if (onlyFamily && !/rodin|famil|osob/i.test(w)) continue
      for (const rx of rxs) { const m = rx.exec(w); if (m) return w.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80).replace(/\s+/g, ' ').trim() }
    }
    return null
  }
  let s
  if ((s = find(RX.unlimited, false))) return { verdict: 'HIT4', rule: 'unlimited', snippet: s }
  if ((s = find(RX.four, true))) return { verdict: 'HIT4', rule: '4+', snippet: s }
  if ((s = find(RX.three, true))) return { verdict: 'HIT3', rule: '2+3', snippet: s }
  const fam = wins.find((w) => RX.family.test(w))
  if (fam) return { verdict: 'ROD', rule: null, snippet: fam.replace(/\s+/g, ' ').trim().slice(0, 300) }
  return { verdict: 'NO', rule: null, snippet: null }
}

async function pageText(res) {
  if (!res.pdf) return htmlText(res.body)
  const tmp = path.join(CACHE, 'tmp-' + createHash('sha1').update(res.url).digest('hex') + '.pdf')
  await writeFile(tmp, res.body)
  try { return (await run('pdftotext', ['-layout', '-l', '6', tmp, '-'], { maxBuffer: 2e7 })).stdout } catch { return '' }
}

const RANK = { HIT4: 3, HIT3: 2, ROD: 1, NO: 0 }
async function scanPlace(p) {
  const home = await politeFetch(p.website)
  if (!home.ok) return { status: `home ${home.status}` }
  if (home.pdf) { const c = classify(await pageText(home)); return { status: 'ok', pages: 1, ...c, url: home.url } }
  let best = { verdict: 'NO' }, bestUrl = null, pages = 0
  const consider = async (res) => {
    const c = classify(await pageText(res))
    if (RANK[c.verdict] > RANK[best.verdict]) { best = c; bestUrl = res.url }
  }
  await consider(home)
  let links = priceLinks(home.body, home.url).filter((l) => domainOf(l.href) === domainOf(home.url)).slice(0, MAX_PAGES)
  if (!links.length) {
    let smUrl; try { smUrl = new URL('/sitemap.xml', home.url).href } catch { smUrl = null }
    const sm = smUrl ? await politeFetch(smUrl) : { ok: false }
    if (sm.ok && typeof sm.body === 'string') links = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => ({ href: m[1].trim() })).filter((l) => /vstupn|cenik|ceny|vstupenk/i.test(l.href)).slice(0, MAX_PAGES)
  }
  for (const l of links) {
    if (best.verdict === 'HIT4') break
    if (!(await allowed(l.href))) continue
    const r = await politeFetch(l.href, { binary: /\.pdf($|\?)/i.test(l.href) })
    pages++
    if (r.ok) await consider(r)
    // druhá úroveň: stránka vstupného odkazuje na PDF ceník
    if (r.ok && !r.pdf && best.verdict !== 'HIT4') {
      const pdf = priceLinks(r.body, r.url).find((x) => /\.pdf($|\?)/i.test(x.href))
      if (pdf && (await allowed(pdf.href))) { const rp = await politeFetch(pdf.href, { binary: true }); pages++; if (rp.ok) await consider(rp) }
    }
  }
  return { status: 'ok', pages, ...best, url: bestUrl }
}

// --- běh ---------------------------------------------------------------------
await mkdir(CACHE, { recursive: true })
let universe = JSON.parse(await readFile(INPUT || path.join(OUT, `universe-${DATE}.json`), 'utf8'))
if (ONLY) universe = universe.filter((p) => ONLY.has(p.domain || domainOf(p.website)))
universe = universe.slice(0, LIMIT)
let state = {}
try { state = JSON.parse(await readFile(STATE, 'utf8')) } catch {}

const todo = universe.filter((p) => !state[p.website])
console.log(`Míst ${universe.length}, hotovo dříve ${universe.length - todo.length}, zbývá ${todo.length}`)
let done = 0, lastSave = Date.now()
const save = () => writeFile(STATE, JSON.stringify(state))

async function worker() {
  while (todo.length) {
    const p = todo.shift()
    try {
      state[p.website] = (await allowed(p.website)) ? await scanPlace(p) : { status: 'robots' }
    } catch (e) { state[p.website] = { status: 'error ' + e.message } }
    done++
    const v = state[p.website].verdict
    if (v === 'HIT4' || v === 'HIT3') console.log(`  ${v} ${p.name} – ${(state[p.website].snippet || '').slice(0, 140)}`)
    if (done % 25 === 0) console.log(`[${new Date().toLocaleTimeString('cs')}] ${done}/${universe.length - (universe.length - todo.length - done)}`)
    if (Date.now() - lastSave > 20000) { lastSave = Date.now(); await save() }
  }
}
// Pořadí: prokládat domény, aby souběžné workery nečekaly na stejný server
todo.sort((a, b) => (a.domain || '').localeCompare(b.domain || ''))
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
await save()

const leads = universe.map((p) => ({ ...p, scan: state[p.website] })).filter((p) => p.scan && ['HIT4', 'HIT3', 'ROD'].includes(p.scan.verdict))
leads.sort((a, b) => RANK[b.scan.verdict] - RANK[a.scan.verdict])
await writeFile(path.join(OUT, `leads-${DATE}.json`), JSON.stringify(leads, null, 1) + '\n')
const stat = Object.values(state).reduce((m, s) => { const k = s.verdict || s.status.split(' ')[0]; m[k] = (m[k] || 0) + 1; return m }, {})
console.log('Výsledek:', stat, `→ out/leads-${DATE}.json (${leads.length})`)
