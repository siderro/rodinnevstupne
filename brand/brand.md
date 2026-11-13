# Značka Rodinné vstupné

*Verze 1.0, 13. 11. 2026. Podklad pro vývoj, copywriting a sociální sítě. Vychází z `docs/strategy.md` a `docs/research/design.md`.*

## 1. Základ

| | |
|---|---|
| **Název** | Rodinné vstupné (vždy s diakritikou, dvě slova, velké jen R) |
| **Claim** | **Kam na výlet, když dětí máte víc než dvě.** |
| **Doména** | primární `rodinnevstupne.cz` (vlastní, v `public/CNAME`), `rodinne-vstupne.cz` jako přesměrování, až ji zaregistrujeme. Logo ani OG obrázek doménu neobsahují, takže na výsledku nic nezávisí. |
| **Pozicování** | Rodinné vstupné je jediný český katalog výletů, který filtruje podle počtu dětí, na které platí rodinné vstupné. Je určený velkým rodinám, které nechtějí přeplácet. Na rozdíl od Kudy z nudy, Cestuj s dětmi a slevových portálů uvádí u každého místa ověřenou cenu pro celou rodinu se zdrojem a datem ověření. Pokrývá celou ČR včetně 4 krajů bez Rodinných pasů. Je zdarma, bez registrace a pořadí výsledků nejde koupit. |
| **Jednou větou** | Zadejte, kolik máte dětí, a ukážeme vám místa, kde zaplatíte jedno rodinné vstupné. |

## 2. Příběh produktu

Ceníky v Česku počítají s rodinou „2 + 2“. Rodina se třemi, čtyřmi nebo šesti dětmi u pokladny
zjistí, že „rodinné“ vstupné pro ni neplatí, a doplácí za každé další dítě. Informace o tom, kde to
jde jinak, existují, ale jsou rozházené po webech zoo, hradů a aquaparků, v PDF cenících a ve
vláknech na Facebooku.

Rodinné vstupné je dává na jedno místo. Procházíme ceníky, ověřujeme podmínky a u každého místa
uvádíme, pro kolik dětí rodinná vstupenka platí, kolik stojí, odkud údaj máme a kdy jsme ho ověřili.
Nejsme slevový portál a nic neprodáváme. Chceme, aby velká rodina věděla, kolik zaplatí, ještě než vyrazí z domu.

Druhý cíl je dlouhodobý: veřejným přehledem a odznakem ukázat provozovatelům, že férové rodinné
vstupné se vyplatí, a přimět je rozšířit ceníky 2 + 2.

Web je zdarma a bez registrace. Provoz drží komunita přes Buy Me a Coffee. Reklama přijde nanejvýš
později, nenápadně a nikdy mezi výsledky.

## 3. Hodnoty

1. **Ověřeno, ne opsáno.** Každá cena má zdroj a datum. Když si nejsme jistí, napíšeme to.
2. **Férovost.** Za zařazení ani za lepší pořadí se neplatí. Kritérium je pro všechny stejné.
3. **Velká rodina je normální zákazník.** Ne charitativní případ, ne cílovka pro slevy.
4. **Rychlá odpověď.** Člověk přichází s jednou otázkou: „Kolik nás to bude stát?“ Odpovídáme hned.
5. **Komunita.** Změny hlásí rodiny, které na místě byly. Děkujeme jim a uvádíme to.

## 4. Úrovně míst

Do katalogu patří místo, kde rodinná vstupenka pokryje **aspoň 4 děti**. Úroveň má vždy
přátelský název **a vedle něj počet dětí**. Samotný název nikdy nestačí, protože počet je informace, kvůli které lidé přišli.

| Klíč v kódu | Název úrovně | Povinný popisek | Ikona | `family_policy` | Barvy (tokeny) |
|---|---|---|---|---|---|
| `gold` | **Všichni dovnitř** | Neomezeně dětí | ∞ (`brand/icons/tier-gold.svg`) | `unlimited`, `kids_free_age` | `--tier-gold-fg` / `--tier-gold-bg` |
| `silver` | **Plná posádka** | 5+ dětí | 5 teček (`brand/icons/tier-silver.svg`) | `max_children` ≥ 5 | `--tier-silver-fg` / `--tier-silver-bg` |
| `base` | **Čtyřlístek** | 4 děti | 4 tečky (`brand/icons/tier-base.svg`) | `max_children` = 4 | `--tier-base-fg` / `--tier-base-bg` |

