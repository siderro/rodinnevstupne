import { Link } from 'react-router-dom'
import { useHead } from '../lib/useHead'
import { KRAJE, krajFull } from '../lib/constants'
import { krajPath } from '../lib/seo'

export default function NotFound() {
  useHead({ title: 'Stránka nenalezena – Rodinné vstupné', noindex: true })
  return (
    <div className="empty-state">
      <h1>Tahle stránka tu není</h1>
      <p>Možná se změnila adresa.</p>
      <Link className="btn" to="/">Všechny výlety</Link>
      <nav className="kraj-links" aria-label="Výlety podle krajů">
        <h2 className="h-sm">Výlety podle krajů</h2>
        <ul>{KRAJE.map((k) => <li key={k}><Link to={krajPath(k)}>{krajFull(k)}</Link></li>)}</ul>
      </nav>
    </div>
  )
}
