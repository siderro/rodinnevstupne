#!/usr/bin/env node
// Koncepty odpovědí na tipy (docs/ops/tipy.md, kap. 4.2 a 6). NIC NEODESÍLÁ.
//
//   node scripts/tips/reply-drafts.mjs [--dry-run] [--force]          (npm run tips:replies)
//   node scripts/tips/reply-drafts.mjs --mark-replied T-2026-11-001 [2026-11-26]
//
// 1. Převezme stavy ze scripts/tips/queue.json (tam je nastavuje ověřovatel) do soukromého ledgeru.
// 2. Pro záznamy se změněným stavem napíše koncept do
//    ~/.local/share/rodinnevstupne/tips/replies/<tip_ref>.eml (adresa z ledgeru, X-Unsent: 1,
//    otevře se v Apple Mail / Outlooku jako rozepsaná zpráva). Odešle ho vlastník ručně.
// 3. --mark-replied zapíše datum odeslání; od něj běží 60denní lhůta pro close-tips.mjs.
//
// Co ověřovatel vyplní ve frontě do `result` (vše volitelné):
//   { slug, reason, reason_text, source_url, verified_at, old_value, new_value }
//   reason = jeden z REJECT_REASONS (lib.mjs) nebo věcná věta; reason_text má přednost.
import fs from 'node:fs'
import path from 'node:path'
import {
  FINAL_STATUSES, REJECT_REASONS, REPLIES_DIR, TIERS, argValue, computeTierKey, ensurePrivateDir,
  hasFlag, loadLedger, loadQueue, loadVenues, saveLedger, today,
} from './lib.mjs'

const DRY = hasFlag('--dry-run')
const FORCE = hasFlag('--force')
const SITE = 'https://rodinnevstupne.cz'
const SIGN = 'Tým Rodinné vstupné'

const ledger = loadLedger()

// ---------------------------------------------------------------- --mark-replied
const markRef = argValue('--mark-replied')
if (markRef) {
  const e = ledger.entries.find((x) => x.tip_ref === markRef)
  if (!e) {
    console.error(`${markRef} v ledgeru není.`)
    process.exit(1)
  }
  const i = process.argv.indexOf('--mark-replied')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(process.argv[i + 2] || '') ? process.argv[i + 2] : today()
  e.replied_at = date
  e.replied_status = e.draft_status || e.status
  if (!DRY) saveLedger(ledger)
  console.log(`${markRef}: odpověď odeslána ${date}.`)
  process.exit(0)
}

// ---------------------------------------------------------------- pomocné
const czDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return `${d}. ${m}. ${y}`
}
const kc = (n) => (n == null || n === '' ? null : Number(n) === 0 ? 'vstup zdarma' : `${Number(n).toLocaleString('cs-CZ').replace(/[\u00a0\u202f]/g, ' ')} Kč`)

function familySummary(v) {
  const adults = v.adults_in_family_ticket ? `${v.adults_in_family_ticket} dospělí` : 'dospělí'
  let kids
  if (v.family_policy === 'unlimited') kids = 'neomezeně dětí'
  else if (v.family_policy === 'kids_free_age') kids = `děti do ${v.kids_age_limit} let zdarma`
  else if (v.max_children) kids = `až ${v.max_children} dětí`
  else kids = 'děti'
  const age = v.family_policy !== 'kids_free_age' && v.kids_age_limit ? ` do ${v.kids_age_limit} let` : ''
  return `${adults} + ${kids}${age}`
}
function tierText(v) {
  const k = computeTierKey(v)
  if (!k) return null
  if (k === 'gold' && v.family_policy === 'kids_free_age') return `${TIERS.gold.name} · děti do ${v.kids_age_limit} let zdarma`
  return `${TIERS[k].name} · ${TIERS[k].label}`
}

const REASON_SENTENCES = {
  'méně než 4 děti': 'rodinná vstupenka tam platí pro méně než 4 děti',
  'bez rodinné vstupenky': 'rodinnou vstupenku tam nenabízejí',
  'platí se za každé dítě': 'platí se tam za každé dítě zvlášť a jednu vstupenku pro celou rodinu nemají',
  'místo je trvale zavřené': 'místo je podle dostupných informací trvale zavřené',
  'mimo ČR': 'místo je mimo Českou republiku a katalog zatím pokrývá jen ČR',
}

