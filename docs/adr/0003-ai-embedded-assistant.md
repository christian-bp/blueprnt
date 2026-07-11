# AI som inbäddad assistans — utanför den deterministiska kärnan

**Status:** accepterad

blueprnt ska vara tight AI-integrerat, men AI hålls **utanför** den deterministiska poäng-/bandvägen (`packages/core` förblir ren och reproducerbar). AI används som **inbäddad assistans** i flödet (inte en chatbot): den tar fram *indata* (t.ex. jobbprofil-utkast, ankartext-utkast) och *förklaringar* — aldrig slutgiltiga betyg/band. Alla AI-utdata är **förslag** med proveniens (källa: AI/HR, status: föreslagen → bekräftad); HR bekräftar alltid, och förslag/bekräftelser loggas i revisionsloggen.

Systemet byggs **AI-redo från dag 1** (förslagslager + proveniens + AI-anrop via Convex actions), men V1 skeppar bara lågrisk-assist: **generera jobbprofil från titel/beskrivning** (och ev. ankartext-utkast). Känsligare assist (AI-betygsförslag, kalibrerings-/biaskoll, copilot) läggs på senare när kärnan + blindningen är beprövad.

## Avvägning / varför

- Att låta AI röra poäng/band eller auto-besluta skulle rasera "objektivt, försvarbart, icke-gamat" — själva EU-direktiv-poängen. Förslag + HR-bekräftelse + logg bevarar det.
- "Aldrig chatbot": inbäddade knappar/utkast/varningar ger bättre UX och håller AI:n inom väldefinierade, granskbara punkter.

## Konsekvenser

- **EU-residens gäller även AI:** i samma stund AI rör rolldata måste en **EU-hostad modell** med no-training-DPA användas (Mistral EU / Azure OpenAI EU / Bedrock EU / självhostad). Provider-val: öppet (egen ADR senare). Annars bryts ADR-0001.
- Datamodellen får ett **förslagslager** (förslag med proveniens/status) skilt från bekräftade värden.
- AI-anrop sker i Convex actions (serverside, nycklar skyddade); leverantören hålls utbytbar (t.ex. via en AI-SDK-abstraktion).
- Determinismen i `packages/core` påverkas inte.

## Tillägg 2026-06-04: modellassistans i onboardingen och leverantörsval

**Scopeutökning (V1):** utöver jobbprofilgenerering omfattar V1 även AI-assistans i onboardingens modellsteg: utkast på kriterier (namn, beskrivning, hjälptext, betydelseetikett, ankartexter) i från scratch-vägen, samt förslag på betydelsejusteringar i mallvägen. Samma regler gäller: förslag med proveniens och status, HR bekräftar per post, inget tillämpas automatiskt, och bekräftelser revisionsloggas (ai.suggestionConfirmed). Statuslivscykeln utökas med "generating" och "failed" (felkod som i18n-nyckel, aldrig display-text).

**Leverantörsbeslut:** Mistral La Plateforme anropas direkt från Convex actions via AI SDK v6 (generateText + Output.object). EU-processing, ingen träning på betald API enligt DPA; Zero Data Retention begärs i DPA:t (godkännandepliktigt, inte självbetjäning). Dokumenterad fallback: Azure OpenAI EU Data Zone (Sweden Central). **Vercel AI Gateway används aldrig i datavägen:** den kan inte pinna EU-routing och bryter därmed EU-datahemvisten (ADR-0001).

## Tillägg 2026-06-14: automatisk ifyllning av jobbprofil i onboardingen

**Scopeundantag (V1):** I onboardingens värderingssteg fylls varje rolls *syfte* och *ansvarsområden* i automatiskt med ett AI-utkast härlett ur rollens titel, utan ett blockerande HR-bekräftelsesteg per post. Det är ett medvetet undantag från regeln "inget tillämpas automatiskt" ovan, avgränsat till just denna profil-ifyllning. Ifyllningen körs när användaren går vidare från rollsteget: nya och omdöpta roller får ett namnhärlett utkast, medan oförändrade roller (som redan har en profil) lämnas orörda, så inget AI-anrop sker utan en faktisk ändring.

**Ett anrop per uppsättning:** Alla rollens tomma profiler genereras i ETT strukturerat objekt-anrop (generateText + Output.object) som returnerar en post per roll. Varje post ekar tillbaka det index rollen fick i prompten, och utdatat mappas till rätt roll via det ekade indexet (aldrig via positionen i listan); en omordnad, för kort eller för lång respons (indexmängden matchar inte exakt inmatningen) förkastas som ett misslyckat anrop, så ingen profil kan hamna på fel roll. Endast en ovanligt stor uppsättning delas upp i ett fåtal sekventiella anrop under ett tak (PREFILL_MAX_PER_CALL); normalfallet är exakt ett anrop. Ett anrop som misslyckas lämnar just det anropets roller tomma (inget partiellt skriv) utan att avbryta övriga.

