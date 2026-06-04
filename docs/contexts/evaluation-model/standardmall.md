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

## Medvetet ignorerat från Excel-prototypen

- **"Helper"-fliken** (8 kriterier, summa 100, andra värden) är en föråldrad/oanvänd viktuppsättning som **inte** används av resultatberäkningen — den seedas aldrig.
- **"Impact on Exit"**: kolumnens bidrag i resultatfliken är **inte** en formel av betyget (ingen vikt kopplar dem — en fri justeringspost i prototypen). Den seedas därför **inte** som kriterium. Vill en arbetsyta ha den blir den ett vanligt eget kriterium viktat via 7-skalan — då reproduceras prototypens exakta totaler inte för berörda roller (accepterat).
