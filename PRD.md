# PRD — Rodinné vstupné (rodinnevstupne.cz)

Claim: *Kam na výlet, když dětí máte víc než dvě.* Doména zatím neregistrovaná.

## 1. Problém
„Rodinné vstupné" bývá 2+2 (2 dospělí + 2 děti). Velké rodiny (3+ dětí) tím tratí.
Neexistuje přehled míst v ČR, kde je vstupné pro velkou rodinu férové.

## 2. Cíl
Veřejný, bezplatný katalog míst v ČR s férovým rodinným vstupným pro velké rodiny.
Rodiny na budgetu tu najdou, kam vyrazit, aniž by přeplatily.

## 3. Cílová skupina
Velké rodiny, které plánují výlety a nechtějí přeplácet. Pokrýváme celou ČR včetně krajů bez Rodinných pasů.

## 4. Rozsah (MVP)
### Veřejná část (bez loginu)
- Seznam míst s kartami: název, kategorie, kraj/město, badge vhodnosti, cena, odkaz na web.
- Filtry: **kraj**, **kategorie** (typ místa), **úroveň** (gold / silver / base = počet dětí na rodinné vstupné).
- Fulltext hledání podle názvu/města.
- Detail místa: podmínky vstupného, ceny, zdroj info, odkaz, datum ověření.
- Buy Me a Coffee tlačítko. Reklama až později, nenásilně; pořadí výsledků nejde koupit.

### Neveřejná část (později, volitelně)
- `/admin` za Supabase Auth (jen povolený e-mail) — v MVP se nepoužívá, data jsou statická.
- Review kandidátů (`status='draft'`), editace, publish/reject.
- Lokální skript: web search + LLM navrhne místa → zapíše drafty ke schválení.

## 5. Kritérium zařazení a úrovně
Místo zařadíme, jen pokud rodinná vstupenka pokryje **aspoň 4 děti**. Úroveň počítá `scripts/build-data.mjs`:
- **gold** — neomezeně dětí (`family_policy = unlimited`)
- **silver** — 5+ dětí (`max_children >= 5`)
- **base** — 4 děti (`max_children = 4`)
- jinak se místo do dat nedostane.

Pole `family_policy`:
- `unlimited` — 2 dospělí + libovolný počet dětí (hlavní badge „Neomezeně dětí").
- `max_children` — konkrétní strop (`max_children`); ≥ 4 pro zařazení.
- `kids_free_age` — děti zdarma do věku (`kids_free_under_age`) — samo o sobě nestačí.
- `per_child` — platí se za dítě (ukládáme ceny pro kalkulaci).
- `none` — bez rodinné výhody.

## 6. Datový model — záznam místa (`src/data/venues.json`)
name, slug, category, kraj, okres?, city, address, lat, lng, website,
family_policy, max_children, kids_free_under_age,
price_adult, price_child, price_family, family_ticket_desc, notes,
source_url, verified_at, tier (gold/silver/base, dopočítané).
Zdroj: `scripts/candidates/verified-*.json` → `npm run data` → `src/data/venues.json`.
Volitelná Supabase tabulka `rv_venues` má navíc status (draft/published/rejected), created_at, updated_at.

## 7. Geografie
14 krajů ČR jako primární filtr: Praha, Středočeský, Jihočeský, Plzeňský, Karlovarský,
Ústecký, Liberecký, Královéhradecký, Pardubický, Vysočina, Jihomoravský, Olomoucký,
Zlínský, Moravskoslezský. (Okresy a mapa = fáze 2.)

## 8. Design
Jednoduchý, veselý, ne dětský. Přehledné karty, čitelné badge, mobile-first, dobrý kontrast.

## 9. Technika
React + Vite se SSR prerenderem → GitHub Pages (GitHub Actions; `VITE_BASE` určuje cestu,
`/<repo>/` pro github.io, `/` po připojení domény rodinnevstupne.cz; `SITE_URL` pro canonical/sitemap).
Data statická v repu. Supabase (Postgres, RLS, Auth) volitelně až pro admin; service-role jen lokálně.
Příkazy: `npm run dev`, `npm run data`, `npm run build`.

## 10. Byznys model
Zdarma, bez registrace. Hlavní příjem: Buy Me a Coffee. Reklama až později a nenásilně.

## 11. Fáze
- **Fáze 1 (MVP)**: statická data + build skript, veřejný seznam+filtry (kraj, kategorie, úroveň), detail, prerender.
- **Fáze 2**: admin v Supabase, mapa (Leaflet/OSM), okresy, kalkulačka ceny pro rodinu 2+N, sdílení, sitemap/SEO.

## 12. Mimo rozsah (zatím)
Uživatelské účty, recenze/hodnocení, rezervace/platby, mobilní appka.
