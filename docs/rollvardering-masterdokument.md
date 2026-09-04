# Masterdokument: anpassningsbar, saklig och könsneutral rollvärderingsmodell

## Dokumentets syfte och användning

Detta är det samlade styrande dokumentet för företagets rollvärderingsmodell. Det beskriver hela modellen i en sammanhängande logik — från den fasta konstitutionen och valet av kriterier till viktning, rollbedömning, zoner, nivåer, styrning och systemimplementation.

Modellen ska göra två saker samtidigt:

1. låta varje företag uttrycka sin egen affärs- och värdelogik, och
2. säkerställa att roller värderas på ett sakligt, jämförbart, könsneutralt och förklarbart sätt.

Dokumentet är metodstöd och implementationsunderlag. Det är inte juridisk rådgivning. Företaget ska vid införande och större förändringar stämma av mot relevant HR-, arbetsrätts- och dataskyddskompetens.

EU:s lönetransparensdirektiv kräver att bedömning av arbetets värde kan göras med objektiva och könsneutrala kriterier som omfattar kompetens, ansträngning, ansvar och arbetsförhållanden, samt andra relevanta faktorer när det behövs för den specifika rollen. [Direktiv (EU) 2023/970](https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX%3A32023L0970)

---

## 1. Grundprincip: varför modellen behöver en konstitution

Helt fria kriterier, fria vikter och otydliga nivåer skapar en risk att modellen i praktiken bekräftar befintliga titlar, chefsnivåer, historiska löner eller en viss typ av arbete. En **konstitution** är därför modellens fasta metodiska regelverk.

Konstitutionen bestämmer inte exakt vilka kriterier ett företag måste välja. Den anger i stället:

- vilka grundtyper av rollkrav som alltid ska kunna beaktas,
- hur företagets kriterier ska kopplas till dessa grundtyper,
- hur dubbelräkning och snedvridning ska undvikas,
- hur viktning får användas,
- hur rollbedömning ska hållas åtskild från viktning,
- hur resultat kan föras vidare till zoner, nivåer och lönearkitektur,
- och hur ändringar ska dokumenteras, kontrolleras och versionshanteras.

> **Kort sagt:** Konstitutionen gör modellen flexibel i innehåll men konsekvent i metod.

---

## 2. Modellens logiska kedja

```text
1. Konstitution: fyra fasta värderingsdimensioner
        ↓
2. Kriteriebibliotek: möjliga, definierade kriterier inom varje dimension
        ↓
3. Metodbyggnad: företaget väljer och avgränsar 6–8 kriterier
        ↓
4. Viktning: företaget fördelar en fast viktbudget mellan valda kriterier
        ↓
5. Modellgodkännande: modellen kontrolleras, låses och versionssätts
        ↓
6. Rollbedömning: varje roll bedöms mot samma godkända kriterier och ankare
        ↓
7. Systemberäkning: rollbedömningar kombineras med fastställda vikter
        ↓
8. Zon och nivå: resultat prövas mot profilkrav, trösklar och ankarroller
        ↓
9. Lönearkitektur: nivåer används som underlag för löneband och sakliga jämförelser
```

---

## 3. Två separata stadier — får aldrig blandas ihop

Modellen består av två skilda stadier. De är sammankopplade, men sker vid olika tidpunkter, besvarar olika frågor och ska hållas åtskilda i dokumentation, datamodell, behörighet, gränssnitt och användarupplevelse.

### Stadium 1: Metodbyggnad

```text
Konstitution → kriterieval → avgränsning → viktning → viktbudget → kontroll → modellgodkännande
```

### Stadium 2: Rollbedömning

```text
Bedömning av rollens krav mot vald kriteriedefinition och ankare → låsning → systemberäkning → kalibrering → zon och nivå
```

| | Stadium 1: Metodbyggnad | Stadium 2: Rollbedömning |
|---|---|---|
| **Vad görs?** | Företaget bygger sin metod. | Företaget tillämpar den godkända metoden på en roll. |
| **Objekt** | Kriteriet och modellversionen. | Den enskilda rollen. |
| **Skala** | Viktningsskala 1–5. | Bedömningsskala 1–5, eller 0–5 för aktivt arbetsförhållandekriterium. |
| **Frågan** | Hur stark påverkan ska detta kriterium ha på det samlade rollvärdet? | Vilken kravnivå har denna roll på detta kriterium? |
| **Vad uttrycks?** | Arbetsgivarens dokumenterade värdelogik. | Rollens faktiska och varaktiga krav. |
| **Ändringsfrekvens** | Bara vid revidering av modellen och ny modellversion. | När en roll ska värderas eller omvärderas. |
| **Vilken information visas?** | Kriterier, vikter, budget, överlappning och modellkonsekvenser. | Endast kriteriets definition, avgränsning, ankare och bedömningsskala. |

> **Viktig regel:** Att båda skalorna innehåller nivåerna 1–5 betyder inte att de mäter samma sak. En hög vikt säger inte att en roll ska få en hög bedömning. En hög rollbedömning säger inte att kriteriet är högt viktat.

### 3.1 Tre begrepp som måste hållas isär

| Begrepp | Stadium | Fråga | Exempel |
|---|---|---|---|
| **Kriterium** | 1 | Vad i arbetet ska bedömas? | Komplexitet och otydlighet |
| **Viktning** | 1 | Hur mycket ska kriteriet påverka den samlade jämförelsen? | Vikt 4 av 5 |
| **Rollbedömning** | 2 | Hur höga krav har just denna roll på kriteriet? | Bedömning 5 av 5 |

Exempel:

- Företaget väljer **Komplexitet och otydlighet** som kriterium.
- Företaget ger kriteriet **vikt 4**, eftersom hög komplexitet ska få tydligt genomslag i den relativa rollvärderingen.
- En viss roll bedöms till **5** eftersom den normalt hanterar mycket komplexa och otydliga frågor.

Först efter att rollbedömningen är genomförd använder systemet den godkända vikten:

$$\text{Kriterieutfall} = \text{Rollbedömning} \times \text{Kriterievikt}$$

### 3.2 Metodisk brandvägg

När någon bedömer en roll ska personen endast bedöma rollens normala och varaktiga krav. Bedömaren får inte kunna se, använda eller behöva känna till:

- kriteriets vikt, viktklass eller viktmotiv,
- vilka kriterier företaget prioriterat högst,
- viktbudget eller återstående viktpoäng,
- viktat delresultat, totalpoäng, preliminär zon eller nivå,
- andra rollers bedömningar eller placeringar.

Vikten används först av systemet **efter att bedömningen har låsts**. Den är en del av beräkningen, inte ett underlag för bedömarens val av nivå.

---

## 4. Den pedagogiska resan genom metodbyggnaden

Metodbyggnaden ska inte upplevas som en administrativ checklista. Den ska göra det begripligt hur företaget går från frågan _”vilka typer av arbete ska kunna jämföras rättvist hos oss?”_ till en godkänd och tillämpbar modell.

| Steg | Vad företaget gör | Varför det behövs | Det leder vidare till |
|---|---|---|---|
| **1. Förstå konstitutionen** | Tar del av de fyra dimensionerna och prövar arbetsförhållanden. | Säkerställer att modellen inte byggs kring titel, chefsnivå eller historisk lön. | En könsneutral och balanserad grund. |
| **2. Välja kriterier** | Väljer 6–8 konkreta, icke överlappande kriterier ur biblioteket. | Översätter dimensionerna till verkliga skillnader mellan roller i den egna verksamheten. | Ett tydligt svar på vad som ska bedömas. |
| **3. Definiera och avgränsa** | Bekräftar vad varje kriterium mäter och inte mäter. | Hindrar dubbelräkning och minskar risken att individ, titel eller prestation påverkar. | Kriterier som kan bedömas konsekvent. |
| **4. Vikta kriterier** | Fördelar viktpoäng 1–5 inom en fast budget. | Gör värdelogiken tydlig: vilka rollskillnader ska få mest genomslag? | En beräkningsbar och dokumenterad modell. |
| **5. Kontrollera och godkänna** | Granskar täckning, överlappning, budget och konsekvenser. | Säkrar att modellen är rimlig innan den används. | En låst, godkänd modellversion. |
| **6. Bedöma roller** | Bedömer roller mot godkända kriterier och ankare. | Säkerställer att alla roller bedöms utifrån samma metod. | Underlag för systemberäkning, zon och nivå. |

