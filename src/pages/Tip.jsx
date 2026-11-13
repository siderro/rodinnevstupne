import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getVenues, getVenueBySlug } from '../lib/venues'
import { BUY_ME_A_COFFEE_URL, REPORT_EMAIL, reportMailto } from '../lib/constants'
import { track } from '../lib/track'
import { tipMeta } from '../lib/seo'
import { useHead } from '../lib/useHead'

// Stránka /tip/: připraví e-mail s tipem nebo opravou na tipy@rodinnevstupne.cz.
// Nic neodesílá ani neukládá. Formát předmětu a těla čte skript scripts/tips/ (viz docs/ops/tipy.md),
// proto klíče, značky [TIP] / [OPRAVA] a podpis neměnit.

const MAX_URL = 1800
const SIGNATURE = '--\nOdesláno přes rodinnevstupne.cz/tip'
const DRUHY = ['Cena', 'Počet dětí nebo věk', 'Místo je zavřené', 'Jiné']

// Zalomení řádků uvnitř pole → mezera (parser čte „Klíč: hodnota“ po řádcích)
const clean = (s) => String(s ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim()

const EMPTY_NEW = { misto: '', mesto: '', cenik: '', vstupne: '', navstiveno: '', poznamka: '', podekovani: 'ne', uvest: '' }
const EMPTY_FIX = { slug: '', misto: '', druh: '', coJeJinak: '', cenik: '', poznamka: '', podekovani: 'ne', uvest: '' }

function compose(kind, f) {
  const credit = f.podekovani === 'ano'
  if (kind === 'oprava') {
    const lines = [
      'Typ: oprava',
      `Slug: ${clean(f.slug)}`,
      `Místo: ${clean(f.misto)}`,
      `Druh změny: ${clean(f.druh)}`,
      `Co je jinak: ${clean(f.coJeJinak)}`,
      `Ceník: ${clean(f.cenik)}`,
      `Poznámka: ${clean(f.poznamka)}`,
      `Poděkování: ${credit ? 'ano' : 'ne'}`,
      `Uvést jako: ${credit ? clean(f.uvest) : ''}`,
    ]
    return {
      subject: `[OPRAVA] ${clean(f.slug) || clean(f.misto)}`,
      body: `${lines.join('\n')}\n\n${SIGNATURE}`,
    }
  }
  const lines = [
    'Typ: tip',
    `Místo: ${clean(f.misto)}`,
    `Město: ${clean(f.mesto)}`,
    `Ceník: ${clean(f.cenik)}`,
    `Rodinné vstupné: ${clean(f.vstupne)}`,
    `Navštíveno: ${clean(f.navstiveno)}`,
    `Poznámka: ${clean(f.poznamka)}`,
    `Poděkování: ${credit ? 'ano' : 'ne'}`,
    `Uvést jako: ${credit ? clean(f.uvest) : ''}`,
  ]
  return {
    subject: `[TIP] ${clean(f.misto)} – ${clean(f.mesto)}`,
    body: `${lines.join('\n')}\n\n(Fotku ceníku můžete přiložit k této zprávě.)\n${SIGNATURE}`,
  }
}

// Zakódovaná adresa mailto: musí zůstat pod 1 800 znaků (české znaky zabírají až 6 znaků).
// Když se nevejde, zkracujeme nejdřív Poznámku, pak Rodinné vstupné / Co je jinak.
function fitMailto(kind, f) {
  const urlOf = (x) => { const { subject, body } = compose(kind, x); return reportMailto(subject, body) }
  let cur = { ...f }
  let truncated = false
  for (const key of ['poznamka', kind === 'oprava' ? 'coJeJinak' : 'vstupne']) {
    if (urlOf(cur).length <= MAX_URL) break
    const full = clean(cur[key])
    let lo = 0, hi = full.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (urlOf({ ...cur, [key]: full.slice(0, mid) + '…' }).length <= MAX_URL) lo = mid
      else hi = mid - 1
    }
    cur = { ...cur, [key]: lo > 0 ? full.slice(0, lo) + '…' : '' }
    truncated = true
  }
  return { href: urlOf(cur), truncated }
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
  } catch { /* zkusíme záložní cestu */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch { return false }
}