**Varför det är försvarbart:**

- Texten rör aldrig den deterministiska poäng-/bandvägen (ADR-0002 gäller oförändrat): poäng/band härleds enbart ur HR:s betyg, aldrig ur profiltexten.
- Utkastet är fritt redigerbart (i värderingsstegets manuella reservvy om generering misslyckas, och i instrumentpanelens rollvy), så HR behåller kontrollen, bara inte som ett blockerande per-post-steg.
- Proveniensen bevaras: AI-användning loggas en gång PER ANROP (en aiUsageEvents-rad med org, modell, leverantör, token och tidpunkt) och varje tillämpad roll får en `role.updated`-revisionsrad. Ifyllningen skapar inte längre per-roll-`role.profile`-förslag; det per-anrops-loggade användningseventet plus per-roll-revisionsraden är proveniensen.

**Avgränsning:** Undantaget gäller endast onboardingens profil-ifyllning. Övriga AI-utdata (kriterieutkast, betydelsejusteringar, framtida betygsförslag) kräver fortsatt explicit HR-bekräftelse per post enligt ovan.

## Tillägg 2026-07-10: skeppade AI-ytor, chunkning, SDK-version och interaktiva utkast

Denna not korrigerar drift mellan ADR-texten ovan och den faktiska koden (koden är rätt; noten uppdaterar dokumentet).

**Skeppade V1 AI-ytor (utöver de ovan).** Två ytterligare AI-funktioner har skeppats och saknades i scope-listan:

- **Starter-import:** HR klistrar in organisationens roller och AI:n grupperar dem i rollfamiljer (`ai/suggest.ts` `requestStarterImport` + `ai/generate.ts` `generateStarterImport`). Går via förslagslagret (förslagsrad + `ai.suggestionConfirmed`) och bekräftas av HR, enligt huvudregeln.
- **Kriterie-efterlevnadsutkast med biasgranskning:** `ai/draft.ts` `draftCriterionCompliance` + `ai/generate.ts` `generateCriterionComplianceText` genererar syfte/relevans/överlapp plus en biasbedömning (biasRisk/biasComment/biasAction) för ett kriterium.
- Den uppskjutna "kalibrerings-/biaskoll" i inledningen avser **betygskalibrering** (AI som granskar HR:s betyg), inte kriteriedokumentationens biasgranskning ovan, som är byggd.

**Chunkning (korrigerar "ett anrop per uppsättning" i 2026-06-14-tillägget).** Onboarding-ifyllningen delar alltid upp uppsättningen i bitar om högst `PREFILL_MAX_PER_CALL = 5` roller per anrop och kör bitarna i konfigurerbara samtidighetsvågor (`PREFILL_CONCURRENCY`, sekventiellt som standard). En typisk uppsättning (fler än 5 roller) blir alltså `ceil(n/5)` strukturerade anrop, ett `aiUsageEvents`-event per anrop; index-ekomappningen och den exakta mängdvalideringen gäller per bit. "Exakt ett anrop" gäller bara uppsättningar om högst 5 roller.

**AI SDK-version.** Backend kör AI SDK v7 (`ai: ^7.0.2`), inte v6. Mekaniken är oförändrad (generateText + Output.object, Mistral La Plateforme direkt via `@ai-sdk/mistral`, ingen AI-gateway i datavägen).

**Interaktiva utkast ("fyll formuläret") kontra förslagslagret.** De interaktiva utkasten `draftRoleProfile` och `draftCriterionCompliance` returnerar text direkt till klienten som fyller redigeringsformuläret; HR granskar och redigerar i formuläret och sparar sedan via `updateRole`/`saveCriterionCompliance`. Den sparade texten är därmed människo-författad (HR granskar och redigerar före spar) och revideras som en vanlig `role.updated`/`modelUpdated`-rad, inte via `ai.suggestionConfirmed`. Detta är ett medvetet mönster, skilt från bekräfta-ett-förslag-flödet: utkastet är en startpunkt, inte ett autotillämpat förslag.

**Beslut (2026-07-10):** revisionsspåret markerar avsiktligt **inte** AI-assistans på dessa sparade rader. Människan som granskar, redigerar och sparar texten är dess författare och ansvarig för innehållet. En `source: "ai"`-markör vore dessutom missvisande eftersom mutationen bara ser den slutgiltiga texten och inte kan veta hur mycket av AI-utkastet som överlevde redigeringen. Detta skiljer sig från förslagslagrets flöden (modellutkast, viktgranskning, starter-import), som är helt AI-genererade tills HR bekräftar dem och därför bär full proveniens.

*Denna not är utkastad av en assistent; den svenska texten bör granskas av en modersmålstalare.*
