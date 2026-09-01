# Samsignering och beslutsdokumentation: beslutsunderlag

Underlag och beslutslogg för ägarbeslutet om M8:s sista bit (spårat sedan rapportteardownen: "Ledningsbekräftelse/samsignering, olöst beslut"), framtaget 2026-09-01. Fyra researchspår (formkraven i svensk rätt, parternas och DO:s hållning, EU-mönstret och e-underskriftsramen, det interna byggsubstratet), samtliga mot levande primärkällor: hela DL 3 kap. och hela MBL (70 §§) lästa i riksdagens konsoliderade texter, DO:s e-guide i renderad form, Unionens och Almegas egna sidor, direktivtexten och konsoliderade eIDAS på EUR-Lex, samt lagen 2016:561.

## 1. Rättsläget: ingen signatur krävs, av någon

- **DL 3 kap. kräver bara "skriftligen dokumentera"** (13, 14, 20 §§). Hela kapitlet saknar varje förekomst av underskrift, attest, fastställande eller godkännande. Dokumentationen är en redogörelse, inte en beslutshandling med formkrav.
- **MBL har ingen allmän protokollsplikt.** Förhandlingsprotokoll förs och justeras av båda parter endast "om part begär det" (16 §). Den enda övriga justeringsreferensen (23 §) definierar när ett kollektivavtal räknas som skriftligt, ett annat instrument.
- **DO:s modell har inget fackligt godkännande.** Samverkan är inte ett krav på enighet: kan parterna inte enas genomför arbetsgivaren ändå och har tolkningsföreträde. Dokumentationens samverkansdel är "en redogörelse för hur ni har fullgjort er samverkansskyldighet", aldrig en underskrift. Kartläggningen ska göras även om arbetstagarsidan avstår helt.
- **Unionen instruerar sina förtroendevalda att INTE skriva under** en kartläggning som gjorts utan fackets inblandning, och beskriver även i samverkansfallet arbetsgivaren som processens juridiska ägare. Almega beskriver fackets roll som kvalitetssäkrande samverkan, inte godkännande part.
- **EU-sömmen (framtid):** art. 9.6 i 2023/970 lägger bekräftelsen på **arbetsgivarens ledning**, "efter samråd med arbetstagarföreträdarna", som ska ha tillgång till metoderna. Ingen av direktivets 66 skäl anger någon form för bekräftelsen. Inte svensk lag ännu (genomförandet pausat).
- **E-underskriftsramen:** eIDAS art. 25.1 ger varje elektronisk underskrift rättslig verkan och bevisvärde; endast handskriftsekvivalens kräver kvalificerad underskrift (25.2), och inget svenskt formkrav finns för detta dokument (lagen 2016:561 rör certifiering, tillsyn och offentliga organ). En enkel, loggad bekräftelseklickning i produkten är alltså rättsligt fullgod beslutsdokumentation.
- **Marknaden:** ingen granskad konkurrent har digital samsignering (rapportkravbilden avsnitt 8).

## 2. Internt substrat

- **Compliance-ack-mönstret finns och är beprövat:** `model.approval` lagrar `{approvedBy, approvedAt}`, godkännandet gates av tolvkontrollen, en metodpåverkande ändring återkallar det automatiskt (`reopenApprovalIfSet`) med egen audit-rad, och ytan visar "Godkänd av {namn} den {datum}". Direkt återanvändbart.
- **Körningens statusmodell:** `active` och `completed` är de nåbara statusarna; `completePayMappingRun` bär redan ADR-0012-gaten och skriver aktören i spåret; `reopenPayMappingRun` är enda vägen tillbaka. En bekräftelse hängs naturligt på den slutförda körningen och rensas vid återöppning.

## 3. Alternativen

**A. Ingen bekräftelse (nuläget).** Lagligt fullgott: Slutför-händelsen i spåret dokumenterar redan vem och när. Noll bygge. Brist: beslutsdokumentationen syns bara i händelseloggen, inte på körningen eller i dokumentet, och art. 9.6-sömmen står oöppnad.

**B. Ledningsbekräftelse (art. 9.6-mönstret), ensidig.** En bekräftelse på den slutförda körningen enligt compliance-ack-mönstret: `{confirmedBy, confirmedAt}` på körningen, egen audit-händelse, "Bekräftad av {namn} den {datum}" på körningsytan och stämplad i rapportens slutliga PDF, automatiskt rensad med egen spårrad om körningen återöppnas. Litet bygge (mönstret finns), rättsligt fullgott (avsnitt 1), och exakt den söm art. 9.6 kommer att behöva.

**C. Facklig kvittens/samsignering därtill.** Avråds av researchen själv: appen är HR-only (facket har inga konton, så en äkta kvittens kan inte avges i produkten; en HR-registrerad "kvittens å fackets vägnar" är värdelös som intyg), DO:s modell har inget fackligt godkännande, och Unionen instruerar uttryckligen sina förtroendevalda att inte skriva under. Fackets delaktighet dokumenteras korrekt genom samverkansREDOGÖRELSEN; vill vi stärka den är rätt verktyg den redan spårade struktureringen (deltagare/roller/datum, rapportkravbilden gap 3), inte en signatur.

## 4. Beslut (ägarbeslut 2026-09-01)

**A: inget bekräftelsesteg byggs nu.** B (ledningsbekräftelse) byggdes först och togs bort samma dag på ägarens invändning, som prövades mot underlaget och höll: i målorganisationerna är bekräftaren i praktiken samma person som slutförde kartläggningen, så steget tillför ingen information utöver Slutför-raden som redan finns i händelseloggen (samma aktör, samma tidpunkt), och produkten saknar en ledningsroll, så den byggda varianten levererade inte heller art. 9.6:s semantik (vem som helst i organisationen kunde klicka). Slutför-händelsen med sin aktör och tidpunkt ÄR beslutsdokumentationen i dag.

C (facklig kvittens) avförs definitivt på beläggen i avsnitt 1 och 3; facklig delaktighet dokumenteras genom samverkansredogörelsen (rätt framtida förstärkning är den redan spårade struktureringen, rapportkravbilden gap 3).

**Återöppningsvillkor:** när det svenska genomförandet av art. 9.6 blir verklighet byggs ledningsbekräftelsen mot den faktiska lagtexten, inklusive vad "ledning" då ska betyda i produkten (rollmodellen är förutsättningen som saknas i dag). Mönstret (compliance-ack) är beprövat, så bygget är litet när kravet finns.

## 5. Källor (hämtade och lästa 2026-09-01)

- Diskrimineringslag (2008:567) 3 kap. i sin helhet; MBL (1976:580) i sin helhet (t.o.m. SFS 2026:886), riksdagen.se.
- DO:s e-guide: vad-innebar-samverkan, fragor-och-svar, gor-sa-har-for-att-samverka, dokumentera; do.se:s lönekartläggningssida (2026-07-30).
- Unionen: checklista lönekartläggning och analys ("Ensidig kartläggning och analys": ingen skyldighet att skriva under). Almega: "Lön: vad ska facket göra?" (2026-05).
- Direktiv (EU) 2023/970 art. 9.6 + samtliga skäl (formfrågan: tyst); eIDAS 910/2014 konsoliderad (art. 3.10-3.12, 25); lag (2016:561), riksdagen.se.
- Internt: `evaluationModel/approval.ts` och `tables.ts` (compliance-ack), `payMapping/runs.ts` (statusmodell, gate, reopen), rapportkravbilden avsnitt 5, 7 (gap 3 och 10) och 8, trackerns sign-off-rad.
