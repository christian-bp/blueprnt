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
  modelName: "Rollvärderingsmodell",
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
        "Finns särskilda objektiva och varaktiga arbetsförhållanden som påverkar kraven?",
      why: "Synliggör exempelvis beredskap, exponering, säkerhetskrav och oregelbundna förhållanden.",
    },
  },
  workingConditionsTest: {
    question:
      "Finns minst en rollfamilj där särskilda arbetsförhållanden är en återkommande, objektiv och väsentlig del av rollens krav, och där kravet inte redan fångas korrekt av ett annat kriterium?",
    notMaterialLabel: "Prövad, men inte väsentligt relevant",
  },
  sharedScale: {
    "1": {
      name: "Avgränsat krav",
      meaning:
        "Kravet är tydligt definierat, lokalt eller begränsat i omfattning. Etablerade ramar och arbetssätt räcker normalt.",
    },
    "2": {
      name: "Grundläggande till måttligt krav",
      meaning:
        "Kravet återkommer inom ett tydligt avgränsat område. Variationer och enklare avvikelser behöver hanteras.",
    },
    "3": {
      name: "Självständigt och etablerat krav",
      meaning:
        "Kravet är en tydlig och återkommande del av området. Professionella bedömningar görs inom etablerade ramar.",
    },
    "4": {
      name: "Avancerat eller brett krav",
      meaning:
        "Kravet är avancerat, har bredare räckvidd eller kräver självständiga avvägningar där etablerade arbetssätt inte alltid räcker.",
    },
    "5": {
      name: "Mycket avancerat, omfattande eller verksamhetskritiskt krav",
      meaning:
        "Kravet har mycket stor omfattning, svårighetsgrad, konsekvens eller strategisk betydelse. Det kan påverka riktning, standarder, lösningar eller resultat även utanför det närmaste området.",
    },
  },
  midpoints: {
    step2: "Ett genomtänkt mellanläge mellan steg 1 och 3.",
    step4: "Ett genomtänkt mellanläge mellan steg 3 och 5.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Kunskapsdjup och specialistnivå",
      shortUiText: "Djup specialistkunskap inom ett avgränsat fackområde.",
      fullDefinition:
        "Omfattar djup fackkunskap, specialistmetoder och relevant erfarenhet inom ett huvudsakligt område. Kriteriet avser hur avancerad kunskapen behöver vara för att hantera svåra frågor inom området. Det avser inte kunskapsbredd, formella behörigheter, verksamhetskontext eller rådgivning som eget område.",
      measures:
        "Djup fackkunskap, specialistmetoder, relevant och varaktig erfarenhet inom ett område.",
      notMeasures:
        "Antalet kunskapsområden, formell examen eller certifiering i sig, kunskap om en specifik bransch eller organisation i sig, beslutsmandat eller individuell prestation.",
      whenSuitable:
        "Välj när djup specialistkunskap inom ett fackområde ska få särskild betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för utbildningskrav, bred samverkan mellan flera fackområden eller rådgivning. Bedöm i stället om något av de närliggande kriterierna bättre fångar det företaget vill prioritera.",
      controlQuestion:
        "Är djup specialistkunskap ett område ni vill lägga särskild vikt vid i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av specialistkunskapsdjup kräver rollen normalt och varaktigt?",
      anchor1:
        "Etablerad och väldokumenterad fackkunskap inom ett tydligt avgränsat område. Kända metoder räcker för välbekanta frågor.",
      anchor3:
        "Fördjupad specialistkunskap och etablerad fackmetodik används självständigt för återkommande och mer krävande frågor inom området.",
      anchor5:
        "Mycket djup specialistkunskap används för fältets svåraste frågor. Kunskapen bidrar till att utveckla metoder, kvalitetsnivåer eller professionell praxis.",
    },
    "knowledge-breadth": {
      name: "Kunskapsbredd och tvärdisciplinär förståelse",
      shortUiText:
        "Förmåga att koppla ihop flera kunskapsområden och förstå deras samband.",
      fullDefinition:
        "Omfattar behovet av att kombinera kunskap från flera olika områden, till exempel affär, teknik, data, produkt och verksamhet. Kriteriet avser förståelse för samband och avvägningar mellan områdena. Det avser inte djupet i ett enskilt fackområde eller antalet kontakter och samarbetspartner.",
      measures:
        "Bredd av kunskapsområden, förståelse för samband mellan områden, förmåga att göra avvägningar mellan olika perspektiv.",
      notMeasures:
        "Djup specialistkunskap inom ett område, antal möten, intressenter eller kontaktytor, organisatorisk räckvidd.",
      whenSuitable:
        "Välj när helhetssyn och förmåga att förena flera kunskapsområden ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för många kontaktytor. Om det främst handlar om djup fackkunskap inom ett område är 7.1 mer träffsäkert.",
      controlQuestion:
        "Är förmågan att förena flera kunskapsområden central för hur verksamheten skapar värde?",
      assessmentQuestion:
        "Vilken nivå av tvärdisciplinär bredd kräver rollen normalt och varaktigt?",
      anchor1:
        "Ett huvudsakligt kunskapsområde används. Kopplingar till andra områden behövs sällan.",
      anchor3:
        "Ett fåtal etablerade kunskapsområden kombineras självständigt, med förståelse för hur de påverkar varandra.",
      anchor5:
        "Många skilda kunskapsområden kopplas ihop på ett sätt som påverkar hur större lösningar, erbjudanden eller arbetssätt utformas.",
    },
    "formal-qualifications": {
      name: "Formella kvalifikations-, behörighets- och certifieringskrav",
      shortUiText: "Obligatorisk legitimation, behörighet eller certifiering.",
      fullDefinition:
        "Omfattar formella krav som måste vara uppfyllda för att få utföra, godkänna, signera eller ansvara för en viss typ av verksamhet. Exempel är legitimation, lagstadgad behörighet och obligatorisk certifiering. Kriteriet avser obligatoriska krav, inte utbildningar, kurser eller examen som är meriterande men inte nödvändiga.",
      measures:
        "Obligatorisk legitimation, lagstadgad eller verksamhetsstyrd behörighet, obligatorisk certifiering.",
      notMeasures:
        "Allmän utbildningsnivå, frivilliga kurser, prestigefylld examen utan krav på behörighet.",
      whenSuitable:
        "Välj när obligatoriska legitimationer, behörigheter eller certifieringar ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte när utbildning främst är en väg till kunskap som redan fångas av 7.1 Kunskapsdjup och specialistnivå.",
      controlQuestion:
        "Ska obligatoriska legitimationer, behörigheter eller certifieringar få genomslag i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av formell kvalifikation, legitimation eller certifiering kräver rollen normalt och varaktigt?",
      anchor1:
        "Inget obligatoriskt krav, eller ett grundläggande och tydligt avgränsat krav med begränsad förnyelse eller omfattning.",
      anchor3:
        "Etablerad yrkeslegitimation eller certifiering som är ett återkommande och självständigt villkor för att få utöva ett område.",
      anchor5:
        "Avancerad eller verksamhetskritisk behörighet som krävs för att godkänna, signera eller ansvara för verksamhet med mycket stora konsekvenser.",
    },
    "domain-knowledge": {
      name: "Domän- och verksamhetskunskap",
      shortUiText:
        "Djup kunskap om bransch, produkt, kundmiljö eller verksamhetskontext.",
      fullDefinition:
        "Omfattar kunskap om det sammanhang där verksamheten bedrivs, till exempel bransch, produkt, kundmiljö, affärsmodell eller regelverk. Kriteriet avser kontextspecifik kunskap som inte snabbt ersätts av allmän yrkeskunskap. Det avser inte normal organisationskännedom som byggs upp genom introduktion och erfarenhet över tid.",
      measures:
        "Branschkunskap, produkt- och kundkunskap, kunskap om affärsmodell eller regelverkskontext.",
      notMeasures:
        "Allmän yrkesskicklighet, vanlig organisationskännedom, formell behörighet.",
      whenSuitable:
        "Välj när specifik kunskap om verksamhetens sammanhang ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte när generell yrkeskunskap och normal introduktion räcker för att förstå verksamhetens sammanhang.",
      controlQuestion:
        "Vill ni väga in hur mycket verksamhets- och branschkunskap som behövs inom olika områden?",
      assessmentQuestion:
        "Vilken nivå av domän- och verksamhetskunskap kräver rollen normalt och varaktigt?",
      anchor1:
        "Kunskap om en tydligt avgränsad produkt-, process- eller kundkontext.",
      anchor3:
        "Etablerad och självständig kunskap om verksamhetens sammanhang som inte snabbt ersätts av allmän yrkeskunskap.",
      anchor5:
        "Mycket djup och svårersättlig kunskap om bransch, marknad, kunder eller regelverk som påverkar viktiga vägval och arbetssätt.",
    },
    "advisory-judgment": {
      name: "Rådgivnings- och omdömeskompetens",
      shortUiText:
        "Kvalificerad rådgivning och professionellt omdöme som underlag för andras beslut.",
      fullDefinition:
        "Omfattar kvalificerad rådgivning som en återkommande del av verksamhetens erbjudande eller som avgörande beslutsstöd till kunder, partners eller interna beslutsfattare. Det innefattar att väga fakta, bedöma osäkra eller motstridiga underlag och formulera råd eller rekommendationer som andra använder i sina vägval. Kriteriet avser kvaliteten i rådgivning och omdöme. Det avser inte formell rätt att fatta det slutliga beslutet.",
      measures:
        "Kvalificerad bedömning av underlag, rådgivning och rekommendationer, professionellt omdöme i frågor med avvägningar.",
      notMeasures:
        "Formellt beslutsmandat, att dela generell information, specialistkunskap i sig.",
      whenSuitable:
        "Välj när kvalificerad rådgivning och professionellt omdöme ska få särskild betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för kunskapsdelning eller rutinmässiga svar. Rådgivningen ska ha tydlig betydelse för vägval eller beslut.",
      controlQuestion:
        "Är kvalificerad rådgivning och professionellt omdöme något ni vill ge tyngd i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av rådgivnings- och omdömeskompetens kräver rollen normalt och varaktigt?",
      anchor1:
        "Underlag eller okomplicerade råd inom ett tydligt avgränsat område, med stöd av etablerad vägledning.",
      anchor3:
        "Självständiga och etablerade professionella råd inom ett område, baserade på avvägning av relevant information.",
      anchor5:
        "Råd och bedömningar i mycket avancerade eller känsliga frågor som har stor betydelse för verksamhetens vägval eller hantering av risker.",
    },
    "complexity-ambiguity": {
      name: "Komplexitet och otydlighet",
      shortUiText:
        "Svårighetsgrad, osäkerhet och otydlighet i de frågor som behöver hanteras.",
      fullDefinition:
        "Omfattar graden av osäkerhet, motstridiga krav, oklara mål och avsaknad av färdiga lösningar. Kriteriet avser själva problemens karaktär. Det avser inte mängden analys som läggs på att hantera problemen, arbetstempo eller organisatorisk räckvidd.",
      measures:
        "Otydliga ramar och mål, motstridiga krav och avvägningar, osäkerhet och komplexa beroenden.",
      notMeasures:
        "Omfattningen av analysarbete, hög arbetsmängd eller tempo, specialistkunskap i sig.",
      whenSuitable:
        "Välj när hantering av svåra, oklara eller mångfacetterade frågor ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för omfattande analys eller många samtidiga uppgifter. Dessa fångas av 8.2 respektive 8.4 om de väljs.",
      controlQuestion:
        "Vill ni ta hänsyn till graden av otydlighet och svårighetsgrad i de frågor verksamheten behöver hantera?",
      assessmentQuestion:
        "Vilken nivå av komplexitet och otydlighet hanterar rollen normalt och varaktigt?",
      anchor1:
        "Tydligt definierade frågor, etablerade metoder och förutsägbara situationer.",
      anchor2:
        "Rollen hanterar återkommande variationer och enklare avvikelser där den väljer mellan kända alternativ.",
      anchor3:
        "Komplexa frågor inom etablerade ramar, där analys, prioritering och anpassning behövs.",
      anchor4:
        "Rollen hanterar avancerade, tvärfunktionella eller delvis otydliga problem där etablerade lösningar inte alltid räcker.",
      anchor5:
        "Mycket komplexa eller strategiskt betydelsefulla frågor med hög osäkerhet, där nya angreppssätt eller långsiktiga lösningar behöver utformas.",
    },
    "analytical-effort": {
      name: "Analytisk och problemlösande ansträngning",
      shortUiText:
        "Omfattning av systematisk analys, felsökning och problemlösning.",
      fullDefinition:
        "Omfattar systematisk analys, felsökning, modellering, diagnostik, testning och beräkning som behövs för att komma fram till lösningar. Kriteriet avser den analytiska insatsen. Det avser inte enbart att problemet är oklart eller vilken specialistkunskap som ligger bakom analysen.",
      measures:
        "Systematisk analys, felsökning och diagnostik, modellering, testning och beräkning.",
      notMeasures:
        "Otydlighet i problemet i sig, specialistkunskap i sig, tillfällig hög arbetsmängd.",
      whenSuitable:
        "Välj när systematiskt analys- och problemlösningsarbete ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för oklara frågor. Det ska finnas ett återkommande och tydligt analys-, felsöknings- eller diagnostikinslag.",
      controlQuestion:
        "Ska omfattningen av systematiskt analys- och problemlösningsarbete få betydelse i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av analytisk och problemlösande ansträngning bär rollen normalt och varaktigt?",
      anchor1:
        "Okomplicerad analys eller felsökning i en tydligt avgränsad fråga, enligt etablerade steg.",
      anchor3:
        "Självständig och etablerad analys, diagnostik eller systematisk problemlösning inom ett område.",
      anchor5:
        "Mycket avancerad eller omfattande analys, modellering eller diagnostik med stor betydelse för verksamhetens förmåga att lösa kritiska eller återkommande problem.",
    },
    "communication-effort": {
      name: "Kommunikations- och relationskrävande arbete",
      shortUiText:
        "Krav på kvalificerad kommunikation, förhandling och hantering av motstridiga intressen.",
      fullDefinition:
        "Omfattar svårighetsgraden i kommunikation, förhandling, påverkan, konflikthantering och översättning mellan olika behov och intressen. Kriteriet avser den kommunikativa och relationella ansträngningen. Det avser inte antalet kontakter, organisatorisk räckvidd eller affärsansvar.",
      measures:
        "Förhandling och påverkan, hantering av svåra samtal och konflikter, översättning mellan olika behov och intressen.",
      notMeasures:
        "Antal kontakter eller möten, kundansvar eller intäktsansvar, organisatorisk räckvidd.",
      whenSuitable:
        "Välj när kvalificerad kommunikation, förhandling och hantering av motstridiga intressen ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för många möten eller kundkontakter. Kommunikationens svårighetsgrad ska vara det som prioriteras.",
      controlQuestion:
        "Ska kvalificerad kommunikation, förhandling och hantering av motstridiga intressen få betydelse i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av kommunikations- och relationsansträngning bär rollen normalt och varaktigt?",
      anchor1:
        "Tydligt avgränsad och till största delen rutinmässig kommunikation med etablerade motparter.",
      anchor3:
        "Självständig och återkommande kommunikation, förhandling eller konflikthantering inom etablerade ramar.",
      anchor5:
        "Mycket avancerad eller känslig kommunikation, förhandling eller konflikthantering där utfallet har stor betydelse för verksamhetens relationer eller vägval.",
    },
    "operational-intensity": {
      name: "Operativ intensitet och simultankrav",
      shortUiText:
        "Krav på att hantera flera samtidiga flöden och prioritera löpande.",
      fullDefinition:
        "Omfattar krav på uppmärksamhet, simultanförmåga och löpande prioritering mellan flera flöden i normalläget. Exempel kan vara kundärenden, larm, leveranser eller driftsflöden. Kriteriet avser ett stabilt och strukturellt krav, inte tillfälliga toppar, resursbrist eller bristande planering.",
      measures:
        "Flera samtidiga flöden, löpande prioritering, uppmärksamhet under tidspress i normalläget.",
      notMeasures:
        "Tillfällig hög arbetsbelastning, underbemanning, komplexitet i sakfrågan.",
      whenSuitable:
        "Välj när hantering och prioritering av flera samtidiga flöden ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte för att kompensera för tillfälliga arbetstoppar eller resursbrist. Kravet ska vara en varaktig del av verksamhetens arbetssätt.",
      controlQuestion:
        "Vill ni väga in krav på att hantera flera samtidiga flöden och prioritera löpande?",
      assessmentQuestion:
        "Vilken nivå av operativ intensitet och simultankrav bär rollen normalt och varaktigt?",
      anchor1:
        "Ett flöde eller en uppgift i taget inom en tydligt avgränsad rytm.",
      anchor3:
        "Flera etablerade och samtidiga flöden hanteras självständigt med löpande prioritering.",
      anchor5:
        "Mycket hög operativ intensitet över många samtidiga flöden, där fel prioritering snabbt kan få stora följder för verksamheten.",
    },
    "physical-sensory": {
      name: "Fysisk eller sensorisk ansträngning",
      shortUiText:
        "Återkommande fysisk belastning, precision eller krav på uthållig sinneskoncentration.",
      fullDefinition:
        "Omfattar fysisk belastning, ergonomiskt krävande moment, precision och koncentration med syn, hörsel eller andra sinnen. Kriteriet avser krav på kropp och uppmärksamhet. Det avser inte riskmiljöer, exponering för farliga ämnen eller konsekvenser för verksamheten om något går fel.",
      measures:
        "Fysisk och ergonomisk belastning, precisionskrav, uthållig koncentration med sinnena.",
      notMeasures:
        "Riskmiljö eller exponering, allmän stress, konsekvenser av fel.",
      whenSuitable:
        "Välj när fysisk belastning, precision eller sensorisk koncentration ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för risk i arbetsmiljön. Om exponering och skyddsåtgärder är det centrala passar 10.1 bättre.",
      controlQuestion:
        "Ska återkommande fysisk belastning, precision eller uthållig koncentration få betydelse i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av fysisk eller sensorisk ansträngning bär rollen normalt och varaktigt?",
      anchor1:
        "Lätta och tillfälliga fysiska eller sensoriska krav inom en tydligt avgränsad uppgift.",
      anchor3:
        "Återkommande fysisk belastning, precisionsmoment eller sensorisk koncentration som en etablerad del av området.",
      anchor5:
        "Mycket krävande och uthållig fysisk eller sensorisk ansträngning där precision och konsekvent utförande är avgörande.",
    },
    "scope-impact": {
      name: "Scope och påverkan",
      shortUiText: "Räckvidden för resultat och påverkan i verksamheten.",
      fullDefinition:
        "Omfattar hur långt resultat, val och leveranser får genomslag i verksamheten: från ett tydligt avgränsat område till team, funktioner, flera delar av företaget eller hela företaget. Kriteriet avser var effekten märks. Det avser inte formell beslutsrätt, personalansvar eller budgetstorlek i sig.",
      measures:
        "Räckvidd för resultat och påverkan, omfattning av berörda delar av verksamheten, varaktiga följder för verksamhetens leverans eller riktning.",
      notMeasures:
        "Formellt personalansvar, beslutsmandat, resurs- eller budgetansvar i sig.",
      whenSuitable:
        "Välj när räckvidden för resultat och påverkan ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för titel, chefsnivå, budgetstorlek eller beslutsrätt. Bedöm om något av de separata ansvarskriterierna bättre fångar det som ska prioriteras.",
      controlQuestion:
        "Är det relevant för er att väga in hur långt resultat och påverkan når i verksamheten?",
      assessmentQuestion:
        "Hur långt sträcker sig rollens normala och varaktiga påverkan?",
      anchor1:
        "Resultat och påverkan är främst begränsade till ett tydligt avgränsat område eller en enskild leverans.",
      anchor2:
        "Rollen påverkar ett avgränsat arbetsområde eller återkommande leverans inom ett team.",
      anchor3:
        "Resultat och påverkan når ett tydligt område och påverkar leveranser eller prioriteringar i närliggande delar av verksamheten.",
      anchor4:
        "Rollen påverkar flera team, en funktion eller en väsentlig del av verksamheten genom val, prioriteringar eller lösningar med varaktiga följder.",
      anchor5:
        "Resultat och påverkan når flera delar av företaget eller företagsnivå och har betydelse för övergripande riktning, resultat eller förmåga att lyckas.",
    },
    "autonomy-mandate": {
      name: "Autonomi och beslutsmandat",
      shortUiText:
        "Självständighet och mandat att göra avvägningar och fatta beslut.",
      fullDefinition:
        "Omfattar mandatet att självständigt göra avvägningar och fatta beslut inom ett definierat område. Kriteriet avser vilket utrymme som finns att välja riktning, prioritera mellan alternativ och besluta om lämpliga lösningar inom området. Det avser inte hur långt beslutets effekt når, hur stora följder ett fel kan få eller vilken typ av ansvar beslutet gäller.",
      measures:
        "Mandat att fatta självständiga beslut, utrymme att välja mellan relevanta alternativ, mandat att prioritera och göra avvägningar, grad av självständighet inom ett definierat område.",
      notMeasures:
        "Räckvidden för resultat eller påverkan, konsekvensen av felaktiga beslut, personal-, resurs- eller kundansvar i sig, företagets interna godkännandeprocesser eller former för samråd.",
      whenSuitable:
        "Välj när självständigt beslutsmandat ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte för att beskriva hur långt beslutets effekt når, vilka följder ett fel kan få eller vilken typ av ansvar beslutet gäller. Det fångas av andra ansvarskriterier om de väljs.",
      controlQuestion:
        "Ska graden av självständigt beslutsmandat få betydelse i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av autonomi och beslutsmandat har rollen normalt och varaktigt?",
      anchor1:
        "Begränsat mandat att välja mellan tydligt angivna alternativ inom etablerade instruktioner.",
      anchor3:
        "Självständigt mandat att göra etablerade avvägningar, prioritera mellan alternativ och fatta beslut inom ett definierat område.",
      anchor5:
        "Mycket brett mandat att göra avvägningar och fatta beslut som sätter riktning, principer eller prioriteringar för flera delar av verksamheten.",
    },
    "risk-consequence": {
      name: "Risk och konsekvens",
      shortUiText:
        "Allvaret i möjliga följder av fel, brister eller felaktiga beslut.",
      fullDefinition:
        "Omfattar vilka följder fel, brister eller felaktiga beslut kan få för exempelvis kunder, kvalitet, ekonomi, säkerhet, information, efterlevnad och förtroende. Kriteriet avser följden om något går fel. Det avser inte vem som har det formella ansvaret för att kontrollera att regler eller skydd fungerar.",
      measures:
        "Konsekvenser för kund, kvalitet och leverans, konsekvenser för säkerhet, information och efterlevnad, ekonomiska och varumärkesmässiga följder.",
      notMeasures:
        "Individens upplevda stress, budgetstorlek i sig, formellt kontrollansvar.",
      whenSuitable:
        "Välj när skillnader i möjliga följder av fel och brister ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte för att beskriva hur pressat eller krävande något upplevs. Bedöm den sakliga och möjliga följden om något blir fel.",
      controlQuestion:
        "Är skillnader i de följder fel eller brister kan få relevanta att väga in i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av risk och konsekvens bär rollens beslut och arbete normalt och varaktigt?",
      anchor1:
        "Fel eller brister har normalt begränsade och lätt korrigerbara följder inom ett avgränsat område.",
      anchor2:
        "Fel eller brister kan påverka teamets kvalitet, effektivitet eller leverans och kräver normalt korrigering inom etablerade processer.",
      anchor3:
        "Fel, brister eller felaktiga beslut kan få tydliga följder för kund, leverans, kvalitet, ekonomi eller efterlevnad inom ett område.",
      anchor4:
        "Fel, beslut eller brister kan få betydande följder för flera delar av verksamheten, viktiga kunder, kritiska processer eller regelefterlevnad.",
      anchor5:
        "Fel eller brister kan få mycket stora, långvariga eller verksamhetskritiska följder för säkerhet, efterlevnad, förtroende, ekonomi eller verksamhetens fortsatta förmåga att fungera.",
    },
    "people-leadership": {
      name: "Lednings- och personalansvar",
      shortUiText:
        "Ansvar för att leda människor, samordna verksamhet och skapa resultat genom andra.",
      fullDefinition:
        "Omfattar ansvar för att leda och samordna människor eller delar av verksamheten för att skapa resultat genom andra. Det kan innefatta ansvar för prioriteringar, arbetsfördelning, riktning, utveckling av arbetssätt eller samordning av leverans. Formellt personalansvar ingår när ansvaret även omfattar medarbetares mål, utveckling, prestation och arbetsmiljö. Kriteriet avser ledningsansvar genom andra – inte enbart specialistinflytande, projektkoordinering eller ett stort eget beslutsmandat.",
      measures:
        "Ansvar för att leda och samordna arbete genom andra, ansvar för riktning, prioriteringar och leverans i en verksamhetsdel, ansvar för att utveckla arbetssätt eller kapacitet genom andra, formellt ansvar för medarbetares mål, utveckling och prestation.",
      notMeasures:
        "Specialistinflytande utan ansvar för andras arbete eller verksamhet, tillfällig samordning av enstaka uppgifter, projektledning utan varaktigt ansvar för människor eller en verksamhetsdel, eget beslutsmandat utan ansvar för att skapa resultat genom andra.",
      whenSuitable:
        "Välj när ansvar för att leda människor eller delar av verksamheten genom andra ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för att samordning, specialiststöd eller projektledning förekommer. Det ska finnas ett varaktigt ansvar för riktning, prioriteringar, leverans eller utveckling genom andra.",
      controlQuestion:
        "Ska ansvar för att leda människor eller verksamhetsdelar genom andra få betydelse i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av personal- och ledningsansvar bär rollen normalt och varaktigt?",
      anchor1:
        "Begränsat ansvar för att samordna andras arbete inom ett tydligt avgränsat område. Inget varaktigt ansvar för riktning, leverans eller medarbetares utveckling.",
      anchor3:
        "Varaktigt ansvar för att leda och samordna ett team, ett arbetsflöde eller en verksamhetsdel genom andra. Ansvar omfattar prioriteringar, arbetsfördelning och leverans. Formellt personalansvar kan förekomma, men är inte ett krav på denna nivå.",
      anchor5:
        "Omfattande ansvar för att leda en större verksamhetsdel eller flera team genom andra. Ansvar omfattar riktning, kapacitet, resultat och utveckling över tid. Formellt personalansvar för andra chefer eller en större organisation ingår normalt på denna nivå.",
    },
    "resource-capacity": {
      name: "Resurs- och kapacitetsansvar",
      shortUiText:
        "Ansvar för att prioritera begränsade resurser mellan verksamhetens behov.",
      fullDefinition:
        "Omfattar ansvar för att göra avvägningar mellan konkurrerande behov när resurserna är begränsade. Resurser kan exempelvis vara tid, budget, utrustning, lager, bemanning eller leveranskapacitet. Kriteriet avser vilka prioriteringar som behövs för att resurser och kapacitet ska användas där de gör mest nytta för verksamheten. Kriteriet avser inte ledning, utveckling eller samordning av människor som sådana. Det avser inte heller rutinmässig budgetuppföljning, inköp eller fördelning inom små och förutbestämda ramar.",
      measures:
        "Prioritering mellan konkurrerande behov, fördelning av begränsade resurser och kapacitet, avvägning mellan tillgängliga resurser, behov och leveransförmåga.",
      notMeasures:
        "Ledning eller utveckling av människor, rutinmässig budgetuppföljning, inköp inom små fasta ramar, affärsresultat i sig.",
      whenSuitable:
        "Välj när ansvar för att prioritera begränsade resurser mellan verksamhetens behov ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för budgetuppföljning, inköp eller samordning av människor. Det ska finnas ett varaktigt ansvar för avvägningar mellan konkurrerande behov och begränsade resurser.",
      controlQuestion:
        "Vill ni lägga vikt vid ansvar för att prioritera begränsade resurser mellan olika behov i verksamheten?",
      assessmentQuestion:
        "Vilken nivå av resurs- och kapacitetsansvar bär rollen normalt och varaktigt?",
      anchor1:
        "Prioritering inom en liten och tydligt avgränsad uppsättning resurser, där effekten av valen är begränsad och lätt att korrigera.",
      anchor3:
        "Självständig prioritering mellan etablerade behov och begränsade resurser eller kapacitet inom ett område.",
      anchor5:
        "Prioritering mellan mycket betydande eller verksamhetskritiska behov och resurser, där avvägningarna påverkar flera delar av verksamhetens förmåga att leverera.",
    },
    "business-customer": {
      name: "Affärs- och kundansvar",
      shortUiText: "Ansvar för viktiga kunder, intäkter eller affärsresultat.",
      fullDefinition:
        "Omfattar ett varaktigt ansvar för att skapa, säkra eller utveckla affärsvärde genom exempelvis kundrelationer, intäktsströmmar, avtal, affärsportföljer eller marknadsposition. Kriteriet avser ansvar som ingår i verksamheten. Det avser inte enskilda försäljningsresultat, provision eller skicklighet i en isolerad förhandling.",
      measures:
        "Ansvar för kundrelationer, ansvar för intäkter eller affärsportfölj, ansvar för affärsresultat eller marknadsposition.",
      notMeasures:
        "Kundkontakt i sig, individuell försäljningsprestation, förhandlingsskicklighet i sig.",
      whenSuitable:
        "Välj när ansvar för kunder, intäkter eller affärsresultat ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för kundkontakt eller försäljning. Det ska finnas ett varaktigt ansvar för kundvärde, intäkter eller affärsresultat.",
      controlQuestion:
        "Är ansvar för kunder, intäkter eller affärsresultat något ni vill ge särskild tyngd i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av affärs- och kundansvar bär rollen normalt och varaktigt?",
      anchor1:
        "Stöd till en etablerad kundrelation eller affärsaktivitet inom ett avgränsat konto eller område.",
      anchor3:
        "Självständigt och etablerat ansvar för en kundrelation, intäktsström eller affärsportfölj.",
      anchor5:
        "Ansvar för kunder, intäkter eller affärsområden med stor betydelse för företaget och påverkan på marknadsposition eller framtida affär.",
    },
    "compliance-control": {
      name: "Informations-, säkerhets- eller regelefterlevnadsansvar",
      shortUiText:
        "Formellt ansvar för kontroll, skydd, kvalitetssäkring eller regelefterlevnad.",
      fullDefinition:
        "Omfattar formellt ansvar för att kontrollera, kvalitetssäkra eller säkerställa att viktiga krav följs, till exempel inom informationssäkerhet, kvalitet, säkerhet eller regelverk. Kriteriet avser ansvar för att kraven tillämpas korrekt. Det avser inte den allmänna skyldigheten att följa regler eller vara riskmedveten.",
      measures:
        "Kontroll- och kvalitetssäkringsansvar, ansvar för skydd av information eller säkerhet, ansvar för korrekt tillämpning av krav och regelverk.",
      notMeasures:
        "Allmän riskmedvetenhet, att följa rutiner som någon annan ansvarar för, konsekvensen om fel uppstår.",
      whenSuitable:
        "Välj när formellt ansvar för kontroll, skydd och regelefterlevnad ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte när området bara omfattar att följa etablerade kontrollrutiner. Det ska finnas ett tydligt ansvar för att kontroller och krav fungerar.",
      controlQuestion:
        "Ska formellt ansvar för kontroll, skydd och regelefterlevnad vägas in i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av informations-, säkerhets- eller regelefterlevnadsansvar bär rollen normalt och varaktigt?",
      anchor1:
        "Etablerade kontrollrutiner följs inom ett tydligt avgränsat område, utan självständigt kontrollansvar.",
      anchor3:
        "Självständigt och formellt ansvar för skydd, kvalitetssäkring eller efterlevnadskontroll inom ett område.",
      anchor5:
        "Mycket avancerat eller verksamhetskritiskt kontrollansvar där tolkningar och arbetssätt styr hur viktiga krav följs i flera delar av verksamheten.",
    },
    "safety-exposure": {
      name: "Säkerhets- och exponeringsförhållanden",
      shortUiText:
        "Varaktig exponering för fysiska, kemiska, biologiska eller miljömässiga risker.",
      fullDefinition:
        "Omfattar återkommande arbete i miljöer med faktisk fysisk, kemisk, biologisk eller miljömässig exponering och krav på skyddsåtgärder. Exempel är buller, farliga ämnen, smitta, höjd, värme, kyla och farliga maskiner. Kriteriet avser arbetsförhållandet, inte fysisk ansträngning eller konsekvensen för verksamheten om något går fel.",
      measures:
        "Riskmiljö och faktisk exponering, återkommande behov av skyddsåtgärder, särskilda säkerhetsförhållanden i miljön.",
      notMeasures:
        "Fysisk eller sensorisk ansträngning i sig, formellt säkerhetsansvar, affärsmässig eller organisatorisk risk.",
      whenSuitable:
        "Välj när särskilda säkerhets- och exponeringsförhållanden ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för säkerhetsansvar eller beslutsrisk. Det ska handla om faktisk och varaktig exponering i verksamhetens miljöer.",
      controlQuestion:
        "Är arbete under särskilda säkerhets- eller exponeringsförhållanden något ni vill ta hänsyn till i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av säkerhet och exponering arbetar rollen normalt och varaktigt under?",
      anchor1:
        "Enstaka och låg exponering under tydligt avgränsade förhållanden med standardiserade skyddsåtgärder.",
      anchor3:
        "Återkommande exponering i en etablerad riskmiljö som kräver konsekvent användning av skyddsåtgärder.",
      anchor5:
        "Mycket krävande eller verksamhetskritiska exponeringsförhållanden där skydd, säkerhetsrutiner och korrekt agerande är avgörande för säker verksamhet.",
    },
    "on-call": {
      name: "Jour, beredskap och tillgänglighetskrav",
      shortUiText:
        "Återkommande jour, beredskap eller krav på snabb tillgänglighet.",
      fullDefinition:
        "Omfattar återkommande krav på att vara nåbar eller kunna agera utanför ordinarie arbetstid, eller att kunna svara omedelbart under ett arbetspass. Kriteriet avser planerad eller förväntad beredskap som är en stabil del av verksamhetens förutsättningar. Det avser inte enstaka övertid, frivillig flexibilitet eller tillfälligt hög arbetsbelastning.",
      measures:
        "Jour och beredskap, krav på snabb tillgänglighet, återkommande insats utanför ordinarie arbetstid.",
      notMeasures:
        "Tillfällig övertid, informella förväntningar på att svara, allmänt hög arbetsmängd.",
      whenSuitable:
        "Välj när jour, beredskap eller krav på snabb tillgänglighet ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte när tillgänglighet bara uppstår vid enstaka kriser eller saknar en tydlig och återkommande förankring i verksamheten.",
      controlQuestion:
        "Är återkommande jour, beredskap eller krav på snabb tillgänglighet en arbetsförutsättning ni vill ta hänsyn till i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av jour, beredskap och tillgänglighet bär rollen normalt och varaktigt?",
      anchor1: "Enstaka och tydligt avgränsad beredskap med låg frekvens.",
      anchor3:
        "Etablerad och återkommande beredskap eller tillgänglighet utanför ordinarie arbetstid.",
      anchor5:
        "Mycket krävande beredskap med frekvent eller omedelbar insatsskyldighet, där verksamheten är starkt beroende av snabb tillgänglighet.",
    },
    "irregularity-mobility": {
      name: "Oregelbundenhet, mobilitet och platsbundenhet",
      shortUiText:
        "Varaktiga krav på oregelbundna tider, resor eller arbete på särskilda platser.",
      fullDefinition:
        "Omfattar varaktiga krav på oregelbundna arbetstider, omfattande resor eller platsbundet arbete, exempelvis fältverksamhet, skift eller internationell närvaro. Kriteriet avser ett stabilt och strukturellt förhållande i verksamheten. Det avser inte enstaka resor, personliga önskemål eller tillfälliga projekt.",
      measures:
        "Oregelbundna arbetstider, omfattande och återkommande resor, fält-, skift- eller platsbundet arbete.",
      notMeasures:
        "Enstaka tjänsteresor, tillfälliga projekt, jour eller beredskap utanför arbetstid.",
      whenSuitable:
        "Välj när oregelbundna tider, mobilitet eller platsbundenhet ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte när kravet är tillfälligt eller förekommer sällan utan att vara en stabil del av verksamhetens förutsättningar.",
      controlQuestion:
        "Vill ni väga in varaktiga krav på oregelbundna tider, resor eller platsbundet arbete?",
      assessmentQuestion:
        "Vilken nivå av oregelbundenhet, mobilitet eller platsbundenhet bär rollen normalt och varaktigt?",
      anchor1:
        "Återkommande men begränsade krav på oregelbundna tider, resor eller platsbundet arbete.",
      anchor3:
        "Etablerat och återkommande mönster av oregelbundna tider, resor eller platsbundet arbete.",
      anchor5:
        "Mycket omfattande krav på skift, resor, fältarbete eller internationell närvaro som tydligt påverkar planering och bemanning.",
    },
    "restricted-environments": {
      name: "Särskilda säkerhets-, sekretess- eller kontrollmiljöer",
      shortUiText:
        "Arbete under särskilda regler för åtkomst, sekretess, säkerhet eller kontroll.",
      fullDefinition:
        "Omfattar arbetsförhållanden med särskilda begränsningar för åtkomst, sekretess, säkerhet eller kontroll, till exempel säkerhetsklassade miljöer eller information som kräver särskilt skydd. Kriteriet avser de regler och begränsningar som gäller i miljön. Det avser inte ansvar för att utforma, följa upp eller kontrollera informationssäkerhet.",
      measures:
        "Särskilda åtkomstbegränsningar, sekretess- och säkerhetsrestriktioner, kontrollkrav som påverkar hur verksamheten kan bedrivas.",
      notMeasures:
        "Formellt ansvar för informationssäkerhet, allmän tystnadsplikt, allmän riskmedvetenhet.",
      whenSuitable:
        "Välj när särskilda åtkomst-, sekretess- eller säkerhetsrestriktioner ska få betydelse i synen på likvärdighet.",
      whenNotSuitable:
        "Välj inte enbart för konfidentiell information. Begränsningarna ska vara särskilda, återkommande och påverka hur verksamheten kan bedrivas.",
      controlQuestion:
        "Ska arbete under särskilda åtkomst-, sekretess- eller säkerhetsrestriktioner få betydelse i synen på likvärdighet?",
      assessmentQuestion:
        "Vilken nivå av säkerhets-, sekretess- eller kontrollrestriktion arbetar rollen normalt och varaktigt under?",
      anchor1:
        "Enstaka och tydligt avgränsade åtkomst- eller sekretessrestriktioner på låg nivå.",
      anchor3:
        "Etablerade och återkommande åtkomst-, kontroll- eller säkerhetsrestriktioner.",
      anchor5:
        "Mycket strikta eller verksamhetskritiska säkerhets-, sekretess- eller kontrollrestriktioner som i hög grad styr planering, genomförande och dokumentation.",
    },
  },
}
