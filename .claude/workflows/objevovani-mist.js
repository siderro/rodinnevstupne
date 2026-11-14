export const meta = {
  name: 'objevovani-mist',
  description: 'Vytěžování webu: hledá nová místa s rodinným vstupným pro 4+ dětí podle krajů a tématu, přísně je ověří a přeověří zastaralé záznamy',
  whenToUse: 'Měsíční objevovací běh (args.focus = téma), plošné přeověření (args.mode = "reverify"), nebo ověření tipů od veřejnosti (args.mode = "tipy"). Popis v docs/ops/vytezovani.md.',
  phases: [
    { title: 'Příprava', detail: 'načte existující slugy, zamítnuté a zastaralé záznamy' },
    { title: 'Sběr', detail: 'sběrač na skupinu krajů × téma → raw-<run>-<skupina>.json' },
    { title: 'Ověření', detail: 'přísný validátor na skupinu → verified-/rejected-<run>-<skupina>.json' },
    { title: 'Přeověření', detail: 'kontrola záznamů starších než N měsíců → reverify-<run>-<n>.json' },
    { title: 'Novinky', detail: 'koncept příspěvku „dalších N míst“ do marketing/novinky/' },
  ],
}

// ---------------------------------------------------------------------------
// args = {
//   today: 'YYYY-MM-DD'            (povinné; skript nesmí volat Date)
//   run?: 'YYYY-MM'                (id běhu pro názvy souborů; výchozí = měsíc z today)
//   mode?: 'discovery' | 'reverify' | 'tipy'   (výchozí 'discovery')
//   focus?: string                 (klíč z FOCUS níže, nebo volný text; výchozí 'mix')
//   regions?: string[]             (skupiny: 'zapad' | 'sever-vychod' | 'morava'; výchozí všechny)
//   perGroup?: number              (kolik kandidátů má sběrač zkusit najít; výchozí 12)
//   reverifyMonths?: number        (stáří verified_at pro přeověření; výchozí 6)
//   reverifyAll?: boolean          (přeověřit vše bez ohledu na stáří — únorový plošný běh)
//   reverifyCategories?: string[] (přeověřit jen tyto kategorie, např. předletní kolo ['aquapark','zabavni_park','zoo','hrad'])
//   reverifyLimit?: number         (max. záznamů na jednoho přeověřovatele; výchozí 25)
//   skipReverify?: boolean         (v discovery režimu vynechat přeověření)
//   tips?: [{name, city?, kraj?, url?, note?, from?}]   (pro mode 'tipy')
// }
// ---------------------------------------------------------------------------

const A = args || {}
if (!A.today || !/^\d{4}-\d{2}-\d{2}$/.test(A.today)) throw new Error('args.today (YYYY-MM-DD) je povinné')
const TODAY = A.today
const RUN = A.run || TODAY.slice(0, 7)
const MODE = A.mode || 'discovery'
// Značka souborů: měsíční objevovací běh = RUN; tipy a plné přeověření dostanou vlastní, aby nepřepsaly soubory měsíčního běhu.
const TAG = MODE === 'discovery' ? RUN : `${RUN}-${MODE}-${TODAY.slice(8, 10)}`
const FOCUS_KEY = A.focus || 'mix'
const PER_GROUP = A.perGroup || 12
const REVERIFY_MONTHS = A.reverifyMonths == null ? 6 : A.reverifyMonths
const REVERIFY_LIMIT = A.reverifyLimit || 25
const REVERIFY_CATS = A.reverifyCategories && A.reverifyCategories.length ? A.reverifyCategories : null

const GROUPS = {
  'zapad': ['Praha', 'Středočeský', 'Jihočeský', 'Plzeňský', 'Karlovarský'],
  'sever-vychod': ['Ústecký', 'Liberecký', 'Královéhradecký', 'Pardubický', 'Vysočina'],
  'morava': ['Jihomoravský', 'Olomoucký', 'Zlínský', 'Moravskoslezský'],
}
const groupKeys = (A.regions && A.regions.length ? A.regions : Object.keys(GROUPS))
  .filter((g) => { if (!GROUPS[g]) log(`Neznámá skupina „${g}“ – přeskakuji (platné: ${Object.keys(GROUPS).join(', ')})`); return !!GROUPS[g] })

