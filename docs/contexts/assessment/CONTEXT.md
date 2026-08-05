# Värdering (assessment)

Roller och deras värderingar mot modellen — där roller registreras, betygsätts (blindat), summeras och tilldelas en nivå.

## Språk

**Roll** *(kod: Role)*:
Ett jobb/en befattning som värderas — definierad av sitt innehåll, sina krav, sitt ansvar och sin påverkan, aldrig av personen som innehar den. blueprnt värderar roller, aldrig personer. En roll har en titel och en track ("System Developer" är IC); **senioriteten sitter på individen, inte på rollen** (V2-rollplaceringen, ADR-0005). Skiljer sig seniorens arbete åt på riktigt blir det en egen roll. Besläktade roller bildar en rollfamilj (se Värderingsmodell-ordlistan).
_Undvik_: Befattning (godtagbar synonym), Nivåroll (utgånget begrepp), Person, Anställd, Individ (uttryckligen INTE en roll)

**Jobbprofil** *(kod: Job profile)*:
Den standardiserade beskrivningen av en roll som krävs som input före värdering. Obligatorisk kärna: identitet (titel, funktion/avdelning, team, track) plus syfte och ansvarsområden. Titeln är rollens visningstitel (t.ex. "System Developer"); ingen senioritet anges (ADR-0005). Standardiserad input = jämförbara värderingar. De tidigare strukturerade valfria fälten (beslutsmandat, intressenter, kunskapskrav, finansiellt ansvar, personalansvar, risk/konsekvens, leverabler) är borttagna före lansering för enkelhet; de kan återinföras senare utan migrationskostnad.
_Undvik (fältet titel)_: Namn (säg "titel"; beslutat 2026-06)
_Undvik_: Rollbeskrivning (ok beskrivande; "jobbprofil" är den strukturerade mallen)

**Värdering** *(kod: Assessment)*:
Posten över att värdera en roll mot modellen — dess betyg, beräknade poäng och tilldelade nivå, plus motiveringar.
_Undvik_: Bedömning (godtagbar synonym), Granskning

**Betyg** *(kod: Rating)*:
Det råa 0–5 en bedömare ger en roll på ett kriterium, bedömt mot kriteriets ankartext. Det enda som matas in för hand.
_Undvik_: Poäng (poäng är den viktade totalen), Grad

**Motivering** *(kod: Motivation)*:
En kort fritextförklaring till ett betyg. **Frivillig** — aldrig obligatorisk. Kan läggas per betyg eller per roll.
_Undvik_: Kommentar (ok beskrivande), Anteckning

**Poäng** *(kod: Score)*:
Den viktade totalen för en roll, normaliserad till 0 till 100: 20 × Σ(betyg × viktpoäng) / Σ(viktpoäng), avrundad nedåt (ADR-0004). Max är alltid 100 oavsett antal kriterier. Mappas till en nivå via nivåtrösklarna. UI-etiketten är "Viktning" (en: Weighting; i18n); kanonisk term i tal och kod är Poäng/Score. UI-etiketten "Viktning" överlappar medvetet med "viktning", processen att vikta kriterierna med viktpoäng (se evaluation-model/viktning-poangbudget.md): ett produktbeslut, inte en sammanblandning av begreppen.
_Undvik_: Total, Betyg, Viktpoäng (kriteriets vikt, se Värderingsmodell-ordlistan)

**Nivåutfall** *(kod: Level outcome)* (tidigare Bandutfall/Band outcome, omdöpt 2026-08-05, ADR-0014):
Nivån en roll hamnar i — **alltid** det som räknas fram automatiskt från poängen via nivåtrösklarna. Ingen manuell override; vill man ändra utfallet justerar man betygen eller modellen (kriterier/betydelser/trösklar), inte den enskilda rollens nivå. UI-etiketten är kort "Nivå" (i18n `assessment.level`).
_Undvik_: Nivåplacering ("placering" är reserverat för rollplacering av medarbetare och kan läsas som ett manuellt moment), Nivåsättning (aktiviteten), Band (utgången term, se ADR-0014), Grad, Override (finns inte)

**Ankarroll** *(kod: Anchor role)*:
En utvald intern referensroll med en överenskommen nivå, använd för att jämföra och rimlighetspröva andra rollers bedömningar EFTER den ordinarie kriteriebedömningen (stöd för beslut, aldrig facit). Utses medvetet av admin och kräver en komplett bedömning, så att ankaret har en kriterieprofil och en beräknad nivå; 2-5 stycken totalt räcker normalt i små och medelstora organisationer. Varje ankarroll dokumenteras med överenskommen nivå, motivering, datum för senaste översyn och status (aktiv, under översyn, ersatt; tas aldrig bort, så kalibreringshistoriken förblir spårbar). INTE samma som ett **ankare** (ett kriteriums 0–5-text; i UI "bedömningsskala").
_Undvik_: Benchmark-roll, Referens (var tydlig)

