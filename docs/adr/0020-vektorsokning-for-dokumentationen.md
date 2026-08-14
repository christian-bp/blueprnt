# ADR-0020: Vektorsökning för dokumentationen (ersätter ADR-0019 punkt 3)

**Status:** accepterad (2026-08-14)

## Kontext

ADR-0019 punkt 3 valde ett Convex-fulltextindex per locale, i tabellen
`docsChunks`, som dokumentationens sökcache, med semantisk sökning noterad
som ett möjligt framtida steg om träffbilden inte räckte. Det steget är nu
mätt och taget.

Mätningen kördes mot samma tolv realistiska frågor per språk, mot det
levande indexet, med en träff definierad som att rätt sida syns bland de
fem första resultaten:

- Engelska: fulltext 7 av 12, vektorsökning 13 av 13.
- Svenska: fulltext 5 av 12, vektorsökning 12 av 13.

Convex fulltextindex böjer eller stammar inget ord för något språk, så
svenska böjningsformer och sammansättningar missade rakt av:
"tvåfaktorsinloggning" matchade aldrig "tvåfaktorsautentisering",
"betygsätter" matchade aldrig "betygsätta". Vektorsökningen regredierade på
en enda svensk fråga ("vad händer med lönekartläggningen vid radering"),
som fulltextsökningen hittade och vektorsökningen inte. Det ska sägas
rakt ut som en känd kostnad, inte döljas bakom totalsiffrorna.

## Beslut

1. Sökmotorn byts till komponenten `@convex-dev/rag`.
   `packages/backend/convex/docs/rag.ts` innehåller de tre actionsen
   `indexPage`, `sweepLocale` och `searchDocs`. `docs/hits.ts` mappar
   komponentens sökresultat till assistentens länkade träffar och hålls
   åtskilt från `rag.ts`, eftersom `rag.ts` är `"use node"` medan
   mappningen ska vara enhetstestbar för sig.
2. Locale är namnrymden (namespace), inte ett filter. En namnrymd är bunden
   till en enda embeddingmodell och embeddingdimension, och locales söks
   aldrig tillsammans, så den engelska reservsökningen är bara en andra
   sökning i namnrymden `en`, inte ett filtervillkor på samma sökning.
3. En post per dokumentationssida, nycklad på slug, med sidans hash som
   innehållshash, så en oförändrad sida kostar inget embeddinganrop vid
   omsynk.
4. Slug och ankare ligger på varje chunks metadata, inte på postens,
   eftersom ankaret är det som gör en träff till en djuplänk och det
   skiljer sig per avsnitt på samma sida.
5. En reservträff från `en` får sitt ankare undertryckt: ankare härleds ur
   översatta rubriker, och ett engelskt ankare finns inte på läsarens egen
   sida. En sådan träff länkar till sidans topp, inte till avsnittet.
6. Embeddings är `mistral-embed` (1024 dimensioner) på Mistral La
   Plateforme. ADR-0001 (EU-datalagring) och ADR-0003 (AI-anrop endast i
   Convex actions, endast EU-hostade modeller) gäller oförändrat. Att
   embedda dokumentationen skickar bara roll- och produktnivåtext, aldrig
   persondata, så invarianten om att ingen persondata går till AI-modeller
   är orörd.
7. Frågesidans embedding är ett modellanrop som spenderar organisationens
   tokens och skriver därför en rad i `aiUsageEvents`
   (`kind: "assistant.docsSearch"`). Korpussidans indexering är ett offline
   byggsteg utan organisation och loggas inte där.
8. Inmatningen förblir push-baserad: komponenten läser aldrig filer själv,
   så `bun run docs:sync` (nu med ett valfritt locale-argument) krävs
   fortfarande efter varje ändring under `apps/dashboard/content/docs/`.
   Regeln är införd i CLAUDE.md.
9. Convex-tabellen `docsChunks`, `docs/sync.ts`, `docs/search.ts` och deras
   tester är borttagna. Tabellen är borta ur `schema.ts` och `devReset.ts`.

## Konsekvenser

- ADR-0019 punkt 3 (docsChunks som härledd fulltextcache) är ersatt av
  denna ADR. Övriga punkter i ADR-0019 gäller oförändrat.
- Regressionen på den svenska raderingsfrågan (se Kontext) är en känd
  kostnad som accepteras, inte ett fel som ska rättas till innan detta
  beslut gäller.
- Komponenten levererar en `hybridRank`-hjälpfunktion (Reciprocal Rank
  Fusion) för den dag ett lexikalt index återinförs vid sidan av
  vektorsökningen. Ingen sådan kombination finns idag.
- Komponenten är låst till exakt version `0.8.0-alpha.0`, inte ett
  intervall, eftersom den stabila linjen (0.7.5) hårdberor på AI SDK 6
  medan assistentens strömningsloop är skriven mot AI SDK 7; det är den
  enda publicerade byggen vars peer-intervall accepterar AI SDK 7. Detta är
  en avsiktlig kortslutning före lansering (go-live-checklistan).
