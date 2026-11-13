import { useState } from 'react'

// Sdílení: Web Share API (mobil), jinak zkopíruje odkaz. Co je k dispozici, zjišťujeme až při kliknutí,
// aby se prerenderované HTML shodovalo s hydratací.
export default function ShareButton({ url, title, text, className = 'btn btn--ghost' }) {
  const [status, setStatus] = useState('')

  async function onClick() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        window.goatcounter?.count?.({ path: 'share-native', event: true })
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
    if (ok) window.goatcounter?.count?.({ path: 'share-copy', event: true })
    setStatus(ok ? 'Odkaz zkopírován.' : `Zkopírujte si odkaz: ${url}`)
  }

  return (
    <>
      <button type="button" className={className} onClick={onClick}>Sdílet</button>
      <span className="share-status" role="status" aria-live="polite">{status}</span>
    </>
  )
}
