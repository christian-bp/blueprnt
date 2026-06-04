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