### 4.1 Standardtext i det guidade systemflödet

Varje steg i gränssnittet ska börja med:

```text
VARFÖR ÄR VI HÄR?
[Förklarar syftet med det aktuella steget.]

VAD SKA NI TA STÄLLNING TILL?
[Förklarar det konkreta beslutet som ska fattas.]

VAD HÄNDER SEDAN?
[Förklarar hur beslutet används i nästa steg.]
```

| Steg | Varför är vi här? | Vad ska ni ta ställning till? | Vad händer sedan? |
|---|---|---|---|
| **Konstitution** | För att jämföra arbete rättvist måste modellen fånga kompetens, ansträngning/komplexitet, ansvar/påverkan och pröva arbetsförhållanden. | Vilka dimensioner är materiella i verksamheten och hur ska arbetsförhållanden hanteras? | Systemet visar lämpliga kriterier per dimension. |
| **Kriterieval** | Dimensioner är breda; kriterier gör dem konkreta och bedömbara. | Vilka sakliga skillnader mellan roller behöver modellen fånga? | Kriterier avgränsas och kontrolleras för överlappning. |
| **Viktning** | Relevans betyder inte att alla kriterier ska ha lika genomslag. | Vilka kriterier ska ha störst effekt när roller skiljer sig åt? | Viktbudgeten skapar verkliga prioriteringar. |
| **Godkännande** | En metod måste vara sammanhängande innan den tillämpas. | Är täckning, avgränsning, viktbudget och konsekvenser rimliga? | Modellen låses och används vid rollbedömning. |

### 4.2 Regler för det guidade flödet

Systemet ska:

1. visa processen **1 Konstitution → 2 Kriterieval → 3 Avgränsning → 4 Viktning → 5 Kontroll och godkännande → 6 Rollbedömning**,
2. visa att steg 1–5 är **METODBYGGNAD** och steg 6 är **ROLLBEDÖMNING**,
3. förklara konsekvensen av varje val innan användaren bekräftar det,
4. visa hur valda kriterier påverkar dimensionstäckning, antal kriterier och återstående viktbudget,
5. använda enkla kontrollfrågor och konkreta exempel före metodtekniskt språk,
6. visa vilka senare steg som behöver göras om när en användare ändrar ett tidigare metodval,
7. inte tillåta rollbedömning innan modellen är komplett, validerad, godkänd och versionssatt,
8. vid konflikt eller otydlighet stoppa nästa steg och förklara vad som saknas, varför det spelar roll och vilket beslut användaren behöver fatta.

---

## 5. De fyra obligatoriska värderingsdimensionerna

Dimensionerna är modellens fasta huvudområden. De är **inte** samma sak som kriterier. Företaget väljer konkreta kriterier inom dimensionerna, men ska täcka dem på ett balanserat sätt.

| Dimension | Grundfråga | Varför den behövs |
|---|---|---|
| **A. Kompetens** | Vilka kunskaper, färdigheter, erfarenheter och kvalifikationer kräver rollen? | Skyddar specialist-, professions- och kvalifikationskrävande roller från att undervärderas. |
| **B. Ansträngning och komplexitet** | Hur svår, otydlig, analytiskt, kommunikativt, fysiskt eller koncentrationskrävande är rollen? | Synliggör krävande arbete även när rollen saknar formell chefsmakt. |
| **C. Ansvar och påverkan** | Vilken räckvidd, vilket mandat och vilka konsekvenser har rollen? | Fångar ansvar för beslut, resultat, risk, människor, kvalitet och verksamhet. |
| **D. Arbetsförhållanden** | Finns särskilda objektiva och varaktiga arbetsvillkor som påverkar kraven? | Synliggör exempelvis beredskap, exponering, säkerhetskrav och oregelbundna förhållanden. |

### 5.1 Varför alla fyra behövs

- Om modellen bara mäter ansvar och påverkan riskerar den att bli chefstung.
- Om den bara mäter kompetens och komplexitet riskerar den att missa verkligt mandat, konsekvens och bolagsstyrning.
- Om den bortser från arbetsförhållanden riskerar den att underskatta roller med materiala krav på exempelvis jour, säkerhet eller fysisk exponering.

Dimensionerna bildar därför ett balanssystem:

- **Kompetens** synliggör specialist- och professionsroller.
- **Ansträngning och komplexitet** synliggör svår problemlösning och faktisk arbetsinsats.
- **Ansvar och påverkan** synliggör räckvidd, mandat och konsekvens.
- **Arbetsförhållanden** synliggör objektiva villkor som inte är titel, status eller prestation.

---

## 6. Kriteriebiblioteket: regler för val och användning

Kriteriebiblioteket är en kontrollerad meny — inte en checklista där allt ska väljas. Det innehåller fler relevanta alternativ än vad som ska användas i en enskild modell.

```text
Fyra fasta dimensioner = konstitutionen
        ↓
Kriteriebibliotek per dimension = byggklossarna
        ↓
Företagets val av 6–8 icke överlappande kriterier = den lokala modellen
        ↓
Företagets viktning = den lokala värdelogiken
```

### 6.1 Antalsregler

| Dimension | Tillgängliga alternativ | Normalt antal som väljs | Högsta antal utan särskilt beslut |
|---|---:|---:|---:|
| Kompetens | 5 | 1–2 | 2 |
| Ansträngning och komplexitet | 6 | 1–2 | 2 |
| Ansvar och påverkan | 7 | 2–3 | 3 |
| Arbetsförhållanden | 4 | 0–1 | 1 |
| **Hela modellen** | **22** | **6–8** | **8** |

### 6.2 Urvalsregler

Ett kriterium får aktiveras endast när företaget kan svara ja på samtliga frågor:

1. Fångar kriteriet en egen och relevant skillnad mellan roller?
2. Fångas inte samma skillnad redan tillräckligt väl av ett annat valt kriterium?
3. Kan kriteriet bedömas på ett konsekvent sätt för roller, inte individer?
4. Är kriteriet relevant för fler än en enskild titel eller person?

När ett kriterium väljs ska systemet lagra:

- vad kriteriet mäter,
- vad kriteriet inte mäter,
- vilka närliggande kriterier som ska kontrolleras för överlappning,
- varför kriteriet behövs i den aktuella modellversionen,
- kriteriedefinition, bedömningsfråga och ankare för rollbedömning.

---

## 7. Kriteriebibliotek: Kompetens

> **Ersatt (2026-08-26):** Kriterietexterna i avsnitt 7–10 (definitioner, avgränsningar, lämplighet, kontrollfrågor, ankartexter och överlappningar) är ersatta av den förfinade arbetsversionen i `docs/kriteriebibliotek-forfining-2026-08-24.md`. Biblioteket i koden följer det dokumentet; texterna här är den ursprungliga leveransen och behålls som historik. Dimensionerna, kriterieuppsättningen, skalan och poängsättningen är oförändrade.

### Dimensionens fråga

> Vilka kunskaper, färdigheter, erfarenheter och kvalifikationer kräver rollen för att kunna utföras på avsett sätt?

| Kriterium | När det är lämpligt | Vad det mäter | Vad det inte mäter | Överlappningsregel |
|---|---|---|---|---|
| **1. Kunskapsdjup och specialistnivå** | Nästan alltid relevant i kunskapsintensiva verksamheter. | Krav på fördjupad fackkunskap, specialistmetodik, avancerad problemlösning och relevant erfarenhet. | Formell examen i sig, svårigheten i ett enskilt problem eller individens prestation. | Välj normalt detta eller det bredare samlade kompetenskriteriet — inte båda. |
| **2. Kunskapsbredd och tvärdisciplinär förståelse** | När roller behöver kombinera flera sakområden, exempelvis produkt, data, affär och teknik. | Krav på att integrera flera kompetensområden och förstå deras samband. | Antal samarbetspartner eller organisatorisk påverkan. | Välj endast när bredd är en självständig skillnad från specialistdjup. |
| **3. Formella kvalifikations-, behörighets- och certifieringskrav** | Reglerade eller säkerhetskritiska roller med obligatorisk legitimation, behörighet eller certifiering. | Formella krav som krävs för att utöva, signera eller ansvara för arbetet. | Allmän utbildningsstatus, prestigefylld examen eller frivilliga kurser. | Ska inte användas om utbildning bara är en väg till kompetens som redan fångas av Kunskapsdjup. |
| **4. Domän- och verksamhetskunskap** | När specifik bransch-, produkt-, kundmiljö- eller regelverkskunskap är en egen rollförutsättning. | Djup kontextkunskap som inte snabbt ersätts av generell yrkesskicklighet. | Allmän erfarenhet eller organisationskännedom som alla förväntas bygga upp. | Domän = kontexten; specialistnivå = professionell metod och färdighet. |
| **5. Rådgivnings- och omdömeskompetens** | Konsult-, partner-, specialist- och ledande expertroller där kvalificerade råd är kärnleveransen. | Krav på att värdera information, ge kvalificerade råd och omsätta expertis i rekommendationer. | Formellt beslutsmandat. | Ska inte kombineras med Kunskapsdjup om det bara beskriver samma expertis med andra ord. |