// Témata běhů. Klíč jde do args.focus; volný text se použije doslova.
const FOCUS = {
  'mix': 'Kategorie, kterých máme v katalogu málo: zoo a zooparky, aquaparky a krytá koupaliště, zábavní a rodinné parky, science centra, příroda (jeskyně, botanické zahrady, arboreta), sport. Muzeí už máme hodně, ber je jen když jsou výjimečná (např. „vstup zdarma do 18 let“ nebo vstupenka pro 5+ dětí).',
  'zoo-a-zooparky': 'Zoologické zahrady, zooparky, minizoo, záchranné stanice a ekocentra se vstupným. Výčet: Unie českých a slovenských zoologických zahrad (UCSZOO), Wikipedie „Seznam zoologických zahrad v Česku“. Pozor: Zoo Plzeň (jen 2+3), Zoo Ostrava a Safari Park Dvůr Králové už byly zamítnuté/neověřené.',
  'vnitrni-zimni': 'Místa pro zimu a jarní prázdniny pod střechou: science centra, hvězdárny a planetária, aquaparky a krytá koupaliště, trampolínové a lezecké haly, interaktivní muzea. U aquaparků hlídej výškové a časové limity.',
  'hrady-a-zamky-mimo-npu': 'Hrady a zámky, které NESPRAVUJE Národní památkový ústav (NPÚ nemá rodinné vstupné → nepatří do katalogu): městské, krajské, církevní a soukromé objekty (např. Bouzov patří NPÚ – pozor, vždy ověřit správce). Výčet: Wikipedie „Seznam hradů/zámků v Česku“ (sloupec vlastník), krajské turistické portály.',
  'regionalni-muzea': 'Krajská, městská a vlastivědná muzea a galerie, jejich pobočky a skanzeny. Hledej hlavně vstupenky typu „rodinné až 5 dětí“, „2 dospělí + neomezený počet dětí“, „děti do 15/18 let zdarma“ a skupinové vstupenky „N osob“. Výčet: adresář Asociace muzeí a galerií ČR (cz-museums.cz), weby krajů (zřizovatelů).',
  'skanzeny-a-pamatniky': 'Skanzeny, muzea v přírodě, památníky, technické památky, důlní a železniční muzea.',
  'rozhledny-hvezdarny': 'Rozhledny se vstupným, hvězdárny a planetária, observatoře.',
  'priroda-a-zahrady': 'Botanické zahrady, arboreta, jeskyně (Správa jeskyní ČR i soukromé), naučné stezky a přírodní areály se vstupným, lanová centra a bobové dráhy.',
  'zabavni-parky-a-farmy': 'Zábavní a rodinné parky, DinoParky, Mirakulum, Bruno Family Park, farmy a statky pro děti, bludiště, dětské parky. Typicky 2+2 s doplatkem za další dítě → takové zamítnout (per_child), hledej výjimky.',
  'statni-muzea-mk': 'Příspěvkové organizace Ministerstva kultury podle nového dubnového „Aktualizovaného přehledu slev ze vstupného“ (mk.gov.cz). Porovnej s katalogem: nové instituce i změněná pravidla.',
  'sezonni-akce': 'Jednorázové a sezónní akce s volným nebo symbolickým vstupem pro děti (Den dětí, dny otevřených dveří, Muzejní noc, „dítě za korunu“). TYTO SE DO KATALOGU NEUKLÁDAJÍ – jen jako podklad pro marketing.',
}
const FOCUS_TEXT = FOCUS[FOCUS_KEY] || FOCUS_KEY
const SEASONAL = FOCUS_KEY === 'sezonni-akce'

