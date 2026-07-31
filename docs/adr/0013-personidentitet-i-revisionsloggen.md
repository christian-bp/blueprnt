# Personidentitet diffas i revisionsloggen och pseudonymiseras vid radering

**Status:** accepterad 2026-07-31

Utlöst av en konkret bugg: när HR rättade en anställds namn skrev `updatePerson` en revisionsrad av typen `person.updated` med `changes: {}`. Loggen visade "Person uppdaterad" följt av "Inga fältnivåändringar registrerade". Ändringen var alltså inte spårbar: raden bevisade att någon rörde posten, men inte vad som ändrades eller från vad.

Orsaken var invarianten som gällde före denna ADR: `PERSON_AUDIT_FIELDS` uteslöt varje identifierande fält (`displayName`, `gender`, `externalRef`, `birthDate`, `title`) så att den append-only-loggen skulle överleva en radering PII-fri. Följden var att just de vanligaste redigeringarna (rätta ett namn, rätta ett anställningsnummer, korrigera kön) blev tomma rader. Revisionsspåret var PII-fritt men bevisade ingenting.

## Beslut

1. **Varje persondatafält diffas i revisionsloggen**, identitet inkluderad. `PERSON_AUDIT_FIELDS` omfattar nu `displayName`, `gender`, `externalRef`, `birthDate` och `title` tillsammans med de strukturella fälten. En namnändring skrivs som en riktig före->efter-diff.

2. **Raderingen pseudonymiserar spåret i stället för att bevara identiteten.** Att spara värdena är bara försvarbart tillsammans med en väg som tar bort dem igen: `anonymizePersonAuditRows` (`lib/audit.ts`) ersätter varje `PERSON_IDENTITY_AUDIT_FIELDS`-värde med tombstonen `ERASED_FIELD_VALUE` och bygger om den deriverade `searchText` för samtliga rader om personen. Raderna bevaras (berättigat intresse), värdena gör det inte. Fältnyckeln står kvar: att fältet ändrades, och när, är själva revisionsbeviset.

3. **`person`-subjektet finns för raderingen, inte för bläddring.** `person.created/updated/archived/erased` sätter `subject = { kind: "person", id }` så att `by_org_subject` kan hämta en persons rader utan att skanna organisationens hela spår. Utan indexet skulle en per-person-radering behöva läsa hela loggen. Ingen produktyta läser subjektet ännu.

4. **Raden som skrivs VID raderingen är identitetsfri.** `PERSON_ERASURE_AUDIT_FIELDS` är `PERSON_AUDIT_FIELDS` minus identitetsfälten, härledd och aldrig handskriven, så `person.erased` inte kan återinföra de värden samma mutation just skrubbat bort.

5. **Strukturella fält skrubbas inte.** Avdelning, land, sysselsättningsgrad, anställningsform och liknande är inte persondata när `people`-raden är borta, så de överlever intakta och spåret förblir användbart.

## Detta upphäver den tidigare invarianten, inte raderingsrätten

CLAUDE.md sa tidigare att identifierande personfält "aldrig" får hamna i revisionsloggens diffar eller `searchText`. Den formuleringen ersätts av denna ADR. Vad som INTE ändras:

- **Radering är fortfarande en äkta hård radering** av all live-persondata (`people`, `payRecords`, `personAssignments`, `users`, Better Auth-tabellerna).
- **Efter radering finns inga direkta identifierare kvar**, varken i payloaden eller i den fulltextsökbara `searchText`. Skillnaden mot tidigare är bara NÄR värdet försvinner: vid raderingen i stället för att aldrig ha skrivits.
- **Roll != Person står fast.** `role`/`rating`/modell-/AI-tabellerna får aldrig persondata. Detta beslut gäller uteslutande `person.*`-radernas diffar.

Vad som däremot ska sägas rakt ut: det som bevaras efter radering är **pseudonymiserade** persondata, inte anonyma. Raderna behåller strukturella fält (anställningsdatum, avdelning, sysselsättningsgrad, land, SSYK-kod, chefsflagga) länkade till ett kvarhängande `personId`, plus tidsstämpeln för varje ändring. I en liten organisation kan den kombinationen (särskilt anställningsdatum + avdelning) i praktiken peka ut individen för någon med organisationens egen kännedom. Enligt GDPR skäl 26 är det alltså fortfarande personuppgifter, bevarade på grunden berättigat intresse, precis som revisionsradens övriga innehåll. Den korrekta utfästelsen är därför "inga direkta identifierare överlever raderingen; residualen är pseudonymiserad och bevaras med berättigat intresse som grund", inte "ingen persondata finns kvar". Om en framtida granskning bedömer att residualen är för identifierande är den vassaste kandidaten att flytta `employmentStartDate` till identitetsfälten; den har minst revisionsvärde när personen är borta.