### Exempel på lämpliga kombinationer

| Verksamhetstyp | Lämpliga kriterier |
|---|---|
| Generellt tech-/SaaS-bolag | Kunskapsdjup och specialistnivå, eller ett samlat kompetenskriterium. |
| Produkt- eller konsultintensivt bolag | Kunskapsdjup och specialistnivå + Kunskapsbredd och tvärdisciplinär förståelse. |
| Reglerad verksamhet | Kunskapsdjup och specialistnivå + Formella kvalifikations-, behörighets- och certifieringskrav. |
| Bransch med lång inlärningskurva | Kunskapsdjup och specialistnivå + Domän- och verksamhetskunskap. |

---

## 8. Kriteriebibliotek: Ansträngning och komplexitet

### Dimensionens fråga

> Hur svåra, otydliga, analytiskt krävande, kommunikativt krävande, fysiskt krävande eller koncentrationskrävande är arbetsuppgifterna som rollen normalt hanterar?

| Kriterium | När det är lämpligt | Vad det mäter | Vad det inte mäter | Överlappningsregel |
|---|---|---|---|---|
| **1. Komplexitet och otydlighet** | Nästan alltid relevant. | Osäkerhet, mångfacetterade frågor, oklara ramar och behov av kvalificerat omdöme. | Kunskapskravet i sig, högt arbetstempo eller organisatorisk räckvidd. | Bör normalt vara huvudkriteriet inom dimensionen. |
| **2. Analytisk och problemlösande ansträngning** | När den mentala analysbördan skiljer sig tydligt mellan roller trots jämförbar komplexitet. | Omfattning av analys, felsökning, modellering, diagnostik eller systematisk problemlösning. | Specialistkunskap eller endast otydliga problem. | Kombinera med Komplexitet endast om skillnaden kan förklaras: komplexitet = problemets natur; analys = arbetet som krävs för att hantera det. |
| **3. Kommunikations- och relationskrävande arbete** | Kundnära, förhandlande, rådgivande eller konflikthanterande verksamheter där detta är ett centralt arbete. | Krav på avancerad kommunikation, förhandling, påverkan, konflikthantering eller översättning mellan intressen. | Antal intressenter eller organisatorisk påverkan. | Mäts som kommunikativ ansträngning, inte som nätverkets storlek. |
| **4. Operativ intensitet och simultankrav** | Drift, kundservice, logistik eller övervakning med varaktiga krav på flera samtidiga flöden och snabba prioriteringar. | Uppmärksamhet, simultanförmåga och kontinuerlig prioritering i normalläget. | Tillfälliga toppar, underbemanning eller dålig planering. | Får inte användas för att belöna arbetsmängd som uppstår genom resursbrist. |
| **5. Fysisk eller sensorisk ansträngning** | Industri, vård, lager, produktion, fältservice eller laboratorier. | Återkommande fysisk belastning, precision, ergonomiskt krävande moment eller sensorisk koncentration. | Säkerhetsrisk eller fysisk exponering. | Riskmiljö och exponering hör normalt till Arbetsförhållanden. |
| **6. Kognitiv uthållighet och fokusbelastning** | Arkitektur, avancerad analys, systemutveckling eller andra roller där kravet på uthållig mental koncentration och djup fokusbelastning har stor betydelse för rollens utförande. | Uthållig mental koncentration, bearbetning av krävande informationsmängder under tid och förmåga att upprätthålla djup fokusbelastning i komplexa tankeprocesser. | Problemets komplexitet i sig, stress på grund av resursbrist eller dålig planering, eller fysisk eller sensorisk ansträngning. | Deklarerat överlapp med Analytisk och problemlösande ansträngning (8.2): analysinsatsen i sig skiljs från den uthålliga koncentrationen och fokusbelastningen den bärs under. |

### Exempel på lämpliga kombinationer

| Verksamhetstyp | Lämpliga kriterier |
|---|---|
| Tech-/SaaS-bolag | Komplexitet och otydlighet; vid behov Analytisk och problemlösande ansträngning. |
| Konsult-, sälj- eller rådgivningsbolag | Komplexitet och otydlighet + Kommunikations- och relationskrävande arbete. |
| Drift-, logistik- eller serviceverksamhet | Komplexitet och otydlighet + Operativ intensitet och simultankrav. |
| Industri- eller fältverksamhet | Komplexitet och otydlighet; vid behov Fysisk eller sensorisk ansträngning. |

---

## 9. Kriteriebibliotek: Ansvar och påverkan

### Dimensionens fråga

> Vilken räckvidd, vilket mandat och vilka konsekvenser har rollen för verksamhet, människor, resurser, kvalitet, risk eller resultat?

Detta är den bredaste dimensionen och behöver därför fler alternativ, men också ett tydligt tak. Annars riskerar modellen att ge chef- eller kommersiella roller flera parallella poängvägar.

| Kriterium | När det är lämpligt | Vad det mäter | Vad det inte mäter | Överlappningsregel |
|---|---|---|---|---|
| **1. Scope och påverkan** | Nästan alltid relevant. | Rollens räckvidd: från avgränsad uppgift till team, funktion, flera funktioner eller bolag. | Formellt personalansvar, budgetstorlek eller själva mandatet. | Ska inte kombineras med ett separat kriterium som bara mäter organisatorisk räckvidd. |
| **2. Autonomi och beslutsmandat** | Nästan alltid relevant. | Självständighet, beslutens nivå och behov av eskalering. | Konsekvensen av beslutet eller dess organisatoriska räckvidd. | Mandat = rätt att besluta; scope = var effekten märks; risk = följden om det blir fel. |
| **3. Risk och konsekvens** | Nästan alltid relevant. | Följder av beslut, fel eller brister för säkerhet, kund, kvalitet, efterlevnad, information eller varumärke. | Enbart ekonomisk risk eller individens stressnivå. | Undvik separat compliance-risk om den bara är ett exempel på samma risk och konsekvens. |
| **4. Personal- och ledningsansvar** | När formellt personalansvar är en materiell skillnad mellan roller. | Ansvar för att leda människor, fördela arbete, utveckla kapacitet och skapa resultat genom andra. | Projektledning utan personalansvar, specialistledarskap eller teamstorlek som enda mått. | Ska normalt ha låg till måttlig vikt eftersom chefskap ofta redan syns i scope och mandat. |
| **5. Resurs- och kapacitetsansvar** | När rollen självständigt disponerar väsentliga resurser, kapacitet, tillgångar eller kritisk leveransförmåga. | Ansvar för att prioritera och använda resurser så verksamheten fungerar. | Vanlig budgetuppföljning eller inköp inom små ramar. | Ska inte väljas samtidigt som ett snävt finansiellt ansvar om båda mäter samma resursstyrning. |
| **6. Affärs- och kundansvar** | När rollen direkt ansvarar för väsentlig kundrelation, intäktsström, affärsportfölj eller kommersiell position. | Ansvar för att skapa, säkra eller utveckla materiellt affärsvärde. | Individuell säljprestation, provision eller förhandlingsskicklighet i sig. | Får inte automatiskt gynna säljroller; ansvaret måste vara en stabil del av rollen. |
| **7. Informations-, säkerhets- eller regelefterlevnadsansvar** | Reglerade, säkerhetskritiska eller datatunga verksamheter med ett separat formellt kontrollansvar. | Ansvar för skydd, kvalitetssäkring, kontroll eller korrekt tillämpning av kritiska krav. | Allmän riskmedvetenhet. | Välj bara om ansvaret är separat från Risk och konsekvens. |

### Exempel på lämpliga kombinationer

