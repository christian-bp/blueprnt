# Logik för viktning med poängbudget

*En enkel förklaring för HR, chefer och systemutvecklare.*

> **Om detta dokument (repo-anmärkning):** källdokument inlagt 2026-06-06 (från Google-dokumentet "Viktning", författat 2026-06-05). Detta är den kanoniska förklaringen av viktningsmodellen; den ersätter den tidigare fasta 7-gradiga betydelseskalan med dolda vikter (8 till 18) från Excel-prototypen. Beslutet och dess systemkonsekvenser är dokumenterade i [ADR-0004](../../adr/0004-point-budget-weighting.md). Tre preciseringar gäller i repot:
>
> 1. **Terminologi:** dokumentet säger "poäng" om vikterna. I produktspråket säger vi **viktpoäng**, eftersom Poäng (Score) redan är kanoniskt för rollens viktade total (se assessment-ordlistan). Den härledda procentsiffran kallas **andel**.
> 2. **Rollpoängen:** dokumentet definierar viktningen, inte rollens totalpoäng. Beslut 2026-06-06: totalpoängen normaliseras till en fast skala 0 till 100 (se ADR-0004), så bandtrösklarna förblir stabila oavsett antal kriterier.
> 3. **Standardmallens förval:** exemplet i §6 är normativt; standardmallen seedas med exakt den fördelningen (beslut 2026-06-06, se [standardmall.md](./standardmall.md)).

**Syfte.** Detta dokument förklarar varför vi använder en poängbudget för att vikta värderingsfaktorer, hur modellen fungerar och varför den är lättare att förstå och bygga in i system än fri viktning.

## 1. Problemet vi försöker lösa

När vi viktar värderingsfaktorer vill vi uttrycka hur viktiga de är i förhållande till varandra. Exempel på faktorer kan vara Scope & Påverkan, Komplexitet, Risk & Konsekvens och Ledningsansvar.

Om vi tillåter fri viktning uppstår nästan alltid samma problem: många upplever att just deras faktor är mycket viktig och vill därför sätta hög vikt på den. Då händer följande:

- för många faktorer får högsta vikt
- skillnaden mellan faktorer blir otydlig
- modellen slutar prioritera på riktigt
- procenttalen ser exakta ut, men säger mindre än man tror

Kort sagt: om allt blir högt prioriterat är inget egentligen prioriterat.

## 2. Grundidén i modellen

I stället för att börja med procent börjar vi med en enkel poängskala: 1 till 5 poäng per faktor.

- 1 poäng = relativt lägre vikt
- 3 poäng = normal / balanserad vikt
- 5 poäng = relativt högsta vikt

Sedan lägger vi till en total budget för hur många poäng som får delas ut totalt. Budgeten sätts till:

**antal faktorer × 3**

Det betyder att om vi har 9 faktorer blir den totala budgeten 27 poäng. Alla faktorer kan alltså inte få 5 poäng samtidigt, eftersom det skulle kräva 45 poäng. Modellen tvingar därför fram verkliga prioriteringar.

## 3. Varför just antal faktorer × 3?

Logiken är enkel: 3 är mittpunkten i en skala från 1 till 5. Om alla faktorer får 3 poäng har vi ett neutralt och balanserat utgångsläge.

Det gör modellen lätt att förstå:

- vill vi höja en faktor från 3 till 4 måste vi sänka någon annan från 3 till 2
- vill vi höja en faktor från 3 till 5 måste vi frigöra 2 poäng någon annanstans
- prioritering blir därför ett nollsummespel inom en tydlig ram

Detta är viktigt eftersom viktning egentligen inte handlar om att säga att allt är viktigt. Det handlar om att visa vad som är mer viktigt relativt annat.

## 4. En enkel analogi

Tänk att ni har en utvecklingsbudget i ett produktteam. Alla initiativ kan vara bra, men budgeten är begränsad. Om ni ger maxbudget till allt, då har ni i praktiken inte prioriterat. Ni har bara sagt ja till allt.

Samma logik gäller här:

- poängen är vår budget
- faktorerna konkurrerar inte om att vara bra eller dåliga
- de konkurrerar om relativ tyngd i modellen

För en utvecklare är detta alltså samma princip som begränsade resurser i systemdesign: när en resurs är begränsad måste trade-offs göras. Det är just trade-offen som gör modellen meningsfull.