- Zápis odznaku: **„Všichni dovnitř · neomezeně dětí“**, **„Plná posádka · 5+ dětí“**, **„Čtyřlístek · 4 děti“**.
  Na úzkých místech (pin na mapě, malá karta) stačí ikona a popisek („5+ dětí“), název úrovně se může vynechat.
- Zlatá úroveň s věkovou hranicí: „Všichni dovnitř · děti do 15 let zdarma“. Vždy uvádíme, od kolika let děti platí.
- **Podmíněná úroveň** (platí jen s kartou, např. Rodinným pasem): čárkovaný obrys místo plné plochy (`.tier--conditional`)
  a podmínka v textu: „Všichni dovnitř · s Rodinným pasem“.
- Proč tyhle názvy: *Čtyřlístek* je čtyřka pro štěstí, *Plná posádka* je auto nebo loďka plná dětí,
  *Všichni dovnitř* je to, co chce slyšet každá velká rodina u pokladny. Názvy jsou vřelé, ale ne dětské,
  a nehodnotí rodiny, jen vstupenky.
- V textu nepoužíváme „zlatá / stříbrná“. To jsou jen interní klíče.

## 5. Tón hlasu

Věcný a vřelý. Mluvíme v množném čísle jako tým a komunita („ověřili jsme“, „přidali jsme“).
Vykáme. Jsme veselí, ale ne dětští. Nemoralizujeme, z velkých rodin neděláme chudáky a nepoužíváme slevový marketing.
Krátké věty, konkrétní čísla, česká typografie (nedělitelná mezera v „690 Kč“, datum „3. 9. 2026“, uvozovky „…“).

| Takhle ano | Takhle ne | Proč |
|---|---|---|
| „Jedno rodinné vstupné pro 2 dospělé a až 5 dětí: 690 Kč.“ | „Super cena! Ušetřete až 50 %!“ | Konkrétní cena místo slevového křiku. |
| „Ověřili jsme 3. 9. 2026 na webu zoo.“ | „Aktuální ceny.“ | Zdroj a datum jsou náš hlavní slib. |
| „Pro velké rodiny, které nechtějí přeplácet.“ | „Pro rodiny, které si nemůžou dovolit…“ | Nejsme charita, cílovku nelitujeme. |
| „Kam na výlet, když dětí máte víc než dvě.“ | „Kam levně s dětmi.“ | „Levně“ je slevový tón. Řešíme férovost, ne lacinost. |
| „Tady rodinná vstupenka platí jen pro 2 děti, za další se doplácí 120 Kč.“ | „Bohužel tu na velké rodiny kašlou.“ | Popisujeme ceník, provozovatele neodsuzujeme. |
| „Ceny se mění. Před cestou je radši ověřte, údaj je starší než rok.“ | „POZOR!!! Ceny nemusí platit!“ | Klidné varování, bez vykřičníků. |
| „Víte o změně? Napište nám, opravíme to.“ | „Pomozte nám, nebo projekt skončí!“ | Komunitu zveme, netlačíme. |
| „Líbí se vám to? Kafe nás drží v chodu.“ (patička, detail místa) | Vyskakovací okno „Podpořte nás!“ | Podpora jen nenápadně, žádné pop-upy. |
| „Rodiny se 4 a více dětmi“, „velká rodina“ | „Mnohodětná rodina“, „početné potomstvo“, „dětičky“ | Žádný úřední ani přeslazený jazyk. |
| „Ověřili jsme“, „náš tým“, „komunita“ | Text v první osobě jednotného čísla, osobní příběhy | Značka mluví jako tým. Osobní údaje ani rodinné poměry kohokoli neuvádíme. |

Další pravidla:
- Bez emoji v nadpisech a odznacích. Na sociálních sítích nanejvýš jedno, pokud něco nese.
- Žádné „TOP“, „nejlepší“, hvězdičky ani hodnocení. Odznak říká jen fakt o vstupence.
- Čísla píšeme číslicemi („5 dětí“), počet dětí vždy s podstatným jménem („4 děti“, „5+ dětí“).
- Výzva k akci je sloveso: „Zadejte počet dětí“, „Ukázat místa“, „Nahlásit změnu“.

## 6. Barvy

