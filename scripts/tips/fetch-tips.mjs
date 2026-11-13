#!/usr/bin/env node
// Stáhne tipy a opravy ze schránky tipy@rodinnevstupne.cz (docs/ops/tipy.md, kap. 4.2).
//
//   node scripts/tips/fetch-tips.mjs [--since 2026-11-01] [--dry-run]   (npm run tips:fetch)
//
// - Přihlašovací údaje jen z ~/.config/rodinnevstupne/mail.env (IMAP_HOST, IMAP_PORT,
//   IMAP_USER, IMAP_PASSWORD; volitelně IMAP_FOLDER_NEW). Nikdy se nevypisují.
// - Soukromý ledger (adresy, jména, původní text): ~/.local/share/rodinnevstupne/tips/ledger.json
// - Anonymní fronta (veřejné repo): scripts/tips/queue.json
// - Zprávy jen označí (\Seen + $Fronta). Nic nemaže ani nepřesouvá, to dělá close-tips.mjs.
// - --dry-run: schránku otevře jen pro čtení, nic nezapíše ani neoznačí.
//
// Kódy: 0 = OK, 1 = část zpráv se nepodařilo zpracovat (fronta se zapíše), 2 = konfigurace/připojení.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ATT_DIR, CANDIDATES_DIR, FINAL_STATUSES, QUEUE_FLAG, REJECTED_PATH,
  argValue, connectImap, daysBetween, ensurePrivateDir, hasFlag, loadLedger, loadMailEnv,
  loadQueue, loadVenues, readJson, saveLedger, saveQueue, slugify, today,
} from './lib.mjs'

const DRY = hasFlag('--dry-run')
const SINCE = argValue('--since')
if (SINCE && !/^\d{4}-\d{2}-\d{2}$/.test(SINCE)) {
  console.error('--since očekává datum ve tvaru RRRR-MM-DD')
  process.exit(2)
}

// ---------------------------------------------------------------- parsování

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Klíče z kap. 2.7 → pole ve frontě
const KEYS = {
  'typ': 'typ',
  'misto': 'misto',
  'mesto': 'mesto',
  'obec': 'mesto',
  'cenik': 'cenik',
  'odkaz na cenik': 'cenik',
  'odkaz na zdroj': 'cenik',
  'rodinne vstupne': 'rodinne_vstupne',
  'navstiveno': 'navstiveno',
  'poznamka': 'poznamka',
  'podekovani': 'podekovani',
  'uvest jako': 'uvest_jako',
  'slug': 'slug',
  'druh zmeny': 'druh_zmeny',
  'co je jinak': 'co_je_jinak',
}
const LIMITS = {
  misto: 120, mesto: 80, cenik: 300, rodinne_vstupne: 250, navstiveno: 20,
  poznamka: 250, uvest_jako: 40, slug: 120, druh_zmeny: 40, co_je_jinak: 300,
}
const FREE_FIELDS = ['rodinne_vstupne', 'poznamka', 'co_je_jinak']
const DRUH_ZMENY = ['Cena', 'Počet dětí nebo věk', 'Místo je zavřené', 'Jiné']

const SIGNATURE_RE = /^(s pozdravem|se srdečným pozdravem|s přáním|s úctou|děkuji|děkujeme|díky|zdraví|zdravím|hezký den|pěkný den|krásný den|mějte se|odesláno z|odesláno přes|sent from|get outlook|--\s*$)/i
const QUOTE_START_RE = /^(dne .+napsal|on .+wrote:|-{2,}\s*(původní|original|přeposlan|forwarded)|from:\s|od:\s)/i
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_RE = /(?:(?:\+|00)\d{3}[\s.-]?)?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}\b/g
const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi
const NAME_INTRO_RE = /\b(jmenuji se|jsem|moje jméno je|píše vám|píše)\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+(\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+)?/g