**AI-förslag** *(kod: AI suggestion)*:
Ett värde som AI föreslår (t.ex. jobbprofil-text, senare betyg) — alltid med proveniens (källa, modell) och status *föreslagen → bekräftad/avvisad*. HR bekräftar alltid; AI beslutar aldrig och rör aldrig den deterministiska poäng-/nivåvägen. Tvärgående (gäller även konfiguration). Se ADR-0003. Tekniskt har förslaget även statusarna genererar (under AI-anropet) och misslyckad (med felkod som i18n-nyckel).
_Undvik_: AI-svar, Automatiskt värde (det är ett *förslag* tills HR bekräftar)

## Översättningssträngar (i18n)

| Nyckel | Svenska | English |
| --- | --- | --- |
| `assessment.role` | Roll | Role |
| `assessment.jobProfile` | Jobbprofil | Job profile |
| `assessment.role.title` | Titel | Title |
| `assessment.role.function` | Funktion/avdelning | Function/department |
| `assessment.role.team` | Team | Team |
| `assessment.role.purpose` | Syfte | Purpose |
| `assessment.role.responsibilities` | Ansvarsområden | Responsibilities |
| `assessment.assessment` | Värdering | Assessment |
| `assessment.rating` | Betyg | Rating |
| `assessment.motivation` | Motivering | Motivation |
| `assessment.score` | Viktning | Weighting |
| `assessment.level` | Nivå | Level |
| `assessment.anchorRole` | Ankarroll | Anchor role |
| `assessment.aiSuggestion` | AI-förslag | AI suggestion |

## Flaggade oklarheter

- **Roll ≠ Person (hård gräns)**: role-/rating-tabellerna får ALDRIG bära person-, löne- eller prestationsfält — sådan data hör till framtida people-/pay-kontexter (V2, se CONTEXT-MAP). **Roll-id är stabilt och permanent**: omvärdering ändrar betyg/poäng/nivå men aldrig rollens identitet, och roll-id återanvänds aldrig (V2:s lika/likvärdigt arbete-gruppering hänger på det).
- **Ankare vs Ankarroll**: ett **ankare** är ett kriteriums 0–5-text (Värderingsmodell); en **ankarroll** är en referensroll för kalibrering. Samma ord, olika saker; säg alltid "ankarroll" explicit. I UI heter kriteriets texter "bedömningsskala" (de sex stegen 0 till 5; "bedömningsankare" till 2026-06-13, "bedömningsnivå" till 2026-06-24, därefter "bedömningsskala" för att inte förväxlas med kriteriets vikt 1–5 i viktningssteget). Skalans lägen heter **steg** (kod `step`, tidigare nivå, ADR-0014). Detta är kriteriets 0–5-skala, inte individens senioritet inom ett track (V2, ADR-0005). Kanonisk term i kod är fortfarande `ankare` (fältet `criteria.anchors`).
- **Rollplacering (V2-term)**: att koppla en medarbetare till en roll och ge hen sin **senioritet** inom rollens track (ADR-0005: senioriteten är individdata). Hör till den framtida people-kontexten, aldrig assessment. Därför är "placering" reserverat för medarbetare-mot-roll och används inte om nivå (säg "nivåutfall").
- **Blindning (mildrad av HR-only)**: eftersom bara betrodd HR använder verktyget handlar blindningen om att undvika att totalen styr betygen, inte om att förhindra fusk. Arbetsdefault: viktpoängen sätts i modellkonfigurationen; vid inmatning av betyg ser bedömaren bara kriterier + ankare (inga viktpoäng); poängen och föreslagen nivå visas i resultatsteget, inte live under betygsättningen. Skärp senare vid behov.
- **Ingen nivåöverride (avviker från briefen)**: briefen nämnde manuell nivåjustering med dokumenterad anledning; vi tar bort det. Nivån är alltid det deterministiska utfallet — vill man ändra justerar man betyg eller modell (stöds av live-omräkning + revisionslogg). Stärker objektiviteten; lätt att återinföra senare.

## Exempeldialog
— "Vad matar jag egentligen in när jag värderar rollen Software Developer?"
— "Bara ett 0–5-betyg per kriterium, med ankartexten som vägledning. Du sätter inte betydelse eller ser totalen här — poängen och föreslagen nivå dyker upp i resultatsteget när du är klar."
