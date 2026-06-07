# Aggregat i dokument, entiteter i tabeller

**Status:** accepterad (2026-06-07)

Datamodellen följer en uttalad regel: **barn som är existentiellt beroende av sin förälder, alltid läses tillsammans med den och aldrig refereras med id utifrån (aggregat) lagras som arrayer i förälderns dokument. Allt som refereras med id från andra tabeller eller skrivs på en egen väg (entiteter) förblir egna tabeller.** Konkret:

- **Bedömningsankare bäddas in i `criteria`** (`anchors: [{level, text}]`, alltid exakt 6). Tabellen `criterionAnchors` utgår.
- **Bandtrösklar bäddas in i `models`** (`bandThresholds: [{band, minScore}]`, alltid exakt 7). Tabellen `bandThresholds` utgår.
- **Tabellerna `tracks` och `levels` utgår.** Track-schemat är fast i V1 (IC/Lead/M, PLAN-V1 §9.6) och namnen lokaliseras redan per nyckel vid läsning; raderna var utstämplade konstanter. Roller bär `trackKey` ("IC" | "Lead" | "M", schemavaliderad literal-union) i stället för `trackId`. Nivådefinitionerna består som referensdata i [standardmall.md](../contexts/evaluation-model/standardmall.md) i väntan på V2:s rollplacering (ADR-0005); de seedas inte längre per organisation.

Schemat går från 13 till 9 tabeller. `getModel` går från ~14 indexläsningar till 2, `deriveResults` (appens hetaste väg: körs två gånger per resultatpåverkande mutation) tappar en läsning, och tre mutationers orphan-städning försvinner.

## Avvägning / varför

- **Convex saknar joins och lagrar dokument som JSON.** Normaliserade barn betyder en query per förälder (N+1 i `getModel`); inbäddade barn är typvaliderade via `v.array(v.object(...))` precis som kolumner. Convex egna riktlinjer varnar för **obegränsade** arrayer i dokument; våra är hårt begränsade (6 ankare, 7 trösklar), vilket är exakt fallet där inbäddning är rätt. Värsta fallet för ett kriteriedokument är ~12 KB mot dokumenttaket 1 MiB.
- **Korrekthet via konstruktion i stället för via disciplin.** "Ett kriterium har exakt 6 ankare" och "trösklarna hör till modellen" upprätthölls av mutationskod som måste komma ihåg att städa (removeCriterion, discardModel, removeSeededOrganization). Inbäddat kan invarianten inte brytas: ankarna kan inte överleva sitt kriterium, en tröskeländring kan inte bli halvgjord. E2:s modellredigering (ankartexter, trösklar) landar på atomiska array-patchar i stället för radavstämning.
- **Nyckeln är referensen, inte rad-id:t.** Roller som bär `trackKey` överlever en framtida konfigurerbar tracks-tabell (V2+): en sådan nycklas naturligt på (orgId, key) och blir ett tillägg med metadata, ingen migrering av rollreferenser.
- **OCC-granularitet:** tröskelredigering blir atomisk per definition; kriterieredigering är oförändrad (fortfarande ett dokument per kriterium); betygsflödet behåller sin egen skrivväg.

## Det som uttryckligen INTE bäddas in

Gränsdragningen är beslutets kärna; allt som växer med användningen förblir rader:

- **`criteria` förblir tabell:** `ratings.criterionId` och `suggestions.target` refererar kriterier med id, borttagning beskär betyg via `ratings.by_criterion`-indexet, och AI-confirm validerar id:n med `normalizeId` vid förtroendegränsen.
- **`ratings` förblir tabell:** sanningskällan (ADR-0002), egen skrivväg som inte ska OCC-krocka med profilredigering, beskärs per kriterium via index, och V2:s frysta lönekartläggningskopior kopierar rader rent.
- **`roles`, `roleFamilies`, `suggestions`, `auditLog`, `users`, `organizations`, `emails` förblir tabeller:** riktiga entiteter respektive loggar. `suggestions.suggestedValue` är redan en JSON-kolumn med Zod-validering vid läsning, rätt användning av mönstret.

## Konsekvenser

- `criterionAnchors`, `bandThresholds`, `tracks` och `levels` raderas ur schemat (pre-launch tas ersatta saker bort direkt, se CLAUDE.md). Dev- och prod-data nollställs vid utrullning.
- `roles.trackId` ersätts av `roles.trackKey`; `createRole`/`updateRole` validerar mot literal-unionen i schemat och behöver ingen db-läsning.
- `getModel` härleder tracks-svaret ur konstanterna (`TRACK_KEYS` + lokaliserade namn), samma trådformat som tidigare minus rad-id:n.
- Den döda `GUARDRAILS`-konstanten raderas ur koden (referensdata finns i standardmall.md sedan ADR-0005).
- Beslutsregeln gäller framåt: nya barnstrukturer med fast, liten kardinalitet som alltid läses med föräldern bäddas in; allt med externa id-referenser eller oberoende skrivvägar får tabell.

## Övervägda alternativ

- **Behålla full normalisering (13 tabeller):** fungerade, men betalade N+1-queries, orphan-städning i tre mutationer och radavstämning i kommande E2-redigering för en integritet som dokumentinbäddning ger gratis. Bortvald 2026-06-07.
- **Bädda in även kriterier (och betyg) i modell-/rolldokumenten:** maximalt aggregerat, men bryter id-referenserna från `ratings`/`suggestions`, tvingar egna sträng-id:n och slår ihop oberoende skrivvägar till ett OCC-hett dokument. Bortvald.
- **Behålla `tracks`/`levels` som seedade tabeller för V2-flexibilitet:** raderna hade noll läsare utöver uppslag som redan lokaliserade per nyckel; V2 återinför en tabell när verkliga krav finns, utan att rollreferenserna behöver migreras. Bortvald.