/** Odstraní e-maily, telefony a představení jménem; URL nechá. */
function scrub(text) {
  if (!text) return text
  return String(text)
    .split(/(https?:\/\/[^\s<>"')\]]+)/gi)
    .map((part, i) => (i % 2 === 1 ? part : part
      .replace(EMAIL_RE, '[odstraněno]')
      .replace(PHONE_RE, '[odstraněno]')
      .replace(NAME_INTRO_RE, (m, verb) => `${verb} [odstraněno]`)))
    .join('')
}

function cut(s, max) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

function validUrl(s) {
  if (!s) return null
  const m = String(s).match(/https?:\/\/[^\s<>"]+/i)
  if (!m) return null
  try {
    const u = new URL(m[0].replace(/[.,;)]+$/, ''))
    if (!/^https?:$/.test(u.protocol)) return null
    return u.toString().slice(0, 300)
  } catch {
    return null
  }
}

/** Odřízne citace, podpis a patičku formuláře. */
function bodyLines(text) {
  const out = []
  for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/ /g, ' ').trimEnd()
    if (/^--\s*$/.test(line)) break
    if (line.startsWith('>')) continue
    if (QUOTE_START_RE.test(line.trim())) break
    out.push(line)
  }
  return out
}

function stripSignature(lines) {
  const out = []
  for (const l of lines) {
    if (SIGNATURE_RE.test(l.trim())) break
    out.push(l)
  }
  return out
}

/** Vytáhne řádky „Klíč: hodnota“ (kap. 2.7). Pokračovací řádky připojí k předchozí hodnotě. */
function parseFields(lines) {
  const fields = {}
  let last = null
  for (const line of lines) {
    const m = line.match(/^\s*([^:]{2,30}):\s?(.*)$/)
    const key = m ? KEYS[norm(m[1]).replace(/\s+/g, ' ')] : null
    if (key) {
      fields[key] = m[2].trim()
      last = key
    } else if (last && line.trim() && !/^\(.*\)$/.test(line.trim())) {
      fields[last] = `${fields[last]} ${line.trim()}`.trim()
    } else {
      last = null
    }
  }
  return fields
}

function parseSubject(subject) {
  const s = String(subject || '').replace(/^\s*((re|fwd?|fw|odp|vs|tr)\s*:\s*)+/i, '').trim()
  let m = s.match(/^\[\s*TIP\s*\]\s*(.*)$/i)
  if (m) {
    const [misto, mesto] = m[1].split(/\s+[–—-]\s+/)
    return { type: 'tip', misto: misto?.trim() || null, mesto: mesto?.trim() || null }
  }
  m = s.match(/^\[\s*OPRAVA\s*\]\s*(\S*)/i)
  if (m) return { type: 'oprava', slug: m[1] ? slugify(m[1]) : null }
  return { type: 'volny' }
}

const SPAM_RE = /\b(seo|backlink|link ?building|guest ?post|casino|kasino|crypto|krypto|bitcoin|forex|viagra|loan|půjčk|unsubscribe|odhlásit odběr|newsletter|marketingov|nabízíme|nabídka spolupráce|sponzorovan|pr článek|placený článek)\w*/i
const PAID_RE = /(zaplat|placen[éýá] zařazení|lepší pozic|vyšší pozic|na první míst|zvýrazněn|topovan|reklamní pozic|partnerstv)/i
const CLOSED_RE = /(zavřen|zrušen|uzavřen|rekonstrukc|skončil|nefunguje)/i

function looksAutomated(parsed) {
  const from = norm(parsed.from?.value?.[0]?.address)
  const auto = parsed.headers.get('auto-submitted')
  return /^(mailer-daemon|postmaster|no-?reply|noreply)@/.test(from)
    || (auto && String(auto).toLowerCase() !== 'no')
    || parsed.headers.has('x-autoreply') || parsed.headers.has('x-autorespond')
}

// ---------------------------------------------------------------- deduplikace (kap. 4.3)

const DOMAIN_ALIASES = { 'zoodvurkralove.cz': 'safaripark.cz' }
const GENERIC_HOSTS = new Set([
  'facebook.com', 'm.facebook.com', 'fb.com', 'instagram.com', 'google.com', 'goo.gl', 'maps.app.goo.gl',
  'drive.google.com', 'docs.google.com', 'mapy.cz', 'mapy.com', 'kudyznudy.cz', 'npu.cz', 'youtube.com',
  'tripadvisor.com', 'tripadvisor.cz', 'wikipedia.org', 'cs.wikipedia.org', 'seznam.cz', 'bit.ly',
])
const NAME_STOP = /\b(zoo|zoopark|zamek|hrad|muzeum)\b/g

function hostOf(u) {
  try {
    let h = new URL(u).hostname.toLowerCase().replace(/^www\./, '')
    h = DOMAIN_ALIASES[h] || h
    return GENERIC_HOSTS.has(h) ? null : h
  } catch {
    return null
  }
}
const normName = (s) => norm(s).replace(/[^a-z0-9 ]+/g, ' ').replace(NAME_STOP, ' ').replace(/\s+/g, ' ').trim()
const normCity = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim()

function buildIndex(venues, queue) {
  const items = []
  const add = (rec, zdroj) => {
    if (!rec || !(rec.slug || rec.name)) return
    items.push({
      zdroj,
      slug: slugify(rec.slug || rec.name),
      name: normName(rec.name),
      city: normCity(rec.city),
      hosts: [rec.website, rec.source_url].map(hostOf).filter(Boolean),
      rec,
    })
  }
  venues.forEach((v) => add(v, 'venues'))
  readJson(REJECTED_PATH, []).forEach((r) => add(r, 'rejected'))
  if (fs.existsSync(CANDIDATES_DIR)) {
    for (const f of fs.readdirSync(CANDIDATES_DIR).sort()) {
      if (!/^(raw|verified)-.*\.json$/.test(f)) continue
      const data = readJson(path.join(CANDIDATES_DIR, f), [])
      ;(Array.isArray(data) ? data : []).forEach((r) => add(r, 'candidates'))
    }
  }
  queue.filter((q) => !FINAL_STATUSES.includes(q.status) && q.misto)
    .forEach((q) => add({ name: q.misto, city: q.mesto, slug: q.slug, website: q.cenik, tip_ref: q.tip_ref }, 'queue'))
  // počet různých slugů na doménu – sdílené domény se nepoužijí
  const hostSlugs = new Map()
  for (const it of items) for (const h of it.hosts) {
    if (!hostSlugs.has(h)) hostSlugs.set(h, new Set())
    hostSlugs.get(h).add(it.slug)
  }
  return { items, hostSlugs }
}

const ZDROJ_ORDER = ['venues', 'rejected', 'candidates', 'queue']
const byZdroj = (a, b) => ZDROJ_ORDER.indexOf(a.zdroj) - ZDROJ_ORDER.indexOf(b.zdroj)

function findDuplicate(index, tip) {
  const { items, hostSlugs } = index
  const slug = tip.slug || (tip.misto ? slugify(tip.misto) : null)
  const hit = (match, it) => ({ match, slug: it.slug, zdroj: it.zdroj, _it: it })
  if (slug) {
    const m = items.filter((it) => it.slug === slug).sort(byZdroj)[0]
    if (m) return hit('slug', m)
  }
  const h = hostOf(tip.cenik)
  if (h && hostSlugs.get(h)?.size === 1) {
    const m = items.filter((it) => it.hosts.includes(h)).sort(byZdroj)[0]
    if (m) return hit('domena', m)
  }
  const n = normName(tip.misto)
  const c = normCity(tip.mesto)
  if (n.length >= 4 && c) {
    const m = items
      .filter((it) => it.city === c && it.name.length >= 4 && (it.name.includes(n) || n.includes(it.name)))
      .sort(byZdroj)[0]
    if (m) return hit('nazev', m)
  }
  return null
}

// ---------------------------------------------------------------- zpracování zprávy

function nextTipRef(ledger, received) {
  const ym = (received || today()).slice(0, 7)
  const prefix = `T-${ym}-`
  const max = ledger.entries
    .map((e) => e.tip_ref)
    .filter((r) => r?.startsWith(prefix))
    .reduce((acc, r) => Math.max(acc, Number(r.slice(prefix.length)) || 0), 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

function safeName(name, i) {
  const base = String(name || `priloha-${i + 1}`).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 80)
  return base || `priloha-${i + 1}`
}

function buildTip(parsed, venuesBySlug, index) {
  const subj = parseSubject(parsed.subject)
  const rawText = parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, ' ') : '')
  const lines = bodyLines(rawText)
  const f = parseFields(lines)
  const hints = []

  let type = subj.type
  const typHint = norm(f.typ)
  if (type === 'volny' && (typHint === 'tip' || typHint === 'oprava')) type = typHint
  const formLike = Boolean(f.misto || f.slug || f.co_je_jinak)

  const tip = {
    type,
    misto: cut(f.misto || subj.misto, LIMITS.misto),
    mesto: cut(f.mesto || subj.mesto, LIMITS.mesto),
    slug: f.slug ? slugify(f.slug).slice(0, LIMITS.slug) : (subj.slug || null),
    cenik: validUrl(f.cenik),
    rodinne_vstupne: null,
    navstiveno: cut(f.navstiveno, LIMITS.navstiveno),
    druh_zmeny: null,
    co_je_jinak: null,
    poznamka: null,
  }
  if (f.cenik && !tip.cenik) hints.push('Ceník není platná http(s) adresa.')
  for (const k of FREE_FIELDS) tip[k] = cut(scrub(f[k]), LIMITS[k])
  if (f.druh_zmeny) {
    tip.druh_zmeny = DRUH_ZMENY.find((d) => norm(d) === norm(f.druh_zmeny)) || cut(scrub(f.druh_zmeny), LIMITS.druh_zmeny)
  }

  const consent = norm(f.podekovani) === 'ano'
  const uvestJako = cut(f.uvest_jako, LIMITS.uvest_jako)
  const tip_credit = consent && uvestJako ? cut(scrub(uvestJako).replace(/\[odstraněno\]/g, '').trim(), 40) : null

  let needs_human = false
  let raw_text = null
  let urls = []
  if (type === 'volny' || !formLike) {
    // psáno ručně: agent z textu vytáhne místo, město a odkaz, rozhoduje člověk
    needs_human = true
    const clean = stripSignature(lines).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    raw_text = scrub(clean)
    if (raw_text && raw_text.length > 1000) raw_text = raw_text.slice(0, 999).trimEnd() + '…'
    urls = [...new Set((clean.match(URL_RE) || []).map(validUrl).filter(Boolean))].slice(0, 5)
    if (!tip.cenik && urls.length) tip.cenik = urls[0]
    if (type !== 'volny') hints.push('Předmět má tag, ale tělo nemá pole formuláře.')
  }

  let status = 'nový'
  const allText = `${parsed.subject || ''}\n${rawText}`
  const linkCount = (rawText.match(URL_RE) || []).length
  if (SPAM_RE.test(allText) || linkCount > 8 || (!formLike && !tip.misto && !tip.slug && !urls.length && type !== 'volny')) {
    status = 'spam?'
    needs_human = true
  }
  let suggested_reply = null
  if (PAID_RE.test(allText)) { suggested_reply = 'placene-zarazeni'; needs_human = true }
  if (type === 'oprava' && (CLOSED_RE.test(`${tip.druh_zmeny} ${tip.co_je_jinak}`) || norm(tip.druh_zmeny) === norm('Místo je zavřené'))) {
    suggested_reply = 'podekovani'
    hints.push('Hlášení zavřeného místa: SLA 3 dny, poslat potvrzení přijetí.')
  }

  if (type === 'oprava') {
    if (!tip.slug && tip.misto) tip.slug = slugify(tip.misto)
    if (tip.slug && !venuesBySlug.has(tip.slug)) {
      needs_human = true
      hints.push(`Slug „${tip.slug}“ není ve venues.json.`)
    }
    if (tip.slug && venuesBySlug.has(tip.slug) && !tip.misto) tip.misto = venuesBySlug.get(tip.slug).name
  }

  // deduplikace jen u tipů na nová místa (oprava míří na známé místo záměrně)
  let dedupe = null
  if (type === 'tip' || (type === 'volny' && tip.misto)) {
    const d = findDuplicate(index, tip)
    if (d) {
      const { _it, ...rest } = d
      dedupe = rest
      if (d.zdroj === 'venues' && type === 'tip') {
        const bringsNew = Boolean(tip.rodinne_vstupne || tip.poznamka || (tip.cenik && hostOf(tip.cenik) && !_it.hosts.includes(hostOf(tip.cenik))))
        tip.original_type = 'tip'
        tip.type = bringsNew ? 'oprava' : 'duplicita'
        tip.slug = d.slug
        if (!bringsNew) hints.push('Místo už je v katalogu a tip nepřináší nic nového.')
      } else if (d.zdroj === 'rejected') {
        const checked = _it.rec.checked_at
        if (checked && daysBetween(checked, today()) <= 183) {
          status = 'zamítnuto'
          tip.result = {
            reason: _it.rec.reason || null,
            source_url: _it.rec.source_url || null,
            verified_at: checked,
            auto: 'shoda s rejected.json (kontrola mladší než 6 měsíců)',
          }
        } else {
          hints.push(`Dříve zamítnuto (${checked || 'bez data'}), ověřit znovu.`)
        }
      }
    }
  }

  return { tip, tip_credit, status, needs_human, raw_text, urls, dedupe, hints, suggested_reply, fullText: rawText }
}

// ---------------------------------------------------------------- hlavní běh

async function main() {
  const cfg = loadMailEnv()
  const { simpleParser } = await import('mailparser')

  let client
  try {
    client = await connectImap(cfg)
  } catch (e) {
    console.error(`Nelze se připojit k IMAP (${cfg.host}:${cfg.port}): ${e.authenticationFailed ? 'přihlášení odmítnuto' : (e.code || e.message)}`)
    process.exit(2)
  }

  const ledger = loadLedger()
  const queue = loadQueue()
  const venues = loadVenues()
  const venuesBySlug = new Map(venues.map((v) => [v.slug, v]))
  const index = buildIndex(venues, queue)
  const knownIds = new Set(ledger.entries.map((e) => e.message_id).filter(Boolean))

  const stats = { nove: 0, tipy: 0, opravy: 0, volne: 0, duplicity: 0, mozna: 0, clovek: 0, spam: 0, ignor: 0, chyby: 0, preskoceno: 0 }
  const toFlag = []
  let lock
  let keywordsOk = false
  try {
    lock = await client.getMailboxLock(cfg.folderNew, { readOnly: DRY })
    const mb = client.mailbox
    keywordsOk = [...(mb.permanentFlags || [])].includes('\\*')
    // Výběr vždy podle chybějícího $Fronta (ne podle \Seen – vlastník může zprávu mezitím přečíst).
    // Když server vlastní příznaky neukládá, vrátí vše a opakování pohlídá ledger (message_id).
    const query = { unKeyword: QUEUE_FLAG }
    if (SINCE) query.since = new Date(SINCE)
    const uids = (await client.search(query, { uid: true })) || []
    console.log(`${DRY ? '[dry-run, jen čtení] ' : ''}Složka ${cfg.folderNew}: ${mb.exists} zpráv celkem, ke zpracování ${uids.length}.`)

    if (uids.length) {
      for await (const msg of client.fetch(uids, { uid: true, source: true, envelope: true, flags: true }, { uid: true })) {
        let parsed
        try {
          parsed = await simpleParser(msg.source)
        } catch (e) {
          stats.chyby++
          console.error(`UID ${msg.uid}: nelze rozparsovat (${e.message})`)
          continue
        }
        const messageId = parsed.messageId || `uid:${cfg.folderNew}:${mb.uidValidity}:${msg.uid}`
        if (knownIds.has(messageId)) {
          stats.preskoceno++
          toFlag.push(msg.uid) // už je v ledgeru, jen doplnit příznak
          continue
        }
        knownIds.add(messageId)
        const receivedIso = (parsed.date || msg.envelope?.date || new Date()).toISOString()
        const tip_ref = nextTipRef(ledger, receivedIso.slice(0, 10))
        const sender = parsed.replyTo?.value?.[0] || parsed.from?.value?.[0] || {}

        const entry = {
          tip_ref,
          message_id: messageId,
          imap: { folder: cfg.folderNew, uid: msg.uid, uid_validity: String(mb.uidValidity) },
          from_address: sender.address || null,
          from_name: sender.name || null,
          subject: parsed.subject || '',
          received_at: receivedIso,
          fetched_at: new Date().toISOString(),
          status: 'nový',
          uvest_jako: null,
          raw_text: null,
          attachments_dir: null,
          status_changed_at: null,
          draft_written_at: null,
          draft_status: null,
          replied_at: null,
          resolved_at: null,
          deleted_at: null,
        }

        if (looksAutomated(parsed)) {
          entry.status = 'ignorováno'
          entry.note = 'automatická zpráva (bounce/autoreply)'
          ledger.entries.push(entry)
          stats.ignor++
          toFlag.push(msg.uid)
          continue
        }

        let r
        try {
          r = buildTip(parsed, venuesBySlug, index)
        } catch (e) {
          stats.chyby++
          console.error(`${tip_ref}: chyba při zpracování (${e.message})`)
          entry.status = 'chyba'
          ledger.entries.push(entry)
          continue
        }

        const atts = (parsed.attachments || []).filter((a) => a.content?.length && !a.related)
        if (atts.length && !DRY) {
          ensurePrivateDir()
          const dir = path.join(ATT_DIR, tip_ref)
          fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
          atts.forEach((a, i) => fs.writeFileSync(path.join(dir, `${i + 1}-${safeName(a.filename, i)}`), a.content, { mode: 0o600 }))
          entry.attachments_dir = dir
        }

        const fields = parseFields(bodyLines(r.fullText))
        entry.uvest_jako = cut(fields.uvest_jako, 40)
        entry.raw_text = r.fullText.slice(0, 20000)
        entry.status = r.status
        if (r.status !== 'nový') entry.status_changed_at = new Date().toISOString()

        const item = {
          tip_ref,
          type: r.tip.type,
          ...(r.tip.original_type ? { original_type: r.tip.original_type } : {}),
          received_at: receivedIso.slice(0, 10),
          status: r.status,
          needs_human: r.needs_human,
          misto: r.tip.misto,
          mesto: r.tip.mesto,
          slug: r.tip.slug,
          cenik: r.tip.cenik,
          rodinne_vstupne: r.tip.rodinne_vstupne,
          navstiveno: r.tip.navstiveno,
          druh_zmeny: r.tip.druh_zmeny,
          co_je_jinak: r.tip.co_je_jinak,
          poznamka: r.tip.poznamka,
          tip_credit: r.tip_credit,
          has_attachment: atts.length > 0,
          dedupe: r.dedupe,
          ...(r.raw_text ? { raw_text: r.raw_text, urls: r.urls } : {}),
          ...(r.suggested_reply ? { suggested_reply: r.suggested_reply } : {}),
          hints: r.hints,
          result: r.tip.result || null,
        }
        queue.push(item)
        ledger.entries.push(entry)
        if (item.misto) {
          // další zprávy ve stejném běhu se deduplikují i proti této
          index.items.push({ zdroj: 'queue', slug: slugify(item.slug || item.misto), name: normName(item.misto), city: normCity(item.mesto), hosts: [hostOf(item.cenik)].filter(Boolean), rec: item })
        }
        toFlag.push(msg.uid)

        stats.nove++
        if (item.type === 'tip') stats.tipy++
        else if (item.type === 'oprava') stats.opravy++
        else if (item.type === 'duplicita') stats.duplicity++
        else stats.volne++
        if (item.dedupe) stats.mozna++
        if (item.needs_human) stats.clovek++
        if (item.status === 'spam?') stats.spam++
        if (DRY) {
          console.log(`  ${tip_ref} ${item.type}${item.status !== 'nový' ? ` [${item.status}]` : ''}: ${item.misto || item.slug || '(bez místa)'}${item.mesto ? ` – ${item.mesto}` : ''}${item.dedupe ? ` · shoda ${item.dedupe.match}/${item.dedupe.zdroj}: ${item.dedupe.slug}` : ''}`)
        }
      }
    }

    if (!DRY) {
      saveLedger(ledger) // nejdřív soubory, pak příznaky (ledger brání zdvojení)
      saveQueue(queue)
      if (toFlag.length) {
        await client.messageFlagsAdd(toFlag, keywordsOk ? ['\\Seen', QUEUE_FLAG] : ['\\Seen'], { uid: true })
        if (!keywordsOk) console.warn(`Server nepodporuje vlastní příznaky, zprávy jsou jen označené jako přečtené (opakování hlídá ledger).`)
      }
    }
  } catch (e) {
    console.error(`Chyba IMAP: ${e.responseText || e.code || e.message}`)
    try { lock?.release() } catch {}
    await client.logout().catch(() => {})
    process.exit(2)
  }
  lock?.release()
  await client.logout().catch(() => {})

  const parts = [`Nové: ${stats.nove} (tipy ${stats.tipy}, opravy ${stats.opravy}${stats.volne ? `, volné ${stats.volne}` : ''}${stats.duplicity ? `, duplicity ${stats.duplicity}` : ''})`,
    `možná duplicitní: ${stats.mozna}`, `ke kontrole člověkem: ${stats.clovek}`]
  if (stats.spam) parts.push(`možný spam: ${stats.spam}`)
  if (stats.ignor) parts.push(`automatické zprávy: ${stats.ignor}`)
  if (stats.preskoceno) parts.push(`už v ledgeru: ${stats.preskoceno}`)
  if (stats.chyby) parts.push(`chyby: ${stats.chyby}`)
  console.log(`${parts.join(', ')}.`)
  if (DRY) console.log('Dry-run: nic se nezapsalo ani neoznačilo.')
  process.exit(stats.chyby ? 1 : 0)
}

// export pro testy parseru bez připojení
export { parseSubject, parseFields, bodyLines, scrub, buildTip, buildIndex, findDuplicate }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(`Neočekávaná chyba: ${e.message}`)
    process.exit(2)
  })
}