| Verksamhetstyp | Lämpliga kriterier |
|---|---|
| Generellt kunskaps- eller techbolag | Scope och påverkan + Autonomi och beslutsmandat + Risk och konsekvens. |
| Bolag med tydligt chefsspår | Scope och påverkan + Risk och konsekvens + Personal- och ledningsansvar; överväg lägre vikt på ledningsansvar. |
| Kund- eller säljdriven verksamhet | Scope och påverkan + Autonomi och beslutsmandat + Affärs- och kundansvar. |
| Reglerad eller säkerhetskritisk verksamhet | Scope och påverkan + Risk och konsekvens + Informations-, säkerhets- eller regelefterlevnadsansvar. |
| Kapital- eller resursintensiv verksamhet | Scope och påverkan + Risk och konsekvens + Resurs- och kapacitetsansvar. |

---

## 10. Kriteriebibliotek: Arbetsförhållanden

### Dimensionens fråga

> Finns särskilda, objektiva och återkommande förhållanden i arbetet som är ett verkligt rollkrav och som inte fångas av de andra dimensionerna?

Arbetsförhållanden ska alltid prövas men behöver inte alltid aktiveras.

| Kriterium | När det är lämpligt | Vad det mäter | Vad det inte mäter | Överlappningsregel |
|---|---|---|---|---|
| **1. Säkerhets- och exponeringsförhållanden** | Roller med faktisk fysisk, kemisk, biologisk, miljömässig eller annan exponering. | Varaktig riskmiljö och krav på arbete under skyddsåtgärder. | Konsekvens för bolaget av ett fel. | Välj inte samtidigt med ett bredare arbetsförhållandekriterium som täcker samma exponering. |
| **2. Jour, beredskap och tillgänglighetskrav** | Drift, IT, vård, säkerhet och andra roller där beredskap är en integrerad rollförutsättning. | Återkommande krav på tillgänglighet utanför ordinarie arbetstid eller omedelbar insats. | Tillfällig övertid, frivillig flexibilitet eller hög arbetsmängd. | Ska vara ett eget kriterium endast när beredskap är materiell och återkommande. |
| **3. Oregelbundenhet, mobilitet och platsbundenhet** | Fältroller, internationell verksamhet, skiftverksamhet eller hög resfrekvens. | Varaktiga krav på oregelbundna tider, omfattande resor eller arbete på särskilda platser. | Enstaka resor, personliga önskemål eller tillfälliga projekt. | Kan slås ihop med Jour/beredskap endast när båda ingår i samma stabila arbetsvillkor. |
| **4. Särskilda säkerhets-, sekretess- eller kontrollmiljöer** | Säkerhetsklassade, sekretesskänsliga eller strikt kontrollerade miljöer med faktiska begränsningar. | Arbetsförhållandet att arbeta under särskilda åtkomst-, kontroll- eller säkerhetsrestriktioner. | Ansvar för informationssäkerhet. | Använd endast när det är arbetsmiljön/förutsättningen — inte kontrollansvaret — som mäts. |

### 10.1 Ja/nej-prövning

Vid uppstart eller årlig översyn ska företaget besvara frågan:

> **Finns minst en rollfamilj där särskilda arbetsförhållanden är en återkommande, objektiv och materiell del av rollens krav, och där kravet inte redan fångas korrekt av ett annat kriterium?**

| Svar | Konsekvens |
|---|---|
| **Nej** | Dimensionen dokumenteras som **prövad men inte materiellt relevant**. Inget arbetsförhållandekriterium är aktivt. |
| **Ja** | Företaget väljer ett relevant kriterium ur biblioteket. Kriteriet aktiveras för samtliga roller i modellversionen. Roller som inte omfattas får bedömning **0**. |

När dimensionen är aktiv får den inte slås på eller av fritt per enskild roll. Bedömningen sker i samma modell för samtliga roller.

| Rollens förhållande | Bedömning |
|---|---:|
| Rollen omfattas inte av det definierade arbetsförhållandet | **0** |
| Rollen omfattas begränsat | **1–2** |
| Rollen omfattas återkommande och materiellt | **3** |
| Rollen omfattas i hög grad med tydliga konsekvenser | **4** |
| Rollen omfattas i mycket hög grad eller under särskilt krävande förhållanden | **5** |

---

## 11. Kriterieval i systemet: beslutsstöd, inte dropdown

Kriteriebiblioteket ska implementeras som ett guidat beslutsstöd. Användaren ska kunna förstå om ett kriterium är lämpligt, hur det skiljer sig från andra och vad det innebär att aktivera det.

Varje kriteriekort ska visa:

| Informationsfält | Syfte |
|---|---|
| Namn och dimension | Visar vilket huvudområde kriteriet tillhör. |
| Kort UI-text | Ger snabb förståelse i en lista. |
| Full definition | Förklarar vilken saklig skillnad mellan roller kriteriet fångar. |
| Vad kriteriet mäter | Avgränsar till rätt typ av rollkrav. |
| Vad kriteriet inte mäter | Skyddar mot dubbelräkning och inblandning av titel, prestation eller individ. |
| När det är lämpligt | Förklarar i vilka verksamheter och rolltyper kriteriet normalt fyller en funktion. |
| När det normalt inte bör användas | Hindrar utfyllnad eller parallell mätning av samma sak. |
| Vanliga överlappningar | Visar vilka redan valda kriterier som ska kontrolleras. |
| Kontrollfråga | Hjälper användaren pröva om kriteriet verkligen behövs. |
| Maximalt antal i dimensionen | Gör metodregeln synlig innan kriteriet väljs. |

### 11.1 Rekommenderat användarflöde för kriterieval

1. Användaren väljer en av de fyra dimensionerna.
2. Systemet visar dimensionens syfte, maximalt antal kriterier och redan valda kriterier.
3. Systemet visar kriteriekort med kort förklaring, lämplighet och överlappningsvarningar.
4. När användaren öppnar ett kort visas full definition, avgränsning, exempel och kontrollfråga.
5. Innan kriteriet aktiveras besvarar användaren kontrollfrågan och motiverar varför kriteriet behövs.
6. Systemet kontrollerar överlappning, dimensionstak och totalt antal kriterier.
7. När kriterievalet är klart går användaren vidare till viktning och den fasta viktbudgeten.

Systemet får inte tillåta publicering om kriterieval, överlappningskontroll, relevansprövning eller viktbudget är ofullständig.

---

## 12. Stadium 1: viktning av kriterier

Viktning uttrycker företagets värdelogik. Hög vikt betyder att hög bedömning på kriteriet ska få större genomslag i det samlade relativa rollvärdet än samma bedömning på ett lägre viktat kriterium.

### 12.1 Viktning är inte rollbedömning

| Exempel | Kriterievikt | Rollbedömning | Tolkning |
|---|---:|---:|---|
| Scope och påverkan | 4 | 5 | Företaget prioriterar bred påverkan; rollen har mycket stor sådan påverkan. |
| Personal- och ledningsansvar | 1 | 5 | Rollen har formellt chefskap, men företaget har beslutat att chefskap inte ska dominera modellen. |
| Komplexitet och otydlighet | 4 | 2 | Företaget prioriterar komplexitet, men rollen arbetar normalt inom relativt förutsägbara ramar. |

### 12.2 Viktningsskalan 1–5

Frågan i metodbyggnaden är alltid:

> **Hur stark påverkan ska detta kriterium ha på det samlade rollvärdet?**

| Vikt | Tolkningsprincip |
|---:|---|
| **1** | Begränsad påverkan. Kriteriet beaktas, men ska ha liten relativ effekt på totalvärdet. |
| **2** | Kompletterande påverkan. Kriteriet ska bidra, men inte vara avgörande vid jämförelser. |
| **3** | Normal påverkan. Kriteriet är en balanserad och tydlig del av modellen. |
| **4** | Hög påverkan. Skillnader mellan roller på kriteriet ska ge tydligt utslag. |
| **5** | Mycket hög påverkan. Kriteriet är en av företagets starkaste värdedrivare i den relativa rollvärderingen. |

### 12.3 Fast viktbudget

För att undvika att alla kriterier sätts till högsta vikt används en fast budget:

$$\text{Viktbudget} = \text{antal aktiva kriterier} \times 3$$

| Antal aktiva kriterier | Viktbudget |
|---:|---:|
| 6 | 18 |
| 7 | 21 |
| 8 | 24 |