// ---------------------------------------------------------------- šablony (kap. 6)
function tplPodekovani() {
  return `Dobrý den,

díky za zprávu. Máme ji a do tří dnů ji ověříme na oficiálním ceníku. Ozveme se, jak to dopadlo.

${SIGN}
rodinnevstupne.cz`
}

function tplPridano(q, v) {
  const price = kc(v.price_family)
  const tier = tierText(v)
  const lines = [
    'Dobrý den,',
    '',
    `díky za tip. Ověřili jsme ho na oficiálním ceníku a ${v.name} je od dnešního dne v katalogu:`,
    `${SITE}/misto/${v.slug}/`,
    '',
    `Rodinná vstupenka: ${familySummary(v)}${price ? `, ${price}` : ''}.${tier ? ` ${tier}.` : ''}`,
  ]
  const credit = v.tip_credit || q.tip_credit
  if (credit) lines.push(`U místa vám děkujeme jako „${credit}“. Kdybyste to chtěli změnit nebo odstranit, stačí odepsat.`)
  lines.push('', 'Znáte další místo? Pošlete ho stejnou cestou: rodinnevstupne.cz/tip', '', SIGN)
  return lines.join('\n')
}

function tplOpraveno(q, v) {
  const r = q.result || {}
  const name = v?.name || q.misto
  const what = r.old_value && r.new_value
    ? `Ověřili jsme to a údaj u místa ${name} jsme opravili: ${r.old_value} → ${r.new_value}.`
    : `Ověřili jsme to a údaj u místa ${name} jsme podle oficiálního ceníku opravili.`
  const link = v ? `\n${SITE}/misto/${v.slug}/\n` : ''
  return `Dobrý den,

díky, že jste se ozvali. ${what}
${link}
${SIGN}`
}

function tplBezeZmeny(q, v) {
  const r = q.result || {}
  const src = r.source_url || v?.source_url
  const when = czDate(r.verified_at || v?.verified_at)
  const ref = [src, when && `ověřeno ${when}`].filter(Boolean).join(', ')
  return `Dobrý den,

díky, že jste se ozvali. Na oficiálním ceníku${ref ? ` (${ref})` : ''} zatím platí údaj, který uvádíme. Pokud máte novější informaci, třeba fotku ceníku od pokladny, pošlete ji prosím, podíváme se znovu.

${SIGN}`
}

function tplZamitnuto(q, venues) {
  const r = q.result || {}
  const name = q.misto || 'místo'
  if (r.reason === 'už je v katalogu' || (q.type === 'duplicita' && !r.reason)) {
    const v = venues.get(r.slug || q.slug)
    return `Dobrý den,

díky za tip na ${name}. Místo už v katalogu máme${v ? `:\n${SITE}/misto/${v.slug}/\n\nPokud tam vidíte něco jinak, než je na pokladně, napište nám prosím, co se změnilo.` : '.'}

${SIGN}`
  }
  if (r.reason === 'nelze ověřit na oficiálním ceníku') {
    return `Dobrý den,

díky za tip na ${name}. Oficiální ceník jsme nenašli, a bez něj místo do katalogu nedáváme. Pokud ho máte (odkaz nebo fotku od pokladny), pošlete ho a zkusíme to znovu.

${SIGN}`
  }
  const why = r.reason_text || REASON_SENTENCES[r.reason] || r.reason
  if (!why) return null
  return `Dobrý den,

díky za tip na ${name}. Prošli jsme oficiální ceník${r.source_url ? ` (${r.source_url})` : ''} a do katalogu ho zatím přidat nemůžeme: ${String(why).replace(/\.$/, '')}.

Do katalogu zařazujeme místa, kde jedna rodinná vstupenka pokryje aspoň 4 děti. Místo si poznamenáme a při dalším ověřování ceníků se k němu vrátíme. Kdyby se ceník změnil, dejte nám vědět.

${SIGN}`
}

function tplPlacene() {
  return `Dobrý den,

díky za zájem. Zařazení ani pořadí v katalogu nejde koupit, kritérium je pro všechna místa stejné: rodinná vstupenka pro aspoň 4 děti, ověřená na oficiálním ceníku. Pokud ho vaše místo splňuje, pošlete nám odkaz na ceník a rádi ho ověříme.

${SIGN}`
}

