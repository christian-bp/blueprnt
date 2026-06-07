# Viktning med poängbudget: synliga viktpoäng 1 till 5 i ett nollsummespel

**Status:** accepterad (2026-06-06)

Kriterier viktas med **viktpoäng 1 till 5** (heltal, 3 = neutral) under en fast **poängbudget = antal kriterier × 3**. Summan av alla viktpoäng måste vara exakt lika med budgeten: att höja ett kriterium kräver att sänka ett annat. Procentandelen per kriterium (viktpoäng / summa) är en **härledd visning**, aldrig en inmatning. Detta ersätter den tidigare fasta 7-gradiga betydelseskalan med dolda vikter (8, 10, 11, 12, 13, 14, 18) från Excel-prototypen. Källdokument: [viktning-poangbudget.md](../contexts/evaluation-model/viktning-poangbudget.md).

Rollens totalpoäng normaliseras till en fast skala **0 till 100**: poäng = 20 × Σ(betyg × viktpoäng) / Σ(viktpoäng), avrundad nedåt till heltal. Bandtrösklar är heltal på 0 till 100-skalan; nedåtavrundningen gör att jämförelsen mot heltalströsklar är exakt (visad poäng ≥ tröskel om och endast om den oavrundade poängen är det). Standardmallens trösklar översätts från prototypens andelar av max: 98, 83, 74, 63, 53, 41, 0.

## Avvägning / varför

- **Fri viktning skapar inflation:** den gamla skalan lät alla kriterier vara "Avgörande" samtidigt, vilket är exakt det problem källdokumentet beskriver. Budgeten tvingar fram verklig prioritering (nollsummespel) i stället för att be om den.
- **Dolda tal byts mot begränsade tal:** den gamla invarianten "vikter visas aldrig som tal" fanns för att undvika falsk precision i fria procentsatser. Poängbudgeten löser samma problem från andra hållet: små heltal med hård budget, där procent är en konsekvens. Invarianten skrivs om till: **vikter anges aldrig som fri procent eller godtyckliga tal; de allokeras som viktpoäng 1 till 5 inom budgeten, och andelen är härledd.**
- **Normaliserad totalpoäng gör trösklarna stabila:** med rå summa (Σ betyg × vikt) förskjuts maxpoängen varje gång ett kriterium läggs till eller tas bort (en redan känd skörhet i den gamla modellen, där max = 540 bara gällde standardmallen). På 0 till 100-skalan betyder trösklarna samma sak oavsett hur många kriterier modellen har.

## Systemregler (upprätthålls i mutationerna, databasen är alltid balanserad)

- **Nytt kriterium får alltid 3 viktpoäng** (neutral). Budgeten växer med 3 samtidigt, så balansen består automatiskt. Detta gäller även AI-utkast: ett utkast valideras och repareras deterministiskt till exakt budget innan det sparas.
- **Omviktning sker atomiskt:** en batch-mutation tar emot hela allokeringen, validerar varje värde (heltal 1 till 5) och exakt summa, och ger en band-shift-diff och en revisionsloggrad per sparning. UI:t redigerar lokalt med en realtidsmätare ("X poäng kvar att fördela") och sparar balanserat.
- **Borttagning omfördelar deterministiskt:** budgeten minskar med 3 medan summan minskar med kriteriets viktpoäng, så mellanskillnaden (3 − viktpoäng) absorberas av de kvarvarande kriterierna med samma deterministiska vandring som reparerar AI-utkast (tyngsta sänks vid överskott, lättaste höjs vid underskott; lika värden tas i visningsordning). Varje justering loggas i borttagningens revisionsrad; borttagning är alltid ett klick. *(Ursprungsbeslutet krävde att kriteriet stod på 3 före borttagning; ändrat 2026-06-07 efter användartest, kravet tvingade fram ett bakvänt flöde där ett lätt kriterium först måste viktas upp för att få tas bort.)*
- **AI-viktgranskningen föreslår balanserade flyttar** ("flytta 1 viktpoäng från X till Y"), där varje flytt i sig är ett nollsummedrag. HR kan därför bekräfta valfri delmängd av flyttarna utan att budgeten någonsin bryts (ADR-0003:s förslag/bekräfta-modell oförändrad).

## Övervägda alternativ

- **Behålla 7-gradiga betydelseskalan:** bortvald; ingen framtvingad prioritering, och etiketter med dolda vikter är svårare att förklara än synliga poäng med budget.
- **Rå summa som totalpoäng:** bortvald; skalan beror på antalet kriterier, så trösklar och jämförbarhet går sönder vid varje modelländring.
- **Mjuk balans (obalanserat läge får sparas, resultat spärras):** bortvald; alltid-balanserad databas är enklare att resonera om, ger en ren metodbilaga och matchar källdokumentets regel "summan måste vara exakt lika med budgeten".

## Konsekvenser

- `packages/core` byter `IMPORTANCE_SCALE` (7 nivåer → vikt) mot viktpoäng + budgetkonstanter och normaliserad poängberäkning; determinismen består (heltalsaritmetik, ADR-0002 opåverkad).
- Excel-prototypens exakta totaler (540-skalan) kan inte längre reproduceras; golden-testerna ersätts med nya på 0 till 100-skalan. Standardmallens trösklar (98/83/74/63/53/41/0) är en översättning av prototypens andelar och ska kalibreras mot verklig data innan lansering.
- Den 7-gradiga betydelseskalans i18n-etiketter (`model.importance.*`) utgår. Ordlistans termer Betydelse/Betydelseskala ersätts av **Viktpoäng**, **Poängbudget** och **Andel**.
- Standardmallen seedas med källdokumentets §6-fördelning: Scope 5, Komplexitet 4, Autonomi 4, Risk 3, Kunskapsdjup 3, Intressentbredd 3, Finansiellt 2, Personal/Ledning 2, Formell kompetens 1 (summa 27). Observera att detta medvetet omprioriterar mot den gamla mallen: Risk flyttas från andra plats till mitten, Autonomi upp till delad andra plats.
- Migrering behövs inte: pre-launch, dev återställs med `db:reset` och prod med `seedProduction`.
