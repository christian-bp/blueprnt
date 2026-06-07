# Standardmall, viktpoäng & bandtrösklar

Referensdata för värderingsmodellens standardmall. (Status: arbetsutkast.)

## Viktpoäng & poängbudget (1 till 5, summa = antal kriterier × 3)

Sedan 2026-06-06 viktas kriterier med **viktpoäng 1 till 5** under en fast **poängbudget = antal kriterier × 3** (se [viktning-poangbudget.md](./viktning-poangbudget.md) och ADR-0004). Skalan ersätter den tidigare 7-gradiga betydelseskalan med dolda Excel-vikter (8 till 18).

| Viktpoäng | Tolkning |
| --- | --- |
| 5 | Relativt högsta vikt |
| 4 | Hög relativ vikt |
| 3 | Normal / balanserad vikt (neutral mittpunkt; förval för nya kriterier) |
| 2 | Lägre relativ vikt |
| 1 | Relativt lägst vikt |

- Summan av alla viktpoäng måste vara **exakt lika med budgeten**: att höja ett kriterium kräver att sänka ett annat (nollsummespel).
- **Andelen** per kriterium (viktpoäng / summa) är härledd visning, aldrig inmatning.
- **Beslut (oförändrat från 7-skalan):** ingen 0-nivå — alla kriterier i modellen räknas med; vill man inte väga in ett kriterium tar man bort det. Vid borttagning omfördelas mellanskillnaden mot budgeten deterministiskt till de kvarvarande kriterierna, så balansen består (ADR-0004).

## Standardmall — 9 kriterier med förvalda viktpoäng (summa 27)

Så här anpassar en organisation modellen: HR omfördelar viktpoängen inom budgeten (9 kriterier → 27 poäng). Standardmallen levereras förifylld enligt källdokumentets §6 (normativt, beslut 2026-06-06); tabellordningen är också mallens visningsordning:

| Kriterium | Viktpoäng | Andel |
| --- | --- | --- |
| Scope & Påverkan | 5 | 18,5 % |
| Komplexitet & Otydlighet | 4 | 14,8 % |
| Autonomi & Beslutsmandat | 4 | 14,8 % |
| Risk & Konsekvens | 3 | 11,1 % |
| Kunskapsdjup/Bredd | 3 | 11,1 % |
| Intressentbredd | 3 | 11,1 % |
| Finansiellt ansvar | 2 | 7,4 % |
| Personal-/Ledningsansvar | 2 | 7,4 % |
| Formell kompetens | 1 | 3,7 % |

> Obs: förvalen omprioriterar **medvetet** mot Excel-prototypen: Risk & Konsekvens flyttar från andra plats till mitten, Autonomi & Beslutsmandat upp till delad andra plats, Finansiellt ansvar ned ett snäpp.

Varje kriterium har dessutom en 0–5-ankarskala (textbeskrivningar per betyg). Kanonisk ankaruppsättning = fliken "Vikter & faktorer"; den alternativa ankarversionen för Kunskapsdjup/Bredd i fliken "Arbetsblad_enbart" är ett utkast och seedas **inte**.

## Totalpoäng (normaliserad 0 till 100)

Rollens totalpoäng = **20 × Σ(betyg × viktpoäng) / Σ(viktpoäng)**, avrundad nedåt till heltal. Max är alltid 100 oavsett antal kriterier, så bandtrösklarna behåller sin innebörd när kriterier läggs till eller tas bort. Nedåtavrundningen gör jämförelsen mot heltalströsklar exakt: visad poäng ≥ tröskel om och endast om den oavrundade poängen är det.

## Standard-bandtrösklar (7 band, seedas i standardmallen)

Band 1 = högst; tröskel = lägsta poäng (inklusive) som heltal på 0 till 100-skalan. Förvalen är Excel-prototypens trösklar översatta till andel av max (530/540 → 98 osv.):

| Band | Minpoäng |
| --- | --- |
| Band 1 | 98 |
| Band 2 | 83 |
| Band 3 | 74 |
| Band 4 | 63 |
| Band 5 | 53 |
| Band 6 | 41 |
| Band 7 | 0 |

- **Kalibrering återstår:** viktspridningen ändras med nya skalan (5:1 mot prototypens 18:8), så rollfördelningen blir inte identisk med prototypens. Trösklarna ska kalibreras mot verklig data före lansering.
- Excelns alternativa **10-bandskolumn** användes medvetet **inte** (historisk anteckning; prototypens exakta totaler på 540-skalan kan inte längre reproduceras).
- **Kompetensmatrisens bandbeskrivningar täcker Band 1–6**; Band 7 saknar beskrivande text. (Öppet: skriv en Band 7-beskrivning — instegsband — eller dokumentera medvetet att den saknas.)

## Track-schema

Track-schemat: **IC1–IC5, Lead 1–3, M1–M3.** Sedan 2026-06-07 (ADR-0005) bär roller bara en **track**; nivåerna är **referensdata för V2:s rollplacering** (individens senioritet) och seedas i modellen i väntan på den. Guardrail-intervallen (min/max per nivå och kriterium, kurerade från Excel-fliken "Track") är **pensionerade ur V1:s betygsflöde** och står kvar här som referens, t.ex. som placeringsstöd i V2; de seedas inte längre. Lead-3 finns inte i Excel; definitionen nedan gäller.

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
- **"Impact on Exit"**: kolumnens bidrag i resultatfliken är **inte** en formel av betyget (ingen vikt kopplar dem — en fri justeringspost i prototypen). Den seedas därför **inte** som kriterium. Vill en organisation ha den blir den ett vanligt eget kriterium viktat med viktpoäng inom poängbudgeten.
