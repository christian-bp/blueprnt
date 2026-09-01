# Raderingsvägar i kartläggningens arbetslager

**Status:** accepterad 2026-09-01 (ägarbeslut)

Go-live-checklistan bar två öppna raderingsbeslut för lönekartläggningens arbetslager: samverkansdeltagarnas namn i `payMappingRuns.collaboration`, och person- och parriktade åtgärder/noteringar i `payMappingActions`/`payMappingNotes` (ADR-0015 §7:s raderingsförbehåll). Båda avgjordes 2026-09-01. Grundmönstret är detsamma som ADR-0011 och ADR-0013 etablerade: identitet pseudonymiseras eller undantas på dokumenterad rättslig grund, aldrig kvarhållen av slentrian, och varje kvarhållen personbärande post ska bära sin egen raderingsväg eller sitt eget dokumenterade undantag.

## Beslut 1: samverkansnamnen behålls som dokumenterat undantag

`collaboration.participants` är ett fritextfält med deltagarnas namn, fört som lagstadgat samverkansinnehåll: DL 3 kap. 14 § kräver att dokumentationen redogör för hur samverkansskyldigheten fullgjorts, och vilka som deltog är redogörelsens kärna. Fältet undantas därför från personradering på grunden rättslig förpliktelse (GDPR art. 17.3 b): raderingsrätten viker där behandlingen krävs för att fullgöra en rättslig skyldighet.

- **Ingen krok byggs.** En tombstone-krok över fritext skulle kräva namnmatchning i prosa (stavningsvarianter, delnamn, titlar), vilket ger falsk trygghet snarare än radering. HR kan redigera fritexten manuellt när det finns skäl.
- **Deltagarna är företrädare i sin roll** (fackliga representanter, HR), inte registrerade anställda i `people`; personraderingens subjekt är normalt inte ens samma population.
- **Framtiden:** den strukturerade samverkan (rapportkravbildens gap 3: deltagare/roller/datum som poster i stället för två fritextfält) bygger per-deltagar-radering när den landar, och ersätter då detta undantag för nya poster.

## Beslut 2: personriktade åtgärder och noteringar tombstonas

En åtgärd eller notering vars mål är en individ (`target.kind === "person"`) bär `personPublicId` plus användarskriven fritext (`problem`, `plannedAction`, `text`) som kan namnge personen. Vid personradering tombstonas raderna av `tombstonePersonInWorkLayer` (`payMapping/erasure.ts`), anropad från `erasePersonRecords` direkt efter snapshot-pseudonymiseringen:

1. **Fritexten skrubbas helt** (tom sträng) och raden flaggas `erased: true`. Fritext är risken: ingen fältnyckelskrubb når prosa, så den tas bort i sin helhet i stället för att matchas. Varje yta (åtgärdsöversikten, rapportens tabeller, utvärderingsavsnittet) renderar en lokaliserad markering i fritextens ställe.
2. **Radens struktur består:** status, prioritet, datum och kostnad. Åtgärdsplanen utvärderas i nästa kartläggning som statutärt innehåll (DL 3 kap. 13 §), och en radering som tog bort raden skulle förfalska den utvärderingen, precis som ADR-0011:s snapshot-resonemang.
3. **`personPublicId` behålls som död pseudonym.** Nyckelns visningsvärde är redan tombstonat av `pseudonymizePersonInSnapshots` (raden renderar som "deleted user"), så att behålla nyckeln gör att målet fortsätter rendera korrekt som tombstone, medan att ta bort den bara skulle bryta upplösningen utan att avlägsna något identifierande värde. Detta är samma precisionsnivå som ADR-0013: residualen är pseudonymiserad, inte anonym, och utfästelsen är "inga direkta identifierare överlever", aldrig "ingen persondata finns kvar".
4. **Kroken går medvetet förbi completed-låset.** Arbetslagrets innehållsmutationer vägrar skriva i en slutförd kartläggning; raderingen är en rättslig skyldighet, inte användarredigering, och skriver via `ctx.db.patch` direkt, samma undantagsklass som `setActionStatus`-undantaget redan dokumenterar.

Uppslaget är indexerat: båda tabellerna fick `by_org_person` på `["orgId", "target.personPublicId"]` (endast person-mål bär fältet; grupp- och jämförelsemål saknar det och träffas aldrig). Jämförelsemål (`kind: "comparison"`) är grupp-mot-grupp och bär ingen personreferens; det tidigare "pair"-målet är borttaget, så person-målet är den enda personbärande varianten.

`estimatedCost` på ett personriktat mål (i praktiken individens planerade justering) består efter tombstoningen, kopplad enbart till den döda pseudonymen; rapportens fackliga variant maskerar den redan vid exportgränsen, och beloppet utan namn och utan fritext är gruppbudgetnivåns information.

## Alternativ som avvisades

- **Hårdradering av raderna:** förfalskar den statutära åtgärdsutvärderingen (en plan som "aldrig fanns" kan inte utvärderas) och strider mot ADR-0011:s bevarandelinje för det frysta underlaget.
- **ADR-undantag utan krok även här:** till skillnad från samverkansnamnen är målet en registrerad anställd med ett indexerbart id, så en exakt, bounded skrubb är möjlig; CLAUDE.md-invarianten kräver då kroken.
- **Namnmatchande tombstone i fritexten i stället för full skrubb:** opålitlig av samma skäl som i beslut 1.

## Konsekvenser

- `AUDIT_SUBJECTS` för `payMapping.action*`/`note*`-händelser förblir `payMappingRun`: raderna hittas via `by_org_person`, inte via revisionsspåret, och åtgärdshändelsernas diffar bär redan varken fritext eller kostnad (ADR-0015), så spåret har inget att skrubba för dessa poster.
- Wire-shapes bär `erased`, och ytorna renderar markeringen i stället för tom text; en raderad åtgärd förblir statusuppdaterbar (uppföljningen fortsätter) och raderbar (återställningsvägen), men dess INNEHÅLL kan inte skrivas om: `validateTarget` avvisar person-mål vars snapshotrad är raderad, vilket samtidigt hindrar att NYA åtgärder/noteringar skapas mot den döda pseudonymen. Kroken är en engångssvepning, så fritext skriven mot pseudonymen efter raderingen skulle aldrig skrubbas; guarden är det som gör svepningen fullständig.
- UI:t speglar guarden: redigeringsvalen i dokumentationsmenyn inaktiveras för raderade mål (tombstonemarkeringen på raden säger varför), medan status och radering står öppna.
- Testerna pinnar krokens semantik (`payMapping/erasure.test.ts`): fritext tom, struktur kvar, grupprader orörda, andra organisationers och andra körningars rader avgränsade, och guarden mot nya/omskrivna person-poster.
