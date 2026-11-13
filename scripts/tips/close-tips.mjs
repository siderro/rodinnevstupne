#!/usr/bin/env node
// Retence tipů (docs/ops/tipy.md, kap. 4.2 a 8). Výchozí je DRY-RUN: jen vypíše, co by smazal.
//
//   node scripts/tips/close-tips.mjs            (npm run tips:close)       – náhled
//   node scripts/tips/close-tips.mjs --apply    (npm run tips:close -- --apply) – provede
//
// Smaže e-mail ve schránce a v ledgeru adresu, jméno a text (zůstane tip_ref, stav a data):
//   - vyřízené tipy (přidáno / opraveno / beze změny / zamítnuto, ignorováno)
//     a odpověď odeslána před více než 60 dny (replied_at),
//   - nebo bez odpovědi (žádná adresa, spam, automatická zpráva, neodpovězeno)
//     a vyřízeno před více než 30 dny (resolved_at).
// Přílohy a koncept odpovědi smaže hned po vyřízení.
import fs from 'node:fs'
import path from 'node:path'
import {
  ATT_DIR, FINAL_STATUSES, REPLIES_DIR, connectImap, daysBetween, hasFlag, loadLedger,
  loadMailEnv, loadQueue, saveLedger, saveQueue, today,
} from './lib.mjs'

const APPLY = hasFlag('--apply')
const REPLY_DAYS = 60
const NO_REPLY_DAYS = 30
const CLOSED = [...FINAL_STATUSES, 'ignorováno']

const ledger = loadLedger()
const queue = loadQueue()
const now = today()

const attCleanup = []
const toDelete = []
for (const e of ledger.entries) {
  if (e.deleted_at || !CLOSED.includes(e.status)) continue
  const resolved = e.resolved_at || e.status_changed_at?.slice(0, 10) || e.fetched_at?.slice(0, 10)
  const attDir = e.attachments_dir || path.join(ATT_DIR, e.tip_ref)
  if (fs.existsSync(attDir)) attCleanup.push({ e, dir: attDir })
  if (e.replied_at) {
    if (daysBetween(e.replied_at, now) > REPLY_DAYS) toDelete.push({ e, why: `odpověď ${e.replied_at}` })
  } else if (resolved && daysBetween(resolved, now) > NO_REPLY_DAYS) {
    toDelete.push({ e, why: `bez odpovědi, vyřízeno ${resolved}` })
  }
}

console.log(`${APPLY ? '' : '[náhled, nic se nemaže – spusťte s --apply] '}Přílohy ke smazání: ${attCleanup.length}, zprávy ke smazání: ${toDelete.length}.`)
for (const { e, dir } of attCleanup) console.log(`  přílohy ${e.tip_ref} (${e.status}): ${dir}`)
for (const { e, why } of toDelete) console.log(`  zpráva ${e.tip_ref} (${e.status}, ${why})`)

if (!APPLY) process.exit(0)

for (const { e, dir } of attCleanup) {
  fs.rmSync(dir, { recursive: true, force: true })
  e.attachments_dir = null
  e.attachments_deleted_at = now
}

let failed = 0
const keep = new Set() // při chybě IMAP necháme záznam v ledgeru pro další běh
if (toDelete.length) {
  const cfg = loadMailEnv()
  let client
  try {
    client = await connectImap(cfg)
  } catch (e) {
    console.error(`Nelze se připojit k IMAP (${cfg.host}:${cfg.port}): ${e.authenticationFailed ? 'přihlášení odmítnuto' : (e.code || e.message)}`)
    saveLedger(ledger)
    process.exit(2)
  }
  const folders = [...new Set([cfg.folderNew, cfg.folderDone])]
  const remaining = new Map(toDelete.map((x) => [x.e.tip_ref, x.e]))
  for (const folder of folders) {
    if (!remaining.size) break
    let lock
    try {
      lock = await client.getMailboxLock(folder)
    } catch {
      continue // složka neexistuje
    }
    try {
      for (const [ref, e] of [...remaining]) {
        let uids = []
        if (e.message_id && !e.message_id.startsWith('uid:')) {
          uids = (await client.search({ header: { 'message-id': e.message_id } }, { uid: true })) || []
        } else if (e.imap?.folder === folder && String(client.mailbox.uidValidity) === e.imap.uid_validity) {
          uids = [e.imap.uid]
        }
        if (!uids.length) continue
        await client.messageDelete(uids, { uid: true }) // \Deleted + EXPUNGE
        remaining.delete(ref)
        e.mail_deleted_in = folder
      }
    } catch (err) {
      console.error(`Chyba ve složce ${folder}: ${err.responseText || err.code || err.message}`)
      failed++
    } finally {
      lock.release()
    }
  }
  await client.logout().catch(() => {})
  for (const ref of remaining.keys()) {
    if (failed) { keep.add(ref); console.warn(`  ${ref}: kvůli chybě IMAP zůstává v ledgeru, zkuste znovu.`) }
    else console.warn(`  ${ref}: zprávu jsem ve schránce nenašel (už smazaná?), čistím jen ledger.`)
  }
}

for (const { e } of toDelete) {
  if (keep.has(e.tip_ref)) continue
  if (e.draft_file) fs.rmSync(e.draft_file, { force: true })
  fs.rmSync(path.join(REPLIES_DIR, `${e.tip_ref}.eml`), { force: true })
  for (const k of ['message_id', 'imap', 'from_address', 'from_name', 'subject', 'uvest_jako', 'raw_text', 'draft_file', 'note']) e[k] = null
  e.deleted_at = now
  const q = queue.find((x) => x.tip_ref === e.tip_ref)
  if (q?.raw_text) q.raw_text = null
}

saveLedger(ledger)
if (toDelete.length) saveQueue(queue)
console.log(`Hotovo: smazáno ${toDelete.length - keep.size} záznamů, ${attCleanup.length} složek s přílohami.`)
process.exit(failed ? 1 : 0)
