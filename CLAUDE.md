# Rodinné vstupné (rodinnevstupne.cz)

Veřejný katalog výletů v ČR (zoo, hrady, aquaparky, muzea, zábavní parky…), kde rodinné
vstupné platí pro **velké rodiny**. Claim: *Kam na výlet, když je dětí spousta.*
Kampaňový claim (sítě, letáky, reklama): *Dětí spousta, vstupenka jedna.* Pravidla v `brand/brand.md`.
Zdarma, bez registrace, pořadí výsledků nejde koupit. Příjem: Buy Me a Coffee; reklama
až později a nenásilně. Doména `rodinnevstupne.cz` patří majiteli (zatím míří na původní hosting).

## Kritérium zařazení
Rodinná vstupenka musí pokrýt **aspoň 3 děti** (od 24. 11. 2026; místa 2 + 3 jsou v `scripts/candidates/tri-deti-*.json`). Úrovně (počítá `scripts/build-data.mjs`):
- `gold` — `family_policy = "unlimited"` (neomezeně dětí)
- `silver` — `max_children >= 5`
- `base` — `max_children == 4`
- `three` — `max_children == 3` (jen se `source_url` a `verified_at`, v seznamu řazeno na konec)
- cokoli jiného se do dat nedostane.

## Stack
- Frontend: React + Vite (+ SSR prerender `src/entry-server.jsx`, `scripts/postbuild.mjs`).
- Data: **statická** — `src/data/venues.json`, generuje `scripts/build-data.mjs`
  ze `scripts/candidates/verified-*.json` (dedup podle slugu, řazení kraj → název).
- Supabase: **volitelný**, jen pro budoucí `/admin` (schéma v `supabase/`, prefix `rv_`).
  Bez klíčů web jede čistě ze statických dat.
- Deploy: GitHub Actions → push `dist/` do větve `production` v gitu Blueboardu
  (`git@locutus.blueboard.cz:rodinnevstupne.cz`, secrets `BLUEBOARD_SSH_KEY`, `BLUEBOARD_KNOWN_HOSTS`)
  → složka www. HTTPS (Let's Encrypt) spravuje Blueboard; přesměrování v `public/.htaccess`.
  GitHub Pages je vypnuté (certifikát se tam zasekl). `SITE_URL` pro canonical/sitemap.

## Struktura
- `src/` — React app; `src/data/venues.json` — vygenerovaná data (ručně neupravovat)
- `scripts/` — `build-data.mjs`, `postbuild.mjs`, `import.mjs` (Supabase), `candidates/`
- `supabase/` — SQL schéma a RLS
- `docs/` — strategie (`strategy.md`), výzkum (`research/`); `brand/`, `marketing/`

## Příkazy
- Dev: `npm run dev`
- Data: `npm run data` (přegeneruje `src/data/venues.json`)
- Build: `npm run build` (prerender + postbuild)

## Konvence
- Texty a UI v češtině se správnou diakritikou. Tón: věcný a vřelý, „my“ jako tým a komunita
  („ověřili jsme“); nemoralizovat, žádný slevový marketing ani vyskakovací okna.
- Každé místo: ověřená cena pro celou rodinu + zdroj (`source_url`) + datum ověření (`verified_at`).
- Kraje: 14 krajů ČR jako primární filtr (seznam v `PRD.md`).
- Design: jednoduchý, veselý, ale ne dětský; přehledný, mobile-first.
- Žádné osobní příběhy ani osobní e-maily v obsahu webu.

## Sociální sítě (instrukce majitele, závazné)
- Témata: co vylepšujeme na webu, radost z dětí a čas spolu, podpora rodin (i když to ekonomicky někdy nejde, jdeme naproti),
  občas demografie. Tipy na jednotlivá místa jen výjimečně (nemáme k nim fotky).
- Tón: nikdy si nestěžujeme; vždy optimisticky, s nadějí a výzvou k akci. Ne akademicky, ne výčitka, ne poučky.
  Lehkost a humor („s velkou rodinou to někdy může být trochu náročné :)“), vždy laskavě.
- Čísla jen občas jako zajímavost („Věděli jste, že…?“), max. jedno na post; zdroj `docs/research/vicedetne-rodiny-statistika.md`.
- Ústřední výzva: „Zkuste všichni vyrazit někam na rodinné vstupné.“
- Každý post s odkazem na web (FB: URL s `utm_source=facebook&utm_campaign=<téma>`, IG: adresa + „odkaz je i v biu“).
- Neshazovat menší rodiny ani bezdětné, nepolitické, bez osobních příběhů. Novinky na webu zapisovat do `marketing/log-inovaci.md`.

## Bezpečnost
- Secrets nikdy do repa. Service-role klíč jen lokálně ve `scripts/.env`.
- Pokud se Supabase zapojí: anon klíč je veřejný, bezpečnost stojí na RLS
  (anonym jen SELECT `status='published'`, zápis jen admin / lokální skript).
