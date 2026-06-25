# Värderingsmodell (evaluation-model)

Den konfigurerbara jobbarkitekturen och poängmodellen som en organisation definierar: kriterierna och deras vikter, track/nivå-schemat, bandtrösklarna samt mallarna bakom dem.

Grundprincip: **track beskriver rollen; bandet värderar den; nivå beskriver individen.** Ordningen är alltid: beskriv rollen (track) → värdera mot kriterierna → bandet faller ut sist. Nivån är medarbetarens senioritet inom rollens track och sätts vid rollplaceringen (V2, ADR-0005), aldrig på rollen. Den pedagogiska förklaringen av modellen finns i [track-level-band.md](./track-level-band.md) (läs dess repo-anmärkning: nivådelen är reviderad).

## Språk

**Rollfamilj** *(kod: Role family)*:
En bred familj av liknande roller, t.ex. Software Engineering (System Developer, Tech Lead och Engineering Manager kan höra dit). Hierarkin är rollfamilj → roll → (V2) medarbetare med nivå. En rollfamilj är inte en track: tracken säger vilken *sorts* jobb rollen är (IC/Lead/M), familjen grupperar besläktade roller. Sedan 2026-06-06 modelleras rollfamiljen som egen entitet: organisationen skapar familjer och en roll kan tillhöra högst en familj (tillhörigheten är frivillig). Familjer påverkar aldrig poäng eller band; de grupperar rollistan, filtrerar resultatvyn och ger progressionsvyn per familj (se PLAN-V1 §9.14).
_Undvik_: Jobbfamilj (säg "rollfamilj"), Track (en familj är inte en track)

**Track**:
Vilken *sorts* jobb en roll är — dess arketyp: Individual Contributor (IC), Lead eller Manager (M). Beskriver rollen, aldrig personen. En track är inte en rollfamilj: en rollfamilj rymmer flera roller, ofta med olika tracks.
_Undvik_: Karriärväg (godtagbar synonym, men "Track" är kanoniskt), Jobbfamilj/Rollfamilj (en familj är inte en track, se Rollfamilj)

**Nivå** *(kod: Level)*:
Medarbetarens *senioritet inom rollens track* (IC1–IC5, Lead-1–Lead-3, M1–M3). Sätts på **individen** vid rollplaceringen (V2, people-kontexten), aldrig på rollen (ADR-0005): rollen "System Developer" är IC, Bo i den kan vara IC1 och Axel IC4. Scopad per track — en IC5 och en M3 är inte samma "nivå". Nivådefinitionerna seedas som referensdata i modellen i väntan på V2.
_Undvik_: Senioritet (godtagbar beskrivning, "Nivå" är kanoniskt), Grad, Nivåroll (utgånget begrepp: roller bär ingen nivå)

**Band**:
Hur *tung* en roll är jämfört med alla andra roller i bolaget — utdataklassificeringen som beräknas från total viktad poäng via trösklar. **Band 1 är högst.** Bandet skapar jämförbarhet mellan tracks och är grunden för framtida koppling till löneband/policy (V2).
_Undvik_: Grad, Tier, Nivå (Band är utdata över hela bolaget; nivå är indata inom en track)

**Kriterium** *(kod: Criterion)*:
En sak en roll värderas på (t.ex. Scope & Påverkan, Komplexitet, Finansiellt ansvar). Har namn, beskrivning och en 0–5-**ankarskala**. Fullt konfigurerbart — en organisation kan lägga till egna (Excelns "Impact on Exit" är ett eget kriterium).
_Undvik_: Faktor ("faktor" finns i källdokumenten; "kriterium" är kanoniskt, "faktor" är alias)