Zdroj pravdy je `brand/palette.json` (tokeny a změřené kontrasty), pro web `brand/tokens.css`.
Všechny dvojice text/pozadí mají aspoň 4,5 : 1, UI prvky (okraje, fokus, ikony úrovní) aspoň 3 : 1.
Ověřeno výpočtem podle vzorce WCAG 2.2 pro světlý i tmavý režim (výsledky jsou v `palette.json` → `contrast`).

| Role | Světlý | Tmavý |
|---|---|---|
| `--bg` pozadí | `#FBF8F3` | `#16181D` |
| `--surface` karty | `#FFFFFF` | `#1F2229` |
| `--text` | `#1C1F26` | `#ECEDEF` |
| `--muted` metadata | `#5B6170` | `#A3A9B6` |
| `--primary` odkazy, tlačítka | `#0F7B6C` petrolejová | `#4FD1BC` |
| `--accent` jen „Podpořit“ a zvýraznění | `#FF6B4A` korálová, text `--on-accent` (tmavý) | `#FF8A70` |
| `--tier-gold-fg/bg` | `#7A5200` / `#FFF2C4` | `#FFD466` / `#3A2F10` |
| `--tier-silver-fg/bg` | `#4D5670` / `#ECEFF5` | `#C9D0DE` / `#2A2F3A` |
| `--tier-base-fg/bg` | `#0B6A5D` / `#E2F3EF` | `#7EE0CF` / `#123430` |
| `--warn-fg/bg` „Ověřte před návštěvou“ | `#8F4A00` / `#FFF1E0` | `#FFB866` / `#3A2A12` |

Pravidla:
- Bílý text na korálovou plochu nepatří (kontrast 2,8 : 1). Na korálové vždy `--on-accent`.
- Barvy úrovní jen pro odznaky, piny a jejich ikony. Úroveň nikdy jen barvou, vždy text + ikona.
- Režim: bez atributu podle systému, ruční volba přes `<html data-theme="light">` nebo `"dark"`.
- Žádná duhová paleta, přechody jen výjimečně a jemně.

## 7. Typografie

- **Nadpisy:** Bricolage Grotesque (variabilní, 600–800, optická velikost automaticky).
- **Text, UI, ceny:** Figtree (400–700), ceny s `tabular-nums`.
- Oba fonty jsou na Google Fonts se subsetem **latin-ext**. Ověřili jsme, že obsahují všechny české znaky.
- Tokeny a načtení: `brand/typography.css` (odkaz na Google Fonts je v komentáři na začátku souboru).
- Základní text 17 px, řádkování 1,5, nadpisy přes `clamp()`.

## 8. Logo

| Soubor | Použití |
|---|---|
| `brand/logo.svg` | Hlavička webu, dokumenty. Značka a slovní značka, text převedený na křivky (nezávisí na fontu). Značka je v obou režimech stejná (petrolejová vstupenka má na tmavém pozadí kontrast 3,3 : 1), v tmavém režimu se přes `prefers-color-scheme` zesvětlí jen písmo. |
| `brand/logo-mark.svg` | Samostatná značka (avatar na sítích, malé plochy od 32 px). |
| `brand/favicon.svg` (+ `public/favicon.svg`) | Favicon, zjednodušená značka (vstupenka a tři hlavičky), čitelná i v 16 px. |
| `brand/og-image.svg` (+ `public/og-image.svg`) | Náhled při sdílení 1200 × 630. |
| `brand/og-image.png` | Totéž v PNG. Facebook, X i WhatsApp SVG v `og:image` nezobrazí, do metatagu patří PNG. |
| `brand/icons/tier-*.svg` | Ikony úrovní, barva přes `currentColor`. |

**Význam značky:** vstupenka s výřezy po stranách, na ní celá rodina: dva dospělí a tři děti, prostřední korálově.
Říká „jedna vstupenka pro všechny“ a „víc než dvě děti“ bez jediného slova.

Pravidla: kolem loga volné místo aspoň na šířku jedné hlavičky dospělého. Logo nedeformujeme, neotáčíme,
nedáváme mu stín a neměníme barvy. Na tmavém podkladu se v `logo.svg` samo přepne písmo na světlé, značka zůstává stejná.
Žádní maskoti ani ilustrované postavičky mimo značku.

## 9. Co ke značce nepatří

Slevový jazyk („levně“, „akce“, „ušetřete“), vyskakovací okna, odznaky „TOP“, hvězdičky, komiksové fonty,
duhové barvy, AI fotky míst, osobní příběhy a údaje o komkoli z týmu.
