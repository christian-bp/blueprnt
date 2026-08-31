# PDF-stacken för rapporterna: @react-pdf/renderer behålls

**Status:** accepterad 2026-08-31

Utlöst av rapportslicen (M8): innan lönekartläggningsrapporten byggdes utvärderades om PDF-grunden skulle bytas till pdfcn (pdfcn.dev) eller dess underliggande motorer Takumi respektive Forme. Utvärderingen gjordes 2026-08-31 mot primärkällor (npm-registret, GitHub-API:t, projektens egna dokumentationssidor) med adversariell verifiering av varje sakpåstående.

## Beslut

@react-pdf/renderer förblir appens enda PDF-motor. Rapporten byggs som en utökning av det befintliga varumärkeskitet (`components/pdf/branded-document.tsx`), och disciplinen att hålla datamonteringen motoragnostisk (ett rent, typat dokumentobjekt i `lib/pdf/`, mallar som bara tar props) fortsätter gälla, så att ett framtida motorbyte bara rör presentationslagret.

## Avvägning / varför

- **Mognadsasymmetrin är avgörande för ett lagstadgat dokument.** Vid utvärderingstillfället: pdfcn:s repo var 20 dagar gammalt; takumi-pdf (PDF-delen av Takumi, till skillnad från dess äldre bildmotor) var under 4 veckor gammalt med 35 publicerade versioner (instabilt API); Forme var 6,5 månader gammalt med 161 stjärnor, 0 registrerade issues (låg användning) och version 0.14. Båda motorerna är enmansprojekt utan företagsbackning. @react-pdf/renderer: tio år gammalt, 4.9.0 släppt 2026-08-27, uttalat React 19-stöd, ~5,35 M nedladdningar/vecka, MIT.
- **pdfcn är inget renderingsbibliotek.** Det är ett shadcn-registry med kopierbara komponenter som förutsätter att ett projekt kör Takumi eller Forme; körningsmodellen (klient eller server) ärvs från vald motor och anges inte av pdfcn självt.
- **Klientkravet.** Persondata ska inte lämna webbläsaren och Chrome-headless är förbjudet för dokument. @react-pdf/renderer kör redan helt klientsidigt i appen. takumi-pdf:s webbläsarstöd är en dokumenterad manuell WASM-workaround (no-init + wasm-url; standardingången förutsätter Vite). Forme har en förstklassig webbläsaringång, men flera marknadsförda funktioner (sammanslagning, certifiering) går via ett hostat HTTP-API, vilket måste granskas per funktion innan något persondataflöde någonsin rör det.
- **Noll migreringskostnad.** Kitet löser redan de två svåraste bitarna (sidnumrerad innehållsförteckning via tvåpassrendering; fasta sidfötter med sidnummer), och metodbilagan är i drift på det.

## Det som talade för ett byte, och varför det inte räckte

Takumi-pdf har på papperet den bästa funktionslistan: tabeller som delar kolumnbredder över sidbrytningar och upprepar `<thead>`, `<TargetPageNumber />` (en förstklassig, klickbar och sidnumrerad innehållsförteckning, exakt det vi handrullar), bokmärken via `outline: true`, och PDF/A-2/A-3/A-4 + PDF/UA-1 som passerar veraPDF (observera: validatorpass, inte certifiering). När paketet mognat förbi 1.0, fått en normalstor issue-historik och ett förstklassigt webbläsarspår är det den naturliga omprövningskandidaten.

## Omprövningskriterier

Frågan tas upp igen (tidigast om 6-12 månader) om: takumi-pdf eller @formepdf/core når stabil 1.0 med normal ärendehistorik; webbläsarspåret blir förstklassigt (inte workaround); eller @react-pdf/renderer:s underhåll viker. Tills dess är pdfcn/Takumi/Forme en bevakningspunkt, inte ett alternativ. Ingen dubbelmotorabstraktion byggs i förväg; det befintliga mönstret (motoragnostisk datamontering, motorspecifik mall) är hela hedgen.

## Konsekvenser

- Rapportslicen bygger vidare på `BrandedDocument`/`BrandedPage`/`Cover`/`Section` och tvåpass-TOC-mönstret.
- Kitets kända luckor byggs vid behov i kitet (flersidiga tabeller, avsnittsnumrering, chart-söm) i stället för att motivera ett motorbyte.
- Installera aldrig npm-paketet `forme` (ett dött, orelaterat paket från 2018); Formes riktiga paket är scopeade under `@formepdf/*`.

## Tillägg 2026-08-31: chart-sömmen avgjord (appens shadcn-diagram i PDF:en)

Rapporten ska bära appens egna shadcn/recharts-diagram (ägarens direktiv). Två vägar utvärderades mot primärkällor:

**react-pdf-charts avvisades.** Biblioteket (EvHaus/react-pdf-charts, som översätter recharts-element till react-pdf-primitiv) stödjer inte recharts v3, som denna repo pinnar (3.8.0): dess peer-krav stannar på v2 och v3-stödet är ett öppet ärende (EvHaus/react-pdf-charts#623). Grundproblemet ligger uppströms: recharts v3:s SSR-rendering via `renderToStaticMarkup` returnerar en tom wrapper (recharts#5997), och utanför en webbläsare finns ingen CSSOM, så shadcn-temats `var(--color-*)` kan aldrig lösas upp. En nedgradering till recharts v2 för PDF:ens skull vore bakvänd.

**Vald väg: rasterisering av appens levande diagram** (`apps/dashboard/lib/chart-capture.ts`). Vid export monterar nedladdningskomponenten diagramkomponenterna (exporterade ur `pay-mapping-overview.tsx`) i en dold värd utanför viewporten, inlinar varje målningsrelevant beräknad stil (vilket löser upp temats CSS-variabler till literala värden), serialiserar SVG:n, rastrerar via canvas i 3x och bäddar in PNG:n som `<Image>` i mallen. Tre fallgropar hittades vid verifiering i webbläsare och är inbyggda i lösningen:

1. **Animering i dolda flikar.** recharts monteringsanimation drivs av `requestAnimationFrame`, som aldrig triggar i en dold eller minimerad flik; en animerad capture där fryser diagrammets tomma första bildruta (text utan staplar). Värden monterar därför diagrammen med `animate={false}` (`isAnimationActive={false}` på varje mark).
2. **Typsnittsfallback.** next/font-stacken namnger bara familjer sidan själv registrerar; i en fristående SVG-bild finns ingen av dem, och en stack utan träff faller till serif. Capturen appenderar `Helvetica, Arial, sans-serif` på varje `font-family`.
3. **Absoluta url-referenser.** Beräknade stilvärden bakar in dokumentets URL i lokala referenser (`url("http://host/sida#hatch")`); i en fristående SVG pekar det på en extern resurs bilden inte får hämta och mönsterfyllnaden försvinner tyst. Capturen skriver om till fragmentformen (`url(#hatch)`).

**Invarianten:** varje capture-slot är valfri och mallen behåller en handritad vektorvariant (`pay-mapping-report-charts.tsx`) som fallback per diagram, så det lagstadgade dokumentet aldrig beror på att rasterisering lyckas (t.ex. i en miljö utan 2d-canvas). Capture-tokens pinnar ljusa temavärden, så en export från mörkt läge fortfarande ger ett ljust dokument.
