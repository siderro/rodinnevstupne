# Rodinné vstupné

*Kam na výlet, když dětí máte víc než dvě.*

Bezplatný katalog výletů v ČR, kde rodinné vstupné platí aspoň pro 4 děti. U každého místa
uvádíme ověřenou cenu pro celou rodinu, zdroj a datum ověření. Budoucí doména:
`rodinnevstupne.cz` (vlastní doména, DNS zatím míří na původní hosting). Viz `PRD.md` a `CLAUDE.md`.

## Lokální vývoj

```bash
npm install
npm run dev        # http://localhost:5173
```

Web čte statická data ze `src/data/venues.json` — žádné klíče nejsou potřeba.

## Data

Ověřená místa se ukládají do `scripts/candidates/verified-*.json` (vzor:
`scripts/candidates.example.json`). Pak:

```bash
npm run data       # sloučí verified-*.json → src/data/venues.json
```

Skript deduplikuje podle slugu (pozdější soubor vyhrává), vyřadí místa pod 4 děti a přidělí úroveň:

| Úroveň | Podmínka |
|---|---|
| `gold` | neomezeně dětí (`family_policy: "unlimited"`) |
| `silver` | `max_children` ≥ 5 |
| `base` | `max_children` = 4 |

## Build

```bash
npm run build      # Vite build + SSR prerender + postbuild (sitemap, canonical)
npm run preview
```

Proměnné: `VITE_BASE` (cesta webu, výchozí `/`), `SITE_URL` (kanonická doména,
výchozí `https://rodinnevstupne.cz`).

## Deploy

Push do `main` → GitHub Actions (`.github/workflows/deploy.yml`) → GitHub Pages.
Workflow nastavuje `VITE_BASE=/<název-repa>/` pro adresu `<user>.github.io/<repo>/`.
Po registraci domény: změnit `VITE_BASE` na `/`, aktualizovat `public/CNAME`
na `rodinnevstupne.cz` a nastavit doménu v Settings → Pages.

## Supabase (volitelné, pro budoucí /admin)

Není nutné pro běh webu. Až bude potřeba admin:
1. V Supabase → SQL Editor spusť `supabase/schema.sql` (tabulka `rv_venues` + RLS).
2. Do `.env.local` (podle `.env.local.example`) doplň `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY`;
   v GitHubu je nastav jako Actions Variables.
3. Import kandidátů: `cp scripts/.env.example scripts/.env` (service-role klíč, tajný!) a
   `npm run import -- scripts/candidates.json`.
