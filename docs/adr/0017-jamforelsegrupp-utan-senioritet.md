# ADR-0017: Jämförelsegruppen för lika arbete bildas utan senioritet

**Status:** Antagen (2026-08-07)

**Ersätter delvis:** ADR-0015 (instegsvillkoren är oförändrade; det som ändras är vad en grupp består av)

## Kontext

Gruppnyckeln för lika arbete har varit `roleTitle | level | seniority`.

`seniority` är individens senioritetssteg inom sitt spår (`IC1`, `IC3`, `IC5`, `M2`, `Lead-3`). `level` är något annat: arbetets värde ur arbetsvärderingen. ADR-0005 slår fast att senioritet hör till individen, aldrig till rollen.

Mätt på en verklig ögonblicksbild:

| Nyckel | Grupper | Jämförbara | Könsrena | Personer i en jämförelse |
|---|---|---|---|---|
| `titel · nivå · senioritet` | 57 | 11 | 46 | 198 |
| `titel · nivå` | 38 | 19 | 19 | 294 |

17 grupper delades enbart av senioritet. `Software Developer` på nivå 6 blev tre skilda jämförelsegrupper (IC1, IC3, IC5): samma jobbtitel, samma värderade nivå.

## Beslut

Gruppnyckeln blir `roleTitle | level`. Senioritet ingår inte.

## Motivering

**3 kap. 8 § handlar om arbetsuppgifterna.** Lika arbete är arbete som är att betrakta som lika, alltså vad personerna gör. Erfarenhet och senioritet är sakliga skäl en arbetsgivare anger för en skillnad inom en sådan grupp, inte grunder för att dela gruppen så att skillnaden aldrig syns.

**Systemet motsäger sig självt idag.** Listan över sakliga skäl innehåller redan Erfarenhet, Kompetens och Prestation under rubriken Individ. Premissen är alltså att individuella skillnader förklaras inom gruppen. Att samtidigt dela grupperna på senioritet gör samma sak två gånger, och den första gången osynligt: skillnaden är borta innan användaren får förklara den.

**96 personer föll ur analysen tyst.** De hamnade i grupper utan motpart av andra könet och granskades aldrig. Ingenting på skärmen sa det.

**Nivå bär ansvarsskillnaden.** Invändningen att ett högre senioritetssteg kan spegla större ansvar (t.ex. `Head of Sales & Marketing` med M2 och M3 på nivå 2) besvaras av arbetsvärderingen: det är dess uppgift att fånga ansvar, och den gav dem samma nivå. Om värderingen är fel är det värderingen som ska rättas, inte jämförelsegruppen som ska delas.

## Konsekvenser

- Färre men större grupper: 57 → 38, varav jämförbara 11 → 19.
- Könsrena grupper faller 46 → 19, alltså färre grupper som filtreras bort ur primärflödet.
- Gruppens visningsetikett blir jobbtiteln ensam; nivån visas som sin egen badge, aldrig som en del av namnet.
- Grindens stegantal ändras, eftersom antalet grupper som kräver dokumentation ändras.
- Varje befintlig `groupKey` i `payMappingGroupAnalyses`, `payMappingActions` och `payMappingNotes` blir föräldralös. Vi är pre-launch: dev- och prod-data nollställs hellre än migreras (regeln "inget legacy före lansering").
- Senioritet försvinner inte ur produkten. Den står kvar som kolumn i medlemstabellen, där den är det den ska vara: en upplysning som hjälper en dokumenterare att bedöma om erfarenhet förklarar skillnaden.