## 5. Exempel med 5 faktorer

Anta att vi har 5 faktorer. Då blir budgeten: 5 × 3 = 15 poäng.

| Faktor | Poäng | Kommentar |
| --- | --- | --- |
| Scope & Påverkan | 5 | Mycket tung faktor i modellen |
| Komplexitet | 4 | Hög relativ vikt |
| Autonomi | 3 | Normal vikt |
| Risk & Konsekvens | 2 | Lägre relativ vikt än ovan |
| Formell kompetens | 1 | Relativt lägst vikt i just denna modell |

Totalt: 15 poäng. Det fungerar. Om någon vill höja Risk & Konsekvens från 2 till 4 måste två poäng tas från någon annan faktor. Modellen frågar alltså inte bara "vad är viktigt?" utan också "vad är viktigare än vad?".

## 6. Exempel med 9 faktorer

Anta att vi har 9 faktorer. Då blir budgeten: 9 × 3 = 27 poäng.

| Faktor | Poäng | Andel av total | Tolkning |
| --- | --- | --- | --- |
| Scope & Påverkan | 5 | 18,5 % | Högst relativ tyngd |
| Komplexitet | 4 | 14,8 % | Hög vikt |
| Autonomi | 4 | 14,8 % | Hög vikt |
| Risk & Konsekvens | 3 | 11,1 % | Normal till hög vikt |
| Kunskapsdjup | 3 | 11,1 % | Normal till hög vikt |
| Intressentbredd | 3 | 11,1 % | Normal till hög vikt |
| Finansiellt ansvar | 2 | 7,4 % | Lägre relativ vikt |
| Ledningsansvar | 2 | 7,4 % | Lägre relativ vikt |
| Formell kompetens | 1 | 3,7 % | Lägst relativ vikt |

Procenten kommer alltså efteråt, som en omräkning av poängen. Det är viktigt, eftersom procenten då blir ett resultat av prioriteringen, inte en fri åsikt från början.

## 7. Varför detta är bättre än fri procentviktning

Fri procentviktning låter först flexibel, men den skapar ofta sämre kvalitet. Poängbudget är bättre av flera skäl:

- Den förhindrar inflation i viktning.
- Den gör prioritering synlig och tvingande.
- Den är lättare att förklara för chefer och medarbetare.
- Den är lättare att implementera i ett system.
- Den är lättare att revidera, eftersom logiken är stabil även om faktorer ändras.

Ur ett HR-perspektiv hjälper detta oss att visa att modellen bygger på konsekvent intern logik. Ur ett systemperspektiv är modellen bra eftersom den har tydliga regler, enkla valideringar och förutsägbara utfall.

## 8. Koppling till systemlogik

För en utvecklare är modellen enkel att bygga eftersom den kan uttryckas som några tydliga regler:

1. Användaren anger antal faktorer.
2. Systemet sätter total budget = antal faktorer × 3.
3. Varje faktor får ett heltal mellan 1 och 5.
4. Summan av alla poäng måste vara exakt lika med budgeten.
5. Systemet räknar om varje faktor till procent: faktorpoäng / total poäng.

Det betyder att systemet enkelt kan:

- varna om användaren överskrider budgeten
- visa återstående poäng i realtid
- räkna fram procent automatiskt
- förhindra att modellen blir inkonsekvent

Det är alltså en bra modell både verksamhetsmässigt och tekniskt: verksamheten får tydlig prioritering och systemet får tydliga valideringsregler.

## 9. Det viktigaste att komma ihåg

- Poängen beskriver relativ vikt, inte om en faktor är bra eller dålig.
- Budgeten gör att prioritering måste ske på riktigt.
- Modellen blir mer rättvis eftersom man inte kan sätta allt på högsta nivå.
- Procenttal ska ses som en konsekvens av prioriteringen, inte som startpunkt.
- Logiken är enkel nog att förstå även utanför HR.

## 10. Rekommenderad formulering i modellen

Värderingsfaktorer viktas genom en femgradig poängskala där varje faktor tilldelas 1 till 5 poäng. För att säkerställa faktisk prioritering används en fast total poängbudget baserad på antalet faktorer. Budgeten beräknas som antal faktorer × 3. Modellen innebär att en högre vikt på en faktor alltid måste balanseras av lägre vikt på en annan. Poängen räknas därefter om till procentuell vikt med totalsumma 100 procent.
