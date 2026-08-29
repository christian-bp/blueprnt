# ADR-0025: "Omfattas ej" utesluter kriteriet ur viktningen

**Status:** accepterad (2026-08-29)

## Kontext

Betygsskalan är 1 till 5. Värdet 0 finns bara på ett aktivt arbetsförhållandekriterium och betyder "rollen omfattas inte av det definierade villkoret" (ADR-0022). Motorn räknade nollan som ett betyg: den bidrog med noll i täljaren, medan kriteriets viktpoäng låg kvar i nämnaren.

Det gav två fel. Rollen straffades för att den inte var exponerad, vilket är motsatsen till vad kriteriets egen definition säger. Och det satte ett tak på skalan: en roll som fick 5 på varje kriterium den faktiskt mättes på nådde 85 vid arbetsförhållandevikt 3, och 76 vid vikt 5. Nivå 1 var oåtkomlig i varje uppsättning och nivå 2 föll bort så fort vikten var 3 eller mer. Metodens upphovsman identifierade orsaken 2026-08-28 och föreslog att kriteriet i stället utesluts helt.

## Beslut

1. **En nolla är en markering, inte ett betyg.** `NOT_COVERED` (`packages/core/src/dimensions.ts`) är dess namn, och `scoreRole` drar bort kriteriets viktpoäng från nämnaren samtidigt som det utelämnas ur täljaren. Rollen viktas alltså bara på de kriterier den faktiskt mäts på.
2. **Formeln är oförändrad i övrigt** (ADR-0004): `floor(20 x summa(betyg x viktpoäng) / summa(viktpoäng))`, summerat över de mätta kriterierna. Poängbudgeten, viktskalan och andelarna på modellnivå rörs inte.
3. **Ett kriterium rollen inte omfattas av visas som "omfattas ej"** i bidragslistan, inte som 0 %: en nolla i en lista som heter Bidrag läses som "mättes och bidrog inget".
4. **Betygsstegets steg 1 är fortfarande ett krav.** Ett kriterium med värdet 1 ligger kvar i både täljare och nämnare. Ordningen 0 -> 1 är alltså inte längre monoton (se konsekvenser).

## Övervägda alternativ

- **Behåll nollan i nämnaren och kalibrera om trappan.** §14.2 förbjuder att flytta gränserna aritmetiskt, och en omkalibrering hade dolt räknefelet i stället för att rätta det. Bortvald.
- **Låt nollan räknas som skalans botten (1).** Tar bort taket bara delvis (taket blir 20 x (5W - 4w)/W) och påstår dessutom att en roll utan exponering ändå bär ett bottenkrav. Bortvald.

## Konsekvenser

- **Vikterna omfördelas för den enskilda rollen.** Poängbudgeten är fast per modell, men en roll som inte omfattas mäts mot en omnormerad uppsättning: de övriga kriteriernas andelar stiger proportionellt. Det är vad "gäller inte" betyder matematiskt, och det innebär att två roller i samma organisation kan mätas mot något olika andelar.
- **Ordningen mellan "omfattas ej" och steg 1-2 är inverterad.** En roll med ett litet men verkligt krav (steg 1) hamnar under sin egen profils medel, medan en roll utan krav alls hamnar på det. Två i övrigt identiska roller med sex kriterier på steg 4 och arbetsförhållanden viktat 3 landar på 80 (omfattas ej), 77 (steg 3) och 82 (steg 5). Det är en inbyggd egenskap hos en viktad medelvärdesmodell: ett lågt betyg drar alltid ned mot sig. Frågan är hänskjuten till metodens upphovsman: den kan bara lösas i ankartexterna (vad steg 1 ska betyda) och inte i motorn.
- Demo-organisationens nivåfördelning flyttades uppåt och är ompinnad i `devCompany.test.ts`. Ankarrollens överenskomna nivå stämmer fortfarande med den härledda.
- Nivå 1 är nu nåbar. ADR-0024:s noterade konsekvens om oåtkomlig topp är därmed löst.
