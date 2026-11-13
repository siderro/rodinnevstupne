import { Link } from 'react-router-dom'
import { BUY_ME_A_COFFEE_URL } from '../lib/constants'
import { aboutMeta } from '../lib/seo'
import { useHead } from '../lib/useHead'

export default function About() {
  useHead(aboutMeta())
  return (
    <article className="prose">
      <h1>O projektu</h1>
      <p className="lead">
        Rodinné vstupné je katalog výletů po celé ČR pro velké rodiny, které nechtějí přeplácet.
        Zadáte, kolik máte dětí, a ukážeme vám místa, kde zaplatíte jedno rodinné vstupné.
      </p>

      <h2>Proč to děláme</h2>
      <p>
        Ceníky v Česku většinou počítají s rodinou „2 + 2“. S více dětmi se u pokladny často zjistí,
        že rodinné vstupné neplatí a za každé další dítě se doplácí. Informace o tom, kde to jde jinak,
        jsou rozházené po webech zoo, hradů a aquaparků. My je dáváme na jedno místo.
      </p>

      <h2>Jak ověřujeme</h2>
      <p>
        Zařazujeme jen místa, kde máme oficiální zdroj ceny a kde rodinná vstupenka platí
        <strong> aspoň pro 4 děti</strong>. U každého místa uvádíme odkaz na ceník a datum, kdy jsme
        údaj ověřili. Údaje starší než rok označujeme „Ověřte před návštěvou“.
      </p>
      <ul className="tier-legend">
        <li><strong>Všichni dovnitř · neomezeně dětí</strong>: rodinná vstupenka platí pro všechny vaše děti.</li>
        <li><strong>Plná posádka · 5+ dětí</strong>: rodinná vstupenka pokryje aspoň 5 dětí.</li>
        <li><strong>Čtyřlístek · 4 děti</strong>: rodinná vstupenka pokryje 4 děti.</li>
      </ul>
      <p>Za zařazení ani za lepší pořadí se neplatí. Kritérium je pro všechna místa stejné.</p>

      <h2>Pomozte nám</h2>
      <p>
        Víte o místě, které tu chybí, nebo se změnil ceník? <Link to="/tip/">Napište nám</Link>,
        opravíme to. Provoz drží komunita, takže pokud vám web pomohl,{' '}
        <a href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">podpořte nás kávou</a>.
      </p>
      <p><Link to="/">← Zpět na výlety</Link></p>
    </article>
  )
}