const CAND = 'scripts/candidates'
const RECORD_FIELDS = 'name, slug, category (zoo|aquapark|hrad|muzeum|zabavni_park|science|priroda|sport|jine), kraj (přesně jeden ze 14 krajů), city, address, lat, lng, website, family_policy (unlimited|max_children|per_child|none), max_children, adults_in_family_ticket, kids_age_limit, price_adult, price_child, price_family, price_family_offseason, season_months, closed_months, min_children, extra_child_price, paid_children, kids_free_under, compare_ok, source_date, family_ticket_desc, notes, source_url, verified_at'

const RULES = `PRAVIDLA OVĚŘENÍ (přísná, platí bez výjimky):
- Do katalogu patří jen místo, kde jedna rodinná vstupenka / bezplatný vstup pokryje ASPOŇ 4 děti.
  Úrovně počítá scripts/build-data.mjs: family_policy "unlimited" → zlatá; max_children ≥ 5 → stříbrná; max_children = 4 → základ; cokoli jiného build vyřadí.
- „Děti do X let zdarma“ nebo „vstup zdarma pro všechny“ kódujeme jako family_policy "unlimited", max_children null, kids_age_limit = X, price_child 0 (stejně jako Národní muzeum a NZM v verified-zapad.json).
- „2+2 a každé další dítě za příplatek“ = per_child → ZAMÍTNOUT. Hrady a zámky NPÚ nemají rodinné vstupné → ZAMÍTNOUT.
- Skupinová vstupenka „N osob (min. M dětí)“ přepočítat na 2 dospělé: 6 osob = 2+4 → max_children 4.
- Odstupňovaná rodinná cena: max_children = nejvyšší varianta, price_family = cena největší varianty, ostatní varianty do notes.
- Podmíněné „neomezeně“ (jen s Rodinným pasem apod.) → uložit základní pravidlo bez karty, podmínku do family_ticket_desc a notes.
- source_url = PŘÍMÁ URL oficiálního ceníku (stránka „Vstupné/Ceník“ nebo PDF) provozovatele. Nikdy agregátor (Kudy z nudy, finance.cz, prague.eu, Slevomat, Wikipedie, Facebook). Bez oficiálního ceníku → zamítnout s důvodem „ceník nenalezen“.
- family_ticket_desc = doslovné nebo věrné znění z ceníku včetně věkové/výškové hranice.
- Ceny: na pokladně, hlavní sezóna, víkend, celodenní (online, všední den a časové varianty do notes). Neznámou cenu nech null, nehádej.
- STRUKTUROVANÁ POLE (vyplň, když je ceník uvádí; jinak null – nic nedomýšlej):
  · price_family_offseason + season_months: má-li rodinná vstupenka jinou cenu mimo sezónu, price_family = hlavní sezóna, price_family_offseason = mimo sezónu, season_months = pole čísel měsíců hlavní sezóny, např. [3,4,5,6,7,8,9,10].
  · closed_months: měsíce, kdy je místo celé zavřené (např. hrad mimo sezónu [11,12,1,2,3]). Jen víkendový provoz NENÍ zavřeno – to do notes.
  · min_children: rodinná vstupenka platí až od N dětí (např. „2 dospělí + 3–4 děti“ → min_children 3, max_children 4).
  · extra_child_price: ceník výslovně říká, že k rodinné vstupence lze dokoupit další dítě za X Kč (Zoo Praha: „každé další dítě za plné vstupné“ → cena dětské vstupenky). Tier se tím nemění.
  · paid_children: „platí 2 dospělí a 1 dítě, další děti zdarma“ → paid_children 1 (jednotlivé vstupné se počítá jen za N dětí).
  · kids_free_under: děti mladší než X let mají vstup zdarma (typicky 3 nebo 6). Odlišné od kids_age_limit (horní věková hranice dítěte na rodinné vstupence).
  · compare_ok: false, když price_adult/price_child platí pro jiný rozsah než rodinná (např. jednotlivé za jeden okruh, rodinná za celý areál). Jinak vynech (= true).
  · source_date: datum nebo rok platnosti ceníku, pokud ho zdroj uvádí („Ceník 2026“ → "2026", PDF z prosince 2023 → "2023-12").
- Dospělá cena: pokud chybí (price_adult null) a ceník ji uvádí, doplň ji – i u míst „děti zdarma“.
- Jednorázové akce (Den dětí, „dítě za korunu“, dny volného vstupu) nejsou trvalé pravidlo → neukládat jako místo.
- Ceník musí být platný pro aktuální nebo nadcházející sezónu; ceník starší než 2 roky bez potvrzení aktuálnosti → zamítnout „ceník neaktuální“.
- Weby blokující automat (hrad.cz, zooliberec.cz, zoolesna.cz, vida.cz) nezkoušej opakovaně – zapiš „ověřit ručně v prohlížeči“.
- Odhadnuté URL typu /vstupne často vrací 404 → ceník hledej vyhledávačem „<název> vstupné“ nebo v navigaci webu. PDF ceníky čti přes \`pdftotext -layout\`.
- verified_at = ${TODAY} jen u záznamu, jehož oficiální ceník jsi v tomto běhu skutečně viděl.
- slug: malá písmena bez diakritiky, slova spojená pomlčkou.
- Texty česky se správnou diakritikou. Kraj přesně: Praha, Středočeský, Jihočeský, Plzeňský, Karlovarský, Ústecký, Liberecký, Královéhradecký, Pardubický, Vysočina, Jihomoravský, Olomoucký, Zlínský, Moravskoslezský.`