- En ny deployment har ett tomt index tills `bun run docs:sync` körts mot
  den; fram till dess svarar assistenten utan dokumentationsunderlag
  (go-live-checklistan).
- CONTEXT-MAP.md:s beskrivning av `docs`-kontexten uppdateras till
  komponenten i stället för den borttagna tabellen.

## Tillägg 2026-08-14: hybrid mätt och avvisad, en kalibrerad relevansgräns

**Rättelse: hybridsökning finns redan.** Konsekvenser ovan säger att
komponenten saknar kombinerad lexikal- och vektorsökning och nämner
`hybridRank` som ett framtida alternativ. Det stämmer inte för den låsta
versionen. `@convex-dev/rag@0.8.0-alpha.0` stöder
`searchType: "vector" | "text" | "hybrid"` med `textWeight`/`vectorWeight`,
kör Reciprocal Rank Fusion internt, och underhåller redan ett fulltextindex
över varje skriven chunk (`state.searchableText`), så hybrid kräver ingen
omindexering.

**Hybrid mättes och valdes bort.** Mätt med det nya verktyget
`bun run docs:eval`, recall@5 över 13 frågor per språk:

- Vektor: engelska 13 av 13, svenska 12 av 13 (totalt 25 av 26).
- Hybrid: engelska 12 av 13, svenska 12 av 13 (totalt 24 av 26).

Hybrid ÅTERVINNER den enda svenska frågan som noterades ovan som en
permanent regression ("vad händer med lönekartläggningen vid radering"),
men tappar i stället en annan fråga per språk: engelska "how often must a
pay mapping be done" och svenska "vad är skillnaden mellan nivå och
senioritet". Beslutet att stå fast vid ren vektorsökning gäller alltså
fortfarande, nu på mätt grund i stället för den felaktiga föreställningen
att hybrid inte gick att använda. Hybrid är fortsatt ett argument bort om
korpusen eller frågeblandningen ändras.

**Nytt beslut: en kalibrerad relevansgräns.** `vectorScoreThreshold` var
osatt, och komponenten defaultar den till -1, så varje fråga fick sina fem
närmaste chunkar oavsett hur irrelevanta de var. Visat konkret: att fråga
den svenska assistenten om morgondagens väder i Stockholm gav fem riktiga
dokumentationsutdrag med levande djuplänkar, trots att systemprompten ber
modellen föredra sökresultat. Gränsen är nu
`AI_DOCS_SCORE_THRESHOLD = 0.65` (`packages/backend/convex/ai/config.ts`).

Kalibreringen redovisas med sin begränsning:

- Vid `0.65` är recall oförändrad på båda språken (en 13 av 13, sv 12 av
  13, identiskt med ingen gräns alls), och de svagaste engelska
  off-topic-träffarna faller bort (live: en engelsk off-topic-fråga gick
  från 5 träffar till 2).
- Gränsen löser INTE off-topic-träffar på svenska. Svenska off-topic-frågor
  poängsätter över `0.70`, och den första gränsen som tystar dem (`0.75`)
  sänker samtidigt svensk recall från 12 av 13 till 8 av 13. De två
  poängpopulationerna överlappar, så ingen enskild cosinusgräns skiljer dem
  åt.
- Relevansbedömningen ligger därför fortsatt hos modellen: systemprompten
  säger nu att sökningen returnerar sina närmaste träffar även när
  dokumentationen inte täcker frågan, och att en svag träff inte är ett
  svar.

**Mätverktyget.** `bun run docs:eval` (`apps/dashboard/scripts/eval-docs.ts`)
mäter recall@5 mot en incheckad frågeuppsättning
(`apps/dashboard/lib/docs/eval-probes.ts`: 13 frågor per språk plus en
off-topic-uppsättning). Det är opt-in och ingår inte i testsviten, eftersom
det kostar ett embeddinganrop per fråga och kräver en levande synkad
deployment. Det finns så att en chunkerändring, en `CHUNKER_VERSION`-höjning
eller ett embeddingmodellbyte har något att mäta mot i stället för att
bedömas på känn.

**Var innehållshashgrinden faktiskt ligger.** Beslutspunkt 3 ovan om att en
oförändrad sida inte kostar något embeddinganrop stämmer fortfarande, men
inte tack vare komponenten: komponentens `rag.add` embeddar innehållet
INNAN den jämför hashar, för varje sida under 100 chunkar (varje sida i
denna korpus), så utan en egen grind embeddades en oförändrad sida på varje
synk. Grinden ligger i vår egen `indexPage`
(`packages/backend/convex/docs/rag.ts`) via `findEntryByContentHash`, inte
i komponenten.
