# Värderingsmodell (evaluation-model)

Den konfigurerbara jobbarkitekturen och poängmodellen som en arbetsyta definierar: kriterierna och deras vikter, track/nivå-schemat, bandtrösklarna samt mallarna bakom dem.

Grundprincip: **track och nivå beskriver rollen; bandet värderar den.** Ordningen är alltid: beskriv rollen (track + nivå) → värdera mot kriterierna → bandet faller ut sist. Nivå jämförs *inom* en track; band jämförs *mellan* tracks. Den pedagogiska förklaringen av hela modellen (rollfamilj, nivåroll, visningstitel, rollplacering) finns i [track-level-band.md](./track-level-band.md).

## Språk

**Rollfamilj** *(kod: Role family)*:
En bred familj av liknande roller, t.ex. Software Developer (kan också dras bredare, som Software Engineering). En familj rymmer flera nivåroller: junior och senior utvecklare är oftast samma rollfamilj men olika nivåroller inom samma track. Hierarkin är rollfamilj → roll/nivåroll → (V2) medarbetare. En rollfamilj är inte en track: tracken säger vilken *sorts* jobb rollen är (IC/Lead/M), familjen grupperar besläktade roller. V1 modellerar inte rollfamilj som egen entitet; gruppering fångas via rollernas titlar (se PLAN-V1 §9.14).
_Undvik_: Jobbfamilj (säg "rollfamilj"), Track (en familj är inte en track)

**Track**:
Vilken *sorts* jobb en roll är — dess arketyp: Individual Contributor (IC), Lead eller Manager (M). Beskriver rollen, aldrig personen. En track är inte en rollfamilj: en rollfamilj (t.ex. Software Developer) rymmer flera nivåroller inom samma track.
_Undvik_: Karriärväg (godtagbar synonym, men "Track" är kanoniskt), Jobbfamilj/Rollfamilj (en familj är inte en track, se Rollfamilj)

**Nivå** *(kod: Level)*:
Hur *avancerat* ett jobb är *inom sin track* (IC1–IC5, Lead-1–Lead-3, M1–M3). Scopad per track — en IC5 och en M3 är inte samma "nivå". Nivå jämförs inom en track, aldrig mellan tracks.
_Undvik_: Senioritet, Grad

**Band**:
Hur *tung* en roll är jämfört med alla andra roller i bolaget — utdataklassificeringen som beräknas från total viktad poäng via trösklar. **Band 1 är högst.** Bandet skapar jämförbarhet mellan tracks och är grunden för framtida koppling till löneband/policy (V2).
_Undvik_: Grad, Tier, Nivå (Band är utdata över hela bolaget; nivå är indata inom en track)

**Kriterium** *(kod: Criterion)*:
En sak en roll värderas på (t.ex. Scope & Påverkan, Komplexitet, Finansiellt ansvar). Har namn, beskrivning och en 0–5-**ankarskala**. Fullt konfigurerbart — en arbetsyta kan lägga till egna (Excelns "Impact on Exit" är ett eget kriterium).
_Undvik_: Faktor ("faktor" finns i källdokumenten; "kriterium" är kanoniskt, "faktor" är alias)

**Ankare** *(kod: Anchor)*:
Texten som beskriver vad varje poäng 0–5 betyder för ett kriterium (t.ex. Autonomi 1 = "följer instruktioner", 5 = "sätter riktning för andra funktioner"). Konfigurerbar per kriterium.
_Undvik_: Ankarroll (en annan sak — se Värdering), Skalbeskrivning

**Betydelse** *(kod: Importance)*:
Hur viktigt ett kriterium är, valt av HR som en etikett på den fasta 7-gradiga **betydelseskalan** (Avgörande, Mycket viktigt … Minst viktigt) — aldrig ett rått tal. Att tilldela varje kriterium en betydelse är hur en arbetsyta anpassar standardmallen efter sitt företag.
_Undvik_: Vikt (vikt är det interna talet; användare ser bara betydelse)

**Vikt** *(kod: Weight)*:
Det interna talet bakom en betydelsenivå (ett av 7 fasta värden: 8, 10, 11, 12, 13, 14, 18) som den deterministiska poängmotorn multiplicerar betyget med. Visas aldrig som ett tal för användare; summerar inte nödvändigtvis till 100.
_Undvik_: Betydelse (den användarvända etiketten), Procent

**Betydelseskala** *(kod: Importance scale)*:
Den **fasta** 7-gradiga skalan som mappar varje betydelseetikett till en vikt. Ändras inte av användaren — den definierar vilka betydelsenivåer som finns. Värden och standardmallens förval: se [`standardmall.md`](./standardmall.md).
_Undvik_: Viktskala (säg "betydelseskala" i produktspråk)

**Mall** *(kod: Template)*:
En återanvändbar förkonfigurerad modell — kriterier, ankare, betydelser, track-schema, bandtrösklar — anpassad till en jobb-/organisationstyp (t.ex. SaaS/tech, kommersiell, G&A, operations). En arbetsyta startar från en mall (eller tomt) och anpassar sedan; dess modell är oberoende därefter.
_Undvik_: Modell (en mall är startförkonfigurationen; arbetsytans redigerbara kopia är modellen)