const WEB = 'Webové nástroje načti jedním voláním ToolSearch s dotazem "select:WebSearch,WebFetch".'

// --- schémata ---------------------------------------------------------------
const SCOUT_SCHEMA = {
  type: 'object',
  properties: {
    existing: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, name: { type: 'string' }, kraj: { type: 'string' } }, required: ['slug', 'name', 'kraj'] } },
    rejected: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name'] } },
    stale: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, name: { type: 'string' }, kraj: { type: 'string' }, category: { type: 'string' }, source_url: { type: 'string' }, verified_at: { type: 'string' }, file: { type: 'string' } }, required: ['slug', 'name', 'kraj', 'verified_at', 'file'] } },
  },
  required: ['existing', 'rejected', 'stale'],
}
const COLLECT_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    count: { type: 'number' },
    candidates: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, kraj: { type: 'string' }, category: { type: 'string' }, claim: { type: 'string' } }, required: ['name', 'kraj'] } },
    sources_used: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'count', 'candidates'],
}
const VALIDATE_SCHEMA = {
  type: 'object',
  properties: {
    verified_file: { type: 'string' },
    rejected_file: { type: 'string' },
    accepted: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, slug: { type: 'string' }, kraj: { type: 'string' }, city: { type: 'string' }, category: { type: 'string' }, tier: { type: 'string', enum: ['gold', 'silver', 'base'] }, rule: { type: 'string' }, price_family: { type: ['number', 'null'] } }, required: ['name', 'slug', 'kraj', 'category', 'tier', 'rule'] } },
    rejected: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'] } },
    manual: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'] } },
  },
  required: ['accepted', 'rejected', 'manual'],
}
const REVERIFY_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    results: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, name: { type: 'string' }, status: { type: 'string', enum: ['unchanged', 'updated', 'below_threshold', 'closed', 'unreachable'] }, summary: { type: 'string' } }, required: ['slug', 'status', 'summary'] } },
  },
  required: ['file', 'results'],
}

// --- 1. Příprava ------------------------------------------------------------
function monthsBefore(dateStr, months) {
  let y = Number(dateStr.slice(0, 4)), m = Number(dateStr.slice(5, 7)) - months
  while (m <= 0) { m += 12; y -= 1 }
  return `${y}-${String(m).padStart(2, '0')}-${dateStr.slice(8, 10)}`
}
const CUTOFF = A.reverifyAll ? '9999-12-31' : monthsBefore(TODAY, REVERIFY_MONTHS)