Mönstret är samma anonymize-not-retain som redan gäller på två andra ställen: `actorName` + `searchText` tombstonas för en raderad operatör, och den frysta lönekartläggningen pseudonymiserar individen men behåller aggregatet (ADR-0011). Denna ADR lägger revisionsloggens persondiffar till samma familj.

Den fullständiga app-granskningen 2026-07-10 (P1.2) flaggade anställningsnummer i revisionspayloaden som kritiskt och angav två giltiga åtgärder: ta bort fältet, eller "skrubba `externalRef` från alla rader som refererar `personId` vid radering". Den första valdes då. Denna ADR väljer den andra, för alla identitetsfält, eftersom revisionsvärdet kräver det.

## Konsekvenser

- Radering rör nu tre bevarade register: den frysta snapshoten (ADR-0011), de rader den raderade operatören själv skrev, och de rader som handlar OM den raderade personen. Alla tre pseudonymiserar; ingen bevarar identitet.
- **Klassificeringen är obligatorisk, inte konventionell.** `PERSON_AUDIT_FIELD_KIND` är en total `Record` över de granskade fälten, så ett nytt personfält (t.ex. `personalNumber` eller `email`) inte kompilerar förrän någon avgör om det är identitet eller strukturellt. Det tysta felet vore annars att ett oklassificerat fält behandlas som strukturellt, diffas och bevaras för alltid utan att något går sönder.
- **Skrubbningen når bara rader med `person`-subjekt.** Därför får inget annat händelseslag ta in ett identitetsfält i sin diff: sådana rader har ett annat subjekt, skulle aldrig hittas, och läckan vore tyst och omöjlig att backfilla. Ett test i `lib/audit.test.ts` korsar identitetsfälten mot samtliga övriga `*_AUDIT_FIELDS` och fäller ett sådant tillägg. (Rollens `title` är det dokumenterade undantaget: samma fältnamn, men roller skapas aldrig från en persons importerade befattning.)
- **Skrubbningen körs som en enda transaktion** avgränsad till en persons egna rader via `by_org_subject`. Konsekvensen om taket ändå nås är inte halvraderad PII (mutationen är atomär) utan att raderingen blir permanent omöjlig för just den personen. En organisation med mycket historik per person behöver därför chunkning i raderingsvägen, och då ska ordningen invertera: skrubba spåret i avgränsade steg FÖRST och radera `people`-raden SIST, eftersom nuvarande ordning (radera i steg 3, skrubba i steg 5) är just den som skulle lämna oskrubbade rader utan någon levande rad att återuppta från. Detta är infört som en egen post i `docs/go-live-checklist.md`.
- **Återinförande efter radering är en öppen fråga, inte en löst.** Inget register håller att ett `externalRef` har raderats, så en senare löneimport som fortfarande innehåller numret skapar personen igen med full identitet (och en ny `person.created`-rad). Det gällde även före denna ADR (personen återskapades i `people`), men nu hamnar identiteten också i spåret. Beslutet (spärrlista på hashat `externalRef` med en flagga i importgranskningen, eller uttalat "controller-process, inte kod") är en post i go-live-checklistan.
- **Anställdas namn blir fulltextsökbara i revisionsloggen** medan personen finns, eftersom `searchText` byggs av payloadens skalärer. Det följer av beslutet och är avsiktligt (att kunna söka fram en persons ändringshistorik är en del av revisionsnyttan), och det upphör vid radering när `searchText` byggs om från den skrubbade payloaden.
- Frontenden renderar tombstonen som en lokaliserad "Raderad"-markör (`dashboard.auditLog.values.erased`), aldrig som det nakna ordet, och `gender` renderas via lokaliserade värdelabels så den svenska wire-koden `Kvinna` aldrig visas rått.
- `title` (Befattning) är därmed ett diffat fält. Punkt (1) i go-live-checklistans post om personens `title` är avgjord av denna ADR; punkt (2) (fritext kan innehålla ett namn) står kvar för integritetsgranskningen före lansering.
- Rader som skrevs före denna ändring saknar `subject` och nås därför inte av skrubbningen. Före lansering gäller "no legacy": dev-data nollställs, och de gamla raderna innehåller ändå inga identitetsvärden (deras diffar var tomma).
