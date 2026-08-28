# Standardmall, viktpoäng & nivåtrösklar

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

Rollens totalpoäng = **20 × Σ(betyg × viktpoäng) / Σ(viktpoäng)**, avrundad nedåt till heltal. Max är alltid 100 oavsett antal kriterier, så nivåtrösklarna behåller sin innebörd när kriterier läggs till eller tas bort. Nedåtavrundningen gör jämförelsen mot heltalströsklar exakt: visad poäng ≥ tröskel om och endast om den oavrundade poängen är det.

## Standard-nivåtrösklar (12 nivåer, seedas i standardmallen)

Nivå 1 = högst; tröskel = lägsta poäng (inklusive) som heltal på 0 till 100-skalan. Nivåerna är grupperade i fyra zoner som är strukturlag, aldrig konfiguration (ADR-0022).

| Zon | Nivå | Minpoäng | Poängintervall | Bredd |
| --- | --- | --- | --- | --- |
| A | Nivå 1 | 97 | 97 till 100 | 4 |
| A | Nivå 2 | 86 | 86 till 96 | 11 |
| A | Nivå 3 | 77 | 77 till 85 | 9 |
| B | Nivå 4 | 69 | 69 till 76 | 8 |
| B | Nivå 5 | 62 | 62 till 68 | 7 |
| B | Nivå 6 | 56 | 56 till 61 | 6 |
| C | Nivå 7 | 50 | 50 till 55 | 6 |
| C | Nivå 8 | 45 | 45 till 49 | 5 |
| C | Nivå 9 | 40 | 40 till 44 | 5 |
| D | Nivå 10 | 35 | 35 till 39 | 5 |
| D | Nivå 11 | 30 | 30 till 34 | 5 |
| D | Nivå 12 | 0 | 0 till 29 | 30 |

- **Trösklarna är progressiva:** avståndet mellan nivåerna växer uppåt, så en förflyttning till de högsta nivåerna kräver en successivt större förändring i rollens samlade viktning, medan de lägre nivåerna ligger tätt nog att skilja roller som faktiskt skiljer sig åt.
- **Upplösning:** en nivå rymmer exakt så många hela viktningspoäng som den är bred, och en differentierad viktning når varje en av dem. En viktning vars poäng har en gemensam delare når bara var n:te, så en orörd modell där alla kriterier ligger kvar på vikt 3 löser upp en tredjedel så fint (33 möjliga viktningar i stället för 81). Golvet är dessutom 20, inte 0: betyget 1 på varje kriterium ger redan 20, så nivå 12:s nominella 30 poäng är i praktiken 20 till 29.
- Excelns alternativa **10-bandskolumn** (källdokumentets ord; vi säger nivå sedan ADR-0014) användes medvetet **inte** (historisk anteckning; prototypens exakta totaler på 540-skalan kan inte längre reproduceras).
- **Kompetensmatrisens nivåbeskrivningar täcker sex nivåer** och skrevs för den gamla sjunivåstegen. (Öppet: skriv nivåbeskrivningar för tolvnivåstegen, eller dokumentera medvetet att zonbeskrivningarna i ADR-0022 bär den rollen.)

## Track-schema

Track-schemat: **IC1–IC5, Lead 1–3, M1–M3.** Sedan 2026-06-07 (ADR-0005) bär roller bara en **track**; senioriteterna är individens senioritet vid rollplaceringen. Senioritetsladdrarna lever som konstanten `TRACK_SENIORITIES` i `@workspace/constants` (denna standardmall är prosareferens) och driver validering av individ-till-roll-placering; de seedas inte i modellen (ADR-0005, tillägg 2026-07-10). Guardrail-intervallen (min/max per senioritet och kriterium, kurerade från Excel-fliken "Track") är **pensionerade ur V1:s betygsflöde** och står kvar här som referens, t.ex. som placeringsstöd i V2; de seedas inte längre. Lead-3 finns inte i Excel; definitionen nedan gäller.

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

**Motivering (kort):** Lead-3 fullföljer trackens jämna +1-progression (Lead-1 → Lead-2 → Lead-3) och når strategisk nivå via bredd: scope, komplexitet, autonomi, intressentbredd och risk. Kunskap hålls på 3–4 (IC5 äger kunskapstaket 5–5). Två hårda tak skiljer Lead-tracken från Manager-tracken: **Personal 1–1** och **Finans 1–2** (M2: 4–4 respektive 3–4); M2 bär personal- och budgetansvar medan Lead-3 når sin tyngd via bredd och autonomi. Därmed kan IC5, Lead-3 och M2 landa på jämförbara nivåer via olika profiler, i linje med principen att nivån härleds ur poäng, inte track. Att koordinering och intressentbredd får nå toppen medan personal/finans hålls lågt följer HR-kritikens varning för att övervärdera synligt mandat relativt faktisk påverkan.

## Medvetet ignorerat från Excel-prototypen

- **"Helper"-fliken** (8 kriterier, summa 100, andra värden) är en föråldrad/oanvänd viktuppsättning som **inte** används av resultatberäkningen — den seedas aldrig.
- **Kompetensmatrisens Nivå→Track-koppling** (t.ex. "Nivå 1 = Head of X") är *deskriptiv dokumentation*, inte en regel — den seedas **inte** som styrande logik. Nivån härleds alltid enbart från poängen (track bestämmer aldrig nivån).
- **"Impact on Exit"**: kolumnens bidrag i resultatfliken är **inte** en formel av betyget (ingen vikt kopplar dem — en fri justeringspost i prototypen). Den seedas därför **inte** som kriterium. Vill en organisation ha den blir den ett vanligt eget kriterium viktat med viktpoäng inom poängbudgeten.
