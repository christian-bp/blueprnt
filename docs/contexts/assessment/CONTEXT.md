# Värdering (assessment)

Roller och deras värderingar mot modellen — där roller registreras, betygsätts (blindat), summeras och tilldelas ett band.

## Språk

**Roll** *(kod: Role)*:
Ett jobb/en befattning som värderas — definierad av sitt innehåll, sina krav, sitt ansvar och sin påverkan, aldrig av personen som innehar den. blueprnt värderar roller, aldrig personer. En roll har en titel och en track ("System Developer" är IC); **nivån sitter på individen, inte på rollen** (V2-rollplaceringen, ADR-0005). Skiljer sig seniorens arbete åt på riktigt blir det en egen roll. Besläktade roller bildar en rollfamilj (se Värderingsmodell-ordlistan).
_Undvik_: Befattning (godtagbar synonym), Nivåroll (utgånget begrepp), Person, Anställd, Individ (uttryckligen INTE en roll)

**Jobbprofil** *(kod: Job profile)*:
Den standardiserade beskrivningen av en roll som krävs som input före värdering. Obligatorisk kärna (titel, funktion/avdelning, team, track, syfte, ansvarsområden) + strukturerade valfria fält (beslutsmandat, intressenter, kunskapskrav, finansiellt ansvar, personalansvar, risk/konsekvens, leverabler). Titeln är rollens visningstitel (t.ex. "System Developer"); ingen nivå anges (ADR-0005). Standardiserad input = jämförbara värderingar.
_Undvik (fältet titel)_: Namn (säg "titel"; beslutat 2026-06)
_Undvik_: Rollbeskrivning (ok beskrivande; "jobbprofil" är den strukturerade mallen)

**Värdering** *(kod: Assessment)*:
Posten över att värdera en roll mot modellen — dess betyg, beräknade poäng och tilldelade band, plus status och motiveringar.
_Undvik_: Bedömning (godtagbar synonym), Granskning

**Betyg** *(kod: Rating)*:
Det råa 0–5 en bedömare ger en roll på ett kriterium, bedömt mot kriteriets ankartext. Det enda som matas in för hand.
_Undvik_: Poäng (poäng är den viktade totalen), Grad

**Motivering** *(kod: Motivation)*:
En kort fritextförklaring till ett betyg. **Frivillig** — aldrig obligatorisk. Kan läggas per betyg eller per roll.
_Undvik_: Kommentar (ok beskrivande), Anteckning

**Poäng** *(kod: Score)*:
Den viktade totalen för en roll, normaliserad till 0 till 100: 20 × Σ(betyg × viktpoäng) / Σ(viktpoäng), avrundad nedåt (ADR-0004). Max är alltid 100 oavsett antal kriterier. Mappas till ett band via bandtrösklarna. UI-etiketten är "Totalpoäng" (i18n); kanonisk term i tal och kod är Poäng/Score.
_Undvik_: Total, Betyg, Viktpoäng (kriteriets vikt, se Värderingsmodell-ordlistan)

**Bandutfall** *(kod: Band outcome)*:
Bandet en roll hamnar i — **alltid** det som räknas fram automatiskt från poängen via bandtrösklarna. Ingen manuell override; vill man ändra utfallet justerar man betygen eller modellen (kriterier/betydelser/trösklar), inte den enskilda rollens band. UI-etiketten är kort "Band" (i18n `assessment.band`).
_Undvik_: Bandplacering ("placering" är reserverat för rollplacering av medarbetare och kan läsas som ett manuellt moment), Bandning (aktiviteten), Grad, Override (finns inte)

**Ankarroll** *(kod: Anchor role)*:
En referensroll med ett överenskommet/förväntat band, använd för att kalibrera och rimlighetspröva modellen tvärs funktioner. INTE samma som ett **ankare** (ett kriteriums 0–5-text).
_Undvik_: Benchmark-roll, Referens (var tydlig)

**AI-förslag** *(kod: AI suggestion)*:
Ett värde som AI föreslår (t.ex. jobbprofil-text, senare betyg) — alltid med proveniens (källa, modell) och status *föreslagen → bekräftad/avvisad*. HR bekräftar alltid; AI beslutar aldrig och rör aldrig den deterministiska poäng-/bandvägen. Tvärgående (gäller även konfiguration). Se ADR-0003. Tekniskt har förslaget även statusarna genererar (under AI-anropet) och misslyckad (med felkod som i18n-nyckel).
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
| `assessment.role.decisionMandate` | Beslutsmandat | Decision mandate |
| `assessment.role.stakeholders` | Intressenter | Stakeholders |
| `assessment.role.knowledge` | Kunskapskrav | Knowledge requirements |
| `assessment.role.financial` | Finansiellt ansvar | Financial responsibility |
| `assessment.role.people` | Personalansvar | People responsibility |
| `assessment.role.risk` | Risk/konsekvens | Risk/consequence |
| `assessment.role.deliverables` | Leverabler | Deliverables |
| `assessment.assessment` | Värdering | Assessment |
| `assessment.rating` | Betyg | Rating |
| `assessment.motivation` | Motivering | Motivation |
| `assessment.score` | Totalpoäng | Score |
| `assessment.band` | Band | Band |
| `assessment.anchorRole` | Ankarroll | Anchor role |
| `assessment.aiSuggestion` | AI-förslag | AI suggestion |
| `assessment.status.draft` | Utkast | Draft |
| `assessment.status.inReview` | Under granskning | In review |
| `assessment.status.approved` | Godkänd | Approved |

## Flaggade oklarheter

- **Roll ≠ Person (hård gräns)**: role-/rating-tabellerna får ALDRIG bära person-, löne- eller prestationsfält — sådan data hör till framtida people-/pay-kontexter (V2, se CONTEXT-MAP). **Roll-id är stabilt och permanent**: omvärdering ändrar betyg/poäng/band men aldrig rollens identitet, och roll-id återanvänds aldrig (V2:s lika/likvärdigt arbete-gruppering hänger på det).
- **Ankare vs Ankarroll**: ett **ankare** är ett kriteriums 0–5-text (Värderingsmodell); en **ankarroll** är en referensroll för kalibrering. Samma ord, olika saker — säg alltid "ankarroll" explicit.
- **Rollplacering (V2-term)**: att koppla en medarbetare till en roll och ge hen sin **nivå** inom rollens track (ADR-0005: nivån är individdata). Hör till den framtida people-kontexten, aldrig assessment. Därför är "placering" reserverat för medarbetare-mot-roll och används inte om band (säg "bandutfall").
- **Blindning (mildrad av HR-only)**: eftersom bara betrodd HR använder verktyget handlar blindningen om att undvika att totalen styr betygen, inte om att förhindra fusk. Arbetsdefault: viktpoängen sätts i modellkonfigurationen; vid inmatning av betyg ser bedömaren bara kriterier + ankare (inga viktpoäng); poängen och föreslaget band visas i resultatsteget, inte live under betygsättningen. Skärp senare vid behov.
- **Ingen bandöverride (avviker från briefen)**: briefen nämnde manuell bandjustering med dokumenterad anledning; vi tar bort det. Band är alltid det deterministiska utfallet — vill man ändra justerar man betyg eller modell (stöds av live-omräkning + revisionslogg). Stärker objektiviteten; lätt att återinföra senare.

## Exempeldialog
— "Vad matar jag egentligen in när jag värderar rollen Software Developer?"
— "Bara ett 0–5-betyg per kriterium, med ankartexten som vägledning. Du sätter inte betydelse eller ser totalen här — poängen och föreslaget band dyker upp i resultatsteget när du är klar."