phase('Příprava')
log(`Běh ${RUN} · režim ${MODE} · téma „${FOCUS_KEY}“ · skupiny ${groupKeys.join(', ')} · přeověřit verified_at < ${A.reverifyAll ? 'vše' : CUTOFF}${REVERIFY_CATS ? ' (' + REVERIFY_CATS.join(', ') + ')' : ''}`)

const scout = await agent(
  `Jsi příprava běhu vytěžování pro rodinnevstupne.cz. Pouze čteš soubory, nic neměň a nic nehledej na webu.
1. Přečti src/data/venues.json (publikovaná místa) → do "existing" dej {slug, name, kraj} každého záznamu.
2. Přečti všechny soubory ${CAND}/rejected-*.json (pole záznamů s polem "reason") → do "rejected" dej {name, reason}. Navíc porovnej ${CAND}/raw-*.json se všemi ${CAND}/verified-*.json: záznamy z raw, jejichž slug ani název není v žádném verified-*, přidej do "rejected" s reason "neprošel validací v dřívějším běhu".
3. Ve všech ${CAND}/verified-*.json najdi záznamy, které jsou zároveň ve venues.json a mají verified_at (řetězec YYYY-MM-DD) menší než "${CUTOFF}"${REVERIFY_CATS ? ' a category je jedna z: ' + REVERIFY_CATS.join(', ') : ''} → do "stale" dej {slug, name, kraj, category, source_url, verified_at, file} (file = název souboru verified-*, kde záznam je; při více výskytech ten abecedně poslední). Seřaď od nejstaršího verified_at.
Na čtení JSON klidně použij krátký node -e příkaz.`,
  { label: 'příprava: slugy a stáří', schema: SCOUT_SCHEMA, effort: 'low' },
)
if (!scout) throw new Error('Příprava selhala – bez seznamu existujících míst nelze pokračovat')
log(`V katalogu ${scout.existing.length} míst, zamítnutých ${scout.rejected.length}, k přeověření ${scout.stale.length}`)

const skipList = (kraje) => {
  const ex = scout.existing.filter((v) => kraje.includes(v.kraj)).map((v) => `${v.name} [${v.slug}]`)
  const rj = scout.rejected.map((r) => r.name)
  return `UŽ MÁME V KATALOGU (nehledat, nepřidávat):\n${ex.join('\n') || '(nic)'}\n\nUŽ DŘÍVE ZAMÍTNUTO (nepřidávat, pokud nemáš důkaz, že se ceník změnil k lepšímu):\n${rj.join('; ') || '(nic)'}`
}

// --- 2.+3. Sběr → Ověření (pipeline po skupinách) ---------------------------
const validatePrompt = (g, kraje, extra) => `Jsi PŘÍSNÝ VALIDÁTOR dat pro rodinnevstupne.cz, skupina krajů „${g}“ (${kraje.join(', ')}). Běh ${RUN}, dnes ${TODAY}.
${extra}
Každého kandidáta ověř NEZÁVISLE: sám najdi oficiální ceník provozovatele a přečti ho. Tvrzení sběrače nebo tipujícího je jen tip, ne důkaz. Kandidáta, který je už v katalogu (shoda slugu nebo zjevně stejné místo), vyřaď.
${WEB}

${RULES}

${skipList(kraje)}

VÝSTUP:
- ${CAND}/verified-${TAG}-${g}.json – JSON pole jen schválených záznamů s poli: ${RECORD_FIELDS}. Souřadnice lat/lng doplň (oficiální web, mapy.cz nebo OpenStreetMap), jinak null.
- ${CAND}/rejected-${TAG}-${g}.json – JSON pole zamítnutých: {name, slug, kraj, website, reason, family_ticket_desc?, source_url?, checked_at: "${TODAY}"}. Zamítnuté se ukládají, aby je další běhy znovu nehledaly; místa s 2+3 se hodí pro budoucí kalkulačku.
- Když nic neschválíš, zapiš verified soubor jako prázdné pole [].
- Do "manual" dej místa, kde web blokuje automat nebo ceník je jen v obrázku – ta NEPATŘÍ do verified souboru.
Pak spusť \`node scripts/build-data.mjs\` a zkontroluj, že tvoje záznamy nevyvolaly varování (neznámý kraj, chybí source_url, duplicitní slug). Chyby oprav ve svém souboru. Jiné soubory needituj.
Vrať strukturovaný přehled; tier spočítej podle pravidel (gold/silver/base).`

