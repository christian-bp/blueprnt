# Lönekartläggningen är en förstklassig livscykelentitet med ett fryst datalager (utvidgar ADR-0008)

**Status:** accepterad 2026-07-12

Utlöst av v2 av metodstödet `Lonekartlaggning_Steg_for_Steg_Guide v2.md` (Del 5.4 och den omnumrerade Modul 3 "Kartläggningshantering"). v2 lyfter det som i ADR-0008 var en fryst rapportkörning till en förstklassig **kartläggningsentitet** med livscykel: en ögonblicksbild av data tas vid ett referensdatum och all analys, dokumentation och åtgärdsplanering byggs ovanpå den. Denna ADR utvidgar ADR-0008; den upphäver den inte.

## Kärnprincip: frys datan, inte arbetet

En kartläggning har två lager:

- **Datalagret (fryst vid referensdatum, immutabelt).** Ögonblicksbilden fryser indata så som de gällde vid referensdatumet: löner (grundlön + komponenter, redan månadsnormaliserade per import-fidelity), roll (band, track, level, befattning, avdelning), demografi (kön, anställningsdatum, anställningsform), **bandets policyintervall (min/mid/max)**, samt betyg och modellkonfiguration (ADR-0008: kriterier, viktpoäng, ankare, bandtrösklar). Metadata: exakt UTC-tidsstämpel, vem som initierade, systemversion.
- **Arbetslagret (föränderligt, kopplat till `snapshot_id`).** Jämförelsegrupper, statistik/gap, sakliga skäl, åtgärdsplaner och anteckningar är ett aktivt arbetsrum som byggs på under hela processen. Det låses **först** när kartläggningen signeras och arkiveras.

ADR-0008 formulerade frysningen som att den omfattar även utfall och godkännanden. Denna ADR förtydligar: utfall, sakliga skäl och godkännanden tillhör arbetslagret och ackumuleras över tid mot den frysta datan. Det som är frozen från dag ett är indatan, inte arbetet. Hela kartläggningen (inklusive arbetslagret) blir oföränderlig först vid arkivering.

## Beslut

1. **Kartläggningen är en entitet med statusflöde:** Ej startad, Aktiv/Pågående, Pausad, Under granskning, Slutförd/Arkiverad. Referensdatum, ansvarig HR-person och populationsanmärkningar (t.ex. dokumenterad exkludering) sätts vid initiering.
2. **Ny entitet: bandpolicyintervall (min/mid/max i valuta per band)** på org/bandnivå (Roll != Person: intervallet hör till bandmodellen, aldrig till individen). Det är grunden för off-policy-detektering (Del 4 Steg 4) och ingår i frysningen.
3. **Åtkomst- och exportloggning.** Utöver dagens invariant ("varje tillståndsändrande mutation skriver en revisionsrad") loggas även **visningar och exporter** av en kartläggning. Detta är en ny, läs-orienterad revisionsdimension för kartläggningsdata; den ska inte tillämpas brett på övriga ytor.
4. **Arkivpaket och retention.** En kartläggning ska kunna exporteras som ett komplett paket (PDF-rapport + XLSX-data + JSON-metadata) och bevaras minst 5 år i en separat backup-rutin.
5. **Sekvensering:** kartläggnings-/snapshot-containern byggs **tidigt** i V2-analyslagret, eftersom all analys per krav körs mot fryst data och aldrig mot live-data. Jämförelsegrupper, statistik, sakliga skäl, åtgärdsplaner och rapporter hänger alla på en kartläggning.

## Beslut (bekräftat av grundaren 2026-07-12): GDPR mot den frysta snapshoten

v2 anger att radering ska **pseudonymisera individen i snapshoten och bevara aggregatet** (den frysta kartläggningen är primärt bevisdokument vid en DO-granskning eller rättslig tvist). Detta är ett avgränsat undantag från den hårda invarianten "en person raderas med en äkta hård radering, aldrig en mjuk flagga" (CLAUDE.md): för snapshot-data bevaras raden med individens identitet pseudonymiserad, medan person-PII i live-kontexterna (people/payRecords/personAssignments, users, Better Auth) fortsatt hårdraderas.

Mönstret finns redan: revisionsloggen bevarar sina rader och tombstonar `actorName` + `searchText` vid radering på grund av berättigat intresse. Snapshot-pseudonymisering är samma princip, med rättslig grund i den lagstadgade lönekartläggningen. Beslutet är bekräftat av grundaren (2026-07-12); den hårda raderingen gäller fortfarande all live-persondata. CLAUDE.md:s raderingsinvariant hänvisar nu hit för det avgränsade snapshot-undantaget.

## Det här ändrar inte ADR-0002 eller ADR-0008

- ADR-0002 (live-omräkning, ingen versionering) står fast för **arbetsytan**. En kartläggning är en lokal, oföränderlig kopia knuten till körningen, inte en modellversion.
- ADR-0008 står fast: kopian omfattar betyg och modellkonfiguration, inte bara utfall. Denna ADR lägger till livscykeln, två-lagersmodellen, policyintervallet, åtkomstloggningen och GDPR-pseudonymiseringen ovanpå den.

## Konsekvenser

- V2-entiteten (arbetsnamn `payMappingRun` / kartläggning) bär: status, referensdatum, ansvarig, population med exkluderingar, den frysta datan (löner, roller, band/policyintervall, demografi, betyg, modellkonfiguration), metadata, samt referenser från arbetslagrets poster via `snapshot_id`.
- En dedikerad listvy (alla kartläggningar med status, population, antal flaggade skillnader, öppna åtgärder, ansvarig, datum) och en jämförelsevy mellan två kartläggningar (gap-, kvartil-, off-policy- och åtgärdseffektsförändring) hör till modulen.
- Byggs inte nu. Detta är ett söm-förtydligande så att kartläggningsmodulen designas rätt från start i stället för att retrofittas.
