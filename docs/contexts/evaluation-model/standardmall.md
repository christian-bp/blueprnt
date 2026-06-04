# Standardmall & betydelseskala

Referensdata för värderingsmodellens standardmall. (Status: arbetsutkast — etikettsordval ska bekräftas.)

## Betydelseskala (fast, 7 nivåer)

Skalan är **fast** — den ändras inte av användaren. Varje nivå har en textetikett (det HR ser) och en intern vikt (det motorn räknar med). Vikterna är de 7 distinkta värdena från Excel-modellen.

| Nivå | Vikt (intern) | Svenska (`model.importance.*`) | English |
| --- | --- | --- | --- |
| 7 (högst) | 18 | Avgörande | Critical |
| 6 | 14 | Mycket viktigt | Very important |
| 5 | 13 | Viktigt | Important |
| 4 | 12 | Ganska viktigt | Fairly important |
| 3 | 11 | Måttligt viktigt | Moderately important |
| 2 | 10 | Lite viktigt | Slightly important |
| 1 (lägst) | 8 | Minst viktigt | Least important |

**Beslut:** ingen "Inte alls viktigt"/0-nivå — vi behåller 7 nivåer, lägst = "Minst viktigt" (vikt 8). Alla kriterier i modellen räknas alltså med; vill man inte väga in ett kriterium tar man bort det.

## Standardmall — 9 kriterier med förvald betydelse

Så här anpassar en arbetsyta modellen: HR tilldelar varje kriterium en betydelsenivå (väljer etiketten), vilket sätter vikten. Standardmallen levereras förifylld så här (vikterna = Excelns):

| Kriterium | Betydelse (standard) | Vikt |
| --- | --- | --- |
| Scope & Påverkan | Avgörande | 18 |
| Risk & Konsekvens | Mycket viktigt | 14 |
| Komplexitet & Otydlighet | Viktigt | 13 |
| Autonomi & Beslutsmandat | Ganska viktigt | 12 |
| Intressentbredd | Måttligt viktigt | 11 |
| Kunskapsdjup/Bredd | Måttligt viktigt | 11 |
| Finansiellt ansvar | Måttligt viktigt | 11 |
| Personal-/Ledningsansvar | Lite viktigt | 10 |
| Formell kompetens | Minst viktigt | 8 |

Varje kriterium har dessutom en 0–5-ankarskala (textbeskrivningar per betyg). Kanonisk ankaruppsättning = fliken "Vikter & faktorer"; den alternativa ankarversionen för Kunskapsdjup/Bredd i fliken "Arbetsblad_enbart" är ett utkast och seedas **inte**.

> Obs: summan av standardvikterna är 108. I den här modellen finns inget krav på att vikterna summerar till 100 — bandtrösklarna sätts på den poängskala som vikterna ger (max = 108 × 5 = 540).

## Standard-bandtrösklar (7 band, seedas i standardmallen)

Excelns 7-bandskolumn (den som faktiskt användes i resultatfliken). Band 1 = högst; tröskel = lägsta poäng (inklusive).

| Band | Minpoäng |
| --- | --- |
| Band 1 | 530 |
| Band 2 | 450 |
| Band 3 | 400 |
| Band 4 | 340 |
| Band 5 | 285 |
| Band 6 | 220 |
| Band 7 | 0 |

- Excelns alternativa **10-bandskolumn** (500/450/…/0) används medvetet **inte**.
- I prototypdatan är **Band 2 (450–529) tomt** — det är en egenskap hos datat, inte ett fel; bekräftat ok.
- **Kompetensmatrisens bandbeskrivningar täcker Band 1–6**; Band 7 saknar beskrivande text. (Öppet: skriv en Band 7-beskrivning — instegsband — eller dokumentera medvetet att den saknas.)

## Track-schema

Track-schemat: **IC1–IC5, Lead 1–3, M1–M3.** Nivådefinitioner och rådgivande guardrail-intervall för IC-nivåerna, Lead-1/Lead-2 och M-nivåerna seedas från Excel-fliken "Track". Lead-3 finns inte i Excel; definitionen nedan gäller.

### Lead-3

> **Lead-3 – Strategisk koordinerande roll (utan fullt personalansvar)**
> Ger riktning åt och samordnar flera områden, team eller initiativ och säkerställer strategisk helhet, prioritering och hantering av beroenden på tvärs. Påverkar genom inflytande, koordinering och vägledning snarare än formellt personalansvar.

Guardrail-intervall (rådgivande), med grannarna som kalibreringsreferens:

| Kriterium | Lead-2 | **Lead-3** | IC5 | M2 |
| --- | --- | --- | --- | --- |
| Scope & Påverkan | 3–4 | **4–5** | 4–5 | 4–4 |
| Komplexitet & Otydlighet | 3–4 | **4–5** | 4–5 | 3–4 |
| Autonomi & Beslutsmandat | 3–4 | **4–5** | 4–5 | 3–4 |
| Intressentbredd | 3–4 | **4–5** | 3–4 | 4–4 |
| Kunskapsdjup/Bredd | 3–4 | **3–4** | 5–5 | 3–4 |
| Risk & Konsekvens | 3–4 | **4–5** | 4–5 | 4–4 |
| Finansiellt ansvar | 1–2 | **1–2** | 1–2 | 3–4 |
| Personal-/Ledningsansvar | 1–1 | **1–1** | 0–1 | 4–4 |

**Motivering (kort):** Lead-3 fullföljer trackens jämna +1-progression (Lead-1 → Lead-2 → Lead-3) och når strategisk nivå via bredd: scope, komplexitet, autonomi, intressentbredd och risk. Kunskap hålls på 3–4 (IC5 äger kunskapstaket 5–5). Två hårda tak skiljer Lead-tracken från Manager-tracken: **Personal 1–1** och **Finans 1–2** (M2: 4–4 respektive 3–4); M2 bär personal- och budgetansvar medan Lead-3 når sin tyngd via bredd och autonomi. Därmed kan IC5, Lead-3 och M2 landa i jämförbara band via olika profiler, i linje med principen att band härleds ur poäng, inte track. Att koordinering och intressentbredd får nå toppen medan personal/finans hålls lågt följer HR-kritikens varning för att övervärdera synligt mandat relativt faktisk påverkan.

## Medvetet ignorerat från Excel-prototypen

- **"Helper"-fliken** (8 kriterier, summa 100, andra värden) är en föråldrad/oanvänd viktuppsättning som **inte** används av resultatberäkningen — den seedas aldrig.
- **Kompetensmatrisens Band→Track-koppling** (t.ex. "Band 1 = Head of X") är *deskriptiv dokumentation*, inte en regel — den seedas **inte** som styrande logik. Band härleds alltid enbart från poängen (track bestämmer aldrig band).
- **"Impact on Exit"**: kolumnens bidrag i resultatfliken är **inte** en formel av betyget (ingen vikt kopplar dem — en fri justeringspost i prototypen). Den seedas därför **inte** som kriterium. Vill en arbetsyta ha den blir den ett vanligt eget kriterium viktat via 7-skalan — då reproduceras prototypens exakta totaler inte för berörda roller (accepterat).
