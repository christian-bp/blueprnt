# Enkel förklaring av Track, Level och Band

*Hur vi sätter detta på roller, hur vi placerar medarbetare och varför det finns.*

> **Om detta dokument (repo-anmärkning):** källdokument inlagt 2026-06-04 (från `Track_Level_Band_roller_medarbetare_enkel_forklaring.docx`). Ordlistorna ([CONTEXT.md](./CONTEXT.md), [assessment](../assessment/CONTEXT.md)) och PLAN-V1 följer den, med preciseringarna nedan:
>
> 1. **REVIDERAT 2026-06-07 (ADR-0005): nivån sitter på individen, inte på rollen.** Dokumentets modell "Track och Level sätts på rollen" med nivåroller ("Software Developer - IC2" som egen roll) gäller inte längre: en roll bär bara en track ("System Developer" är IC), och nivån beskriver medarbetarens senioritet inom rollens track (sätts i V2:s rollplacering: Bo kan vara IC1 och Axel IC4 i samma roll). Skiljer sig seniorens *arbete* åt blir det en egen roll. Värderingen och bandet gäller därmed rollen som helhet, vilket matchar lönekartläggningens "lika arbete"-grupper. Nivåtabellerna nedan (avsnitt 2, 3 och 8) läses som referens för individnivåer, inte som separata roller.
> 2. **"Sätter Band" beskriver utfallet, inte mekanismen.** Band härleds alltid deterministiskt från sparade betyg + aktuell modell och kan aldrig sättas manuellt (ADR-0002). Dokumentet säger inget annat; det är tyst om mekanismen.
> 3. **Band 1 är högst** (högre bandnummer = lägre tyngd). Dokumentet anger ingen numreringsriktning; detta är repots beslut.
>
> Medarbetarplacering (rollplacering, steg 4 till 5 nedan) är V2-scope (people-kontexten), inte V1.

**Kärnbudskap:** Vi sätter först struktur på rollerna. Därefter placerar vi medarbetare i rätt rollnivå. På så sätt kan vi jämföra roller rättvist, visa karriärprogression och skapa en tydligare löne- och kompensationsmodell.

## 1. Tre enkla begrepp

| Begrepp | Enkelt sagt | Det används till |
| --- | --- | --- |
| Track | Typ av roll | Visar vilken sorts jobb det är, till exempel specialist, lead eller chef. |
| Level | Nivå inom rollen | Visar hur avancerad rollen är inom sitt track. |
| Band | Rollens tyngd i bolaget | Visar hur tung rollen är jämfört med andra roller och används för jämförbarhet och lönepolicy. |

**Superkort förklaring:** Track och Level beskriver rollen. Band hjälper oss att jämföra roller.

## 2. Vad sätter vi på rollen?

**Track och Level sätts på rollen, inte först på personen.** Det betyder att vi först definierar vilken typ av jobb det är och hur avancerat jobbet är. Sedan placerar vi medarbetaren i rätt sådan rollnivå.

| Nivå i modellen | Exempel | Vad det betyder |
| --- | --- | --- |
| Rollfamilj | Software Developer | En bred familj av liknande jobb. |
| Roll / nivåroll | Software Developer - IC2 | En konkret definierad roll i jobbarkitekturen. |
| Medarbetare | Anna | En person som placeras i en definierad roll. |

**Viktigt:** Om ni har juniora och seniora utvecklare är det oftast samma rollfamilj, men olika nivåroller inom samma track.

## 3. Exempel: Software Developer

| Rollfamilj | Visningstitel | Track | Level | Vad som skiljer nivåerna åt |
| --- | --- | --- | --- | --- |
| Software Developer | Junior Software Developer | IC | IC1 | Behöver mer vägledning, mindre scope, lägre komplexitet. |
| Software Developer | Software Developer | IC | IC2 | Arbetar mer självständigt i tydligt definierat område. |
| Software Developer | Experienced Software Developer | IC | IC3 | Tar större eget ansvar, löser svårare problem, bredare påverkan. |
| Software Developer | Senior Software Developer | IC | IC4 | Hög självständighet, större tekniskt ansvar, påverkar flera team/områden. |
| Software Developer | Principal Software Developer | IC | IC5 | Strategisk expert, formar arbetssätt, stort domänansvar och hög påverkan. |

## 4. Vad är syftet med att sätta Track och Level på rollen?

