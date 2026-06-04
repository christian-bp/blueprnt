# CLAUDE.md: projektregler för blueprnt

Projektspecifika regler för agenter och utvecklare. Fyll på vid behov. Håll reglerna korta och absoluta.

Se även: `AGENTS.md` (Next.js-versionsvarning + agent-skills-konfig) · `docs/PLAN-V1.md` (planen) · `CONTEXT-MAP.md` + `docs/contexts/` (domänordlistor) · `docs/adr/` (arkitekturbeslut, läs innan du ändrar arkitektur).

## Text & skrivstil

- **Använd aldrig tankstreck/em dashes (" — ")** i text vi skriver: UI-texter, dokument, kommentarer, commit-meddelanden. Använd punkt, komma, kolon eller parentes i stället.

## i18n: aldrig hårdkodad text

- **All användarvänd text går via i18n** (`next-intl` + `@workspace/i18n`). Skriv ALDRIG visningstext direkt i sidor/komponenter, inte ens "tillfälligt".
- Nya strängar läggs i **`packages/i18n/messages/sv.json` först** (svenska är grunden; `Messages`-typen genereras från den), och speglas därefter i **samtliga övriga språkfiler i samma mapp** (vilka språk som finns styrs av `routing.ts`). Typsystemet fångar nycklar som saknas i `sv`, men INTE i de andra. Håll dem i synk manuellt.
- Nyckelnamn: punktnamnrymd per kontext (`web.*`, `dashboard.*`, `accounts.*`, `model.*`, `assessment.*`). Domäntermernas nycklar definieras i ordlistornas i18n-tabeller. Förälder/blad-konflikt löses med `label`-undernyckel.
- **Språkbyte = full sidladdning** (vanlig `<a>` + `getPathname`), aldrig `<Link locale=...>`. Klientnavigering över locale-gränsen triggar Reacts script-tag-fel via next-themes.
- Backend (Convex) returnerar **felkoder/nycklar, aldrig visningstext**. Frontend översätter.
- Maskinöversatta språkfiler är utkast. Flagga nya översättningar för modersmålsgranskning.

## Domänspråk

- Använd ordlistornas kanoniska termer (`docs/contexts/*/CONTEXT.md`) i kod, issues och commit-texter. Kod-identifierare på **engelska** (kod-termen i ordlistan), domändokument på **svenska**.
- Band 1 = **högst**. Track = sorts jobb; Nivå = hur avancerat inom tracken; Band = uträknad tyngd. Förväxla aldrig.

## Arkitektur-invarianter (bryt aldrig utan ny ADR)

- `packages/core` är **ren och deterministisk**: inga Convex/Next-imports, inga sidoeffekter. Poäng/band härleds alltid av motorn och lagras inte (ADR-0002).
- **AI rör aldrig den deterministiska poäng-/bandvägen** och auto-beslutar aldrig. AI-utdata är förslag med proveniens som HR bekräftar (ADR-0003). AI-anrop endast i Convex actions, endast EU-hostad modell.
- **Roll ≠ Person:** `role`-/`rating`-tabellerna får aldrig bära person-, löne- eller prestationsfält. Roll-id är permanent och återanvänds aldrig.
- **Vikter visas aldrig som tal** för användare, alltid betydelse-etiketter (fast 7-skala).
- Varje Convex-funktion **org-scopas** (tenant-isolering). Ingen bandöverride. Resultatpåverkande ändringar loggas i revisionsloggen.
- All data inom **EU** (Convex eu-west-1; ADR-0001).

## Konventioner

- PDF:er från dokumenten byggs med `./docs/build-pdf.sh` (pandoc + typst), aldrig Chrome headless.
- Next.js 16: `proxy.ts` (inte `middleware.ts`); proxyn måste exportera en explicit funktion.
