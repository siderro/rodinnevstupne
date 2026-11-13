import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { BUY_ME_A_COFFEE_URL, reportMailto } from '../lib/constants'

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <>
      <a className="skip-link" href="#obsah">Přeskočit na obsah</a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Rodinné vstupné – úvod">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Rodinné vstupné" width="233" height="40" />
          </Link>
          <nav className="header-nav" aria-label="Hlavní">
            <NavLink to="/o-projektu/">O projektu</NavLink>
            <a className="btn btn--support btn--sm" href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">
              Podpořit
            </a>
          </nav>
        </div>
      </header>

      <main id="obsah" className="container main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-col">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Rodinné vstupné" width="186" height="32" />
            <p className="meta">
              Kam na výlet, když dětí máte víc než dvě. Zdarma, bez registrace a pořadí výsledků nejde koupit.
            </p>
          </div>
          <nav className="footer-col footer-links" aria-label="Patička">
            <Link to="/o-projektu/">O projektu a jak ověřujeme</Link>
            <a href={reportMailto('Tip na místo', 'Název místa:\nOdkaz na ceník:\n')}>Nahlásit místo</a>
            <a href={reportMailto('Oprava údaje', 'Které místo:\nCo je jinak:\nOdkaz na zdroj:\n')}>Nahlásit opravu</a>
          </nav>
          <div className="footer-col">
            <p className="meta">Líbí se vám to? Kafe nás drží v chodu.</p>
            <a className="btn btn--support" href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">
              Podpořit projekt kávou
            </a>
          </div>
        </div>
        <div className="container">
          <p className="disclaimer">
            Ceny a podmínky přebíráme z oficiálních ceníků a u každého místa uvádíme zdroj a datum ověření.
            Ceníky se ale mění, proto si je před cestou ověřte na webu místa. Za případné rozdíly neručíme.
          </p>
        </div>
      </footer>
    </>
  )
}
