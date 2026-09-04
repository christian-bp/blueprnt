# Två rapporter ur en fryst lönekartläggning

**Status:** accepterad 2026-09-03 (ägarbeslut, dokumentet "Rapporter Lönekartläggning").

Rapportfliken erbjöd en maskerad dokumentations-PDF, en maskerad facklig PDF byggd ur samma montering, en nyckeltalsarbetsbok och ett arkivpaket. De två PDF:erna tjänade olika läsare med samma innehåll, och maskeringen satt i monteringen, så inget dokument kunde visa hela underlaget. Ägaren beslutade att ersätta dem med två medvetet olika dokument ur samma frysta körning.

## Beslut

1. **Signeringsrapporten ersätter den fackliga rapporten; detaljbilagan ersätter dokumentations-PDF:en.** Fyra nedladdningar återstår: signeringsrapport, detaljbilaga, nyckeltal (Excel) och arkivpaket. Inget legacy behålls: den gamla dokumentkomponenten, dess i18n-nycklar, dess revisionshändelser (`payMapping.reportExported`, `payMapping.unionReportExported`) och `lonekartlaggning-facklig-rapport-kravbild.md` är borttagna.
2. **En omaskerad montering, två projektioner.** `assemblePayMappingReport` nollar aldrig ett värde på grund av gruppstorlek; den beräknar bara exporttröskelflaggorna. `signingReportDoc` är den ENDA platsen där maskering finns: organisationens medianer och medel för ett kön med färre än fyra prissatta rader, samt regeln att ingen gruppnivåsumma finns i dess utdatatyp (ett läckage är ett kompileringsfel, och ett projektionstest strängskannar utdata). `detailAppendixDoc` är identitetsprojektionen.
3. **Detaljbilagan kan laddas ner av varje medlem.** Målgruppen är enbart HR och ser löner i appen av design; revisionsloggen (`payMapping.detailAppendixExported`, skriven före överlämningen) är kontrollen. Ingen rollspärr.
4. **Formalia:** samverkanssteget får ett valfritt samverkansdatum (`payMappingRuns.collaboration.date`, en dag, diffat i spåret som `collaborationDate`, aldrig deltagarnamnen) och ett valfritt fritextfält för parternas synpunkter (`payMappingRuns.collaboration.remarks`). Signeringsrapporten skriver ut parterna, datumet och tomma underskriftsrader. Ingen signering i appen (samsigneringsbeslutet står).
   **Samverkanssynpunkter:** synpunkterna är statutärt samverkansredogörelseinnehåll inom ADR-0027:s undantag, alltså ingen ny ADR. De skrivs ut i detaljbilagans praxiskapitel (som redan bär rubriken "Praxis, samverkansanteckningar och åtgärder") men aldrig i signeringsrapporten. Texten kan innehålla namn, precis som deltagarfältet, så spåret diffar den ALDRIG: `COLLABORATION_AUDIT_FIELDS` får i stället markören `collaborationRemarksChanged` (samma mönster som `detailsChanged` på åtgärder), så en redigering som bara rör synpunkterna inte skriver en rad som läses som en no-op. Per-deltagarradering kommer med den strukturerade samverkansbygget.
5. **Praxisåtgärder:** åtgärdsmålet får varianten `{ kind: "praxis", area }`, tillåten enbart när områdets fynd är `found`; noteringar tar aldrig målet. Praxistabellen i båda dokumenten visar den kopplade åtgärden och dess planerade datum. Inga personuppgifter rider på varianten, så ingen exportmaskering gäller den.
6. **Åtgärdsnummer:** `payMappingActions.number`, tilldelat i `createAction` ur en räknare per körning (`payMappingRuns.actionCounter`, sådd med 0 vid start och höjd i samma transaktion) som aldrig återanvänder ett nummer: en hårdraderad åtgärd frigör inte sitt nummer och en tombstonad rad behåller sitt. Visas som `#n` i översikten och som id-kolumn i båda dokumenten, så ett tryckt nummer pekar aldrig på en annan åtgärd senare. Dev-data nollställs, ingen backfill.
7. **Fryst metod på tråden:** `getPayMappingRunBySlug` returnerar `frozenMethod` (kriterier, nivå- och zonregler, arbetsförhållandebeslutet, godkännandedatum) och `systemVersion`; bilagans metodkapitel och rapportens metodnot dokumenterar körningens metod, aldrig den levande modellen. Varje kriterium bär också sin frysta dokumentation (`purpose`, `whyRelevant`, `weightMotivation`, `null` när den saknas), eftersom bilagan är ett fristående granskningsdokument: den skriver ut vad varje kriterium mäter i stället för att peka på den levande modellen. Ankartexter ingår inte (endast `anchorCount` är fryst).
8. **Analysstatus härleds, lagras aldrig.** `analysis-status.ts` ger en av fyra statusar per grupp med lika arbete och per jämförelse av likvärdigt arbete (ingen åtgärd behövs, sakligt skäl dokumenterat, åtgärd beslutad, fortsatt analys); båda dokumenten och den kommande översiktsomgörningen läser den därifrån.

## Alternativ som avvisades

- **En PDF med maskeringsväxel:** ett dokument som ibland är signeringsunderlag och ibland fullständig dokumentation kan inte läsas utan att veta vilket läge det genererades i; två dokument med olika namn och olika omslag kan.
- **Rollspärr på bilagan:** avvisad; appen är HR-only och loggen är den kontroll som faktiskt går att revidera.
- **Maskering i monteringen med "avmaskerad" flagga:** samma läckagerisk som förr, spegelvänd; typen som saknar fältet är starkare än en flagga.

## Konsekvenser

- Tabell-, identitets- och signaturprimitiverna ligger i `components/pdf/` (ADR-0026:s kit) och delas av båda dokumenten och metodbilagan.
- Arkivpaketets `schemaVersion` är 2 och listar båda PDF:erna; kravbilden `lonekartlaggning-rapport-kravbild.md` avsnitt 9 mappar dokumentationsplikten på de två dokumenten.
- Rasteriseringen av appens diagram (`lib/chart-capture.ts`) hade ingen konsument kvar: signeringsrapportens enda diagram är den befintliga vektorkvartilen. Modulen är borttagen; ADR-0026:s tillägg om chart-sömmen beskriver därmed en möjlighet, inte en byggd väg.