Alla kriterier kan ses som att de börjar på vikt 3. Om företaget höjer ett kriterium från 3 till 5 måste två poäng tas från ett eller flera andra kriterier. Det gör prioritering verklig och jämförbar.

### 12.4 Skydd mot snedvridning

Systemet ska varna när:

- fler än tillåtna kriterier har valts i en dimension,
- mer än 40 % av samlad vikt ligger inom en dimension utan dokumenterad motivering,
- Ansvar och påverkan har fler än tre aktiva kriterier,
- Personal- och ledningsansvar får vikt 4 eller 5 utan konsekvensanalys,
- ett nytt kriterium överlappar ett befintligt kriterium,
- viktbudgeten över- eller underskrids.

---

## 13. Stadium 2: rollbedömning

Rollbedömningen börjar först när metodbyggnaden är klar, kontrollerad, godkänd och låst i en modellversion.

### 13.1 Vad som bedöms

Bedömningen ska avse rollens **normala och varaktiga krav**. Den ska inte påverkas av:

- den nuvarande personens erfarenhet, utbildning eller prestation,
- individens lön, förhandlingsstyrka eller anställningshistorik,
- titel, organisationsstatus eller vem som för närvarande har rollen,
- tillfälliga arbetstoppar, projekt eller extraordinära händelser.

### 13.2 Vad rollbedömaren ser

Rollbedömningsvyn ska endast visa:

1. kriteriets namn och kärndefinition,
2. bedömningsfråga,
3. vad kriteriet mäter och inte mäter,
4. den gemensamma bedömningsskalan,
5. kriteriespecifika ankare,
6. fält för bedömningsnivå och motivering.

Rollbedömningsvyn får inte visa vikt, viktklass, viktmotiv, viktbudget, kriteriernas inbördes prioritering, viktad delpoäng, totalpoäng, preliminär zon, preliminär nivå eller andra rollers resultat.

### 13.3 Gemensam bedömningsskala 1–5

> **Ersatt (2026-08-26):** Skalans betydelsetexter är ersatta av de komprimerade formuleringarna i `docs/kriteriebibliotek-forfining-2026-08-24.md` (avsnittet ”Skala 1–5”). Nivåerna och benämningarna är oförändrade.

| Nivå | Benämning | Gemensam betydelse |
|---:|---|---|
| **1** | Avgränsat krav | Kravet är tydligt definierat, lokalt eller begränsat i omfattning. Rollen arbetar huvudsakligen inom etablerade ramar. |
| **2** | Grundläggande till måttligt krav | Kravet förekommer återkommande men inom ett tydligt avgränsat område. Rollen hanterar variationer och enklare avvikelser. |
| **3** | Självständigt och etablerat krav | Kravet är en tydlig och återkommande del av rollen. Rollen gör professionella bedömningar inom sitt område. |
| **4** | Avancerat eller brett krav | Kravet är avancerat, har bredare räckvidd eller kräver självständiga avvägningar där etablerade arbetssätt inte alltid räcker. |
| **5** | Mycket avancerat, omfattande eller verksamhetskritiskt krav | Kravet har mycket stor omfattning, svårighetsgrad, konsekvens eller strategisk betydelse. Rollen formar ofta riktning, standarder, lösningar eller resultat utanför det egna närmaste området. |

Den gemensamma skalan beskriver graden av krav, men ersätter inte kriteriets definition. En fyra på Komplexitet och otydlighet betyder inte samma sak i sak som en fyra på Risk och konsekvens.

### 13.4 Kriteriespecifika ankare

Varje aktivt kriterium ska ha tydliga ankare för nivå 1, 3 och 5. Nivå 2 och 4 används som genomtänkta mellanlägen och kan kompletteras med korta kriteriespecifika texter.

| Nivå | Funktion |
|---:|---|
| **1** | Visar ett tydligt avgränsat eller begränsat krav för kriteriet. |
| **2** | Visar ett genomtänkt mellanläge mellan 1 och 3. |
| **3** | Visar en självständig och etablerad kravnivå. |
| **4** | Visar ett genomtänkt mellanläge mellan 3 och 5. |
| **5** | Visar en mycket avancerad, omfattande eller verksamhetskritisk kravnivå. |

### 13.5 Exempel på kriteriespecifika ankare

#### Scope och påverkan

| Nivå | Ankare |
|---:|---|
| **1** | Rollen påverkar främst kvaliteten, effektiviteten eller resultatet i egna tydligt avgränsade arbetsuppgifter. |
| **2** | Rollen påverkar ett avgränsat arbetsområde eller återkommande leverans inom ett team. |
| **3** | Rollen har självständigt ansvar för resultat inom ett tydligt område och påverkar teamets eller närliggande funktioners leverans och prioriteringar. |
| **4** | Rollen påverkar flera team, en funktion eller en väsentlig del av verksamheten genom val, prioriteringar eller lösningar med varaktiga följder. |
| **5** | Rollen påverkar bolagets övergripande riktning, resultat eller förmåga att lyckas genom beslut och ansvar med företagsövergripande eller strategisk effekt. |

#### Komplexitet och otydlighet

| Nivå | Ankare |
|---:|---|
| **1** | Rollen arbetar huvudsakligen med tydligt definierade frågor, etablerade metoder och förutsägbara situationer. |
| **2** | Rollen hanterar återkommande variationer och enklare avvikelser där den väljer mellan kända alternativ. |
| **3** | Rollen hanterar självständigt komplexa frågor inom sitt område och behöver analysera, prioritera och anpassa lösningar. |
| **4** | Rollen hanterar avancerade, tvärfunktionella eller delvis otydliga problem där etablerade lösningar inte alltid räcker. |
| **5** | Rollen definierar och hanterar mycket komplexa eller strategiskt viktiga problem med hög osäkerhet och formar ofta angreppssätt, principer eller långsiktiga lösningar. |

#### Risk och konsekvens

| Nivå | Ankare |
|---:|---|
| **1** | Fel eller brister får normalt begränsade och lätt korrigerbara följder inom det egna arbetsområdet. |
| **2** | Fel eller brister kan påverka teamets kvalitet, effektivitet eller leverans och kräver normalt korrigering inom etablerade processer. |
| **3** | Fel, beslut eller brister kan få tydliga följder för kund, leverans, kvalitet, ekonomi eller efterlevnad inom ett område. |
| **4** | Fel, beslut eller brister kan få betydande följder för flera delar av verksamheten, viktiga kunder, kritiska processer eller regelefterlevnad. |
| **5** | Fel, beslut eller brister kan få mycket stora, långvariga eller verksamhetskritiska följder för strategi, säkerhet, efterlevnad, förtroende eller överlevnadsförmåga. |

---

## 14. Beräkning, zoner och nivåer

Efter att rollbedömningen är låst beräknar systemet:

$$\text{Vägt kriterieutfall} = \text{Rollbedömning} \times \text{Kriterievikt}$$

$$\text{Viktat rollvärde} = \sum(\text{Rollbedömning} \times \text{Kriterievikt})$$

Om arbetsförhållanden är aktivt får en roll som inte omfattas av det definierade villkoret bedömningen 0.

### 14.1 Varför totalpoäng inte räcker ensam

Två roller kan få samma totalpoäng på olika sätt. Om företaget har sagt att vissa kriterier är särskilt värdedrivande ska det även synas i zonlogiken.

Högre zoner ska därför bygga på två regler samtidigt:

1. **minsta viktade totalpoäng**, och
2. **profilkrav** för de högst viktade kriterierna.

Profilkrav innebär att en roll inte enbart kan nå en hög zon genom att samla många måttliga poäng på mindre prioriterade kriterier. Rollen behöver också ha en tillräcklig profil i företagets mest värdedrivande krav.

### 14.2 Tröskelvärden och kalibrering

Tröskelvärden ska inte optimeras i efterhand för att resultatfördelningen ska ”se bra ut”. De ska förankras i:

- kvalitativa zonbeskrivningar,
- representativa ankarroller,
- observerade bedömningsmönster,
- den godkända viktningen och dess profilkrav,
- konsekvensanalys mellan chef-, specialist-, kommersiella och stödjande roller.

En förändring av kriterier, vikter eller zontrösklar ska skapa en ny modellversion och utlösa konsekvensanalys för berörda roller.

### 14.3 Nivåarkitektur: från sju till tolv nivåer

