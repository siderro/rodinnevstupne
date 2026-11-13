import { useEffect } from 'react'
import { SITE_URL } from './constants'

// Při přechodu mezi stránkami v prohlížeči aktualizuje titulek, popis a canonical
// (prerenderované HTML je má od začátku, tohle drží stav při navigaci bez načtení stránky).
export function useHead({ title, description, path, noindex } = {}) {
  useEffect(() => {
    if (title) document.title = title
    const set = (sel, attr, val, create) => {
      let el = document.head.querySelector(sel)
      if (!el && val != null && create) { el = create(); document.head.appendChild(el) }
      if (!el) return
      if (val == null) el.remove()
      else el.setAttribute(attr, val)
    }
    set('meta[name="description"]', 'content', description, () => Object.assign(document.createElement('meta'), { name: 'description' }))
    set('link[rel="canonical"]', 'href', path ? SITE_URL + path : null, () => Object.assign(document.createElement('link'), { rel: 'canonical' }))
    set('meta[name="robots"]', 'content', noindex ? 'noindex, follow' : null, () => Object.assign(document.createElement('meta'), { name: 'robots' }))
  }, [title, description, path, noindex])
}
