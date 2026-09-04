# Värderingsmodell (evaluation-model)

Den konfigurerbara jobbarkitekturen och poängmodellen som en organisation definierar: kriterierna och deras vikter samt track/senioritetsschemat. Nivåtrösklarna och zonernas profilkrav är metodlag och konfigureras inte (ADR-0024).

Grundprincip: **track beskriver rollen; nivån värderar den; senioriteten beskriver individen.** Ordningen är alltid: beskriv rollen (track) → värdera mot kriterierna → nivån faller ut sist. Senioriteten är medarbetarens senioritet inom rollens track och sätts vid rollplaceringen (V2, ADR-0005), aldrig på rollen. Den pedagogiska förklaringen av modellen finns i [track-level-band.md](./track-level-band.md) (läs dess repo-anmärkning: senioritetsdelen är reviderad och termerna är omdöpta, ADR-0014).

## Språk

**Rollfamilj** *(kod: Role family)*:
En bred familj av liknande roller, t.ex. Software Engineering (System Developer, Tech Lead och Engineering Manager kan höra dit). Hierarkin är rollfamilj → roll → (V2) medarbetare med senioritet. En rollfamilj är inte en track: tracken säger vilken *sorts* jobb rollen är (IC/Lead/M), familjen grupperar besläktade roller. Sedan 2026-06-06 modelleras rollfamiljen som egen entitet: organisationen skapar familjer och en roll kan tillhöra högst en familj (tillhörigheten är frivillig). Familjer påverkar aldrig poäng eller nivå; de grupperar rollistan, filtrerar resultatvyn och ger progressionsvyn per familj (se PLAN-V1 §9.14).
_Undvik_: Jobbfamilj (säg "rollfamilj"), Track (en familj är inte en track)

**Track**:
Vilken *sorts* jobb en roll är — dess arketyp: Individual Contributor (IC), Lead eller Manager (M). Beskriver rollen, aldrig personen. En track är inte en rollfamilj: en rollfamilj rymmer flera roller, ofta med olika tracks.
_Undvik_: Karriärväg (godtagbar synonym, men "Track" är kanoniskt), Jobbfamilj/Rollfamilj (en familj är inte en track, se Rollfamilj)

**Senioritet** *(kod: Seniority)* (tidigare Nivå/Level, omdöpt 2026-08-05, ADR-0014):
Medarbetarens *senioritet inom rollens track* (IC1–IC5, Lead-1–Lead-3, M1–M3). Sätts på **individen** vid rollplaceringen (V2, people-kontexten), aldrig på rollen (ADR-0005): rollen "System Developer" är IC, Bo i den kan vara IC1 och Axel IC4. Scopad per track — en IC5 och en M3 är inte samma senioritet. Senioritetsdefinitionerna är konstanten `TRACK_SENIORITIES` i `@workspace/constants` (standardmall.md är prosareferens) och driver validering av individens rollplacering; de seedas inte i modellen (ADR-0005, tillägg 2026-07-10).
_Undvik_: Nivå (utgånget för detta begrepp: Nivå är rollens beräknade tyngd, se nedan), Grad, Nivåroll (utgånget begrepp: roller bär ingen senioritet)

**Nivå** *(kod: Level)* (tidigare Band, omdöpt 2026-08-05, ADR-0014):
Hur *tung* en roll är jämfört med alla andra roller i bolaget — utdataklassificeringen som beräknas från total viktad poäng via trösklar. **Nivå 1 är högst.** Nivån skapar jämförbarhet mellan tracks och är grunden för framtida koppling till löneband/policy (V2).
_Undvik_: Grad, Tier, Band (utgången term, se ADR-0014), Senioritet (nivån är utdata över hela bolaget; senioriteten är indata inom en track)

**Kriterium** *(kod: Criterion)*:
En sak en roll värderas på (t.ex. Scope & Påverkan, Komplexitet, Finansiellt ansvar). Har namn, beskrivning och en 0–5-**ankarskala**. Fullt konfigurerbart — en organisation kan lägga till egna (Excelns "Impact on Exit" är ett eget kriterium).
_Undvik_: Faktor ("faktor" finns i källdokumenten; "kriterium" är kanoniskt, "faktor" är alias)