let groupResults = []
if (MODE === 'discovery') {
  groupResults = await pipeline(
    groupKeys,
    (g) => agent(
      `Jsi SBĚRAČ kandidátů pro rodinnevstupne.cz – katalog míst v ČR, kde rodinná vstupenka (nebo bezplatný vstup dětí) pokryje aspoň 4 děti. Běh ${RUN}, dnes ${TODAY}.
Skupina krajů „${g}“: ${GROUPS[g].join(', ')}.
TÉMA BĚHU: ${FOCUS_TEXT}
${WEB}

Postup:
1. Z výčtových zdrojů (Kudy z nudy, Wikipedie, krajské turistické portály, seznamy asociací, finance.cz a blogy jen jako TIP) sestav seznam míst k tématu v těchto krajích. Pokryj rovnoměrně všechny kraje skupiny, přednostně ty, kde katalog má málo míst.
2. U každého rychle otevři oficiální web a stránku vstupného. Ponech jen ta, kde to vypadá na 4+ dětí na jednu rodinnou vstupenku, „děti do X let zdarma“, „neomezený počet dětí“, skupinovou vstupenku 6+ osob, nebo vstup zdarma. 2+2 / 2+3 / per_child rovnou zahoď (stačí je zmínit v "claim" s poznámkou).
3. Cíl: až ${PER_GROUP} slibných kandidátů. Méně je v pořádku – nevymýšlej.
${SEASONAL ? '4. TÉMA JE SEZÓNNÍ: akce NEJSOU místa do katalogu. Zapiš je do ' + CAND + '/akce-' + RUN + '-' + g + '.json jako {nazev, misto, kraj, datum_od, datum_do, co_je_zdarma, zdroj_url} a do raw souboru zapiš prázdné pole [].' : ''}

${skipList(GROUPS[g])}

Zapiš ${CAND}/raw-${TAG}-${g}.json – JSON pole záznamů s poli: ${RECORD_FIELDS} (co nevíš, dej null; verified_at null; do notes napiš, odkud tip pochází). Jiné soubory needituj.
Vrať strukturovaný přehled (claim = jednou větou, co ceník slibuje).`,
      { label: `sběr: ${g}`, phase: 'Sběr', schema: COLLECT_SCHEMA },
    ),
    (collected, g) => {
      if (!collected || !collected.count || SEASONAL) {
        log(`Skupina ${g}: ${SEASONAL ? 'sezónní akce – validace přeskočena' : 'žádní kandidáti, validace přeskočena'}`)
        return { group: g, collected, validated: null }
      }
      return agent(
        validatePrompt(g, GROUPS[g], `Vstup: ${CAND}/raw-${TAG}-${g}.json (${collected.count} kandidátů od sběrače).`),
        { label: `ověření: ${g}`, phase: 'Ověření', schema: VALIDATE_SCHEMA },
      ).then((validated) => ({ group: g, collected, validated }))
    },
  )
} else if (MODE === 'tipy') {
  const tips = A.tips || []
  if (!tips.length) log('Režim tipy bez args.tips – nic k ověření')
  const krajToGroup = (k) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(k)) || groupKeys[0]
  const byGroup = {}
  for (const t of tips) { const g = krajToGroup(t.kraj); (byGroup[g] = byGroup[g] || []).push(t) }
  groupResults = await pipeline(
    Object.keys(byGroup),
    (g) => agent(
      validatePrompt(g, GROUPS[g], `Vstup: tipy od veřejnosti (z tipy@rodinnevstupne.cz nebo formuláře „Nahlas místo“). Fotka ceníku nebo tvrzení tipujícího NENÍ zdroj – vždy dohledej oficiální ceník. Do notes zapiš „Tip od komunity (${RUN})“ a jméno/přezdívku z pole "from", jen pokud je vyplněné. Tipy:\n${JSON.stringify(byGroup[g], null, 1)}`),
      { label: `tipy: ${g}`, phase: 'Ověření', schema: VALIDATE_SCHEMA },
    ).then((validated) => ({ group: g, collected: null, validated })),
  )
}

