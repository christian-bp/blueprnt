# Kontextkarta

blueprnt är modellerad som flera avgränsade kontexter (bounded contexts). Ordlistorna ligger just nu under `docs/contexts/<namn>/CONTEXT.md` och flyttas intill sin kod (t.ex. `packages/backend/convex/<namn>/`) när de paketen scaffoldas.

Kod-identifierare (Convex-tabeller, typer, funktioner) skrivs på engelska. Ordlistorna är på svenska men anger engelsk kod-term inom parentes så att doc-språk och kod hänger ihop.

Varje ordlista har en sektion **Översättningssträngar (i18n)** med svenska + engelska för de mest använda begreppen, så att domändokumenten också fungerar som källa för översättningarna. Nyckelformatet är bibliotek-neutralt (punktnamnrymd, t.ex. `model.criterion`); svenska är standardspråk, engelska är andraspråk.

Terminologi (ADR-0014, 2026-08-05): **Nivå** (kod `level`) är rollens beräknade tyngd, tidigare Band. **Senioritet** (kod `seniority`) är individens senioritet inom rollens track, tidigare Nivå. **Steg** (kod `step`) är ett läge på kriteriets bedömningsskala, tidigare nivå. Äldre ADR-texter behåller sina ursprungliga ord.

Terminologi (ADR-0021/0022, 2026-08-18): bedömningsskalan är **1 till 5**; 0 finns bara på ett aktivt arbetsförhållandekriterium och betyder att rollen inte omfattas. **Dimension** är en av metodens fyra fasta värderingsdimensioner och aldrig ett kriterium. **Zon** (kod `zone`) är en av fyra grupper om tre nivåer, A högst och D lägst, strukturlag och aldrig ett bedömningsfält. **Profilkriterium** är ett kriterium viktat till 4 eller 5, härlett och aldrig lagrat. Mallen är pensionerad: **kriteriebiblioteket** ersatte den.

## Kontexter

- [Konton (accounts)](./docs/contexts/accounts/CONTEXT.md) — organisationer (tenants), medlemmar och behörighetsroller. Bygger på Better Auth-organisationer.
- [Värderingsmodell (evaluation-model)](./docs/contexts/evaluation-model/CONTEXT.md) — den konfigurerbara jobbarkitekturen + poängmodellen: kriterier ur biblioteket, viktpoäng (poängbudget), track/senioritet, nivåindelning i tolv nivåer och fyra zoner, godkännande som status; live-omräkning (ingen versionering i V1).
- [Värdering (assessment)](./docs/contexts/assessment/CONTEXT.md) — roller och deras blindade värderingar: betyg, totalpoäng, nivåutfall, kalibrering.

- **Personer (people)** — medarbetare (dataminimerade persondata) och koppling medarbetare↔roll (rollplacering med individens senioritet, ADR-0005). Byggd; ordlista under docs/contexts/ saknas ännu.
- **Lönekartläggning (payMapping)** — lönedata och lika/likvärdigt arbete-analys (lönekartläggning, ADR-0011/0012). Striktare minimering än övriga kontexter; assessment förblir alltid fri från person-/lönedata. Byggd; ordlista under docs/contexts/ saknas ännu.

Tvärgående moduler utan egen ordlista: **platform** (plattformsadmin, ADR-0009), **ai** (AI-förslag, ADR-0003), **email** (utskick via Sweego-komponenten), **assistant** (chattassistenten, ADR-0018), **docs** (dokumentationens sökindex, ADR-0019/0020).

**docs**-kontexten äger dokumentationens sökindex: komponenten `@convex-dev/rag`, med en namnrymd per locale och en post per dokumentationssida, som assistentens `search_docs`-verktyg (ADR-0018/0020) läser via vektorsökning. Källan till sanning är MDX-korpusen under `apps/dashboard/content/docs/{en,sv,nb,da,fi}`, inte indexet; indexet innehåller ingen persondata och är fullständigt återuppbyggbart när som helst via `bun run docs:sync`, oavsett indexets skick.

## Relationer

- **Konton → allt**: varje post hör till en organisation (tenant). Convex-funktioner upprätthåller org-scoping.
- **Värderingsmodell → Värdering**: en värdering använder organisationens **aktuella** modell (kriterier, viktpoäng, track/senioritetsschema) mot metodens fasta nivåtrösklar och zonprofilkrav (ADR-0024). Poäng och nivå härleds live från sparade betyg + aktuell modell (ingen versionering i V1).
- **Värdering → Värderingsmodell**: en roll bär en track hämtad från modellens jobbarkitektur-vokabulär. Senioriteterna i schemat är referensdata för V2:s rollplacering (senioriteten sätts på individen, ADR-0005).
