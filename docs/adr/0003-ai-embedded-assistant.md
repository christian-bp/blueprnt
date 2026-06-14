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

**Varför det är försvarbart:**

- Texten rör aldrig den deterministiska poäng-/bandvägen (ADR-0002 gäller oförändrat): poäng/band härleds enbart ur HR:s betyg, aldrig ur profiltexten.
- Utkastet är fritt redigerbart (i värderingsstegets manuella reservvy om generering misslyckas, och i instrumentpanelens rollvy), så HR behåller kontrollen, bara inte som ett blockerande per-post-steg.
- Proveniensen bevaras: varje ifyllning går via ett `role.profile`-förslag som auto-bekräftas plus en loggad AI-användningshändelse, så källa, modell och tidpunkt finns kvar i revisions-/telemetriloggen.

**Avgränsning:** Undantaget gäller endast onboardingens profil-ifyllning. Övriga AI-utdata (kriterieutkast, betydelsejusteringar, framtida betygsförslag) kräver fortsatt explicit HR-bekräftelse per post enligt ovan.
