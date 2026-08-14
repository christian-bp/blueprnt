# ADR-0019: Dokumentation i appen som assistentens kunskapskälla

**Status:** accepterad (2026-08-13)

## Kontext

Produkten saknade användarvänd dokumentation, och assistentens produktkunskap
låg enbart i en handskriven systemprompt (ADR-0018) som driftar när produkten
ändras. Vi ville ha en omfattande hjälpyta i appen och en assistent som svarar
ur samma källa, på alla fem språk.

## Beslut

1. MDX-filer per locale i `apps/dashboard/content/docs/{en,sv,nb,da,fi}` är
   dokumentationens enda källa. Engelska är källspråket; övriga locales är
   maskinutkast flaggade för native-granskning (go-live-checklistan).
2. Dokumentationen renderas i appen på `/docs` och `/docs/[slug]`, inuti
   appskalet, med navstruktur i kod och titlar enbart i frontmatter.
   Appskalets inloggningsspärr (`AuthGate`) är klientsidig: den avgör efter
   hydrering vilket delträd webbläsaren visar, men sidkomponenterna läser
   och returnerar MDX-innehållet på serversidan utan någon sessionskontroll.
   Dokumentationens innehåll är därför inte åtkomstskyddat på serversidan.
   Det är godtagbart i dag eftersom korpusen är identisk för alla
   organisationer och saknar både organisations- och persondata. Sidorna är
   trots det inte publika: de länkas och serveras bara inuti appskalet.
3. Convex-tabellen `docsChunks` är en HÄRLEDD cache av MDX-filerna (chunk per
   H2-rubrik, fulltextindex per locale), återuppbyggbar när som helst via
   `bun run docs:sync`. Den redigeras aldrig för hand och innehåller ingen
   persondata, så ingen raderingskrok behövs.
4. Synkens hash täcker BÅDE den råa MDX-filen och chunkerversionen
   (`CHUNKER_VERSION`, exporterad från `apps/dashboard/lib/docs/chunk.ts`):
   `pageHash = sha256(CHUNKER_VERSION + rå MDX-text)`. Utan chunkerversionen i
   hashen skulle en ändring av chunknings- eller strippningsreglerna lämna
   gamla chunkar kvar i indexet tyst, eftersom sidans råtext (och därmed dess
   hash) är oförändrad även när utdatat från chunkningen ändras. Att höja
   `CHUNKER_VERSION` är därför obligatoriskt varje gång chunkningens utdata
   ändras för oförändrad indata, exakt för att tvinga fram en fullständig
   omsynk i stället för en tyst drift i sökindexet.
5. Synken är deploy-innehåll, inte en användarinitierad domänändring: den
   skriver ingen auditrad (utanför auditregelns omfång i CLAUDE.md).
6. Assistenten får ett femte read-only-verktyg, `search_docs`, som söker i
   användarens locale med fallback till engelska och länkar dokumentsidan.
   ADR-0018:s invarianter kvarstår oförändrade: enbart läsande verktyg, aldrig
   persondata i prompt, AI-anrop endast i Convex actions mot EU-hostade
   modeller, ingen skrivåtkomst.
7. Systemprompten förblir identitets- och gränslagret (kärnbegrepp,
   sidlista, regler); djupet bor i dokumentationen.

## Konsekvenser

- En ny produktyta eller ett nytt begrepp ska uppdatera dokumentationen i
  samma ändring; nio driftvakter (paritet, nav, länkar, termtäckning,
  feltäckning, prompt-rutter, rubrik-ankare m.fl.) gör utebliven uppdatering
  till ett rött test i stället för en tyst drift.
- Deployflödet kör `bun run docs:sync` efter `convex deploy` så cachen
  följer innehållet (go-live-checklistan spårar CI-kopplingen).
- Framtida steg om fulltextens träffbild inte räcker: semantisk sökning med
  EU-hostade embeddings, som ett utbyte av sökmotorn bakom samma verktyg.

## Tillägg 2026-08-14: sökmotorn är vektorbaserad (ADR-0020)

Punkt 3 ovan (docsChunks som en härledd Convex-fulltextcache) är ersatt:
sökningen görs nu av komponenten `@convex-dev/rag` med embeddings i stället
för ett fulltextindex, sedan en mätning visade att Convex fulltextsökning
missade en stor andel svenska och engelska testfrågor på grund av
avsaknaden av böjnings- och morfologistöd. Tabellen `docsChunks`,
`docs/sync.ts` och `docs/search.ts` är borttagna. Punkterna 1, 2 och 4-7
ovan står fast. Se [ADR-0020](./0020-vektorsokning-for-dokumentationen.md).