Den nuvarande arkitekturen med sju nivåer kan vara tillräcklig i en mindre eller mindre differentierad organisation. När rollerna blir fler, eller när det finns tydliga skillnader inom samma nuvarande nivå, kan sju nivåer bli för grovt. Rollen kan då hamna på samma nivå som andra roller trots en väsentligt annorlunda kravprofil, utan att det finns en tydlig plats i strukturen för skillnaden.

En utökning till **tolv nivåer** ger därför inte en ny värderingsmetod. Den ger en **finare upplösning i resultatet** av samma godkända metod. Kriterier, vikter och rollbedömningar ändras inte för att skapa fler nivåer. Det som utvecklas är sättet att tolka och strukturera det viktade rollvärdet.

> **Princip:** Fler nivåer ska införas för att skilja mellan verkliga och återkommande skillnader i rollkrav — aldrig för att skapa en önskad fördelning, ge plats åt en specifik titel eller lösa enskilda lönesituationer.

I detta dokument används nivå **1** som den högsta nivån och nivå **12** som den lägsta, i linje med den tidigare bandlogiken. Systemet ska dock ha en tydlig konfigurationsparameter för numreringsriktning; nivåernas innehåll och relativa ordning får aldrig bli otydlig enbart på grund av numreringen.

### 14.4 Vad zoner är och varför de behövs

En **nivå** är en specifik placering i arkitekturen. En **zon** är en bredare grupp av närliggande nivåer med en gemensam kvalitativ karaktär.

Zoner behövs eftersom en totalpoäng i sig inte förklarar vilken typ av rollvärde som har uppnåtts. De gör det möjligt att:

- beskriva den gemensamma karaktären för flera närliggande nivåer,
- skilja mellan rollens övergripande profil och den exakta finplaceringen inom zonen,
- förankra nivågränser i tydliga och begripliga rollkrav,
- kalibrera arkitekturen mot representativa ankarroller,
- kommunicera strukturen till chefer, medarbetare, fackliga företrädare och ledning utan att reducera modellen till enbart poäng.

Zonen är alltså **inte** en separat bedömning och ska inte poängsättas. Den är ett tolknings- och kalibreringslager mellan det viktade rollvärdet och den slutliga nivån.

```text
Rollbedömning per kriterium
        ↓
Viktat rollvärde + profilkrav
        ↓
Zon: bred kvalitativ karaktär
        ↓
Nivå: exakt placering inom zonen
```

### 14.5 Rekommenderad struktur: fyra zoner och tolv nivåer

| Zon | Nivåer | Övergripande karaktär | Typisk rollprofil |
|---|---:|---|---|
| **A. Företagsövergripande och strategiska roller** | **1–3** | Formar bolagets långsiktiga riktning, kritiska vägval eller samlade förmåga att lyckas. | Företagsledande roller, verksamhetskritiska ledande experter eller roller med företagsövergripande ansvar. |
| **B. Ledande specialist- och chefsroller med bred påverkan** | **4–6** | Har bred, varaktig och ofta tvärfunktionell påverkan på en väsentlig del av verksamheten. | Funktionsledande roller, seniora chefer och ledande specialister med betydande mandat eller konsekvensansvar. |
| **C. Självständiga specialist- och operativa ledarroller** | **7–9** | Har självständigt ansvar för ett tydligt område, avancerade arbetskrav eller påverkan på team och närliggande funktioner. | Seniora specialister, teamchefer, operativa ledare och roller med etablerat professionellt ansvar. |
| **D. Professionella och stödjande roller med mer avgränsad påverkan** | **10–12** | Har tydliga och relevanta krav, men normalt mer avgränsad räckvidd, lägre beslutshöjd eller mer etablerade ramar. | Professionella roller, koordinerande roller, administrativt stöd och operativa roller. |

Zonbeskrivningarna ska vara stabila över tid. De ska inte skrivas om för att passa en enskild roll. Den exakta betydelsen av en nivå inom zonen ska däremot förtydligas genom nivåbeskrivningar och ankarroller.

### 14.5.1 Zoner i arkitekturöversikten

Zonerna ska vara tydligt synliga i systemets **arkitekturöversikt**. De ska fungera som visuella och förklarande grupperingar runt nivåerna — inte som en separat poäng, ett extra bedömningsfält eller en egen värderingsdimension.

Arkitekturöversikten ska visa zon, nivå och nivåernas inbördes ordning, exempelvis:

| Zon | Nivåer | Övergripande karaktär |
|---|---:|---|
| **A – Företagsövergripande och strategiska roller** | 1–3 | Strategisk och företagsövergripande påverkan. |
| **B – Ledande specialist- och chefsroller** | 4–6 | Bred och varaktig påverkan på en väsentlig del av verksamheten. |
| **C – Självständiga specialist- och operativa ledarroller** | 7–9 | Självständigt ansvar och avancerade krav inom ett tydligt område. |
| **D – Professionella och stödjande roller** | 10–12 | Tydliga och relevanta, men normalt mer avgränsade, rollkrav. |

Syftet är att göra två saker tydliga för användaren:

- **Nivån** är rollens exakta placering i arkitekturen.
- **Zonen** visar den bredare karaktären och det relativa sammanhanget för nivån.

Två roller kan ligga på olika nivåer inom samma zon och ändå ha liknande övergripande rollprofil. En övergång mellan zoner ska däremot spegla en tydligare förändring i exempelvis räckvidd, komplexitet, mandat, ansvar eller konsekvens.

Zoner ska visas i arkitektur- och resultatvyer för behöriga användare, men får **inte** visas som ett bedömningsfält i rollbedömningsvyn. Bedömaren ska fortsatt endast bedöma rollens krav mot kriteriedefinition, ankare och den gemensamma bedömningsskalan.

### 14.6 Nivåernas funktion inom respektive zon

Varje zon omfattar tre nivåer. De tre nivåerna ska inte tolkas som tre olika yrkestyper, utan som en successiv skillnad i kravprofil inom samma breda karaktär.

| Placering i zon | Funktion | Tolkning |
|---|---|---|
| **Första nivån i zonen** | Inträde till zonen | Rollen uppfyller zonens grundläggande kvalitativa krav och profilkrav. |
| **Mittennivån i zonen** | Etablerad zonprofil | Rollen uppfyller zonens krav tydligt och har en stabil, typisk profil för zonen. |
| **Högsta nivån i zonen** | Övre del av zonen | Rollen ligger nära nästa zon genom högre räckvidd, komplexitet, ansvar eller konsekvens, men uppfyller ännu inte nästa zons samlade profil. |

Exempel: En roll på nivå 6 kan ha en mycket stark profil inom zon B, men saknar ett eller flera av de kvalitativa eller kvantitativa villkor som krävs för att tillhöra zon A. Nivå 6 är därför inte ”nästan nivå 1” i titel eller status, utan den högsta etablerade nivån inom sin egen zon.

### 14.7 Hur zoner och tröskelvärden ska förankras

Zoner och nivåtrösklar ska fastställas genom en spårbar kalibreringsprocess. Processen ska börja i innehållet — inte i en önskad nivåfördelning.

#### Steg 1: Skriv kvalitativa zonbeskrivningar

Börja med de fyra zonernas karaktär enligt avsnitt 14.5. Beskriv vad som typiskt skiljer en roll i en zon från en roll i zonen under, med ord som är kopplade till den egna modellens kriterier:

- räckvidd och påverkan,
- komplexitet och otydlighet,
- grad av självständighet och beslutsmandat,
- konsekvens, risk och ansvar,
- kompetensens djup, bredd eller särskilda kvalifikationskrav,
- eventuella objektiva arbetsförhållanden.

#### Steg 2: Välj representativa ankarroller

Välj flera befintliga roller som har väl dokumenterade och relativt okontroversiella kravprofiler. Ankarroller ska tillsammans representera olika funktioner och rolltyper, exempelvis specialist-, chefs-, kommersiella och stödjande roller.

En ankarroll ska väljas för att den är **typisk och begriplig**, inte för att dess nuvarande lön, titel eller innehavare ska försvaras.

#### Steg 3: Bedöm ankarroller utan insyn i viktning och resultat

Ankarrollerna ska bedömas enligt Stadium 2: endast mot kriteriedefinitioner, ankare och den gemensamma bedömningsskalan. Bedömarna ska inte se kriteriernas vikt, preliminära poäng eller önskad zon.

#### Steg 4: Tillämpa viktning och analysera mönster

När bedömningarna har låsts beräknar systemet viktade rollvärden enligt den godkända modellversionen. Därefter analyseras:

- vilka poängintervall som naturligt samlas kring liknande kravprofiler,
- om de föreslagna zonerna innehåller roller med en begriplig och sammanhängande karaktär,
- om högre zoner verkligen har starkare profil i de kriterier företaget viktat högst,
- om någon rolltyp systematiskt gynnas eller missgynnas av kriterieval, viktning eller trösklar.

#### Steg 5: Sätt preliminära trösklar och profilkrav

För varje zon och nivå fastställs:

1. ett **poängintervall** eller en miniminivå för viktat rollvärde,
2. ett eller flera **profilkrav** på de högst viktade kriterierna,
3. en **kvalitativ nivåbeskrivning**,
4. minst en relevant **ankarroll** eller ankarkategori när underlag finns.

Profilkravet ska alltid skydda värdelogiken. Om exempelvis Komplexitet och otydlighet, Scope och påverkan samt Risk och konsekvens är de högst viktade kriterierna, ska högre zoner normalt kräva en viss lägstanivå eller sammanlagd profil i dessa — inte endast en hög totalpoäng.

#### Steg 6: Genomför konsekvensanalys och godkänn

Innan publicering ska modellen testas mot ett urval roller från olika funktioner. Resultatet ska kunna förklaras i relation till zonbeskrivningar, kriterier och viktning. Om det behövs ändringar ska modellen ändras på metodnivå och testas på nytt — inte justeras för att flytta en enskild titel.

### 14.8 Förslag till zonregler i datamodellen

```text
Zon
- zon_id
- namn
- niva_fran
- niva_till
- zonbeskrivning
- kriterieprofil_princip
- ankarroller: lista
- aktiv: ja/nej

Nivaregel
- niva_id
- zon_id
- namn
- min_viktad_totalpoang
- max_viktad_totalpoang: valfri
- profilkrav
- nivabeskrivning
- ankarroller: lista
- modellversion
```

Systemet ska beräkna zon och nivå i denna ordning:

```text
1. Beräkna viktat rollvärde efter att rollbedömningen är låst.
2. Identifiera preliminär zon utifrån poängintervall och zonens profilkrav.
3. Identifiera preliminär nivå inom zonen utifrån nivåintervall och nivåprofil.
4. Jämför resultatet med relevanta ankarroller.
5. Markera "kalibrering krävs" om totalpoäng, profilkrav och kvalitativ zonbeskrivning ger motsägelsefullt utfall.
6. Lås zon och nivå först efter behörig kalibrering och godkännande.
```

### 14.9 Regler vid övergång från sju till tolv nivåer

Övergången ska göras som en kontrollerad modellförändring, inte som en enkel omnumrering.

1. Behåll den godkända kriterie- och viktlogiken som utgångspunkt.
2. Definiera de fyra zonerna och deras kvalitativa skillnader.
3. Välj och bedöm ankarroller enligt den redan fastställda rollbedömningsmetoden.
4. Beräkna resultaten och föreslå trösklar samt profilkrav för tolv nivåer.
5. Jämför utfallet mot dagens sju nivåer för att förstå vilka roller som delas upp, flyttas eller förblir samlade.
6. Genomför särskild konsekvensanalys för olika rollfamiljer och könsdominerade rollgrupper.
7. Godkänn som en ny modellversion med dokumenterad motivering, datum och beslutsfattare.
8. Kommunicera att den nya nivån uttrycker relativt rollvärde och inte automatiskt innebär förändrad titel, lön eller individuell prestation.

---

## 15. Exempel på modellkonfigurationer

### 15.1 Tech-/SaaS-bolag

| Dimension | Exempel på valda kriterier |
|---|---|
| Kompetens | Kunskapsdjup och specialistnivå; vid behov Kunskapsbredd och tvärdisciplinär förståelse. |
| Ansträngning/komplexitet | Komplexitet och otydlighet. |
| Ansvar/påverkan | Scope och påverkan; Autonomi och beslutsmandat; Risk och konsekvens. |
| Arbetsförhållanden | Prövas; ofta inte aktivt, om inga materiella skillnader finns. |

### 15.2 Reglerat medtech- eller finansbolag

| Dimension | Exempel på valda kriterier |
|---|---|
| Kompetens | Kunskapsdjup och specialistnivå; Formella kvalifikations-, behörighets- och certifieringskrav. |
| Ansträngning/komplexitet | Komplexitet och otydlighet. |
| Ansvar/påverkan | Scope och påverkan; Risk och konsekvens; Informations-, säkerhets- eller regelefterlevnadsansvar. |
| Arbetsförhållanden | Särskilda säkerhets-, sekretess- eller kontrollmiljöer, om materiellt relevanta. |

### 15.3 Industribolag med produktion och fältservice

| Dimension | Exempel på valda kriterier |
|---|---|
| Kompetens | Kunskapsdjup och specialistnivå; Domän- och verksamhetskunskap. |
| Ansträngning/komplexitet | Komplexitet och otydlighet; Fysisk eller sensorisk ansträngning. |
| Ansvar/påverkan | Scope och påverkan; Risk och konsekvens. |
| Arbetsförhållanden | Säkerhets- och exponeringsförhållanden. |

Dessa är exempel — inte färdiga standardmodeller. Varje företag måste dokumentera varför de valda kriterierna är relevanta och icke överlappande i den egna verksamheten.

---

## 16. Datamodell

### 16.1 Dimension

```text
Dimension
- id
- namn
- obligatorisk: ja
- aktiv: ja/nej
- relevansstatus: aktiv | provad_ej_materiell
- relevansmotivering
```

Tillåtna dimensioner:

```text
kompetens
anstrangning_och_komplexitet
ansvar_och_paverkan
arbetsforhallanden
```

### 16.2 Kriterium

```text
Kriterium
- id
- namn
- beskrivning
- primar_dimension
- sekundar_dimension: valfri
- aktiv: ja/nej
- ar_valbart: ja/nej
- bedomningsskala: 0-5 eller 1-5
- noll_tillaten: ja/nej
- vad_det_mater
- vad_det_inte_mater
- dubblettkontroll_text
- kort_ui_text
- full_definition
- nar_lampligt
- nar_normalt_inte_lampligt
- exempel_pa_relevanta_verksamheter
- exempel_pa_relevanta_rolltyper
- vanliga_overlappningar: lista
- kontrollfraga
- max_antal_inom_dimension
- bedomningsfraga
- ankare_1
- ankare_3
- ankare_5
- mellantext_niva_2: valfri
- mellantext_niva_4: valfri
```

### 16.3 Kriterievikt — endast Stadium 1

```text
Kriterievikt
- kriterium_id
- viktpoang_1_5: heltal 1-5
- viktklass_namn
- viktmotiv
- modellversion
```

### 16.4 Rollbedomning — endast Stadium 2

```text
Rollbedomning
- roll_id
- kriterium_id
- bedomningspoang_1_5: heltal
- bedomningsmotivering
- valt_ankarunderlag
- bedomd_av
- datum
- modellversion
- status: utkast | last | kalibrerad
```

### 16.5 Viktning

```text
Viktning
- antal_aktiva_kriterier
- viktbudget = antal_aktiva_kriterier * 3
- viktpoang_anvanda
- viktpoang_kvar
- hogst_viktade_kriterier: lista
- dimensionsvikt: summerad vikt per dimension
```

### 16.6 Zon och nivåregler

```text
Zon
- zon_id
- namn
- niva_fran
- niva_till
- zonbeskrivning
- kriterieprofil_princip
- ankarroller: lista
- aktiv: ja/nej
- modellversion

Nivaregel
- niva_id
- zon_id
- namn
- min_viktad_totalpoang
- max_viktad_totalpoang: valfri
- profilkrav
- nivabeskrivning
- ankarroller: lista
- modellversion
```

### 16.7 Modellversion

```text
Modellversion
- versionsnummer
- datum
- beslutsfattare
- andringsorsak
- foregaende_version
- konsekvensanalys
- godkannandestatus
```

---

## 17. Implementationsregler för system och AI-agenter

### 17.1 Överordnad regelhierarki

```text
Konstitution → dimensionsregler → företagskonfiguration → godkänd modellversion → rollbedömning → resultat
```

Ingen senare instruktion får tyst åsidosätta en tidigare regel. Vid konflikt ska systemet stoppa, förklara konflikten och begära förtydligande.

### 17.2 Obligatoriska valideringar före modellgodkännande