**Bandtröskel** *(kod: Band threshold)*:
Lägsta poäng för ett band. Konfigurerbar per band; definierar var poäng → band. (Band 1 = högst.)
_Undvik_: Gränsvärde, Intervallgräns

**Modell** *(kod: Model)*:
En arbetsytas levande värderingskonfiguration — kriterier, ankare, betydelser, track-schema, bandtrösklar. Det finns **en** aktiv modell per arbetsyta (V1: ingen versionering). När modellen ändras räknas alla rollers poäng/band om direkt — poäng och band **härleds** från sparade betyg + aktuell modell.
_Undvik_: Mall (mallen är startförkonfigurationen; modellen är arbetsytans levande, redigerbara konfiguration), Modellversion (ingen versionering i V1)

**Revisionslogg** *(kod: Audit log)*:
Spårbar logg över ändringar som påverkar utfall — främst modelländringar (vem, vad, när) och vilka roller som bytte band som följd. Ger spårbarhet trots att V1 saknar versionering.
_Undvik_: Ändringslogg, Historik (säg "revisionslogg")

**Kriterieurvalsprotokoll** *(kod: Criterion rationale)*:
Den dokumenterade motiveringen per kriterium — syfte, varför relevant, bias-risk, beslutad betydelse, beslutsfattare, datum. Visar *varför* ett kriterium finns (EU-direktivets saklighetskrav).
_Undvik_: Faktorurvalsprotokoll (HR:s term; vi säger "kriterie-" eftersom "kriterium" är kanoniskt)

**Bias-granskning** *(kod: Bias review)*:
Per-kriterium-bedömning av köns-/bias-risk: risknivå (låg/medel/hög), kommentar, åtgärd, godkänd ja/nej. Bevisar att modellen är *designad* för neutralitet, inte bara känns neutral.
_Undvik_: Könsneutralitetstest (ok beskrivande), Bias-test

**Metodbilaga** *(kod: Method appendix)*:
Ett exporterbart dokument som samlar modellens kriterier, betydelser, kriterieurvalsprotokoll och bias-granskning — som compliance-bevis (EU-direktivet).
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
| `model.importance` | Betydelse | Importance |
| `model.template` | Mall | Template |
| `model.bandThreshold` | Bandtröskel | Band threshold |
| `model.auditLog` | Revisionslogg | Audit log |
| `model.criterionRationale` | Kriterieurvalsprotokoll | Criterion rationale |
| `model.biasReview` | Bias-granskning | Bias review |
| `model.methodAppendix` | Metodbilaga | Method appendix |
| `model.importance.critical` | Avgörande | Critical |
| `model.importance.veryHigh` | Mycket viktigt | Very important |
| `model.importance.high` | Viktigt | Important |
| `model.importance.fair` | Ganska viktigt | Fairly important |
| `model.importance.moderate` | Måttligt viktigt | Moderately important |
| `model.importance.slight` | Lite viktigt | Slightly important |
| `model.importance.least` | Minst viktigt | Least important |

Etikettsordval är förslag — bekräftas med användaren.

## Flaggade oklarheter

- **Bandnumrering är inverterad**: Band 1 = högst; högre bandnummer = lägre tyngd. Säg detta uttryckligen i UI och text.
- **Track/nivå vs band-orsakssamband**: en rolls track/nivå *bestämmer inte* dess band — bandet kommer enbart från poängen. De korrelerar men är inte kausala.
- **Track-guardrails** (Excelns min/max per (track, nivå) per kriterium): provisoriskt *rådgivande* (varna vid betyg utanför intervall, blockera aldrig) — bekräftas när värderingsflödet designas.
- **Egna kriterier (full konfiguration)**: HR kan skapa egna kriterier utöver standardmallen, med egna 0–5-ankare, och anpassa kriterier/ankare/betydelser/bandtrösklar fritt. Även egna kriterier får sin vikt genom att tilldelas en **betydelse från den fasta 7-skalan** — aldrig fria siffervikter.
- **Live-omräkning (V1-beslut)**: ingen modellversionering i V1 — en levande modell per arbetsyta, och ändringar räknar om alla rollers poäng/band direkt (härleds från sparade betyg + aktuell modell). Avviker medvetet från briefens versioneringskrav; konsekvens: roller kan tyst byta band vid modelländring. Spårbarhet löses med en **revisionslogg** (ingår i V1). Se ADR-0002.
- **Rollfamiljens granularitet**: förklaringsdokumentet (track-level-band.md) använder Software Developer som exempel på rollfamilj; familjer kan också dras bredare (t.ex. Software Engineering, beslutat 2026-06). Granulariteten bestäms per arbetsyta. V1 modellerar inte rollfamilj som egen entitet.

## Exempeldialog
— "Det här är en IC3 Software Developer, så det blir Band 4, va?"
— "Inte nödvändigtvis. IC3 är dess track och nivå — vilken sorts jobb och hur avancerat inom IC. Bandet faller ut ur den viktade poängen när den väl värderats. IC3:or hamnar ofta runt samma band, men poängen avgör, inte tracken."
