# ADR-0023: Modellgodkännande utan versionering

**Status:** accepterad (2026-08-18)

## Kontext

Masterdokumentet kräver att modellen kontrolleras, låses och versionssätts före rollbedömning (§2, §13), att metodändringar skapar ny modellversion med konsekvensanalys (§14.2, §18) och definierar en Modellversion-entitet (§16.7). ADR-0002 valde medvetet en levande modell utan versioner med live-omräkning. Detta ADR avgör hur kraven möts utan att återinföra versionering.

## Beslut

1. **ADR-0002 består.** En levande, redigerbar modell per organisation; poäng, nivå och zon härleds alltid ur sparade betyg plus aktuell modell. Ingen modellversionstabell, ingen frysning av modellen, inget revisionsläge.
2. **Godkännande är en status, inte en frysning.** Modellen bär `approval: draft | approved` med beslutsfattare och tidpunkt. Godkännandet kör §17.2-checklistan (blockerare måste vara gröna, varningar kräver motiv). Statusens enda kraft är grinden: rollbedömning kräver godkänd modell.
3. **Metodpåverkande ändringar återställer till utkast.** Kriterieuppsättning, definitionstexter, ankare, vikter, nivå- och profilregler samt materialitetsbeslutet fäller statusen till `draft`; ombekräftelse är ett klick när checklistan är grön. Protokoll- och biasfält påverkar inte statusen. Varje godkännandehändelse i revisionsloggen är därmed en de facto versionsgräns.
4. **Kartläggningens frysning är den enda frysningen.** `payMappingRuns.frozenModel` växer till full metodbevisning (kriterier med dimension och vikt, materialitetsbeslut, nivå- och profilregler, godkännandemetadata) och fryser vid körningens skapande (ADR-0011). Det är där masterdokumentets versionssättning bor i vår värld: varje lagstadgat bevisdokument bär permanent den metod som producerade det.
5. **Metoddrift härleds, lagras aldrig:** en roll vars bedömning låstes före modellens senaste `approvedAt` visas som "bedömd enligt tidigare metod" (§17.5:s markering); omlåsning under aktuell metod rensar den.

## Övervägda alternativ

- **Full snapshot-versionering** (ny modellversionstabell med konfigurationskopior): mest ordagrant konformt, mest att bygga, och dubblerar det som kartläggningsfrysningen redan bevisar. Bortvald.
- **Lås plus versionsstämpel utan snapshots:** ger versionsnummer utan reproducerbarhet, friktion utan bevisvärde. Bortvald.

## Konsekvenser

- Spårbarheten bärs av revisionsloggen (befintliga modelldiffar plus `level.shift`) och konsekvensanalysen av live-omräkningen själv: ändringar syns omedelbart och loggas.
- Konsekvens som består från ADR-0002: mellan två kartläggningar kan en metodändring tyst flytta roller mellan nivåer; grinden, driftmarkeringen och loggen gör det synligt men hindrar det inte.
- Omvärderas vid go-live-behov (t.ex. kundkrav på historiska modellutfall utanför kartläggningarna).

## Beslutsnot 2026-08-20: aterstallningsbuffert

En enda "senast godkand"-ogonblicksbild (`lastApprovedModel`, samma metodbevisform som kartlaggningens `frozenModel`) skrivs vid varje godkannande och kan aterstallas av admin nar godkannandet ar ateroppnat. Detta ar en angerbuffert, inte versionering: ingen historik, inga historiska utfall, exakt en vag till godkant (aterstallningen lamnar checklistan gron for ordinarie engangsgodkannande). Bedomningar som raderats vid kriterieborttagning ateruppstar inte; aterstallningsdialogen namnger konsekvenserna i bada riktningarna. Beslutet i spec-beslut 11.
