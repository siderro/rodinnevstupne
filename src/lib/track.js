// Měření událostí v GoatCounteru. Žádná osobní data: posíláme jen název události
// a nanejvýš stránku nebo slug místa (nikdy text z vyhledávání, formuláře ani e-mail).
// Všechno je v try/catch a bez přístupu k window na úrovni modulu (prerender běží v Node).
// Seznam událostí a jejich význam: docs/kpi.md.

export function track(path, title) {
  try {
    if (typeof window === 'undefined') return
    window.goatcounter?.count?.({ path, title: title || path, event: true })
  } catch { /* bez měření */ }
}

// Jednou za relaci (sessionStorage), záložně jednou za načtení stránky.
const sent = new Set()
export function trackOnce(key, path = key, title) {
  if (sent.has(key)) return
  sent.add(key)
  try {
    const k = `rv-ev-${key}`
    if (window.sessionStorage.getItem(k)) return
    window.sessionStorage.setItem(k, '1')
  } catch { /* soukromé okno: stačí Set výše */ }
  track(path, title)
}

// Pro průběžné změny (psaní do vyhledávání): odešle až po chvíli klidu, pak jednou za relaci.
const timers = new Map()
export function trackDebounced(key, path = key, title, ms = 1500) {
  if (sent.has(key) || typeof window === 'undefined') return
  clearTimeout(timers.get(key))
  timers.set(key, setTimeout(() => { timers.delete(key); trackOnce(key, path, title) }, ms))
}
