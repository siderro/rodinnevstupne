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
        Rodina s více dětmi by neměla u pokladny přemýšlet, jestli si výlet může dovolit. Ceníky
        v Česku ale většinou počítají s rodinou „2 + 2“ a za každé další dítě se doplácí. Informace
        o tom, kde to jde jinak, jsou rozházené po webech zoo, hradů a aquaparků. My je dáváme na
        jedno místo a ukazujeme provozovatelům, že férové rodinné vstupné se vyplatí. Chceme, aby
        velká rodina byla u pokladny vítaná.
      </p>

      <h2>Jak ověřujeme</h2>
      <p>
        Zařazujeme jen místa, kde máme oficiální zdroj ceny a kde rodinná vstupenka platí
        <strong> aspoň pro 4 děti</strong>. U každého místa uvádíme odkaz na ceník a datum, kdy jsme
        údaj ověřili. Údaje starší než rok označujeme „Ověřte před návštěvou“.
      </p>
      <ul className="tier-legend">
        <li><strong>2 + 4 děti</strong> nebo <strong>2 + 5 dětí</strong>: rodinná vstupenka pro 2 dospělé a nejvýš tolik dětí.</li>
        <li><strong>2 + všechny děti</strong>: rodinná vstupenka platí pro všechny vaše děti, případně do uvedeného věku.</li>
        <li><strong>děti zdarma</strong>: rodinnou vstupenku nekupujete, děti mají vstup zdarma a platí jen dospělí.</li>
      </ul>
      <p>
        Máte tři děti? Všechna místa v katalogu platí i pro vás: vstupenka pro 4 a více dětí
        pokryje i tři.
      </p>
      <p>Za zařazení ani za lepší pořadí se neplatí. Kritérium je pro všechna místa stejné.</p>

      <h2>Pomozte nám</h2>
      <p>
        Víte o místě, které tu chybí, nebo se změnil ceník? <Link to="/tip/">Napište nám</Link>,
        opravíme to. Provoz drží komunita, takže pokud vám web pomohl,{' '}
        <a href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">kupte nám pivo 🍺</a>.
      </p>
      <p><Link to="/">← Zpět na výlety</Link></p>
    </article>
  )
}
