import { useState } from 'react'
import { track } from '../lib/track'

// Sdílení: Web Share API (mobil), jinak zkopíruje odkaz. Co je k dispozici, zjišťujeme až při kliknutí,
// aby se prerenderované HTML shodovalo s hydratací.
export default function ShareButton({ url, title, text, className = 'btn btn--ghost' }) {
  const [status, setStatus] = useState('')

  async function onClick() {
    track('sdilet', typeof location !== 'undefined' ? location.pathname : undefined) // záměr; výsledek: share-native / share-copy
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        track('share-native')
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    let ok = false
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); ok = true }
    } catch { /* záložní cesta níže */ }
    if (!ok) {
      try {
        const ta = Object.assign(document.createElement('textarea'), { value: url })
        ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select()
        ok = document.execCommand('copy'); ta.remove()
      } catch { ok = false }
    }
    if (ok) track('share-copy')
    setStatus(ok ? 'Odkaz zkopírován.' : `Zkopírujte si odkaz: ${url}`)
  }

  return (
    <>
      <button type="button" className={className} onClick={onClick}>Sdílet</button>
      <span className="share-status" role="status" aria-live="polite">{status}</span>
    </>
  )
}