**Ankare** *(kod: Anchor)*:
Texten som beskriver vad varje poäng 0–5 betyder för ett kriterium (t.ex. Autonomi 1 = "följer instruktioner", 5 = "sätter riktning för andra funktioner"). Konfigurerbar per kriterium. Kanonisk term i tal och kod är **ankare** (fältet `criteria.anchors`); i UI heter kriteriets texter "bedömningsskala" (de sex nivåerna 0 till 5; tidigare "bedömningsnivå", omdöpt 2026-06-24), så att de läses som skalan för HUR en roll bedöms och inte förväxlas med kriteriets VIKT (1–5 viktpoäng) i viktningssteget. Modellbyggaren håller dessa isär i två steg: "Definiera" (bedömningsskalan) och "Vikta" (viktpoängen), som aldrig visas samtidigt. Obs: denna 0–5-skala är kriteriets bedömningsskala och är INTE samma som individens senioritetsnivå inom ett track (V2-term, ADR-0005).
_Undvik_: Ankarroll (en annan sak, se Värdering), Skalbeskrivning

**Viktpoäng** *(kod: Weight points)*:
Kriteriets vikt, angiven av HR som ett heltal 1 till 5 (1 = relativt lägst, 3 = neutral, 5 = relativt högst). Viktpoängen är synliga och redigerbara men begränsade av poängbudgeten: summan över alla kriterier är alltid exakt lika med budgeten, så att höja ett kriterium kräver att sänka ett annat. Motorn multiplicerar betyget med viktpoängen. Sedan 2026-06-06; ersätter den tidigare 7-gradiga betydelseskalan med dolda vikter (se [viktning-poangbudget.md](./viktning-poangbudget.md) och ADR-0004).
_Undvik_: Betydelse (den utgångna etikettskalan), Vikt (säg "viktpoäng"; kort "vikt" är ok beskrivande), Poäng (rollens viktade total, se assessment-ordlistan)

**Poängbudget** *(kod: Point budget)*:
Det totala antalet viktpoäng som får delas ut: **antal kriterier × 3**. Summan av alla viktpoäng måste vara exakt lika med budgeten (nollsummespel; 3 är skalans neutrala mittpunkt). Nya kriterier får alltid 3 viktpoäng så balansen består automatiskt; tas ett kriterium bort omfördelas mellanskillnaden deterministiskt till de kvarvarande (loggas i revisionsloggen).
_Undvik_: Viktskala, Betydelseskala (utgångna), Maxpoäng (det är rollpoängens tak, inte viktbudgeten)

**Andel** *(kod: Share)*:
Den härledda procentvikten per kriterium: viktpoäng delat med summan av alla viktpoäng. Visas som en konsekvens av prioriteringen och matas aldrig in; fri procentviktning finns inte.
_Undvik_: Procentvikt (säg "andel"), Vikt i procent

**Mall** *(kod: Template)*:
En återanvändbar förkonfigurerad modell — kriterier, ankare, viktpoäng, track-schema, bandtrösklar — anpassad till en jobb-/organisationstyp (t.ex. SaaS/tech, kommersiell, G&A, operations). En organisation startar från en mall (eller tomt) och anpassar sedan; dess modell är oberoende därefter.
_Undvik_: Modell (en mall är startförkonfigurationen; organisationens redigerbara kopia är modellen)

**Bandtröskel** *(kod: Band threshold)*:
Lägsta poäng för ett band, som heltal på den normaliserade 0 till 100-poängskalan. Konfigurerbar per band; definierar var poäng → band. (Band 1 = högst.)
_Undvik_: Gränsvärde, Intervallgräns

**Modell** *(kod: Model)*:
En organisations levande värderingskonfiguration — kriterier, ankare, viktpoäng, track-schema, bandtrösklar. Det finns **en** aktiv modell per organisation (V1: ingen versionering). När modellen ändras räknas alla rollers poäng/band om direkt — poäng och band **härleds** från sparade betyg + aktuell modell.
_Undvik_: Mall (mallen är startförkonfigurationen; modellen är organisationens levande, redigerbara konfiguration), Modellversion (ingen versionering i V1)

