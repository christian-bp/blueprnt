# Frysta rapportkörningar kopierar betyg och modellkonfiguration, inte bara utfall (V2-söm)

**Status:** accepterad — 2026-06-17

Utlöst av implementationsunderlaget för rapportering, data och synlighet enligt EU:s lönetransparensdirektiv (2026-06). När V2 inför frysta ögonblicksbilder för lönekartläggning och gap-rapportering (PLAN-V1 §11, söm 3) ska en rapportkörning frysa en **reproducerbar** kopia: inte bara utfallen (poäng, band, grupper) utan också **indata och beräkningslogik som gällde vid frystidpunkten** — betygen (`ratings`) **och** modellkonfigurationen (kriterier, viktpoäng, ankare, bandtrösklar).

Detta förtydligar söm 3, som tidigare listade kopiering av (roller, poäng, band, grupper) och förlitade sig på att revisionslogg + stabila roll-id:n räcker som grund.

## Avvägning / varför

- **Direktivet kräver reproducerbarhet.** Underlaget kräver att alla beräkningar är reproducerbara och reviderbara i efterhand, full historisering per rapportkörning, och **spårbarhet från aggregerad rapport tillbaka till underliggande beräkningslogik**.
- **Live-omräkning gör den levande modellen oduglig som källa.** Enligt ADR-0002 lagras inte poäng och band utan härleds live från betyg + aktuell modell; en modelländring räknar om allt direkt och kan tyst flytta roller mellan band. En framtida rapport kan därför inte rekonstrueras genom att läsa den levande modellen vid ett senare tillfälle.
- **Att frysa enbart utfallen bevarar siffran, inte varför.** En kopia av (poäng, band) visar bandet men inte hur det räknades fram. Utan betygen och modellen som den var går utfallet varken att förklara eller försvara vid en lönekartläggningsgranskning.
- **Revisionsloggen är spårbarhetsspine, inte rekonstruktionskälla.** Att återskapa den historiska modellen genom att spela upp revisionsloggen är skört: dess payload är `v.any()` (otypad) och den loggar *att* något ändrades, inte ett komplett, validerat ögonblick av modellen.

## Det här ändrar inte ADR-0002

- Den levande modellen förblir oversionerad. En rapportkörning är en **lokal, oföränderlig kopia** knuten till körningen, inte en modellversion. ADR-0002:s live-omräkning står fast för arbetsytan.
- ADR-0006 håller `ratings` som tabell delvis just för att "V2:s frysta lönekartläggningskopior kopierar rader rent". Detta utvidgar den motiveringen: kopian omfattar även modellkonfigurationen, inte bara betygsraderna.

## Konsekvenser

- En framtida `payGapReportRun` (V2-entitet) bär: frystidpunkt, population med exkluderingar, kopia av betyg, kopia av modellkonfiguration (kriterier, viktpoäng, ankare, bandtrösklar), härledda utfall och godkännanden. Den är reproducerbar utan att läsa den levande modellen.
- Invarianten "poäng och band lagras aldrig" (CLAUDE.md, ADR-0002) gäller **den levande modellen**. En fryst rapportkörnings kopia är ett uttryckligt, avgränsat undantag: utfallen lagras som en del av en oföränderlig ögonblicksbild. (CLAUDE.md-invarianten kompletteras med en hänvisning hit när V2:s rapportlager byggs.)
- Byggs inte nu. Detta är ett söm-förtydligande så att V2:s ögonblicksbild designas rätt från start i stället för att retrofittas.
