// Společné funkce pro skripty tipů (docs/ops/tipy.md, kap. 4).
// Soukromá data (adresy, jména, přílohy, koncepty odpovědí) leží jen v
// ~/.local/share/rodinnevstupne/tips/ – mimo repozitář i mimo Dropbox.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '..', '..')
export const QUEUE_PATH = path.join(HERE, 'queue.json')
export const CANDIDATES_DIR = path.join(ROOT, 'scripts', 'candidates')
export const REJECTED_PATH = path.join(CANDIDATES_DIR, 'rejected.json')
export const VENUES_PATH = path.join(ROOT, 'src', 'data', 'venues.json')

export const MAIL_ENV_PATH = path.join(os.homedir(), '.config', 'rodinnevstupne', 'mail.env')
export const PRIVATE_DIR = path.join(os.homedir(), '.local', 'share', 'rodinnevstupne', 'tips')
export const LEDGER_PATH = path.join(PRIVATE_DIR, 'ledger.json')
export const ATT_DIR = path.join(PRIVATE_DIR, 'att')
export const REPLIES_DIR = path.join(PRIVATE_DIR, 'replies')

export const QUEUE_FLAG = '$Fronta'
export const FINAL_STATUSES = ['přidáno', 'opraveno', 'beze změny', 'zamítnuto']
export const REJECT_REASONS = [
  'méně než 4 děti',
  'bez rodinné vstupenky',
  'platí se za každé dítě',
  'nelze ověřit na oficiálním ceníku',
  'už je v katalogu',
  'místo je trvale zavřené',
  'mimo ČR',
  'spam',
]

// Stejné jako src/lib/constants.js (ten importovat nejde kvůli import.meta.env).
export const TIERS = {
  gold: { name: 'Všichni dovnitř', label: 'neomezeně dětí' },
  silver: { name: 'Plná posádka', label: '5+ dětí' },
  base: { name: 'Čtyřlístek', label: '4 děti' },
}

// Stejná funkce jako v scripts/build-data.mjs (ten při importu spouští build).
export const slugify = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const today = () => new Date().toISOString().slice(0, 10)
export const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000)

export function hasFlag(name) {
  return process.argv.includes(name)
}
export function argValue(name) {
  const i = process.argv.indexOf(name)
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  const eq = process.argv.find((a) => a.startsWith(name + '='))
  return eq ? eq.slice(name.length + 1) : null
}

/** Načte mail.env bez dotenv. Hodnoty nikdy nevypisovat. */
export function loadMailEnv() {
  if (!fs.existsSync(MAIL_ENV_PATH)) {
    console.error('Chybí ~/.config/rodinnevstupne/mail.env')
    process.exit(2)
  }
  try {
    const mode = fs.statSync(MAIL_ENV_PATH).mode & 0o777
    if (mode & 0o077) console.warn('Upozornění: mail.env má volnější práva než 600 (chmod 600 ~/.config/rodinnevstupne/mail.env).')
  } catch {}
  const env = {}
  for (const raw of fs.readFileSync(MAIL_ENV_PATH, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    else val = val.replace(/\s+#.*$/, '')
    env[key] = val
  }
  const cfg = {
    host: env.IMAP_HOST,
    port: Number(env.IMAP_PORT || 993),
    user: env.IMAP_USER,
    pass: env.IMAP_PASSWORD || env.IMAP_PASS,
    folderNew: env.IMAP_FOLDER_NEW || 'INBOX',
    folderDone: env.IMAP_FOLDER_DONE || 'Zpracovano',
    folderTrash: env.IMAP_FOLDER_TRASH || null,
  }
  const missing = ['host', 'user', 'pass'].filter((k) => !cfg[k])
  if (missing.length) {
    console.error(`V mail.env chybí: ${missing.map((k) => ({ host: 'IMAP_HOST', user: 'IMAP_USER', pass: 'IMAP_PASSWORD' })[k]).join(', ')}`)
    process.exit(2)
  }
  return cfg
}

export async function connectImap(cfg) {
  const { ImapFlow } = await import('imapflow')
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 993,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false, // žádný protokolový výpis (nesmí uniknout přihlašovací údaje)
    emitLogs: false,
  })
  client.on('error', () => {})
  await client.connect()
  return client
}

export function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return fallback
    throw new Error(`Nelze načíst ${p}: ${e.message}`)
  }
}

/** Zápis přes dočasný soubor a přejmenování. */
export function writeJson(p, data, mode) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = `${p}.tmp-${process.pid}`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', mode ? { mode } : undefined)
  fs.renameSync(tmp, p)
  if (mode) fs.chmodSync(p, mode)
}

export function ensurePrivateDir() {
  for (const d of [path.dirname(PRIVATE_DIR), PRIVATE_DIR]) {
    fs.mkdirSync(d, { recursive: true, mode: 0o700 })
    fs.chmodSync(d, 0o700)
  }
}

export function loadLedger() {
  const l = readJson(LEDGER_PATH, { version: 1, entries: [] })
  if (!Array.isArray(l.entries)) l.entries = []
  return l
}
export function saveLedger(ledger) {
  ensurePrivateDir()
  writeJson(LEDGER_PATH, ledger, 0o600)
}

export function loadQueue() {
  const q = readJson(QUEUE_PATH, [])
  return Array.isArray(q) ? q : []
}
export function saveQueue(queue) {
  writeJson(QUEUE_PATH, queue)
}

export function loadVenues() {
  const v = readJson(VENUES_PATH, [])
  return Array.isArray(v) ? v : v.venues || []
}

export function computeTierKey(v) {
  const toInt = (x) => (x === '' || x == null || Number.isNaN(Number(x)) ? null : Math.trunc(Number(x)))
  if (v.tier && TIERS[v.tier]) return v.tier
  if (v.family_policy === 'unlimited') return 'gold'
  if (v.family_policy === 'kids_free_age' && (toInt(v.kids_age_limit) ?? 0) >= 15) return 'gold'
  const max = toInt(v.max_children)
  if (max != null && max >= 5) return 'silver'
  if (max === 4) return 'base'
  return null
}