// ---------------------------------------------------------------- .eml
const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`)
function toEml(entry, body) {
  const subject = /^re:/i.test(entry.subject || '') ? entry.subject : `Re: ${entry.subject || 'Váš tip'}`
  const to = entry.from_name ? `${encWord(entry.from_name.replace(/["\\]/g, ''))} <${entry.from_address}>` : entry.from_address
  const mid = entry.message_id?.startsWith('<') ? entry.message_id : null
  const headers = [
    `From: ${encWord('Rodinné vstupné')} <tipy@rodinnevstupne.cz>`,
    `To: ${to}`,
    `Subject: ${encWord(subject)}`,
    ...(mid ? [`In-Reply-To: ${mid}`, `References: ${mid}`] : []),
    'X-Unsent: 1',
    `X-Tip-Ref: ${entry.tip_ref}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ]
  return `${headers.join('\r\n')}\r\n\r\n${body.replace(/\r?\n/g, '\r\n')}\r\n`
}

// ---------------------------------------------------------------- běh
const queue = loadQueue()
const qByRef = new Map(queue.map((q) => [q.tip_ref, q]))
const venues = new Map(loadVenues().map((v) => [v.slug, v]))
const now = new Date().toISOString()
const out = { drafts: 0, skipped: [], synced: 0 }
let dirty = false

for (const e of ledger.entries) {
  if (e.deleted_at) continue
  const q = qByRef.get(e.tip_ref)
  if (q && q.status && q.status !== e.status) {
    e.status = q.status
    e.status_changed_at = now
    out.synced++
  }
  if (FINAL_STATUSES.includes(e.status) && !e.resolved_at) { e.resolved_at = today(); dirty = true }
  if (!q) continue

  // co poslat
  let kind = null
  if (FINAL_STATUSES.includes(e.status)) kind = e.status
  else if (q.suggested_reply === 'placene-zarazeni' && e.status !== 'spam?') kind = 'placene-zarazeni'
  else if (q.suggested_reply === 'podekovani' && ['nový', 'ověřuje se'].includes(e.status)) kind = 'podekovani'
  if (!kind) continue
  if (e.draft_status === kind && !FORCE) continue
  if (e.replied_at && e.replied_status === kind) continue
  if (!e.from_address) { out.skipped.push(`${e.tip_ref}: bez adresy`); continue }
  if (q.result?.reason === 'spam') { out.skipped.push(`${e.tip_ref}: spam, bez odpovědi`); continue }

  const v = venues.get(q.result?.slug || q.slug)
  let body = null
  if (kind === 'podekovani') body = tplPodekovani()
  else if (kind === 'placene-zarazeni') body = tplPlacene()
  else if (kind === 'přidáno') {
    if (!v) { out.skipped.push(`${e.tip_ref}: přidáno, ale slug „${q.result?.slug || q.slug || '?'}“ není ve venues.json (sloučit PR a spustit npm run data)`); continue }
    body = tplPridano(q, v)
  } else if (kind === 'opraveno') body = tplOpraveno(q, v)
  else if (kind === 'beze změny') body = tplBezeZmeny(q, v)
  else if (kind === 'zamítnuto') body = tplZamitnuto(q, venues)
  if (!body) {
    out.skipped.push(`${e.tip_ref}: zamítnuto bez důvodu v result.reason (povolené: ${REJECT_REASONS.join(', ')})`)
    continue
  }

  const file = path.join(REPLIES_DIR, `${e.tip_ref}.eml`)
  if (DRY) {
    console.log(`--- ${e.tip_ref} (${kind}) → ${file}\n${body}\n`)
  } else {
    ensurePrivateDir()
    fs.mkdirSync(REPLIES_DIR, { recursive: true, mode: 0o700 })
    fs.writeFileSync(file, toEml(e, body), { mode: 0o600 })
    e.draft_written_at = now
    e.draft_status = kind
    e.draft_file = file
    // nová odpověď = lhůta 60 dnů se počítá až od jejího odeslání
    if (e.replied_at && e.replied_status !== kind) { e.replied_at = null; e.replied_status = null }
  }
  out.drafts++
}

if (!DRY && (out.drafts || out.synced || dirty)) saveLedger(ledger)

console.log(`Převzaté stavy z fronty: ${out.synced}. Nové koncepty: ${out.drafts}${out.drafts && !DRY ? ` (${REPLIES_DIR})` : ''}.`)
for (const s of out.skipped) console.log(`  přeskočeno – ${s}`)
if (out.drafts && !DRY) console.log('Nic se neodeslalo. Po odeslání: npm run tips:replies -- --mark-replied <tip_ref>')