**Ankare** *(kod: Anchor)*:
Texten som beskriver vad varje poäng 0–5 betyder för ett kriterium (t.ex. Autonomi 1 = "följer instruktioner", 5 = "sätter riktning för andra funktioner"). Konfigurerbar per kriterium. Kanonisk term i tal och kod är **ankare** (fältet `criteria.anchors`); i UI heter kriteriets texter "bedömningsskala" (de sex stegen 0 till 5; tidigare "bedömningsnivå", omdöpt 2026-06-24), så att de läses som skalan för HUR en roll bedöms och inte förväxlas med kriteriets VIKT (1–5 viktpoäng) i viktningssteget. Modellbyggaren håller dessa isär i två steg: "Definiera" (bedömningsskalan) och "Vikta" (viktpoängen), som aldrig visas samtidigt. Obs: skalans lägen heter **steg** (kod `step`, tidigare nivå, ADR-0014). Denna 0–5-skala är kriteriets bedömningsskala och är INTE samma som individens senioritet inom ett track (V2-term, ADR-0005).
_Undvik_: Ankarroll (en annan sak, se Värdering), Skalbeskrivning

**Steg** *(kod: Step)*:
Ett läge på kriteriets bedömningsskala 0–5 (fältet `anchors[].step`); varje steg bär en ankartext. Hette nivå före ADR-0014. Steget är läget på skalan; det valda värdet för en roll är betyget (se assessment-ordlistan).
_Undvik_: Nivå (utgånget för detta begrepp, ADR-0014: Nivå är rollens beräknade tyngd), Grad

**Viktpoäng** *(kod: Weight points)*:
Kriteriets vikt, angiven av HR som ett heltal 1 till 5 (1 = relativt lägst, 3 = neutral, 5 = relativt högst). Viktpoängen är synliga och redigerbara men begränsade av poängbudgeten: summan över alla kriterier är alltid exakt lika med budgeten, så att höja ett kriterium kräver att sänka ett annat. Motorn multiplicerar betyget med viktpoängen. Sedan 2026-06-06; ersätter den tidigare 7-gradiga betydelseskalan med dolda vikter (se [viktning-poangbudget.md](./viktning-poangbudget.md) och ADR-0004).
_Undvik_: Betydelse (den utgångna etikettskalan), Vikt (säg "viktpoäng"; kort "vikt" är ok beskrivande), Poäng (rollens viktade total, se assessment-ordlistan)

**Poängbudget** *(kod: Point budget)*:
Det totala antalet viktpoäng som får delas ut: **antal kriterier × 3**. Summan av alla viktpoäng måste vara exakt lika med budgeten (nollsummespel; 3 är skalans neutrala mittpunkt). Nya kriterier får alltid 3 viktpoäng så balansen består automatiskt; tas ett kriterium bort omfördelas mellanskillnaden deterministiskt till de kvarvarande (loggas i händelseloggen).
_Undvik_: Viktskala, Betydelseskala (utgångna), Maxpoäng (det är rollpoängens tak, inte viktbudgeten)

**Andel** *(kod: Share)*:
Den härledda procentvikten per kriterium: viktpoäng delat med summan av alla viktpoäng. Visas som en konsekvens av prioriteringen och matas aldrig in; fri procentviktning finns inte.
_Undvik_: Procentvikt (säg "andel"), Vikt i procent

**Dimension** *(kod: Dimension)*:
En av metodens fyra fasta värderingsdimensioner (kompetens, ansträngning och komplexitet, ansvar och påverkan, arbetsförhållanden), vilka direktiv (EU) 2023/970 namnger. Strukturlag: aldrig konfigurerbar, aldrig fler eller färre. Varje kriterium tillhör exakt en.
_Undvik_: Kriterium (ett kriterium tillhör en dimension, det är inte en)

**Kriteriebibliotek** *(kod: Criteria library)* (ersatte Mall/Template, ADR-0021):
Den kontrollerade katalogen med 22 kriterier som varje organisation väljer sina 6 till 8 ur, under dimensionstaken 2/2/3/1. Definition, ankare och kontrollfråga är bibliotekets och identiska i varje organisation. Det finns ingen förkonfigurerad startmodell längre: en ny organisation börjar tom och bygger genom att välja.
_Undvik_: Mall (utgången term, ADR-0021)

