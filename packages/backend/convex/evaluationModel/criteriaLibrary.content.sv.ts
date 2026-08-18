import type { CriteriaLibraryContent } from "./criteriaLibrary.content.en"

// Swedish content for the criteria library (the masterdokument's sections
// 5-13.5). Swedish is the substance source locale: criterion names, the
// section 5 dimension rows, the section 7-10 table cells (measures,
// notMeasures, whenSuitable, whenNotSuitable), the section 10.1 test
// question and notMaterialLabel, the section 13.3 shared scale, and the
// section 13.5 anchors (scope-impact, complexity-ambiguity, risk-consequence)
// are verbatim from docs/rollvardering-masterdokument.md. Every other field
// (shortUiText, fullDefinition, controlQuestion, assessmentQuestion, the
// midpoint captions, and the anchor1/anchor3/anchor5 sets of the remaining
// 18 criteria) is a faithful Swedish counterpart of criteriaLibraryContentEn,
// since the masterdokument does not define those per criterion.
export const criteriaLibraryContentSv: CriteriaLibraryContent = {
  dimensions: {
    competence: {
      name: "Kompetens",
      question:
        "Vilka kunskaper, färdigheter, erfarenheter och kvalifikationer kräver rollen?",
      why: "Skyddar specialist-, professions- och kvalifikationskrävande roller från att undervärderas.",
    },
    effort: {
      name: "Ansträngning och komplexitet",
      question:
        "Hur svår, otydlig, analytiskt, kommunikativt eller fysiskt krävande är rollen?",
      why: "Synliggör krävande arbete även när rollen saknar formell chefsmakt.",
    },
    responsibility: {
      name: "Ansvar och påverkan",
      question:
        "Vilken räckvidd, vilket mandat och vilka konsekvenser har rollen?",
      why: "Fångar ansvar för beslut, resultat, risk, människor, kvalitet och verksamhet.",
    },
    workingConditions: {
      name: "Arbetsförhållanden",
      question:
        "Finns särskilda objektiva och varaktiga arbetsvillkor som påverkar kraven?",
      why: "Synliggör exempelvis beredskap, exponering, säkerhetskrav och oregelbundna förhållanden.",
    },
  },
  workingConditionsTest: {
    question:
      "Finns minst en rollfamilj där särskilda arbetsförhållanden är en återkommande, objektiv och materiell del av rollens krav, och där kravet inte redan fångas korrekt av ett annat kriterium?",
    notMaterialLabel: "Prövad, men inte materiellt relevant",
  },
  sharedScale: {
    "1": {
      name: "Avgränsat krav",
      meaning:
        "Kravet är tydligt definierat, lokalt eller begränsat i omfattning. Rollen arbetar huvudsakligen inom etablerade ramar.",
    },
    "2": {
      name: "Grundläggande till måttligt krav",
      meaning:
        "Kravet förekommer återkommande men inom ett tydligt avgränsat område. Rollen hanterar variationer och enklare avvikelser.",
    },
    "3": {
      name: "Självständigt och etablerat krav",
      meaning:
        "Kravet är en tydlig och återkommande del av rollen. Rollen gör professionella bedömningar inom sitt område.",
    },
    "4": {
      name: "Avancerat eller brett krav",
      meaning:
        "Kravet är avancerat, har bredare räckvidd eller kräver självständiga avvägningar där etablerade arbetssätt inte alltid räcker.",
    },
    "5": {
      name: "Mycket avancerat, omfattande eller verksamhetskritiskt krav",
      meaning:
        "Kravet har mycket stor omfattning, svårighetsgrad, konsekvens eller strategisk betydelse. Rollen formar ofta riktning, standarder, lösningar eller resultat utanför det egna närmaste området.",
    },
  },
  midpoints: {
    step2: "Ett genomtänkt mellanläge mellan steg 1 och 3.",
    step4: "Ett genomtänkt mellanläge mellan steg 3 och 5.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Kunskapsdjup och specialistnivå",
      shortUiText:
        "Rollens krav på fördjupad specialistkunskap och avancerad problemlösning.",
      fullDefinition:
        "Fångar rollens krav på fördjupad fackkunskap, specialistmetodik, avancerad problemlösning och relevant erfarenhet. Kriteriet mäter djupet i den expertis rollen normalt använder, inte en formell examen i sig eller hur ett enskilt problem råkade lösas.",
      measures:
        "Krav på fördjupad fackkunskap, specialistmetodik, avancerad problemlösning och relevant erfarenhet.",
      notMeasures:
        "Formell examen i sig, svårigheten i ett enskilt problem eller individens prestation.",
      whenSuitable: "Nästan alltid relevant i kunskapsintensiva verksamheter.",
      whenNotSuitable:
        "Välj normalt detta eller det bredare samlade kompetenskriteriet, inte båda.",
      controlQuestion:
        "Har djupet i den specialistkunskap rollen kräver betydelse i sig, skilt från dess bredd, formella kvalifikationer, domänkontext och rådgivningsomdöme?",
      assessmentQuestion:
        "Vilken nivå av specialistkunskapsdjup kräver rollen normalt och varaktigt?",
      anchor1:
        "Rollen använder etablerad, väldokumenterad fackkunskap inom ett tydligt avgränsat område och tillämpar kända metoder på välbekanta problem.",
      anchor3:
        "Rollen tillämpar självständigt fördjupad specialistkunskap och etablerad fackmetodik för att lösa problem inom sitt eget område.",
      anchor5:
        "Rollen besitter specialistkunskap på mycket avancerad nivå och anlitas ofta för fältets svåraste problem, vilket formar professionella standarder eller praxis utanför det egna teamet.",
    },
    "knowledge-breadth": {
      name: "Kunskapsbredd och tvärdisciplinär förståelse",
      shortUiText:
        "Rollens krav på att integrera flera kompetensområden och förstå deras samband.",
      fullDefinition:
        "Fångar rollens krav på att kombinera och integrera flera kompetensområden, till exempel produkt, data, affär och teknik, och att förstå hur de hänger ihop. Kriteriet mäter bredden i integrationen, inte antalet personer rollen samarbetar med.",
      measures:
        "Krav på att integrera flera kompetensområden och förstå deras samband.",
      notMeasures: "Antal samarbetspartner eller organisatorisk påverkan.",
      whenSuitable:
        "När roller behöver kombinera flera sakområden, exempelvis produkt, data, affär och teknik.",
      whenNotSuitable:
        "Välj endast när bredd är en självständig skillnad från specialistdjup.",
      controlQuestion:
        "Har bredden i den kompetens rollen integrerar betydelse i sig, skilt från hur djup dess specialistkunskap är?",
      assessmentQuestion:
        "Vilken nivå av tvärdisciplinär bredd kräver rollen normalt och varaktigt?",
      anchor1:
        "Rollen använder huvudsakligen ett kompetensområde och behöver sällan koppla det till andra discipliner.",
      anchor3:
        "Rollen kombinerar självständigt ett fåtal etablerade kompetensområden och förstår hur de påverkar varandra.",
      anchor5:
        "Rollen integrerar många olika kompetensområden på mycket avancerad nivå och förlitas på att koppla samman dem på sätt som formar lösningar eller riktning utanför det egna området.",
    },
    "formal-qualifications": {
      name: "Formella kvalifikations-, behörighets- och certifieringskrav",
      shortUiText:
        "Rollens krav på obligatorisk legitimation, behörighet eller certifiering.",
      fullDefinition:
        "Fångar formella krav rollen måste uppfylla för att lagligt utöva, signera eller ansvara för arbetet, till exempel en obligatorisk legitimation, behörighet eller certifiering. Kriteriet mäter det formella kravet i sig, inte allmän utbildningsstatus eller en prestigefylld examen som inte krävs för att utföra arbetet.",
      measures:
        "Formella krav som krävs för att utöva, signera eller ansvara för arbetet.",
      notMeasures:
        "Allmän utbildningsstatus, prestigefylld examen eller frivilliga kurser.",
      whenSuitable:
        "Reglerade eller säkerhetskritiska roller med obligatorisk legitimation, behörighet eller certifiering.",
      whenNotSuitable:
        "Ska inte användas om utbildning bara är en väg till kompetens som redan fångas av Kunskapsdjup.",
      controlQuestion:
        "Har rollens obligatoriska legitimation, behörighet eller certifiering betydelse i sig, skilt från den specialistkunskap den också kräver?",
      assessmentQuestion:
        "Vilken nivå av formell kvalifikation, legitimation eller certifiering kräver rollen normalt och varaktigt?",
      anchor1:
        "Rollen kräver en grundläggande, tydligt definierad behörighet eller certifiering med begränsat krav på förnyelse eller omfattning.",
      anchor3:
        "Rollen kräver en etablerad yrkeslegitimation eller certifiering som är ett återkommande, självständigt villkor för att utöva rollen.",
      anchor5:
        "Rollen kräver en avancerad eller verksamhetskritisk legitimation, behörighet eller certifiering, utan vilken rollen inte lagligt kan utövas, signeras eller ansvaras för, och som ofta sätter den standard andra måste uppfylla.",
    },
    "domain-knowledge": {
      name: "Domän- och verksamhetskunskap",
      shortUiText:
        "Rollens krav på djup, svårersättlig kunskap om sin specifika bransch eller verksamhetskontext.",
      fullDefinition:
        "Fångar rollens krav på djup kontextkunskap, till exempel bransch, produkt, kundmiljö eller regelverkskontext, som inte snabbt kan ersättas av allmän yrkesskicklighet. Kriteriet mäter djupet i kontextkunskapen, inte den allmänna erfarenhet eller organisationskännedom alla förväntas bygga upp över tid.",
      measures:
        "Djup kontextkunskap som inte snabbt ersätts av generell yrkesskicklighet.",
      notMeasures:
        "Allmän erfarenhet eller organisationskännedom som alla förväntas bygga upp.",
      whenSuitable:
        "När specifik bransch-, produkt-, kundmiljö- eller regelverkskunskap är en egen rollförutsättning.",
      whenNotSuitable:
        "Domän = kontexten; specialistnivå = professionell metod och färdighet.",
      controlQuestion:
        "Har rollens kontextspecifika domänkunskap betydelse i sig, skilt från dess allmänna specialistmetod och färdighet?",
      assessmentQuestion:
        "Vilken nivå av domän- och verksamhetskunskap kräver rollen normalt och varaktigt?",
      anchor1:
        "Rollen kräver domänkunskap begränsad till en tydligt avgränsad produkt-, process- eller kundkontext.",
      anchor3:
        "Rollen kräver etablerad, självständig kunskap om sin verksamhetsdomän som inte snabbt ersätts av allmän yrkesskicklighet.",
      anchor5:
        "Rollen kräver mycket djup, verksamhetskritisk domänkunskap som är svår att ersätta och som ofta formar hur domänens standarder eller praxis sätts utanför rollens eget område.",
    },
    "advisory-judgment": {
      name: "Rådgivnings- och omdömeskompetens",
      shortUiText:
        "Rollens krav på att väga information och omsätta expertis i kvalificerade rekommendationer.",
      fullDefinition:
        "Fångar rollens krav på att väga information, utöva professionellt omdöme och omsätta expertis i kvalificerade råd eller rekommendationer som andra agerar på. Kriteriet mäter själva rådgivningsomdömet, inte det formella mandatet att besluta vad som händer härnäst.",
      measures:
        "Krav på att värdera information, ge kvalificerade råd och omsätta expertis i rekommendationer.",
      notMeasures: "Formellt beslutsmandat.",
      whenSuitable:
        "Konsult-, partner-, specialist- och ledande expertroller där kvalificerade råd är kärnleveransen.",
      whenNotSuitable:
        "Ska inte kombineras med Kunskapsdjup om det bara beskriver samma expertis med andra ord.",
      controlQuestion:
        "Har rollens krav på att utöva rådgivningsomdöme betydelse i sig, skilt från den specialistkunskap omdömet bygger på?",
      assessmentQuestion:
        "Vilken nivå av rådgivnings- och omdömeskompetens kräver rollen normalt och varaktigt?",
      anchor1:
        "Rollen bidrar med underlag eller okomplicerade råd inom ett tydligt avgränsat område, enligt etablerad vägledning.",
      anchor3:
        "Rollen väger självständigt information och ger etablerade, professionella råd som andra förlitar sig på inom sitt eget område.",
      anchor5:
        "Rollens råd och omdöme efterfrågas i mycket avancerade eller verksamhetskritiska frågor och formar ofta de rekommendationer, standarder eller den riktning andra delar av verksamheten följer.",
    },
    "complexity-ambiguity": {
      name: "Komplexitet och otydlighet",
      shortUiText:
        "Rollens krav på att hantera osäkerhet, mångfacetterade frågor och oklara ramar med kvalificerat omdöme.",
      fullDefinition:
        "Fångar den osäkerhet, de mångfacetterade frågorna, oklara ramar och det behov av kvalificerat omdöme rollen normalt arbetar med. Kriteriet mäter karaktären hos de problem rollen hanterar, inte kunskapskravet i sig, arbetstempot eller den organisatoriska räckvidden.",
      measures:
        "Osäkerhet, mångfacetterade frågor, oklara ramar och behov av kvalificerat omdöme.",
      notMeasures:
        "Kunskapskravet i sig, högt arbetstempo eller organisatorisk räckvidd.",
      whenSuitable: "Nästan alltid relevant.",
      whenNotSuitable: "Bör normalt vara huvudkriteriet inom dimensionen.",
      controlQuestion:
        "Har den komplexitet och otydlighet rollen hanterar betydelse i sig, skilt från den analytiska ansträngning som läggs på att arbeta igenom den?",
      assessmentQuestion:
        "Vilken nivå av komplexitet och otydlighet hanterar rollen normalt och varaktigt?",
      anchor1:
        "Rollen arbetar huvudsakligen med tydligt definierade frågor, etablerade metoder och förutsägbara situationer.",
      anchor2:
        "Rollen hanterar återkommande variationer och enklare avvikelser där den väljer mellan kända alternativ.",
      anchor3:
        "Rollen hanterar självständigt komplexa frågor inom sitt område och behöver analysera, prioritera och anpassa lösningar.",
      anchor4:
        "Rollen hanterar avancerade, tvärfunktionella eller delvis otydliga problem där etablerade lösningar inte alltid räcker.",
      anchor5:
        "Rollen definierar och hanterar mycket komplexa eller strategiskt viktiga problem med hög osäkerhet och formar ofta angreppssätt, principer eller långsiktiga lösningar.",
    },
    "analytical-effort": {
      name: "Analytisk och problemlösande ansträngning",
      shortUiText:
        "Omfattningen av analys, felsökning eller systematisk problemlösning rollen normalt utför.",
      fullDefinition:
        "Fångar omfattningen av analys, felsökning, modellering, diagnostik eller systematisk problemlösning rollen normalt utför. Kriteriet mäter det analytiska arbetet i sig, inte specialistkunskapen bakom det eller enbart förekomsten av otydliga problem.",
      measures:
        "Omfattning av analys, felsökning, modellering, diagnostik eller systematisk problemlösning.",
      notMeasures: "Specialistkunskap eller endast otydliga problem.",
      whenSuitable:
        "När den mentala analysbördan skiljer sig tydligt mellan roller trots jämförbar komplexitet.",
      whenNotSuitable:
        "Kombinera med Komplexitet endast om skillnaden kan förklaras: komplexitet = problemets natur; analys = arbetet som krävs för att hantera det.",
      controlQuestion:
        "Har den analytiska ansträngning rollen lägger på att lösa problem betydelse i sig, skilt från hur komplexa eller otydliga dessa problem är?",
      assessmentQuestion:
        "Vilken nivå av analytisk och problemlösande ansträngning bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen utför okomplicerad analys eller felsökning inom en tydligt avgränsad uppgift, enligt etablerade steg.",
      anchor3:
        "Rollen utför självständigt etablerad analys, diagnostik eller systematisk problemlösning som en återkommande del av sitt eget område.",
      anchor5:
        "Rollen utför mycket avancerad eller omfattande analys, modellering eller diagnostik som ofta är verksamhetskritisk och formar hur liknande problem angrips utanför det egna området.",
    },
    "communication-effort": {
      name: "Kommunikations- och relationskrävande arbete",
      shortUiText:
        "Rollens krav på avancerad kommunikation, förhandling eller konflikthantering.",
      fullDefinition:
        "Fångar rollens krav på avancerad kommunikation, förhandling, påverkan, konflikthantering eller översättning mellan olika intressen. Kriteriet mäter den kommunikativa ansträngningen, inte antalet intressenter rollen råkar hantera eller dess organisatoriska påverkan.",
      measures:
        "Krav på avancerad kommunikation, förhandling, påverkan, konflikthantering eller översättning mellan intressen.",
      notMeasures: "Antal intressenter eller organisatorisk påverkan.",
      whenSuitable:
        "Kundnära, förhandlande, rådgivande eller konflikthanterande verksamheter där detta är ett centralt arbete.",
      whenNotSuitable:
        "Mäts som kommunikativ ansträngning, inte som nätverkets storlek.",
      controlQuestion:
        "Har den kommunikativa ansträngning rollen bär betydelse i sig, skilt från hur många intressenter eller hur stor organisatorisk räckvidd den har?",
      assessmentQuestion:
        "Vilken nivå av kommunikations- och relationsansträngning bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen kommunicerar inom ett tydligt avgränsat, till största delen rutinmässigt utbyte med etablerade motparter.",
      anchor3:
        "Rollen genomför självständigt etablerad, återkommande kommunikation, förhandling eller konflikthantering som en del av sitt eget område.",
      anchor5:
        "Rollen bär mycket avancerad eller verksamhetskritisk kommunikation, förhandling eller konflikthantering och formar ofta hur känsliga relationer eller tvister hanteras utanför det egna området.",
    },
    "operational-intensity": {
      name: "Operativ intensitet och simultankrav",
      shortUiText:
        "Rollens normala krav på att hålla uppmärksamheten över flera samtidiga flöden och prioritera löpande.",
      fullDefinition:
        "Fångar den uppmärksamhet, simultanförmåga och kontinuerliga prioritering rollen normalt kräver i sitt ordinarie arbetsläge. Kriteriet mäter ett varaktigt, strukturellt krav, inte tillfälliga toppar, underbemanning eller dålig planering som råkar öka arbetsbördan.",
      measures:
        "Uppmärksamhet, simultanförmåga och kontinuerlig prioritering i normalläget.",
      notMeasures: "Tillfälliga toppar, underbemanning eller dålig planering.",
      whenSuitable:
        "Drift, kundservice, logistik eller övervakning med varaktiga krav på flera samtidiga flöden och snabba prioriteringar.",
      whenNotSuitable:
        "Får inte användas för att belöna arbetsmängd som uppstår genom resursbrist.",
      controlQuestion:
        "Har rollens normala operativa intensitet betydelse i sig, skilt från tillfälliga toppar orsakade av underbemanning eller dålig planering?",
      assessmentQuestion:
        "Vilken nivå av operativ intensitet och simultankrav bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen hanterar normalt ett flöde eller en uppgift i taget inom en tydligt avgränsad arbetsrytm.",
      anchor3:
        "Rollen hanterar självständigt flera etablerade, samtidiga flöden och prioriterar mellan dem som en normal del av sitt eget område.",
      anchor5:
        "Rollen upprätthåller mycket hög, verksamhetskritisk operativ intensitet över många samtidiga flöden, och hur den prioriterar sätter ofta mönstret andra följer.",
    },
    "physical-sensory": {
      name: "Fysisk eller sensorisk ansträngning",
      shortUiText:
        "Rollens återkommande fysiska belastning, precisionskrav eller sensoriska koncentration.",
      fullDefinition:
        "Fångar den återkommande fysiska belastning, precision, ergonomiskt krävande moment eller sensoriska koncentration rollen normalt kräver. Kriteriet mäter den fysiska eller sensoriska ansträngningen i sig, inte den säkerhetsrisk eller exponering arbetet också kan innebära.",
      measures:
        "Återkommande fysisk belastning, precision, ergonomiskt krävande moment eller sensorisk koncentration.",
      notMeasures: "Säkerhetsrisk eller fysisk exponering.",
      whenSuitable:
        "Industri, vård, lager, produktion, fältservice eller laboratorier.",
      whenNotSuitable:
        "Riskmiljö och exponering hör normalt till Arbetsförhållanden.",
      controlQuestion:
        "Har den fysiska eller sensoriska ansträngning rollen bär betydelse i sig, skilt från den säkerhetsrisk eller exponering den också kan innebära?",
      assessmentQuestion:
        "Vilken nivå av fysisk eller sensorisk ansträngning bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen innebär lätta, tillfälliga fysiska eller sensoriska krav inom en tydligt avgränsad uppgift.",
      anchor3:
        "Rollen bär självständigt etablerad, återkommande fysisk belastning, precisionsarbete eller sensorisk koncentration som en normal del av sitt eget område.",
      anchor5:
        "Rollen bär mycket krävande, uthållig fysisk eller sensorisk ansträngning som ofta är verksamhetskritisk att utföra rätt, till exempel precisionsarbete vars standard andra hålls till.",
    },
    "scope-impact": {
      name: "Scope och påverkan",
      shortUiText:
        "Rollens räckvidd: från en avgränsad uppgift till team, funktion, flera funktioner eller hela bolaget.",
      fullDefinition:
        "Fångar hur långt rollens resultat och beslut sträcker sig i organisationen, från tydligt avgränsade egna uppgifter till bolagsövergripande påverkan. Kriteriet mäter räckvidd, inte formell befogenhet.",
      measures:
        "Rollens räckvidd: från avgränsad uppgift till team, funktion, flera funktioner eller bolag.",
      notMeasures:
        "Formellt personalansvar, budgetstorlek eller själva mandatet.",
      whenSuitable: "Nästan alltid relevant.",
      whenNotSuitable:
        "Ska inte kombineras med ett separat kriterium som bara mäter organisatorisk räckvidd.",
      controlQuestion:
        "Har skillnaden i räckvidd mellan era roller betydelse i sig, utöver mandat och konsekvens?",
      assessmentQuestion:
        "Hur långt sträcker sig rollens normala och varaktiga påverkan?",
      anchor1:
        "Rollen påverkar främst kvaliteten, effektiviteten eller resultatet i egna tydligt avgränsade arbetsuppgifter.",
      anchor2:
        "Rollen påverkar ett avgränsat arbetsområde eller återkommande leverans inom ett team.",
      anchor3:
        "Rollen har självständigt ansvar för resultat inom ett tydligt område och påverkar teamets eller närliggande funktioners leverans och prioriteringar.",
      anchor4:
        "Rollen påverkar flera team, en funktion eller en väsentlig del av verksamheten genom val, prioriteringar eller lösningar med varaktiga följder.",
      anchor5:
        "Rollen påverkar bolagets övergripande riktning, resultat eller förmåga att lyckas genom beslut och ansvar med företagsövergripande eller strategisk effekt.",
    },
    "autonomy-mandate": {
      name: "Autonomi och beslutsmandat",
      shortUiText:
        "Hur självständigt rollen beslutar, och på vilken nivå, innan eskalering krävs.",
      fullDefinition:
        "Fångar hur självständigt rollen fattar beslut, på vilken nivå besluten ligger och hur mycket som behöver eskaleras till någon annan. Kriteriet mäter själva beslutsmandatet, inte konsekvensen av beslutet eller hur långt dess effekt sträcker sig.",
      measures: "Självständighet, beslutens nivå och behov av eskalering.",
      notMeasures:
        "Konsekvensen av beslutet eller dess organisatoriska räckvidd.",
      whenSuitable: "Nästan alltid relevant.",
      whenNotSuitable:
        "Mandat = rätt att besluta; scope = var effekten märks; risk = följden om det blir fel.",
      controlQuestion:
        "Har den nivå av beslutsmandat rollen har betydelse i sig, skilt från var effekterna märks och vilka konsekvenserna skulle bli om det blev fel?",
      assessmentQuestion:
        "Vilken nivå av autonomi och beslutsmandat har rollen normalt och varaktigt?",
      anchor1:
        "Rollen fattar beslut inom en tydligt avgränsad uppgift och eskalerar allt som ligger utanför etablerad rutin.",
      anchor3:
        "Rollen fattar självständigt etablerade beslut inom sitt eget område och eskalerar bara genuint nya eller tvärgående frågor.",
      anchor5:
        "Rollen har mycket brett eller verksamhetskritiskt beslutsmandat och beslutar i frågor vars riktning eller standarder sträcker sig utanför det egna närmaste området, med litet behov av eskalering.",
    },
    "risk-consequence": {
      name: "Risk och konsekvens",
      shortUiText:
        "Konsekvenserna för verksamheten om rollens beslut, fel eller brister slår fel.",
      fullDefinition:
        "Fångar de konsekvenser rollens beslut, fel eller brister kan få för säkerhet, kund, kvalitet, efterlevnad, information eller varumärke. Kriteriet mäter konsekvens brett, inte enbart ekonomisk risk eller hur påfrestande individen upplever rollen.",
      measures:
        "Följder av beslut, fel eller brister för säkerhet, kund, kvalitet, efterlevnad, information eller varumärke.",
      notMeasures: "Enbart ekonomisk risk eller individens stressnivå.",
      whenSuitable: "Nästan alltid relevant.",
      whenNotSuitable:
        "Undvik separat compliance-risk om den bara är ett exempel på samma risk och konsekvens.",
      controlQuestion:
        "Har konsekvensen av rollens beslut eller fel betydelse i sig, skilt från det formella efterlevnadsansvar den också kan bära?",
      assessmentQuestion:
        "Vilken nivå av risk och konsekvens bär rollens beslut och arbete normalt och varaktigt?",
      anchor1:
        "Fel eller brister får normalt begränsade och lätt korrigerbara följder inom det egna arbetsområdet.",
      anchor2:
        "Fel eller brister kan påverka teamets kvalitet, effektivitet eller leverans och kräver normalt korrigering inom etablerade processer.",
      anchor3:
        "Fel, beslut eller brister kan få tydliga följder för kund, leverans, kvalitet, ekonomi eller efterlevnad inom ett område.",
      anchor4:
        "Fel, beslut eller brister kan få betydande följder för flera delar av verksamheten, viktiga kunder, kritiska processer eller regelefterlevnad.",
      anchor5:
        "Fel, beslut eller brister kan få mycket stora, långvariga eller verksamhetskritiska följder för strategi, säkerhet, efterlevnad, förtroende eller överlevnadsförmåga.",
    },
    "people-leadership": {
      name: "Personal- och ledningsansvar",
      shortUiText:
        "Rollens formella ansvar för att leda människor och skapa resultat genom dem.",
      fullDefinition:
        "Fångar rollens formella ansvar för att leda människor: fördela arbete, utveckla deras kapacitet och skapa resultat genom andra. Kriteriet mäter formellt personalansvar, inte projektledning utan detta, specialistledarskap eller teamstorlek använd som enda mått.",
      measures:
        "Ansvar för att leda människor, fördela arbete, utveckla kapacitet och skapa resultat genom andra.",
      notMeasures:
        "Projektledning utan personalansvar, specialistledarskap eller teamstorlek som enda mått.",
      whenSuitable:
        "När formellt personalansvar är en materiell skillnad mellan roller.",
      whenNotSuitable:
        "Ska normalt ha låg till måttlig vikt eftersom chefskap ofta redan syns i scope och mandat.",
      controlQuestion:
        "Har rollens formella personalansvar betydelse i sig, utöver vad dess scope och beslutsmandat redan fångar?",
      assessmentQuestion:
        "Vilken nivå av personal- och ledningsansvar bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen har inget eller mycket begränsat formellt personalansvar, till exempel att enstaka gånger samordna en eller två andras uppgifter.",
      anchor3:
        "Rollen har etablerat, självständigt ansvar för att leda ett team: fördela arbete, utveckla kapacitet och skapa resultat genom andra.",
      anchor5:
        "Rollen bär mycket avancerat eller verksamhetskritiskt personal- och ledningsansvar, leder ledare eller en stor organisation, och sätter ofta standarden för hur människor leds utanför det egna teamet.",
    },
    "resource-capacity": {
      name: "Resurs- och kapacitetsansvar",
      shortUiText:
        "Rollens ansvar för att prioritera och använda väsentliga resurser eller kapacitet.",
      fullDefinition:
        "Fångar rollens ansvar för att prioritera och använda väsentliga resurser, kapacitet, tillgångar eller kritisk leveransförmåga så att verksamheten fortsätter fungera. Kriteriet mäter självständig resursstyrning, inte rutinmässig budgetuppföljning eller inköp inom små, förutbestämda ramar.",
      measures:
        "Ansvar för att prioritera och använda resurser så verksamheten fungerar.",
      notMeasures: "Vanlig budgetuppföljning eller inköp inom små ramar.",
      whenSuitable:
        "När rollen självständigt disponerar väsentliga resurser, kapacitet, tillgångar eller kritisk leveransförmåga.",
      whenNotSuitable:
        "Ska inte väljas samtidigt som ett snävt finansiellt ansvar om båda mäter samma resursstyrning.",
      controlQuestion:
        "Har rollens självständiga ansvar för resurser eller kapacitet betydelse i sig, skilt från rutinmässig budgetuppföljning inom förutbestämda ramar?",
      assessmentQuestion:
        "Vilken nivå av resurs- och kapacitetsansvar bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen prioriterar självständigt användningen av en liten, tydligt avgränsad uppsättning resurser eller kapacitet inom sitt eget område, där dess val har begränsad och lätt korrigerbar effekt.",
      anchor3:
        "Rollen prioriterar och fördelar självständigt etablerade resurser eller kapacitet så att det egna området fortsätter fungera.",
      anchor5:
        "Rollen förvaltar självständigt mycket betydande eller verksamhetskritiska resurser, kapacitet eller leveransförmåga, med beslut som formar resursprioriteringar utanför det egna området.",
    },
    "business-customer": {
      name: "Affärs- och kundansvar",
      shortUiText:
        "Rollens ansvar för att skapa, säkra eller utveckla materiellt affärsvärde.",
      fullDefinition:
        "Fångar rollens ansvar för att skapa, säkra eller utveckla materiellt affärsvärde genom en väsentlig kundrelation, intäktsström, affärsportfölj eller kommersiell position. Kriteriet mäter stabiliteten i detta affärsansvar, inte individuell säljprestation, provision eller förhandlingsskicklighet i sig.",
      measures:
        "Ansvar för att skapa, säkra eller utveckla materiellt affärsvärde.",
      notMeasures:
        "Individuell säljprestation, provision eller förhandlingsskicklighet i sig.",
      whenSuitable:
        "När rollen direkt ansvarar för väsentlig kundrelation, intäktsström, affärsportfölj eller kommersiell position.",
      whenNotSuitable:
        "Får inte automatiskt gynna säljroller; ansvaret måste vara en stabil del av rollen.",
      controlQuestion:
        "Har rollens stabila ansvar för affärs- eller kundvärde betydelse i sig, skilt från individuell säljprestation eller förhandlingsskicklighet?",
      assessmentQuestion:
        "Vilken nivå av affärs- och kundansvar bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen stöttar en kundrelation eller affärsaktivitet inom ett tydligt avgränsat, etablerat kundkonto eller en uppgift.",
      anchor3:
        "Rollen har självständigt etablerat ansvar för en kundrelation, intäktsström eller affärsportfölj som är en stabil del av rollen.",
      anchor5:
        "Rollen bär mycket betydande eller verksamhetskritiskt ansvar för stora kundrelationer, intäkter eller kommersiell position, med beslut som formar verksamhetens riktning utanför den egna portföljen.",
    },
    "compliance-control": {
      name: "Informations-, säkerhets- eller regelefterlevnadsansvar",
      shortUiText:
        "Rollens formella ansvar för skydd, kvalitetssäkring eller efterlevnadskontroll.",
      fullDefinition:
        "Fångar rollens formella ansvar för skydd, kvalitetssäkring, kontroll eller korrekt tillämpning av kritiska krav, till exempel informationssäkerhet eller regelefterlevnad. Kriteriet mäter ett separat, formellt kontrollansvar, inte den allmänna riskmedvetenhet varje roll förväntas ha.",
      measures:
        "Ansvar för skydd, kvalitetssäkring, kontroll eller korrekt tillämpning av kritiska krav.",
      notMeasures: "Allmän riskmedvetenhet.",
      whenSuitable:
        "Reglerade, säkerhetskritiska eller datatunga verksamheter med ett separat formellt kontrollansvar.",
      whenNotSuitable:
        "Välj bara om ansvaret är separat från Risk och konsekvens.",
      controlQuestion:
        "Har rollens formella kontrollansvar betydelse i sig, skilt från den allmänna risk och konsekvens den också bär?",
      assessmentQuestion:
        "Vilken nivå av informations-, säkerhets- eller regelefterlevnadsansvar bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen följer etablerade kontrollrutiner inom ett tydligt avgränsat område, utan självständigt kontrollansvar.",
      anchor3:
        "Rollen har självständigt etablerat, formellt ansvar för skydd, kvalitetssäkring eller efterlevnadskontroll inom sitt eget område.",
      anchor5:
        "Rollen bär mycket avancerat eller verksamhetskritiskt kontrollansvar, och hur den tillämpar kritiska krav sätter ofta standarden för efterlevnad utanför det egna området.",
    },
    "safety-exposure": {
      name: "Säkerhets- och exponeringsförhållanden",
      shortUiText:
        "Rollens varaktiga krav på att arbeta i en riskmiljö under skyddsåtgärder.",
      fullDefinition:
        "Fångar den varaktiga riskmiljö rollen arbetar i och kravet på att arbeta under skyddsåtgärder, vilket omfattar faktisk fysisk, kemisk, biologisk eller miljömässig exponering. Kriteriet mäter själva arbetsförhållandet, inte konsekvensen för verksamheten om något går fel.",
      measures: "Varaktig riskmiljö och krav på arbete under skyddsåtgärder.",
      notMeasures: "Konsekvens för bolaget av ett fel.",
      whenSuitable:
        "Roller med faktisk fysisk, kemisk, biologisk, miljömässig eller annan exponering.",
      whenNotSuitable:
        "Välj inte samtidigt med ett bredare arbetsförhållandekriterium som täcker samma exponering.",
      controlQuestion:
        "Har rollens exponering för en varaktig riskmiljö betydelse i sig, utöver vad kriteriet fysisk eller sensorisk ansträngning redan fångar?",
      assessmentQuestion:
        "Vilken nivå av säkerhet och exponering arbetar rollen normalt och varaktigt under?",
      anchor1:
        "Rollen utsätts enstaka gånger för ett tydligt avgränsat säkerhets- eller exponeringsförhållande på låg nivå, med standardiserade skyddsåtgärder.",
      anchor3:
        "Rollen arbetar under en etablerad, återkommande riskmiljö som kräver konsekvent användning av skyddsåtgärder som en normal del av arbetet.",
      anchor5:
        "Rollen arbetar under mycket krävande eller verksamhetskritiska exponeringsförhållanden, där den skyddsstandard den följer eller sätter ofta sträcker sig utanför det egna närmaste teamet.",
    },
    "on-call": {
      name: "Jour, beredskap och tillgänglighetskrav",
      shortUiText:
        "Rollens återkommande krav på att vara tillgänglig utanför ordinarie arbetstid eller att svara omedelbart.",
      fullDefinition:
        "Fångar rollens återkommande krav på att vara tillgänglig utanför ordinarie arbetstid, eller att svara omedelbart, som en integrerad rollförutsättning. Kriteriet mäter ett materiellt, återkommande beredskapskrav, inte tillfällig övertid, frivillig flexibilitet eller en generellt hög arbetsmängd.",
      measures:
        "Återkommande krav på tillgänglighet utanför ordinarie arbetstid eller omedelbar insats.",
      notMeasures:
        "Tillfällig övertid, frivillig flexibilitet eller hög arbetsmängd.",
      whenSuitable:
        "Drift, IT, vård, säkerhet och andra roller där beredskap är en integrerad rollförutsättning.",
      whenNotSuitable:
        "Ska vara ett eget kriterium endast när beredskap är materiell och återkommande.",
      controlQuestion:
        "Har rollens återkommande beredskapskrav betydelse i sig, utöver tillfällig övertid eller en generellt hög arbetsmängd?",
      assessmentQuestion:
        "Vilken nivå av jour, beredskap och tillgänglighet bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen täcker enstaka gånger ett tydligt avgränsat beredskapskrav med låg frekvens.",
      anchor3:
        "Rollen bär ett etablerat, återkommande beredskaps- eller tillgänglighetskrav utanför ordinarie arbetstid som en normal del av rollen.",
      anchor5:
        "Rollen bär ett mycket krävande eller verksamhetskritiskt beredskapskrav, med frekvent eller omedelbar insatsskyldighet som andra rollers tillgänglighet ofta byggs runt.",
    },
    "irregularity-mobility": {
      name: "Oregelbundenhet, mobilitet och platsbundenhet",
      shortUiText:
        "Rollens varaktiga krav på oregelbundna tider, omfattande resor eller arbete på särskilda platser.",
      fullDefinition:
        "Fångar rollens varaktiga krav på oregelbundna arbetstider, omfattande resor eller arbete knutet till särskilda platser, till exempel fält-, skift- eller internationellt arbete. Kriteriet mäter ett stabilt, strukturellt förhållande i rollen, inte enstaka resor, personliga önskemål eller ett tillfälligt projekt.",
      measures:
        "Varaktiga krav på oregelbundna tider, omfattande resor eller arbete på särskilda platser.",
      notMeasures:
        "Enstaka resor, personliga önskemål eller tillfälliga projekt.",
      whenSuitable:
        "Fältroller, internationell verksamhet, skiftverksamhet eller hög resfrekvens.",
      whenNotSuitable:
        "Kan slås ihop med Jour/beredskap endast när båda ingår i samma stabila arbetsvillkor.",
      controlQuestion:
        "Har rollens varaktiga krav på oregelbundenhet eller mobilitet betydelse i sig, utöver enstaka resor eller ett tillfälligt projekt?",
      assessmentQuestion:
        "Vilken nivå av oregelbundenhet, mobilitet eller platsbundenhet bär rollen normalt och varaktigt?",
      anchor1:
        "Rollen bär ett återkommande men begränsat krav på oregelbundna tider, resor eller platsbundet arbete, till exempel ett regelbundet men sällan förekommande mönster som är en varaktig del av rollen.",
      anchor3:
        "Rollen bär ett etablerat, återkommande mönster av oregelbundna tider, resor eller platsbundet arbete som en normal och stabil del av rollen.",
      anchor5:
        "Rollen bär mycket omfattande eller verksamhetskritisk oregelbundenhet, mobilitet eller platsbundenhet, till exempel varaktiga internationella åtaganden, skiftåtaganden eller fältåtaganden som formar hur rollen kan bemannas.",
    },
    "restricted-environments": {
      name: "Särskilda säkerhets-, sekretess- eller kontrollmiljöer",
      shortUiText:
        "Rollens krav på att arbeta under särskilda åtkomst-, kontroll- eller säkerhetsrestriktioner.",
      fullDefinition:
        "Fångar arbetsförhållandet att verka under särskilda åtkomst-, kontroll- eller säkerhetsrestriktioner, till exempel en säkerhetsklassad eller sekretesskänslig miljö. Kriteriet mäter restriktionen rollen arbetar under, inte ansvaret för informationssäkerhet i sig.",
      measures:
        "Arbetsförhållandet att arbeta under särskilda åtkomst-, kontroll- eller säkerhetsrestriktioner.",
      notMeasures: "Ansvar för informationssäkerhet.",
      whenSuitable:
        "Säkerhetsklassade, sekretesskänsliga eller strikt kontrollerade miljöer med faktiska begränsningar.",
      whenNotSuitable:
        "Använd endast när det är arbetsmiljön/förutsättningen, inte kontrollansvaret, som mäts.",
      controlQuestion:
        "Har rollens krav på att arbeta under särskilda åtkomst- eller säkerhetsrestriktioner betydelse i sig, skilt från det formella kontrollansvar den också kan bära?",
      assessmentQuestion:
        "Vilken nivå av säkerhets-, sekretess- eller kontrollrestriktion arbetar rollen normalt och varaktigt under?",
      anchor1:
        "Rollen arbetar enstaka gånger under en tydligt avgränsad åtkomst- eller sekretessrestriktion på låg nivå.",
      anchor3:
        "Rollen arbetar under en etablerad, återkommande uppsättning åtkomst-, kontroll- eller säkerhetsrestriktioner som en normal del av rollen.",
      anchor5:
        "Rollen arbetar under mycket strikta eller verksamhetskritiska säkerhets-, sekretess- eller kontrollrestriktioner som formar hur rollen och dess omgivning måste drivas.",
    },
  },
}