// --- 4. Přeověření ----------------------------------------------------------
let reverifyResults = []
const doReverify = MODE === 'reverify' || (MODE === 'discovery' && !A.skipReverify)
if (doReverify && scout.stale.length) {
  const maxChunks = MODE === 'reverify' ? 7 : 1
  const chunks = []
  for (let i = 0; i < scout.stale.length && chunks.length < maxChunks; i += REVERIFY_LIMIT) chunks.push(scout.stale.slice(i, i + REVERIFY_LIMIT))
  const covered = chunks.reduce((n, c) => n + c.length, 0)
  if (covered < scout.stale.length) log(`Přeověření omezeno na ${covered} z ${scout.stale.length} nejstarších záznamů; zbytek zůstává na příští běh (nebo spusť mode "reverify").`)
  phase('Přeověření')
  reverifyResults = (await parallel(chunks.map((chunk, i) => () => agent(
    `Jsi PŘEOVĚŘOVATEL dat pro rodinnevstupne.cz. Běh ${RUN}, dnes ${TODAY}, dávka ${i + 1}/${chunks.length}.
U každého záznamu níže si NEJDŘÍV přečti celý uložený záznam v ${CAND}/<file> (hledej podle slugu), pak otevři jeho source_url (a když nefunguje, najdi aktuální oficiální ceník) a porovnej s uloženým záznamem v uvedeném souboru ${CAND}/<file>.
${WEB}

${RULES}

Stavy:
- unchanged – pravidlo i ceny sedí → v "record" jen {verified_at: "${TODAY}"}.
- updated – změnila se cena, URL ceníku nebo popis, NEBO jsi doplnil některé ze strukturovaných polí / chybějící cenu, a pořád ≥ 4 děti → v "record" celý aktualizovaný záznam (všechna pole z: ${RECORD_FIELDS}); do notes připiš starou cenu ve formátu "${RUN}: 1 000 Kč → 1 100 Kč", když se cena změnila. Informace přesunuté z notes do strukturovaných polí z notes odstraň, ať se neopakují.
- below_threshold – rodinná vstupenka nově kryje < 4 děti → "reason" s doslovným zněním.
- closed – místo trvale zavřené, zrušené nebo dlouhodobě v rekonstrukci → "reason" se zdrojem.
- unreachable – web nebo ceník nedostupný, blokuje automat → nic neměň, "reason" (ověřit ručně do 30 dní).

SOUBORY V ${CAND}/verified-*.json NEEDITUJ (běží víc přeověřovatelů souběžně). Zapiš jen ${CAND}/reverify-${TAG}-${i + 1}.json – JSON pole {slug, file, status, record?, reason?, checked_at: "${TODAY}"}. Změny do katalogu propíše až správce dat skriptem \`node scripts/apply-reverify.mjs ${TAG}\` po kontrole.

Záznamy:
${JSON.stringify(chunk, null, 1)}

Vrať strukturovaný přehled (summary = jedna věta, co se změnilo).`,
    { label: `přeověření ${i + 1}/${chunks.length}`, phase: 'Přeověření', schema: REVERIFY_SCHEMA },
  )))).filter(Boolean)
} else if (doReverify) {
  log('Žádný záznam není starší než hranice přeověření – přeskakuji.')
}