**Zon** *(kod: Zone)* (ADR-0022):
En av fyra grupper av närliggande nivåer: A är nivå 1 till 3, B är 4 till 6, C är 7 till 9, D är 10 till 12. Strukturlag, aldrig konfigurerbar. Zonen är den kvalitativa karaktär flera nivåer delar; den betygsätts aldrig och är aldrig ett bedömningsfält.
_Undvik_: Nivå (zonen grupperar nivåer, den är ingen nivå), Band

**Omfattas ej** *(kod: Not covered)* (ADR-0025):
Betygsvärdet 0, som bara finns på ett aktivt arbetsförhållandekriterium och betyder att rollen inte omfattas av det definierade villkoret. Det är en markering, inte ett betyg: kriteriet lämnar både täljaren och nämnaren i viktningen, så rollen viktas enbart på de kriterier den faktiskt mäts på.
_Undvik_: Betyg 0, Lägsta betyg (0 är inget steg på skalan)

**Profilkriterium** *(kod: Profile criterion)* (ADR-0022):
Ett kriterium som organisationen viktat till 4 eller 5, alltså ett av dem den förklarat mest värdedrivande. Härleds, lagras aldrig. Ett arbetsförhållandekriterium är aldrig profilkriterium oavsett vikt, eftersom dess 0 betyder att rollen inte omfattas.
_Undvik_: Tungt kriterium

**Profilkrav** *(kod: Zone profile rule)* (ADR-0022, fast sedan ADR-0024):
Det lägsta steg en zon kräver på varje profilkriterium: zon A steg 4, zon B steg 3, zon C och D inget. Metodlag, aldrig konfigurerbar. Kan bara sänka en placering, aldrig lyfta en: en roll vars viktning når zonen men vars profil inte gör det hålls på den underliggande zonens översta nivå och flaggas för kalibrering.
_Undvik_: Nivåoverride (ingen sådan finns)

**Modellgodkännande** *(kod: Model approval)* (ADR-0023):
En status, utkast eller godkänd, som grindar bedömning: ingen roll kan värderas mot en icke godkänd metod. En tiopunktschecklista måste passera först, varje metodpåverkande ändring öppnar godkännandet igen, och det senast godkända tillståndet kan återställas. Ingen versionering; kartläggningens frysta ögonblicksbild är den enda frysningen (ADR-0002 består).
_Undvik_: Modellversion

**Nivåtröskel** *(kod: Level threshold)* (tidigare Bandtröskel/Band threshold, ADR-0014; fast sedan ADR-0024):
Lägsta poäng för en av de tolv nivåerna, som heltal på den normaliserade 0 till 100-poängskalan; definierar var poäng → nivå. (Nivå 1 = högst.) Metodlag i `packages/core`, aldrig konfigurerbar: trappan är progressiv och identisk i varje organisation.
_Undvik_: Gränsvärde, Intervallgräns

**Modell** *(kod: Model)*:
En organisations levande värderingskonfiguration — kriterier, ankare, viktpoäng, track-schema. Det finns **en** aktiv modell per organisation (V1: ingen versionering). När modellen ändras räknas alla rollers poäng/nivå om direkt — poäng och nivå **härleds** från sparade betyg + aktuell modell.
_Undvik_: Mall (mallen är startförkonfigurationen; modellen är organisationens levande, redigerbara konfiguration), Modellversion (ingen versionering i V1)

**Händelselogg** *(kod: Audit log)*:
Spårbar logg över ändringar som påverkar utfall — främst modelländringar (vem, vad, när) och vilka roller som bytte nivå som följd. Ger spårbarhet trots att V1 saknar versionering.
_Undvik_: Ändringslogg, Historik, Revisionslogg (säg "händelselogg", som navigationen)

**Kriterieurvalsprotokoll** *(kod: Criterion rationale)*:
Den dokumenterade motiveringen per kriterium — syfte, varför relevant, bias-risk, beslutade viktpoäng, beslutsfattare, datum. Visar *varför* ett kriterium finns (EU-direktivets saklighetskrav).
_Undvik_: Faktorurvalsprotokoll (HR:s term; vi säger "kriterie-" eftersom "kriterium" är kanoniskt)

**Bias-granskning** *(kod: Bias review)*:
Per-kriterium-bedömning av köns-/bias-risk: risknivå (låg/medel/hög), kommentar, åtgärd, godkänd ja/nej. Bevisar att modellen är *designad* för neutralitet, inte bara känns neutral.
_Undvik_: Könsneutralitetstest (ok beskrivande), Bias-test

