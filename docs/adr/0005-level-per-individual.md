# Nivå per individ: roller bär track, inte nivå

**Status:** accepterad (2026-06-07)

En roll bär en **track** (vilken sorts jobb: IC/Lead/M) men **ingen nivå**. Nivån beskriver **individens senioritet inom rollens track** och sätts på medarbetaren när people-kontexten byggs (V2): rollen "System Developer" är IC, medan Bo kan vara IC1 och Axel IC4 i samma roll. Detta reviderar källdokumentet [track-level-band.md](../contexts/evaluation-model/track-level-band.md), som beskrev roller som nivåroller ("Software Developer - IC2") med nivån satt på rollen.

## Avvägning / varför

- **Värderingsobjektet matchar lönekartläggningens gruppindelning.** I svensk lönekartläggning (DO:s praxis) är "lika arbete"-gruppen *rollen*: alla systemutvecklare som utför väsentligen samma arbete bildar en grupp, arbetsvärderingen görs per grupp, och senioritet förklarar löneskillnader *inom* gruppen. Nivåroller splittrade gruppen i konstgjorda undergrupper (en grupp per nivå), vilket avvek från hur analysen faktiskt görs.
- **Enklare setup.** Färre objekt att skapa och underhålla: ett jobb är en roll, inte fem. Ligger i linje med designprincipen enkelhet för användaren (PLAN-V1 §1).
- **Ventilen som gör modellen hållbar:** om seniorens *arbete* faktiskt skiljer sig (en "Senior System Developer" som arkitekterar och leder är ett annat jobb än en "System Developer") skapar organisationen det som en **egen roll**. Rollgranulariteten är organisationens val; systemet tvingar bara inte längre en nivå på varje roll.

## Konsekvenser

- `role`-tabellen refererar bara `trackId`; `levelId`-fältet är borttaget helt (pre-launch tar vi bort ersatta saker direkt i stället för att behålla legacy, se CLAUDE.md). *(Reviderat 2026-06-07: `trackId` ersattes av `trackKey` när tracks-tabellen utgick, se ADR-0006.)*
- **Ett band per jobb:** "System Developer" får en värdering och ett band oavsett vilka senioriteter som bemannar rollen. Karriärstegs-banding per nivå utgår ur V1.
- **Track-guardrails utgår ur V1.** De rådgivande min/max-intervallen var definierade per (nivå, kriterium) och har inget fäste när rollen saknar nivå; per track blir spannen meningslöst breda. Intervallen finns kvar som referensdata i [standardmall.md](../contexts/evaluation-model/standardmall.md) och kan återanvändas i V2 (t.ex. som placeringsstöd när individer får nivåer). `checkGuardrails` är borttagen ur motorn och `trackGuardrails`-tabellen ur schemat.
- **Nivådefinitionerna består som referensdata:** track-schemat (IC1–IC5, Lead 1–3, M1–M3) seedas fortfarande per modell och väntar på V2:s rollplacering (medarbetare placeras på en nivå inom rollens track). *(Reviderat 2026-06-07: nivåerna seedas inte längre per modell; definitionerna består enbart i standardmall.md, se ADR-0006.)*
- **Branschstartarna föreslår ett jobb per titel** (System Developer, Tech Lead, Engineering Manager) i stället för senioritetsvarianter per nivå.
- Glossarierna och PLAN-V1 uppdateras: Nivå omdefinieras (individens senioritet, V2), Roll är inte längre en nivåroll, jobbprofilens obligatoriska kärna tappar nivåfältet.

## Övervägda alternativ

- **Behålla nivåroller (källdokumentets linje):** mest trogen karriärarkitektur-tänket och ger band per senioritetssteg, men värderingsobjektet matchar inte lönekartläggningens grupper, och setupen blir tyngre. Bortvald 2026-06-07.
- **Nivå på både roll och individ:** dubblerad sanning med synkproblem. Bortvald.

## Tillägg 2026-07-10: nivådefinitionerna är nu en kodkonstant

Korrigering av konsekvensnoten ovan (2026-06-07: "definitionerna består enbart i standardmall.md"). V2:s rollplacering har delvis skeppat. Nivåladdarna (IC1–IC5, Lead-1..3, M1–M3) lever nu som konstanten `TRACK_LEVELS` i `@workspace/constants` (enda källan i kod) och driver aktiv validering av individ-till-roll-placering (`isValidLevelForTrack` i `people/assignments.ts`) samt nivåförslag; `standardmall.md` är prosareferens. Individens nivå lagras per `personAssignments`-rad. Rollen bär fortfarande bara `trackKey` (ingen nivå på rollen), och band beräknas fortfarande av motorn. `updateRole` blockerar dessutom ett track-byte som skulle lämna en aktiv tilldelnings nivå utanför den nya trackens ladder (`errors.roleTrackChangeBlocked`).

*Denna not är utkastad av en assistent; den svenska texten bör granskas av en modersmålstalare.*