// --- 5. Souhrn + koncept novinek -------------------------------------------
const accepted = groupResults.filter(Boolean).flatMap((r) => (r.validated ? r.validated.accepted : []))
const rejected = groupResults.filter(Boolean).flatMap((r) => (r.validated ? r.validated.rejected : []))
const manual = groupResults.filter(Boolean).flatMap((r) => (r.validated ? r.validated.manual : []))
const rv = reverifyResults.flatMap((r) => r.results)
const countBy = (arr, k) => arr.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {})

let novinkyFile = null
if (accepted.length) {
  phase('Novinky')
  novinkyFile = `marketing/novinky/${TAG}.md`
  await agent(
    `Napiš koncept do souboru ${novinkyFile} (složku vytvoř). Hlas značky podle brand/brand.md: mluvíme za tým v množném čísle („ověřili jsme“), věcně a vřele, žádný slevový křik, žádné vykřičníky v řadě, nic o soukromí kohokoli z týmu. Úrovně v textu jen přátelskými názvy s počtem dětí: „Všichni dovnitř · neomezeně dětí“, „Plná posádka · 5+ dětí“, „Čtyřlístek · 4 děti“ (nikdy „zlatá/stříbrná“).
Obsah souboru:
1. Krátký příspěvek na sociální sítě „Dalších ${accepted.length} míst, kam se vejdete všichni“ (do 600 znaků, 3–5 nejzajímavějších míst, odkaz https://rodinnevstupne.cz).
2. Delší novinka na web: úvodní věta, místa seskupená podle kraje (název, obec, úroveň s počtem dětí, jedna věta o pravidlu), poděkování komunitě, pokud šlo o tipy, a výzva „Znáte další místo? Napište na tipy@rodinnevstupne.cz.“
3. Na konci HTML komentář s interní poznámkou: datum běhu ${TODAY}, že ceny ověřujeme k datu ověření a koncept před zveřejněním zkontroluje člověk.
Ceny uváděj jen tak, jak jsou níže; nic nedohledávej a nevymýšlej. Jiné soubory needituj.
Nová místa: ${JSON.stringify(accepted)}`,
    { label: 'novinky: koncept', phase: 'Novinky', effort: 'low' },
  )
}

return {
  run: RUN,
  tag: TAG,
  mode: MODE,
  focus: FOCUS_KEY,
  groups: groupKeys,
  files: {
    raw: MODE === 'discovery' ? groupKeys.map((g) => `${CAND}/raw-${TAG}-${g}.json`) : [],
    verified: groupResults.filter(Boolean).filter((r) => r.validated).map((r) => `${CAND}/verified-${TAG}-${r.group}.json`),
    rejected: groupResults.filter(Boolean).filter((r) => r.validated).map((r) => `${CAND}/rejected-${TAG}-${r.group}.json`),
    reverify: reverifyResults.map((r) => r.file),
    novinky: novinkyFile,
  },
  new_venues: {
    total: accepted.length,
    by_tier: countBy(accepted, 'tier'),
    by_kraj: countBy(accepted, 'kraj'),
    by_category: countBy(accepted, 'category'),
    list: accepted.map((a) => `${a.name} (${a.city || a.kraj}) – ${a.tier}: ${a.rule}`),
  },
  rejected_count: rejected.length,
  manual_check: manual,
  reverify: {
    checked: rv.length,
    by_status: countBy(rv, 'status'),
    attention: rv.filter((r) => r.status !== 'unchanged').map((r) => `${r.slug}: ${r.status} – ${r.summary}`),
  },
  next_steps: [
    'Projít verified-' + TAG + '-*.json (čtyři oči: schvaluje jiná osoba než ověřovatel; checklist v docs/admin-playbook.md kap. 6).',
    rv.length ? `node scripts/apply-reverify.mjs ${TAG} --dry-run, pak bez --dry-run` : null,
    'npm run data && npm run dev (kontrola pár míst) → PR / commit → deploy',
    novinkyFile ? `Upravit a naplánovat ${novinkyFile}` : null,
  ].filter(Boolean),
}
