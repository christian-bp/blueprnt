# Kontextkarta

blueprnt är modellerad som flera avgränsade kontexter (bounded contexts). Ordlistorna ligger just nu under `docs/contexts/<namn>/CONTEXT.md` och flyttas intill sin kod (t.ex. `packages/backend/convex/<namn>/`) när de paketen scaffoldas.

Kod-identifierare (Convex-tabeller, typer, funktioner) skrivs på engelska. Ordlistorna är på svenska men anger engelsk kod-term inom parentes så att doc-språk och kod hänger ihop.

Varje ordlista har en sektion **Översättningssträngar (i18n)** med svenska + engelska för de mest använda begreppen, så att domändokumenten också fungerar som källa för översättningarna. Nyckelformatet är bibliotek-neutralt (punktnamnrymd, t.ex. `model.criterion`); svenska är standardspråk, engelska är andraspråk.

## Kontexter

- [Konton (accounts)](./docs/contexts/accounts/CONTEXT.md) — arbetsytor (tenants), medlemmar och behörighetsroller. Bygger på Better Auth-organisationer.
- [Värderingsmodell (evaluation-model)](./docs/contexts/evaluation-model/CONTEXT.md) — den konfigurerbara jobbarkitekturen + poängmodellen: kriterier, vikter, track/nivå, bandindelning, mallar; live-omräkning (ingen versionering i V1).
- [Värdering (assessment)](./docs/contexts/assessment/CONTEXT.md) — roller och deras blindade värderingar: betyg, totalpoäng, bandutfall, kalibrering.

**Reserverade framtida kontexter (V2, byggs inte i V1):**
- **people** — medarbetare (dataminimerade persondata) och koppling medarbetare↔roll (rollplacering).
- **pay** — lönedata och lika/likvärdigt arbete-analys (lönekartläggning). Striktare behörighet/minimering än V1-kontexterna. Assessment förblir alltid fri från person-/lönedata.

## Relationer

- **Konton → allt**: varje post hör till en arbetsyta (tenant). Convex-funktioner upprätthåller org-scoping.
- **Värderingsmodell → Värdering**: en värdering använder arbetsytans **aktuella** modell (kriterier, vikter, track/nivå-schema, bandtrösklar). Poäng och band härleds live från sparade betyg + aktuell modell (ingen versionering i V1).
- **Värdering → Värderingsmodell**: en roll bär en track + nivå hämtad från modellens jobbarkitektur-vokabulär.
