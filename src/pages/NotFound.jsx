import { Link } from 'react-router-dom'
import { useHead } from '../lib/useHead'

export default function NotFound() {
  useHead({ title: 'Stránka nenalezena – Rodinné vstupné', noindex: true })
  return (
    <div className="empty-state">
      <h1>Tahle stránka tu není</h1>
      <p>Možná se změnila adresa, nebo místo z katalogu vypadlo.</p>
      <Link className="btn" to="/">Zpět na výlety</Link>
    </div>
  )
}