Systemet eller AI-agenten ska kontrollera:

1. att alla fyra dimensioner finns i modellen,
2. att Kompetens, Ansträngning och komplexitet samt Ansvar och påverkan har minst ett aktivt kriterium vardera,
3. att Arbetsförhållanden antingen har ett aktivt kriterium eller statusen `provad_ej_materiell` med motivering,
4. att det normalt finns 6–8 aktiva kriterier,
5. att varje kriterium har exakt en primär dimension,
6. att varje kriterium har tydlig definition, `vad_det_mater` och `vad_det_inte_mater`,
7. att överlappningskontroll har genomförts,
8. att viktbudgeten är exakt uppfylld,
9. att varje `Kriterievikt.viktpoang_1_5` ligger mellan 1 och 5,
10. att Ansvar och påverkan inte har fler än tre aktiva kriterier utan särskilt beslut,
11. att arbetsförhållanden inte kan göras godtyckligt valbart per individ,
12. att högst viktade kriterier används i zonernas profilkrav,
13. att ändrade kriterier, vikter eller trösklar skapar ny modellversion och konsekvensanalys.

### 17.3 Valideringar vid rollbedömning

Systemet eller AI-agenten ska kontrollera:

1. att den använda modellen är godkänd, låst och versionssatt,
2. att bedömningspoängen ligger inom kriteriets tillåtna skala,
3. att bedömningen är motiverad när nivå 1, 4 eller 5 väljs, eller när tillgängligt rollunderlag motsäger bedömningen,
4. att rollbedömaren inte får åtkomst till viktningsdata eller resultatdata under bedömningen,
5. att arbetsförhållandekriterium, när det är aktivt, bedöms för samtliga roller enligt samma definition,
6. att bedömningen gäller rollen och inte individens prestation, lön eller titel.

### 17.4 Beräkningslogik

```text
funktion berakna_rollvarde(roll, modell):
    kontrollera att modellen är godkänd och låst
    kontrollera att samtliga rollbedömningar är låsta

    total = 0

    för varje aktivt kriterium i modellen:
        bedomning = roll.bedomning[kriterium.id]

        om kriterium.primar_dimension == arbetsforhallanden
           och kriterium.arbetsforhallanden_aktiva == sant
           och rollen inte omfattas:
               bedomning = 0

        validera att bedomning ligger inom kriteriets tillåtna bedomningsskala
        vikt = modell.kriterievikt[kriterium.id].viktpoang_1_5
        total = total + (bedomning * vikt)

    profilresultat = utvardera_profilkrav(roll, modell.hogst_viktade_kriterier)
    preliminar_zon = hitta_zon_fran_total(total, modell.zonregler)

    om profilresultat inte uppfyller preliminar_zon.profilkrav:
        returnera status = "kalibrering_kravs", total, preliminar_zon, profilresultat

    returnera status = "klar", total, preliminar_zon
```

### 17.5 UI- och behörighetsregler

| Läge | Rubrik | Fråga | Visar |
|---|---|---|---|
| Stadium 1 | **METODBYGGNAD – Kriterieval och viktning** | Hur ska vår metod byggas och vilka kriterier ska ha störst genomslag? | Dimensioner, kriteriebibliotek, avgränsning, vikter, budget och modellkontroller. |
| Stadium 2 | **ROLLBEDÖMNING – Bedömning av rollens krav** | Vilken kravnivå har rollen på detta kriterium? | Kriteriedefinition, avgränsning, ankare, bedömningsskala och motiveringsfält. |

Systemet ska:

- låta endast behöriga användare skapa eller revidera metodbyggnaden,
- låsa viktning när modellen godkänns,
- inte tillåta rollbedömning mot en icke godkänd modell,
- blockera åtkomst till viktning och resultat under aktiv rollbedömning,
- inte låta bedömaren navigera till metodbyggnadsläget från en aktiv bedömning,
- först i en separat resultat- och kalibreringsvy för behöriga användare tillämpa viktning och beräkna totalvärde,
- vid metodändring skapa ny modellversion och markera berörda rollbedömningar för eventuell omvärdering.

### 17.6 När AI-agenten ska stoppa och be om förtydligande

AI-agenten ska inte gissa när instruktioner är otydliga eller motsägelsefulla.

| Situation | Agentens åtgärd |
|---|---|
| Två instruktioner säger olika saker om samma kriterium eller vikt | Visa konflikten och be användaren avgöra vilken regel som gäller. |
| Nytt kriterium saknar primär dimension | Be om mappning innan kriteriet skapas. |
| Kriteriet överlappar ett befintligt | Beskriv överlappningen och be användaren välja: behåll, ersätt, slå ihop eller avgränsa. |
| Viktbudgeten över- eller underskrids | Visa använda och tillgängliga viktpoäng och be om ändrad prioritering. |
| Arbetsförhållanden föreslås för endast en individ utan gemensam definition | Stoppa och förklara att dimensionen ska aktiveras på modellnivå. |
| En ändring syftar till att få en viss person eller titel till en viss nivå | Stoppa och be om generell, rollbaserad motivering och konsekvensanalys. |
| Underlag saknas för rollbedömning | Markera bedömningen preliminär och be om rollbeskrivning eller sakligt underlag. |

---

## 18. Förändringsstyrning och kvalitetssäkring

Följande förändringar kräver alltid ny modellversion:

- aktivering, borttag eller omdefinition av kriterium,
- ändrad dimensionstillhörighet,
- ändrad vikt eller viktbudget,
- ändrade kriterieankare,
- ändrad zonlogik eller tröskel,
- ändrat profilkrav.

Varje förändring ska dokumentera:

1. ändringsorsak,
2. berörda kriterier och dimensioner,
3. bedömd risk för överlappning eller snedvridning,
4. påverkan på chef-, specialist-, kommersiella och stödjande roller,
5. påverkan på befintliga ankarroller och nivåer,
6. beslut om omvärdering av berörda roller,
7. godkännande från behörig modellägare.

---

## 19. Checklista för införande

### Fas 1 — etablera konstitutionen

- [ ] Lägg in de fyra dimensionerna som fasta systemobjekt.
- [ ] Lägg in relevansprövning för Arbetsförhållanden.
- [ ] Lägg in dimensionstak och regler för antal aktiva kriterier.
- [ ] Lägg in datamodell för separata objekt för kriterier, kriterievikter och rollbedömningar.

### Fas 2 — gör kriteriebiblioteket tillgängligt

- [ ] Lägg in samtliga 22 kriteriealternativ med definitioner, avgränsningar och överlappningsvarningar.
- [ ] Implementera kriteriekort och vägledd urvalsprocess.
- [ ] Implementera kontrollfrågor och obligatoriska motiveringar.
- [ ] Implementera varningar för dubbelräkning och överskridna dimensionstak.

### Fas 3 — konfigurera metodbyggnaden

- [ ] Välj normalt 6–8 aktiva kriterier.
- [ ] Dokumentera vad varje valt kriterium mäter och inte mäter.
- [ ] Genomför och dokumentera relevansprövning av Arbetsförhållanden.
- [ ] Fördela viktbudget enligt antal aktiva kriterier × 3.
- [ ] Dokumentera viktmotiv och genomför konsekvensanalys.
- [ ] Godkänn och lås modellversionen.

### Fas 4 — genomför rollbedömning

- [ ] Visa endast bedömningsunderlag, inte vikter eller resultat.
- [ ] Bedöm roller mot kriteriedefinitioner och ankare.
- [ ] Dokumentera saklig motivering för bedömningar.
- [ ] Lås bedömningar före beräkning.
- [ ] Beräkna därefter totalvärde i separat behörig resultatvy.
- [ ] Kalibrera mot ankarroller, profilkrav och zonbeskrivningar.

---

## 20. Sammanfattande princip

Den färdiga modellen bygger på en tydlig ordning:

> **Konstitutionen skyddar hur modellen byggs. Kriteriebiblioteket ger företaget saklig valfrihet. Kriterievalet bestämmer vad som jämförs. Viktningen bestämmer vilka skillnader som ska få störst genomslag. Rollbedömningen avgör sedan, utan insyn i vikter eller resultat, hur höga krav den enskilda rollen har. Först efter den låsta bedömningen beräknar systemet det relativa rollvärdet.**

Det gör modellen både anpassningsbar för olika företag och robust nog för att kunna förklara varför olika roller bedöms som lika eller olika värdefulla.
