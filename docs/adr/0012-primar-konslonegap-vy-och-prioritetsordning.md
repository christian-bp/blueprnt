# Könslönegapet är kartläggningens obligatoriska primärvy och P1 (v3-direktiv, utvidgar ADR-0011)

**Status:** accepterad 2026-07-12

Utlöst av v3 av metodstödet `Lonekartlaggning_Steg_for_Steg_Guide v3.md` (Del 3, nytt avsnitt "Primärt fokus: Löneskillnader mellan kvinnor och män"). v3 slår fast att könslönegapet (kvinna vs. man) för lika och likvärdigt arbete är kartläggningens primära, lagstadgade syfte, och att det ska vara den förvalda, alltid-aktiva vyn. Denna ADR utvidgar ADR-0011 (kartläggningens livscykel) med analysvyns prioritet och slutförandegrind. Rättslig grund: Diskrimineringslagen 3 kap. 8-10 §§; EU 2023/970 Art. 4 och 9.

## Beslut

1. **Primärvy (SYSTEMKRAV).** Kön-mot-kön-jämförelsen är kartläggningens obligatoriska, förvalda, alltid-aktiva primärvy. Den kan inte stängas av; den är utgångspunkten i varje kartläggning.
   - **Steg 1, lika arbete:** grupp = `job_title` + band + level. Tabell per grupp: antal kvinnor, medellön kvinna, antal män, medellön man, lönegap %, flagga.
   - **Steg 2, likvärdigt arbete:** grupp = band. Samma kolumner.

2. **Fyra flaggnivåer, en delad sanningskälla.** 🔴 Kritisk: gap > 10%. 🟠 Varning: gap 5-10% (5% = EU-tröskeln). ✅ OK: gap < 5% (dokumenteras som genomförd kontroll). ⚪ Otillräckligt underlag: färre än 4 individer i gruppen ELLER gruppen saknar ett av könen (kan inte analyseras statistiskt; dokumentera och motivera). Nivåerna kodas som EN pur, delad helper i `packages/core` (t.ex. `classifyPayGap(womenCount, menCount, gapPct)`), konsumerad av både Convex-aggregatqueryn och UI:t (ADR-0002-mönstret, DRY). Queryn lämnar aldrig individrader för en ⚪-grupp.
   - Dessa fyra nivåer är **skilda** från (a) könsdominansflaggan (>= 60%, en P2-signal) och (b) den gemensamma lönebedömningens 5%-tröskel (rättslig trigger för joint pay assessment, inte flaggmodellen). Begreppen får inte konflateras.
   - Statistisk otillräcklighet (⚪) är **skild** från integritets-cellmaskning: en grupp med 20 kvinnor och 0 män maskeras inte av storlek men ger ändå inget gap.

3. **Minsta gruppstorlek = 4.** Standarden för både ⚪-underlag och integritetsmaskning höjs från de tidigare provisoriska 3 (v2-salary-import-design) till 4, i linje med v3. Fortsatt konfigurerbar per organisation (HR/Legal sign-off).

4. **Prioritetsordning (ska återspeglas i UX-flödet).** P1 = könslönegap (lika + likvärdigt), alltid obligatorisk, förvald primärvy. P2 = utökade jämförelser (jobbfamilj, kohort, kors-funktionell, intersektionell) som kompletterande "förstå varför", byggs efter P1 och ersätter den aldrig. P3 = frivillig icke-köns-kvalitetskontroll (lönespridning inom en roll, bandkonsistens, off-policy-individer). ADR-0011:s off-policy/bandpolicyintervall-entitet är **P3-kompletterande**, inte jämbördig med P1.

5. **Slutförandegrind (utvidgar ADR-0011:s statusflöde).** En kartläggning kan gå Under granskning -> Slutförd/Arkiverad först när P1 är beräknad och dokumenterad mot den frysta ögonblicksbilden, och varje 🔴/🟠-flaggad osaklig skillnad bär ett dokumenterat sakligt skäl eller en åtgärdsplan (⚪-grupper dokumenterade och motiverade). Detta är kartläggningsnivåns motsvarighet till CLAUDE.md:s formulär-slutförandegrindar.

6. **Likvärdigt arbete = band i primärvyn.** v3:s Steg-2-tabell grupperar per band. Detta försonas med PLAN-V1 §9.13 ("likvärdigt arbete ≠ band rakt av"): primärvyn grupperar per band som v3 kräver, medan §9.13:s poäng-härledda toleransklustring är ett striktare rättsligt försvarslager ovanpå den grupperingen. Band är en grovindelning av poäng, så de två är kompatibla (band först i primärvyn, poäng-klustring som förfining, inte som ersättning).

## Konsekvenser

- Den obligatoriska primärvyn är den **första** analysleveransen, före någon generell jämförelse- eller filtreringsmotor (som är P2). Sekvensen: kartläggning + ögonblicksbild (ADR-0011) -> pur gap-motor i `packages/core` -> P1-primärvy (Steg 1 + Steg 2) med flaggor och maskning -> därefter P2/P3.
- **Datamodellen kräver ingen ändring.** Kön är obligatoriskt (`Man`/`Kvinna`), `title`/band/level och det FTE-justerade lönemåttet finns eller härleds redan. Ingen ny tabell krävs för primärvyn.
- Gap- och grupplogik är deterministisk och AI-fri (ADR-0003-utvidgningen, PLAN §11 söm 5) och körs mot den frysta ögonblicksbilden (ADR-0011), aldrig mot live-data.

## Ändrar inte ADR-0002 / 0008 / 0011

- ADR-0002 (live-omräkning) står fast för arbetsytan. Primärvyn beräknas mot ögonblicksbilden.
- ADR-0011:s livscykel och två-lagersmodell står fast; denna ADR lägger till primärvyns SYSTEMKRAV, P1/P2/P3-ordningen och P1-slutförandegrinden.
