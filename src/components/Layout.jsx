import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { BUY_ME_A_COFFEE_URL } from '../lib/constants'
import { track } from '../lib/track'

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  // GoatCounter: první zobrazení počítá count.js sám, další přechody v SPA tady
  const firstView = useRef(true)
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return }
    window.goatcounter?.count?.({ path: location.pathname + location.search })
  }, [pathname])

  // Kliky na „Podpořit“ (Buy Me a Coffee) a na odkazy na /tip/ odkudkoli na webu.
  // Jeden delegovaný posluchač místo onClick u každého odkazu. Vestavěné data-goatcounter-click
  // z count.js nepoužíváme, protože vidí jen prvky, které existují při načtení skriptu.
  useEffect(() => {
    const tipPath = `${import.meta.env.BASE_URL}tip/`
    function onClick(e) {
      const a = e.target?.closest?.('a[href]')
      if (!a) return
      const from = location.pathname
      if (a.href.startsWith(BUY_ME_A_COFFEE_URL)) track('podporit-klik', from)
      else if (a.origin === location.origin && a.pathname.startsWith(tipPath)) track('tip-klik', from)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return (
    <>
      <a className="skip-link" href="#obsah">Přeskočit na obsah</a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Rodinné vstupné – úvod">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Rodinné vstupné" width="233" height="40" />
          </Link>
          <nav className="header-nav" aria-label="Hlavní">
            <NavLink to="/novinky/" className="nav-novinky">Novinky</NavLink>
            <NavLink to="/tip/">Poslat tip</NavLink>
            <NavLink to="/o-projektu/" className="nav-about">O projektu</NavLink>
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
            <Link to="/novinky/">Novinky v katalogu</Link>
            <Link to="/tip/">Nahlásit místo</Link>
            <Link to="/tip/?oprava=">Nahlásit opravu</Link>
            <a href={`${import.meta.env.BASE_URL}rss.xml`}>Novinky přes RSS</a>
          </nav>
          <div className="footer-col">
            <p className="meta">Líbí se vám to? Kafe nás drží v chodu.</p>
            <a className="btn btn--support" href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">
              Podpořit projekt kávou
            </a>
            <p className="meta footer-credits">
              Nápad: <a href="https://www.jakubgoldmann.cz" target="_blank" rel="noopener">Jakub Goldmann</a>
              <br />
              Inovace: <a href="https://www.svejda-goldmann.cz" target="_blank" rel="noopener">Švejda Goldmann</a>
            </p>
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
