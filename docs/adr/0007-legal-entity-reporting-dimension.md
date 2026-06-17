# Juridisk enhet och land: en organisation per företag, med organisationsväljare

**Status:** accepterad — 2026-06-17

Utlöst av implementationsunderlaget för rapportering, data och synlighet enligt EU:s lönetransparensdirektiv (2026-06). Direktivets gap-rapportering och svensk lönekartläggning görs per **juridisk enhet** (arbetsgivare) och kan brytas ned per **land**; storlekströsklarna (100 / 150 / 250 anställda) räknas per enhet.

**Beslut (2026-06-17):** varje företag / juridisk enhet är en egen **organisation** (tenant, ADR-0001 oförändrad). En användare kan vara medlem i **flera organisationer** och byter aktiv organisation via en **organisationsväljare** högst upp i sidofältet, på samma sätt som teamväxlaren i Polyform (referensimplementation: /Volumes/development/personal/polyform). Detta är alternativ B nedan, valt för att det är enklast och faller naturligt ut ur stacken.

## Avvägning / varför

- **Enklast (PLAN-V1 §1).** Ingen ny enhetsdimension i datamodellen, ingen migrering. Den vanliga SMB-kunden har en organisation och ser aldrig växlaren; en koncern lägger till fler organisationer och byter mellan dem.
- **Faller ut ur Better Auth.** Org-pluginet stödjer redan att en användare är medlem i flera organisationer med en aktiv organisation. Växlaren är i huvudsak ett UX-lager, inte en datamodellsändring.
- **Org = juridisk enhet ger rapporteringsaxeln gratis.** `organizations.country` och `employeeCount` är redan per organisation, alltså per juridisk enhet, vilket är exakt vad rapporteringen och trösklarna behöver. Den tidigare oron att lägga till en enhetsdimension försvinner.
- **Matchar hur jämförelsen är scopad.** "Arbete av lika värde" och lönekartläggning jämförs inom en arbetsgivare, inte över koncernen. Separata modeller per organisation är därför rätt scope, inte en kompromiss.

## Konsekvenser

- **Bygge (accounts / E1):** organisationsväljare (Better Auths aktiva organisation), flöde för att skapa eller gå med i fler organisationer. Inte beroende av V2-lönedata; kan landa självständigt när det behövs.
- `employeeCount` måste bli auktoritativt per organisation (i V2 härlett från importerade medarbetare) innan det grindar 100 / 150 / 250-trösklarna; dagens valfria AI-kontextfält duger inte. (Söm i PLAN-V1 §11.)
- **Avvägning som tas medvetet:** ingen delad jobbarkitektur mellan en kunds organisationer (varje organisation har sin egen modell) och ingen inbyggd koncernöversikt över enheter. Inget av detta krävs av direktivet (rapportering är per arbetsgivare). Ett framtida grupp-, rollup- eller modelldelningslager kan referera till befintliga organisationer additivt, det är ingen migrering. Uppskjutet tills en kund faktiskt behöver det.

## Övervägda alternativ

- **A. En tenant med en juridisk-enhet-dimension (ursprungligt förslag, bortvalt 2026-06-17):** enheter som rader under en organisation, delad jobbarkitektur, rollup per enhet och land. Ger delad modell och koncernöversikt, men kostar en ny dimension i datamodellen och i UI för en vinst (delad modell, rollup) som inte krävs av direktivet och ändå kan läggas till additivt senare. Bortvald till förmån för den enklare organisation-per-företag.
- **C. Skjut upp helt:** bortvalt, den strukturella frågan behövde ett svar innan rapportlagret designas.
