# Rodinné vstupné (rodinnevstupne.cz)

Veřejný katalog výletů v ČR (zoo, hrady, aquaparky, muzea, zábavní parky…), kde rodinné
vstupné platí pro **velké rodiny**. Claim: *Kam na výlet, když dětí máte víc než dvě.*
Zdarma, bez registrace, pořadí výsledků nejde koupit. Příjem: Buy Me a Coffee; reklama
až později a nenásilně. Doména `rodinnevstupne.cz` patří majiteli (zatím míří na původní hosting).

## Kritérium zařazení
Rodinná vstupenka musí pokrýt **aspoň 4 děti**. Úrovně (počítá `scripts/build-data.mjs`):
- `gold` — `family_policy = "unlimited"` (neomezeně dětí)
- `silver` — `max_children >= 5`
- `base` — `max_children == 4`
- cokoli jiného se do dat nedostane.

## Stack
- Frontend: React + Vite (+ SSR prerender `src/entry-server.jsx`, `scripts/postbuild.mjs`).
- Data: **statická** — `src/data/venues.json`, generuje `scripts/build-data.mjs`
  ze `scripts/candidates/verified-*.json` (dedup podle slugu, řazení kraj → název).
- Supabase: **volitelný**, jen pro budoucí `/admin` (schéma v `supabase/`, prefix `rv_`).
  Bez klíčů web jede čistě ze statických dat.
- Deploy: GitHub Actions → GitHub Pages. `VITE_BASE` = `/<repo>/` pro github.io,
  `/` pro vlastní doménu; `SITE_URL` pro canonical/sitemap.

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

## Bezpečnost
- Secrets nikdy do repa. Service-role klíč jen lokálně ve `scripts/.env`.
- Pokud se Supabase zapojí: anon klíč je veřejný, bezpečnost stojí na RLS
  (anonym jen SELECT `status='published'`, zápis jen admin / lokální skript).