- Att beskriva vilken typ av jobb det är på ett konsekvent sätt.
- Att skilja på roller som är på olika nivå även om de tillhör samma rollfamilj.
- Att skapa tydliga karriärsteg inom en rollfamilj.
- Att göra det lättare att jämföra likvärdigt arbete och bygga löneband på sakliga grunder.
- Att kunna förklara varför olika roller kan ha olika tyngd även om titlarna liknar varandra.

## 5. Vilken typ av jämförelse gör vi?

| Vad vi jämför | Med hjälp av | Syfte |
| --- | --- | --- |
| Roller inom samma track | Level | För att se progression inom samma typ av jobb. |
| Olika roller mellan track | Band | För att jämföra total rolltyngd mellan till exempel specialist, lead och chef. |
| Medarbetare mot roll | Rollplacering | För att se om medarbetaren är placerad i rätt nivå utifrån rollens innehåll. |

**Enkelt uttryckt:** Level används främst för att jämföra inom ett track. Band används för att jämföra mellan olika typer av roller.

## 6. När placerar vi medarbetarna?

**Först definierar vi rollerna. Sedan placerar vi medarbetarna i rätt rollnivå.** Detta gör att vi inte bygger modellen utifrån individer, utan utifrån jobbens innehåll.

| Steg | Vad vi gör | Varför |
| --- | --- | --- |
| 1 | Definierar rollfamiljer och nivåroller | För att skapa en tydlig jobbarkitektur. |
| 2 | Sätter Track och Level på rollerna | För att beskriva typ av jobb och nivå. |
| 3 | Värderar rollerna och sätter Band | För att få jämförbarhet och grund för lönestruktur. |
| 4 | Placerar medarbetare i rätt rollnivå | För att koppla individen till rätt struktur. |
| 5 | Använder detta i lön, utveckling och karriärdialog | För att skapa tydlighet och konsekvens. |

## 7. Vad är syftet med att placera medarbetare i Track och Level?

- Att säkerställa att medarbetaren ligger i rätt nivå i förhållande till rollens faktiska innehåll.
- Att ge tydlighet kring förväntningar och ansvar.
- Att skapa synlig karriärprogression inom rollen.
- Att kunna ha mer konsekventa löneintervall och utvecklingssamtal.
- Att minska risken att titel eller historik styr mer än rollens faktiska värde.

## 8. Hur sker progression inom rollen?

**Progression inom rollen sker genom att rollen eller medarbetaren flyttas till en högre level inom samma track.** Det betyder att personen fortfarande kan vara till exempel Software Developer, men på en högre nivå.

| Progression | Vad som ökar |
| --- | --- |
| Från IC1 till IC2 | Självständighet och kvalitet i leverans. |
| Från IC2 till IC3 | Ansvar för större problem och bredare påverkan. |
| Från IC3 till IC4 | Komplexitet, ägarskap, teknisk tyngd och påverkan över flera team. |
| Från IC4 till IC5 | Strategisk påverkan, metodutveckling, domänledande expertis och långsiktig riktning. |

**Viktigt:** En högre level betyder inte bara fler år i rollen. Det betyder att rollens ansvar, självständighet, komplexitet och påverkan faktiskt har ökat.

## 9. Vad behöver levels definiera skillnader i?

**För att levels ska fungera behöver skillnaderna mellan nivåerna vara tydligt beskrivna.** De bör normalt definieras utifrån följande dimensioner:

| Dimension | Fråga att besvara |
| --- | --- |
| Självständighet | Hur mycket vägledning behöver rollen? |
| Komplexitet | Hur svåra och otydliga problem hanterar rollen? |
| Scope / ansvar | Hur stort område ansvarar rollen för? |
| Påverkan | Hur långt sträcker sig rollens effekt i organisationen? |
| Kunskapsdjup | Hur djup specialistkunskap krävs? |
| Samarbete / ledarskap | I vilken grad vägleder eller påverkar rollen andra? |
| Beslutsmandat | Vilken typ av beslut fattar rollen själv? |

> **Repo-anmärkning:** dessa dimensioner är i blueprnt modellerade som standardmallens kriterier med 0 till 5-ankare; skillnaderna mellan levels uttrycks strukturerat via track-guardrails (min/max per kriterium och nivå). Se [standardmall.md](./standardmall.md).

## 10. Enkel sammanfattning

- Vi sätter Track och Level på rollerna för att beskriva vilken typ av jobb det är och hur avancerat det är.
- Vi sätter Band för att kunna jämföra olika roller rättvist i hela organisationen.
- Därefter placerar vi medarbetare i rätt rollnivå.
- Progression inom en rollfamilj sker genom högre Level.
- För att detta ska fungera måste skillnaderna mellan Level-stegen vara tydligt definierade.