function Field({ id, label, required, error, hint, children }) {
  return (
    <div className={`form-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {children}
      {hint && <p className="form-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="form-error" id={`${id}-err`} role="alert">{error}</p>}
    </div>
  )
}

const describedBy = (id, hint, error) => [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined

export default function Tip() {
  const [params] = useSearchParams()
  // Nový stav při změně ?oprava=… (např. odkaz z patičky, když už je stránka otevřená)
  return <TipForm key={params.get('oprava') ?? '#novy'} oprava={params.get('oprava')} />
}

function TipForm({ oprava }) {
  useHead(tipMeta())
  const { data: venues } = getVenues()
  const prefill = oprava ? getVenueBySlug(oprava) : null

  const [tab, setTab] = useState(oprava != null ? 'oprava' : 'novy')
  const [fNew, setFNew] = useState(EMPTY_NEW)
  const [fFix, setFFix] = useState(() => (prefill ? { ...EMPTY_FIX, slug: prefill.slug, misto: prefill.name } : EMPTY_FIX))
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState('')
  const formRef = useRef(null)

  const isFix = tab === 'oprava'
  const f = isFix ? fFix : fNew
  const set = (key) => (e) => {
    const value = e.target.value
    setErrors((er) => ({ ...er, [key]: undefined }))
    if (!isFix) return setFNew((x) => ({ ...x, [key]: value }))
    setFFix((x) => {
      if (key !== 'misto') return { ...x, [key]: value }
      // Výběr z nabídky doplní slug; přepsaný název slug zruší
      const hit = venues.find((v) => v.name === value.trim())
      return { ...x, misto: value, slug: hit ? hit.slug : '' }
    })
  }

  const { href, truncated } = useMemo(() => fitMailto(tab, f), [tab, f])

  function validate() {
    const er = {}
    if (!clean(f.misto)) er.misto = 'Vyplňte prosím název místa.'
    if (!isFix && !clean(f.mesto)) er.mesto = 'Vyplňte prosím obec.'
    if (isFix && !f.druh) er.druh = 'Vyberte prosím, co se změnilo.'
    if (isFix && !clean(f.coJeJinak)) er.coJeJinak = 'Napište prosím, co je jinak.'
    return er
  }

  function onSend(e) {
    const er = validate()
    if (Object.keys(er).length) {
      e.preventDefault()
      setErrors(er)
      const first = Object.keys(er)[0]
      formRef.current?.querySelector(`[name="${first}"]`)?.focus()
      return
    }
    track(isFix ? 'oprava-mailto' : 'tip-mailto')
    setSent(true)
  }

  async function onCopyText() {
    const { subject, body } = compose(tab, f)
    const ok = await copyText(`Komu: ${REPORT_EMAIL}\nPředmět: ${subject}\n\n${body}`)
    if (ok) { track('tip-copy'); setCopied('text') } else setCopied('fail')
  }
  async function onCopyAddress() {
    setCopied((await copyText(REPORT_EMAIL)) ? 'adresa' : 'fail')
  }

  const switchTab = (t) => { setTab(t); setErrors({}); setSent(false); setCopied('') }
  const id = (k) => `tip-${tab}-${k}`
  const thanks = (
    <>
      <fieldset className="form-field form-radios">
        <legend>Můžeme vám na webu poděkovat?</legend>
        <label><input type="radio" name="podekovani" value="ne" checked={f.podekovani !== 'ano'} onChange={set('podekovani')} /> Ne, děkuji</label>
        <label><input type="radio" name="podekovani" value="ano" checked={f.podekovani === 'ano'} onChange={set('podekovani')} /> Ano</label>
      </fieldset>
      {f.podekovani === 'ano' && (
        <Field id={id('uvest')} label="Jak vás máme uvést"
          hint="Napište jméno nebo přezdívku, jak ji chcete vidět, třeba ‚Jana z Brna‘. Bez příjmení. Uvedeme ji u místa, které díky vám přibude nebo se opraví.">
          <input id={id('uvest')} name="uvest" type="text" maxLength={40} value={f.uvest} onChange={set('uvest')}
            aria-describedby={`${id('uvest')}-hint`} />
        </Field>
      )}
    </>
  )

  const noscriptHtml = `<p class="form-hint">Bez JavaScriptu formulář nefunguje. <a href="${reportMailto(
    '[TIP] ', compose('tip', EMPTY_NEW).body,
  ).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Otevřít prázdnou šablonu e-mailu</a> na ${REPORT_EMAIL}.</p>`

  return (
    <article className="tip-page">
      <section className="hero">
        <h1>Znáte místo, kam se vejdete všichni?</h1>
        <p className="lead">
          Napište nám, kde rodinná vstupenka platí pro 4 a více dětí. Ověříme to a přidáme.
          Stačí odkaz na ceník nebo fotka od pokladny.
        </p>
      </section>

      <div className="segmented tip-tabs" role="tablist" aria-label="Co chcete poslat">
        <button type="button" role="tab" id="tab-novy" aria-controls="tip-panel" aria-selected={!isFix}
          className={!isFix ? 'is-on' : ''} onClick={() => switchTab('novy')}>Nové místo</button>
        <button type="button" role="tab" id="tab-oprava" aria-controls="tip-panel" aria-selected={isFix}
          className={isFix ? 'is-on' : ''} onClick={() => switchTab('oprava')}>Oprava u místa</button>
      </div>

      <form id="tip-panel" role="tabpanel" aria-labelledby={isFix ? 'tab-oprava' : 'tab-novy'} className="tip-form"
        ref={formRef} noValidate onSubmit={(e) => e.preventDefault()}>
        {isFix ? (
          <>
            <p className="form-intro">
              Změnila se cena, pravidlo nebo je místo zavřené? Napište, co je jinak.
              Ověříme to na oficiálním ceníku a opravíme.
            </p>
            <Field id={id('misto')} label="Které místo" required error={errors.misto}>
              <input id={id('misto')} name="misto" type="text" maxLength={120} list="tip-venues" value={f.misto}
                onChange={set('misto')} aria-invalid={!!errors.misto} aria-describedby={describedBy(id('misto'), false, errors.misto)} />
              <datalist id="tip-venues">
                {venues.map((v) => <option key={v.slug} value={v.name}>{v.city || ''}</option>)}
              </datalist>
            </Field>
            <input type="hidden" name="slug" value={f.slug} />
            <fieldset className={`form-field form-radios ${errors.druh ? 'has-error' : ''}`}
              aria-describedby={errors.druh ? `${id('druh')}-err` : undefined}>
              <legend>Druh změny<span aria-hidden="true"> *</span></legend>
              {DRUHY.map((d) => (
                <label key={d}><input type="radio" name="druh" value={d} checked={f.druh === d} onChange={set('druh')} /> {d}</label>
              ))}
              {errors.druh && <p className="form-error" id={`${id('druh')}-err`} role="alert">{errors.druh}</p>}
            </fieldset>
            <Field id={id('coJeJinak')} label="Co je jinak" required error={errors.coJeJinak}>
              <textarea id={id('coJeJinak')} name="coJeJinak" rows={3} maxLength={300} value={f.coJeJinak}
                onChange={set('coJeJinak')} aria-invalid={!!errors.coJeJinak}
                aria-describedby={describedBy(id('coJeJinak'), false, errors.coJeJinak)} />
            </Field>
            <Field id={id('cenik')} label="Odkaz na zdroj">
              <input id={id('cenik')} name="cenik" type="url" inputMode="url" maxLength={300} placeholder="https://"
                value={f.cenik} onChange={set('cenik')} />
            </Field>
            <Field id={id('poznamka')} label="Poznámka">
              <textarea id={id('poznamka')} name="poznamka" rows={2} maxLength={250} value={f.poznamka} onChange={set('poznamka')} />
            </Field>
            {thanks}
          </>
        ) : (
          <>
            <Field id={id('misto')} label="Název místa" required error={errors.misto}>
              <input id={id('misto')} name="misto" type="text" maxLength={120} value={f.misto} onChange={set('misto')}
                aria-invalid={!!errors.misto} aria-describedby={describedBy(id('misto'), false, errors.misto)} />
            </Field>
            <Field id={id('mesto')} label="Obec" required error={errors.mesto}>
              <input id={id('mesto')} name="mesto" type="text" maxLength={80} value={f.mesto} onChange={set('mesto')}
                aria-invalid={!!errors.mesto} aria-describedby={describedBy(id('mesto'), false, errors.mesto)} />
            </Field>
            <Field id={id('cenik')} label="Odkaz na ceník" hint="Máte jen fotku ceníku? Přiložte ji v e-mailu, který se otevře.">
              <input id={id('cenik')} name="cenik" type="url" inputMode="url" maxLength={300} placeholder="https://"
                value={f.cenik} onChange={set('cenik')} aria-describedby={`${id('cenik')}-hint`} />
            </Field>
            <Field id={id('vstupne')} label="Jaké je tam rodinné vstupné">
              <textarea id={id('vstupne')} name="vstupne" rows={2} maxLength={250} value={f.vstupne} onChange={set('vstupne')}
                placeholder="2 dospělí + až 5 dětí do 15 let, 690 Kč" />
            </Field>
            <Field id={id('navstiveno')} label="Kdy jste tam byli">
              <input id={id('navstiveno')} name="navstiveno" type="text" maxLength={20} value={f.navstiveno}
                onChange={set('navstiveno')} placeholder="třeba říjen 2026" />
            </Field>
            <Field id={id('poznamka')} label="Poznámka">
              <textarea id={id('poznamka')} name="poznamka" rows={2} maxLength={250} value={f.poznamka} onChange={set('poznamka')} />
            </Field>
            {thanks}
          </>
        )}

        <div className="tip-send">
          <a className="btn" href={href} onClick={onSend}>
            {isFix ? 'Otevřít e-mail s opravou' : 'Otevřít e-mail s tipem'}
          </a>
          {truncated && (
            <p className="form-hint" role="status">Text je dlouhý, zbytek prosím dopište přímo do e-mailu.</p>
          )}
          <p className="form-hint">
            Otevře se váš poštovní program s předvyplněnou zprávou na <strong>{REPORT_EMAIL}</strong>.
            Zprávu odešlete vy, my na tomhle webu nic neukládáme.
          </p>
          <div className="tip-fallback">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onCopyText}>Zkopírovat text</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onCopyAddress}>Zkopírovat adresu</button>
          </div>
          <p className="form-hint" role="status" aria-live="polite">
            {copied === 'text' && <>Zkopírováno. Vložte ho do e-mailu na {REPORT_EMAIL}.</>}
            {copied === 'adresa' && <>Adresa {REPORT_EMAIL} je ve schránce.</>}
            {copied === 'fail' && <>Kopírování se nepovedlo. Napište nám prosím přímo na {REPORT_EMAIL}.</>}
          </p>
          <noscript dangerouslySetInnerHTML={{ __html: noscriptHtml }} />
        </div>

        {sent && (
          <div className="notice tip-thanks" role="status">
            <p><strong>Děkujeme. Tip ověříme a do týdne ho přidáme, nebo vám dáme vědět, proč to nejde.</strong></p>
            <p className="meta">
              Našli jste, co jste hledali? Projekt je zdarma díky komunitě.{' '}
              <a href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">Podpořit kafem</a>
            </p>
          </div>
        )}
      </form>

      <section className="tip-privacy" aria-labelledby="tip-privacy-h">
        <h2 id="tip-privacy-h" className="h-sm">Co se děje s vaším tipem</h2>
        <p>
          Tahle stránka nic neodesílá ani neukládá. Jen připraví e-mail, který odešlete vy ze své schránky.
          Dostaneme tedy vaši e-mailovou adresu a to, co do zprávy napíšete.
        </p>
        <p>
          Údaje použijeme jen k ověření tipu a k odpovědi. Do katalogu se dostane jen samotné místo a ceník.
          Vaše jméno nebo přezdívku zveřejníme, jen když o to výslovně požádáte, a jen v podobě, kterou sami
          napíšete. Kdykoli nám napíšete, smažeme ji.
        </p>
        <p>
          E-mail po vyřízení smažeme, nejpozději do 60 dnů od odpovědi. Nikomu ho nepředáváme a nepošleme vám
          nic dalšího, žádný newsletter ani reklamu.
        </p>
        <p>
          Správcem údajů je provozovatel webu rodinnevstupne.cz, Švejda Goldmann, s.r.o.,
          IČO 04888189, Pernerova 293/11, 186 00 Praha 8.
          Dotazy k údajům a žádosti o výmaz pište na <a href={`mailto:${REPORT_EMAIL}`}>{REPORT_EMAIL}</a>.
        </p>
      </section>

      <p><Link to="/novinky/">Co jsme naposledy přidali →</Link></p>
    </article>
  )
}