**Metodbilaga** *(kod: Method appendix)*:
Ett exporterbart dokument som samlar modellens kriterier, viktpoäng (med andelar), kriterieurvalsprotokoll och bias-granskning — som compliance-bevis (EU-direktivet).
_Undvik_: Rapport (säg "metodbilaga" för det här specifika compliance-dokumentet)

## Översättningssträngar (i18n)

Nyckelformat är bibliotek-neutralt (punktnamnrymd). Svenska är standardspråk.

| Nyckel | Svenska | English |
| --- | --- | --- |
| `model.roleFamily` | Rollfamilj | Role family |
| `model.track` | Track | Track |
| `model.seniority` | Senioritet | Seniority |
| `model.level` | Nivå | Level |
| `model.criterion` | Kriterium | Criterion |
| `model.anchor` | Ankare | Anchor |
| `model.step` | Steg | Step |
| `model.weightPoints` | Viktpoäng | Weight points |
| `model.pointBudget` | Poängbudget | Point budget |
| `model.share` | Andel | Share |
| `model.template` | Mall | Template |
| `model.levelThreshold` | Nivåtröskel | Level threshold |
| `model.auditLog` | Händelselogg | Audit log |
| `model.criterionRationale` | Kriterieurvalsprotokoll | Criterion rationale |
| `model.biasReview` | Bias-granskning | Bias review |
| `model.methodAppendix` | Metodbilaga | Method appendix |

Etikettsordval är förslag, bekräftas med användaren. `model.*`-nycklarna är ordlistans referenstermer och finns i alla språkfiler; alla har ännu inte en UI-konsument. (De tidigare `model.importance.*`-etiketterna utgick 2026-06-06 med poängbudgeten, ADR-0004.)

## Flaggade oklarheter

- **Nivånumrering är inverterad**: Nivå 1 = högst; högre nivånummer = lägre tyngd. Säg detta uttryckligen i UI och text.
- **Track/senioritet vs nivå-orsakssamband**: en rolls track/senioritet *bestämmer inte* dess nivå — nivån kommer enbart från poängen. De korrelerar men är inte kausala.
- **Track-guardrails** (Excelns min/max per (track, senioritet) per kriterium): **pensionerade ur V1:s betygsflöde** (ADR-0005) — de var definierade per senioritet och har inget fäste när rollen saknar senioritet. Intervallen ligger kvar som referensdata i standardmall.md för V2 (t.ex. placeringsstöd).
- **Egna kriterier (full konfiguration)**: HR kan skapa egna kriterier utöver standardmallen, med egna 0–5-ankare, och anpassa kriterier/ankare/viktpoäng fritt. Även egna kriterier viktas med **viktpoäng inom poängbudgeten** (nya kriterier startar på 3) — aldrig fria siffervikter eller procentsatser.
- **Live-omräkning (V1-beslut)**: ingen modellversionering i V1 — en levande modell per organisation, och ändringar räknar om alla rollers poäng/nivå direkt (härleds från sparade betyg + aktuell modell). Avviker medvetet från briefens versioneringskrav; konsekvens: roller kan tyst byta nivå vid modelländring. Spårbarhet löses med en **händelselogg** (ingår i V1). Se ADR-0002.
- **Rollfamiljens granularitet**: granulariteten bestäms per organisation (Software Developer eller bredare Software Engineering). Sedan 2026-06-06 är rollfamiljen en egen entitet med frivillig tillhörighet per roll. Samma sak gäller rollerna själva (ADR-0005): skiljer sig seniorens arbete åt på riktigt blir det en egen roll ("Senior System Developer"), annars är det samma roll och senioriteten bor hos individen.
- **Mallinnehållets språk**: mallseedade, orörda rader (kriterier via templateKey, tracks/senioriteter via key) lokaliseras vid läsning till UI-språket (sv/en, fallback en). Egna och AI-skapade kriterier visas som de författats. När E2-redigering ändrar en mallrad rensas templateKey och organisationen äger texten (beslut 2026-06-05).

## Exempeldialog
— "Axel är IC4, så rollen System Developer borde väl ligga på en hög nivå?"
— "IC4 är Axels senioritet, inte rollens egenskap. Rollen värderas som det jobb den är, och nivån faller ut ur den viktade poängen. Skulle Axels arbete faktiskt skilja sig från de andra utvecklarnas är det en egen roll som värderas för sig."
