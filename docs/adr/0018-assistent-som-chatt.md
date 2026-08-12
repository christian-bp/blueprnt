# ADR-0018: Assistenten får en chattyta (ändrar ADR-0003:s "aldrig chatbot")

**Status:** accepterad (2026-08-12)

## Kontext

ADR-0003 slog fast att AI används som inbäddad assistans i flödet, inte som chatbot, och PLAN-V1 (E8) upprepar "aldrig chatbot". Produkten har nu flera inbäddade AI-ytor (modellutkast, viktgranskning, jobbprofiler, importer) och behovet har vuxit av en plats där användaren kan ställa fria frågor om begrepp, flödet och sin egen organisations läge ("vad är ett kriterium?", "hur ser vårt lönegap ut?") utan att leta i hjälptexter. Riktningen ändras: vi bygger en chattbaserad assistent som vägledningslager.

## Beslut

1. Assistenten får en egen sida (/assistant) samt ett promptfält på översiktssidan; översiktens övriga innehåll behålls. En aktiv konversation per användare och organisation; ny konversation arkiverar den gamla.

2. Assistenten är läsande, aldrig skrivande. V1:s fyra verktyg returnerar endast aggregerad statistik på organisationsnivå: antal, roll- och utvärderingsläge, lönegap och trender ur payMappingRuns, samt lönestatistik (medel och median, även uppdelad per kön) beräknad deterministiskt i interna Convex-queries med samma härledning som lönekartläggningens analys. Individrader lämnar ALDRIG den interna frågan: grupper mindre än ASSISTANT_MIN_GROUP_SIZE (3) undertrycks. För de strukturerade fälten (antal, medel, median) garanterar returvalidatorerna tal och fasta nyckelord, så ett personfält där är ett kompileringsfel; strängfälten (sammanfattning, valuta, period) skyddas i stället av att de alltid byggs av redan godkända tal och ett fast ordförråd i koden, plus ett källtest som söker efter persondata-läsningar i källtexten, en textmatchning med begränsad räckvidd och inte en fullständig garanti. Gränsen är processorgränsen (vad som lämnar tjänsten till modellen), inte användargränsen: HR-användaren ser redan individuell lön i produkten. Två verktyg visar dessutom diagram: meddelandet lagrar bara diagramTYPEN, klienten ritar med översiktens befintliga diagramkomponenter från LEVANDE data. Om assistenten senare får skrivande förmågor går varje skrivning genom förslagsflödet med proveniens och bekräftelse (ADR-0003 i övrigt oförändrad). Dessutom screenas varje inkommande meddelande mot organisationens anställda innan något AI-anrop sker: innehåller det en anställds fullständiga namn avvisas genereringen med en förklaring, utan att modellen anropas, och ett källtest låter persondata-läsningar endast finnas i insights-modulen.

3. Övriga invarianter från ADR-0001/0003 gäller oförändrat: AI-anrop endast i Convex-actions, endast EU-hostad Mistral (aldrig AI Gateway), aldrig persondata om enskilda individer i prompt, verktygsresultat eller svar, aldrig i den deterministiska poäng-/nivåvägen.

4. Backend byggs Convex-native (tabellerna assistantThreads och assistantMessages, streamText i intern action, reaktiv strömning via Convex-queries). Komponenten @convex-dev/agent valdes bort: den kräver AI SDK v6 medan kodbasen är standardiserad på v7. Omprövas när komponenten stöder v7.

5. Chattmeddelanden är konversationstelemetri, inte användarinitierade ändringar av granskningsbart domäntillstånd: inga auditrader skrivs. VARJE generering loggas i aiUsageEvents (kind "assistant.chat"), även stoppade genereringar när leverantören rapporterat förbrukning, så AI-användningen har ett tätt kvitto precis som övriga AI-flöden.

6. Chattinnehåll är raderbart användardata från dag ett: radering av en användare hårdraderar alla trådar och meddelanden (schemalagd, chunkad). Användaren instrueras i UI och systemprompt att inte dela persondata; retentionspolicy för arkiverade trådar avgörs före lansering (go-live-checklistan).

## Konsekvenser

- PLAN-V1 E8:s "aldrig chatbot" är ersatt av detta beslut; dokumentet lämnas orört som historik.
- En ny bounded context `assistant` tillkommer i Convex-backenden.
- Kostnadsskydd i V1: en pågående generering per tråd, 30 meddelanden per användare och timme, 4000 teckens meddelandetak, max 3 verktygssteg, 120 s timeout.