**Revisionslogg** *(kod: Audit log)*:
Spårbar logg över ändringar som påverkar utfall — främst modelländringar (vem, vad, när) och vilka roller som bytte band som följd. Ger spårbarhet trots att V1 saknar versionering.
_Undvik_: Ändringslogg, Historik (säg "revisionslogg")

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
| `model.level` | Nivå | Level |
| `model.band` | Band | Band |
| `model.criterion` | Kriterium | Criterion |
| `model.anchor` | Ankare | Anchor |
| `model.weightPoints` | Viktpoäng | Weight points |
| `model.pointBudget` | Poängbudget | Point budget |
| `model.share` | Andel | Share |
| `model.template` | Mall | Template |
| `model.bandThreshold` | Bandtröskel | Band threshold |
| `model.auditLog` | Revisionslogg | Audit log |
| `model.criterionRationale` | Kriterieurvalsprotokoll | Criterion rationale |
| `model.biasReview` | Bias-granskning | Bias review |
| `model.methodAppendix` | Metodbilaga | Method appendix |

Etikettsordval är förslag — bekräftas med användaren. (De tidigare `model.importance.*`-etiketterna utgick 2026-06-06 med poängbudgeten, ADR-0004.)

## Flaggade oklarheter

- **Bandnumrering är inverterad**: Band 1 = högst; högre bandnummer = lägre tyngd. Säg detta uttryckligen i UI och text.
- **Track/nivå vs band-orsakssamband**: en rolls track/nivå *bestämmer inte* dess band — bandet kommer enbart från poängen. De korrelerar men är inte kausala.
- **Track-guardrails** (Excelns min/max per (track, nivå) per kriterium): **pensionerade ur V1:s betygsflöde** (ADR-0005) — de var definierade per nivå och har inget fäste när rollen saknar nivå. Intervallen ligger kvar som referensdata i standardmall.md för V2 (t.ex. placeringsstöd).
- **Egna kriterier (full konfiguration)**: HR kan skapa egna kriterier utöver standardmallen, med egna 0–5-ankare, och anpassa kriterier/ankare/viktpoäng/bandtrösklar fritt. Även egna kriterier viktas med **viktpoäng inom poängbudgeten** (nya kriterier startar på 3) — aldrig fria siffervikter eller procentsatser.
- **Live-omräkning (V1-beslut)**: ingen modellversionering i V1 — en levande modell per organisation, och ändringar räknar om alla rollers poäng/band direkt (härleds från sparade betyg + aktuell modell). Avviker medvetet från briefens versioneringskrav; konsekvens: roller kan tyst byta band vid modelländring. Spårbarhet löses med en **revisionslogg** (ingår i V1). Se ADR-0002.
- **Rollfamiljens granularitet**: granulariteten bestäms per organisation (Software Developer eller bredare Software Engineering). Sedan 2026-06-06 är rollfamiljen en egen entitet med frivillig tillhörighet per roll. Samma sak gäller rollerna själva (ADR-0005): skiljer sig seniorens arbete åt på riktigt blir det en egen roll ("Senior System Developer"), annars är det samma roll och senioriteten bor hos individen.
- **Mallinnehållets språk**: mallseedade, orörda rader (kriterier via templateKey, tracks/nivåer via key) lokaliseras vid läsning till UI-språket (sv/en, fallback en). Egna och AI-skapade kriterier visas som de författats. När E2-redigering ändrar en mallrad rensas templateKey och organisationen äger texten (beslut 2026-06-05).

## Exempeldialog
— "Axel är IC4, så rollen System Developer borde väl ligga högt i band?"
— "Nivån är Axels senioritet, inte rollens egenskap. Rollen värderas som det jobb den är, och bandet faller ut ur den viktade poängen. Skulle Axels arbete faktiskt skilja sig från de andra utvecklarnas är det en egen roll som värderas för sig."
