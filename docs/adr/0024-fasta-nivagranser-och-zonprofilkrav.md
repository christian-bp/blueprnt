# ADR-0024: Fasta nivågränser och zonprofilkrav

**Status:** accepterad (2026-08-28)

## Kontext

ADR-0022 införde arkitekturen tolv nivåer i fyra zoner med ett profilkrav per zon. Nivågränserna (viktningen där varje nivå öppnar) och zonernas profilkrav lagrades då som fält på organisationens modelldokument och redigerades i ett eget avsnitt på Godkännande-kapitlet, med två av godkännandets tolv kontroller ägnade åt att formen på de sparade reglerna fortfarande höll (fallande gränser, botten på 0, icke-stigande zonkrav).

Masterdokumentet behandlar gränserna som en kalibrerad artefakt per organisation (§14.2, §14.7) och profilkravet som ett ska-krav (§14.1). Metodens upphovsman levererade i augusti 2026 en progressiv trappa (97/86/77/69/62/56/50/45/40/35/30/0) som ersatte den tidigare jämnt fördelade. I samma veva visade en genomräkning att skalans upplösning är hård: en modell med sex till åtta kriterier ger 81 möjliga viktningar, och en nivå som är fem poäng bred rymmer bara två eller tre av dem. En gräns som flyttas en poäng är därför inte en finjustering utan kan vara hela nivåns innehåll.

Ägarbeslutet 2026-08-28: ta bort kundens möjlighet att ändra gränserna, behåll profilkravet som en fast regel.

## Beslut

1. **Nivågränserna är metodlag, inte organisationsdata.** `LEVEL_RULES` i `packages/core/src/zones.ts` är den enda källan. Fälten `levelRules` och `zoneProfileRules` tas bort från `models`, från den delade metodbevisformen (`modelEvidenceFields`) och från `lastApprovedModel`-bufferten. Ingen organisation bär en egen kopia.
2. **Profilkravet består, reglaget försvinner.** `ZONE_PROFILE_RULES` (zon A steg 4, zon B steg 3, zon C och D inget krav) är konstant. Regeln i sig är oförändrad: den kan bara sänka en placering, aldrig lyfta en, och ett arbetsförhållandekriterium är aldrig profilkriterium.
3. **Två kontroller utgår.** `levelRulesValid` och `zoneProfileMonotonic` fanns bara för att validera det som nu inte kan skrivas. Checklistan går från tolv till tio punkter, sju obligatoriska och tre rekommenderade.
4. **Den frysta kartläggningen behåller sin egen kopia.** `payMappingRuns.frozenModel` deklarerar `levelRules` och `zoneProfileRules` explicit, utanför den delade bevisformen. En omkalibrering av konstanten senare får inte skriva om vad en redan signerad lönekartläggning säger sig ha mätt (ADR-0011, ADR-0023 punkt 4).
5. **Metodbilagan läser konstanten.** Bilagan dokumenterar fortfarande alla tolv gränser under sina zoner med varje zons profilkrav; värdena kommer från `packages/core` i stället för över tråden.

## Övervägda alternativ

- **Behåll reglaget och lita på kontrollerna.** Kontrollerna validerade bara formen, aldrig omdömet. En kund kunde flytta gräns 1 från 97 till 90 och få en helt annan nivåfördelning utan att något sa emot. Bortvald.
- **Ta bort profilkravet tillsammans med reglaget.** Kravet är metodens spärr mot att en hög totalsumma köper en hög zon, och masterdokumentet kräver det (§14.1). Bortvald.
- **Låt gränserna vara redigerbara men kräva motivering.** Lägger på friktion utan att lösa upplösningsproblemet: en motiverad ändring är fortfarande en ändring vars effekt kunden inte kan förutse. Bortvald.

## Konsekvenser

- **Avsteg från masterdokumentet, medvetet.** §14.2 och §14.7 beskriver gränserna som något varje organisation kalibrerar. Vi fryser dem för att en nivå ska betyda samma sak överallt och för att skalans upplösning gör en gränsändring till ett trubbigt instrument. Avsteget noteras här; en framtida kalibrering är ett beslut om konstanten, inte om produkten.
- **Nivå 1 var i praktiken utom räckhåll för en roll som inte omfattas av ett aktivt arbetsförhållandekriterium.** Med arbetsförhållanden viktat 3 låg taket på 85 mot nivå 1:s 97. Orsaken visade sig ligga i hur nollan räknades, inte i trappan: löst i ADR-0025, som utesluter kriteriet ur viktningen i stället för att flytta gränserna.
- Ändringen är förstörande för lagrad data. Pre-launch löses den med `db:reset`; fälten avlägsnades ur schemat efter att utvecklingsdeploymenten verifierats tom på dem.
