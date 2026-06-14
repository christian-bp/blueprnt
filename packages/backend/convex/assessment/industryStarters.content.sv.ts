import type { StarterContent } from "./industryStarters"

// Swedish starter sets. Titles are stored as written once the user confirms
// (user data, no read-time localization). Track keys reference the fixed
// schema (IC/Lead/M). One role per JOB (ADR-0005): seniority lives on the
// individual, so there are no junior/senior title variants; a senior whose
// work actually differs becomes its own role, added by the user.
// NOTE: purpose/responsibilities are machine-drafted (mirror of the en
// profiles) and need native Swedish review before launch.
export const industryStartersSv: StarterContent = {
  itTelecom: [
    {
      name: "Engineering",
      roles: [
        {
          title: "Systemutvecklare",
          trackKey: "IC",
          purpose:
            "Bygger och underhåller programvara som möter produkt- och kvalitetskrav.",
          responsibilities:
            "Designa och implementera funktioner\nSkriva och granska kod\nÅtgärda fel och förbättra prestanda\nMedverka i tekniska beslut",
        },
        {
          title: "Tech Lead",
          trackKey: "Lead",
          purpose:
            "Styr teamets tekniska inriktning och säkerställer god ingenjörspraxis.",
          responsibilities:
            "Sätta teknisk inriktning och standarder\nGranska arkitektur och nyckelbeslut\nHandleda och avlasta utvecklare\nSamordna leverans i teamet",
        },
        {
          title: "Engineering Manager",
          trackKey: "M",
          purpose:
            "Leder ett utvecklingsteam för pålitlig leverans och utvecklar medarbetarna.",
          responsibilities:
            "Leda och utveckla teamet\nPlanera kapacitet och leverans\nSätta mål och följa upp\nStödja rekrytering och utveckling",
        },
      ],
    },
    {
      name: "Produkt",
      roles: [
        {
          title: "Product Manager",
          trackKey: "IC",
          purpose:
            "Äger produktinriktningen och säkerställer att rätt saker byggs.",
          responsibilities:
            "Definiera produktstrategi och roadmap\nPrioritera backloggen\nSamla in och analysera användarbehov\nSamordna intressenter och team",
        },
      ],
    },
    {
      name: "Design",
      roles: [
        {
          title: "UX-designer",
          trackKey: "IC",
          purpose:
            "Formar intuitiva användarupplevelser grundade i research och produktmål.",
          responsibilities:
            "Genomföra användarresearch\nDesigna flöden och gränssnitt\nSkapa prototyper och wireframes\nValidera design genom testning",
        },
      ],
    },
    {
      name: "Försäljning",
      roles: [
        {
          title: "Account Executive",
          trackKey: "IC",
          purpose:
            "Driver nyförsäljning genom att stänga affärer och utveckla kundkonton.",
          responsibilities:
            "Hantera säljpipeline\nKvalificera och driva möjligheter\nFörhandla och stänga affärer\nVårda kundrelationer",
        },
        {
          title: "Försäljningschef",
          trackKey: "M",
          purpose: "Leder säljorganisationen mot intäkts- och tillväxtmål.",
          responsibilities:
            "Sätta säljstrategi och mål\nLeda och coacha säljteamet\nPrognostisera och följa upp resultat\nUtveckla nyckelkunder och partners",
        },
      ],
    },
    {
      name: "Kundsupport",
      roles: [
        {
          title: "Supportspecialist",
          trackKey: "IC",
          purpose:
            "Löser kundärenden och säkerställer en positiv supportupplevelse.",
          responsibilities:
            "Besvara kundförfrågningar\nFelsöka och lösa ärenden\nEskalera komplexa fall\nDokumentera lösningar och återkoppling",
        },
        {
          title: "Customer Success Manager",
          trackKey: "IC",
          purpose:
            "Säkerställer att kunder får värde och fortsätter växa med produkten.",
          responsibilities:
            "Introducera och vägleda kunder\nFölja användning och kundhälsa\nDriva förnyelser och merförsäljning\nSamla in och förmedla kundåterkoppling",
        },
      ],
    },
  ],
  consulting: [
    {
      name: "Konsultverksamhet",
      roles: [
        {
          title: "Konsult",
          trackKey: "IC",
          purpose:
            "Levererar uppdrag och rådgivning som löser konkreta affärsproblem.",
          responsibilities:
            "Analysera kundbehov\nTa fram rekommendationer\nLeverera projektarbete\nPresentera resultat för kunder",
        },
        {
          title: "Uppdragsledare",
          trackKey: "Lead",
          purpose: "Leder kunduppdrag för att leverera kvalitet i tid.",
          responsibilities:
            "Planera och avgränsa uppdrag\nLeda leveransteamet\nHantera kundrelationer\nSäkerställa kvalitet i leveranser",
        },
        {
          title: "Affärsområdeschef",
          trackKey: "M",
          purpose:
            "Bygger och driver ett affärsområde och utvecklar dess konsulter.",
          responsibilities:
            "Sätta inriktning för affärsområdet\nLeda och utveckla konsulter\nFölja beläggning och leverans\nStödja affärsutveckling",
        },
      ],
    },
    {
      name: "Försäljning",
      roles: [
        {
          title: "Account Manager",
          trackKey: "IC",
          purpose:
            "Vårdar och utvecklar kundkonton för att säkra fortsatta affärer.",
          responsibilities:
            "Hantera kundrelationer\nIdentifiera nya möjligheter\nTa fram offerter\nNå kontomål",
        },
        {
          title: "Säljchef",
          trackKey: "M",
          purpose: "Leder säljarbetet mot tillväxt- och intäktsmål.",
          responsibilities:
            "Sätta säljmål\nLeda säljteamet\nPrognostisera och följa upp resultat\nUtveckla viktiga kundrelationer",
        },
      ],
    },
    {
      name: "Verksamhetsstöd",
      roles: [
        {
          title: "Administratör",
          trackKey: "IC",
          purpose:
            "Håller den dagliga verksamheten igång genom korrekt administrativt stöd.",
          responsibilities:
            "Hantera administrativa uppgifter\nUnderhålla register och system\nStödja interna processer\nSamordna scheman och logistik",
        },
        {
          title: "Ekonomiansvarig",
          trackKey: "M",
          purpose:
            "Leder den ekonomiska styrningen och säkerställer god ekonomisk kontroll.",
          responsibilities:
            "Hantera budget och rapportering\nÖverse redovisningsprocesser\nSäkerställa ekonomisk regelefterlevnad\nLeda ekonomiteamet",
        },
      ],
    },
  ],
  manufacturing: [
    {
      name: "Produktion",
      roles: [
        {
          title: "Operatör",
          trackKey: "IC",
          purpose:
            "Kör produktionsutrustning för att tillverka varor säkert och enligt standard.",
          responsibilities:
            "Manövrera produktionsmaskiner\nFölja säkerhetsrutiner\nÖvervaka produktkvalitet\nRapportera fel och stillestånd",
        },
        {
          title: "Produktionstekniker",
          trackKey: "IC",
          purpose:
            "Förbättrar produktionsprocesser för effektivitet, kvalitet och säkerhet.",
          responsibilities:
            "Optimera produktionsprocesser\nFelsöka tekniska problem\nStödja underhåll av utrustning\nGenomföra processförbättringar",
        },
        {
          title: "Produktionsledare",
          trackKey: "Lead",
          purpose:
            "Samordnar ett produktionsteam för att nå volym- och kvalitetsmål.",
          responsibilities:
            "Planera och fördela skiftarbete\nVägleda produktionsteamet\nÖvervaka volym och kvalitet\nLösa dagliga problem",
        },
        {
          title: "Produktionschef",
          trackKey: "M",
          purpose:
            "Leder produktionen för att nå mål för volym, kostnad och kvalitet.",
          responsibilities:
            "Planera produktionskapacitet\nLeda produktionsteam\nStyra kostnad och kvalitet\nDriva ständiga förbättringar",
        },
      ],
    },
    {
      name: "Kvalitet",
      roles: [
        {
          title: "Kvalitetsingenjör",
          trackKey: "IC",
          purpose:
            "Säkerställer att produkter uppfyller kvalitetskrav och specifikationer.",
          responsibilities:
            "Definiera kvalitetskontroller\nInspektera och testa produkter\nUtreda kvalitetsavvikelser\nDriva korrigerande åtgärder",
        },
        {
          title: "Kvalitetschef",
          trackKey: "M",
          purpose:
            "Leder kvalitetsfunktionen och värnar produkt- och processkvalitet.",
          responsibilities:
            "Äga kvalitetsledningssystemet\nLeda kvalitetsteamet\nSäkerställa regelefterlevnad\nDriva kvalitetsförbättring",
        },
      ],
    },
    {
      name: "Underhåll",
      roles: [
        {
          title: "Underhållstekniker",
          trackKey: "IC",
          purpose:
            "Håller utrustning och anläggning igång genom reparation och underhåll.",
          responsibilities:
            "Utföra förebyggande underhåll\nFelsöka och reparera fel\nDokumentera underhållsarbete\nFölja säkerhetsrutiner",
        },
        {
          title: "Underhållsledare",
          trackKey: "Lead",
          purpose:
            "Samordnar underhållsarbetet för att maximera utrustningens drifttid.",
          responsibilities:
            "Planera underhållsscheman\nVägleda underhållsteamet\nPrioritera reparationer\nFölja utrustningens tillförlitlighet",
        },
      ],
    },
    {
      name: "Logistik",
      roles: [
        {
          title: "Logistikkoordinator",
          trackKey: "IC",
          purpose:
            "Samordnar flödet av varor så att leveranser kommer fram i tid.",
          responsibilities:
            "Planera leveranser och transport\nSamordna med leverantörer\nFölja lager och order\nLösa leveransproblem",
        },
        {
          title: "Logistikchef",
          trackKey: "M",
          purpose:
            "Leder logistikverksamheten för effektiv försörjning och distribution.",
          responsibilities:
            "Sätta logistikstrategi\nLeda logistikteamet\nOptimera flöden i leveranskedjan\nStyra logistikkostnader",
        },
      ],
    },
  ],
  retail: [
    {
      name: "Butik",
      roles: [
        {
          title: "Butikssäljare",
          trackKey: "IC",
          purpose: "Betjänar kunder och driver försäljning på butiksgolvet.",
          responsibilities:
            "Hjälpa och råda kunder\nHantera köp i kassan\nUnderhålla butikens skyltning\nSköta varor på golvet",
        },
        {
          title: "Butiksansvarig",
          trackKey: "Lead",
          purpose:
            "Samordnar butiksteamet under ett pass så att det löper smidigt.",
          responsibilities:
            "Leda personalen under passet\nÖppna och stänga butiken\nHantera kundeskaleringar\nFölja dagliga säljuppgifter",
        },
        {
          title: "Butikschef",
          trackKey: "M",
          purpose:
            "Driver en butik för att nå säljmål och ge en stark kundupplevelse.",
          responsibilities:
            "Leda butikspersonalen\nDriva försäljning och mål\nStyra lager och budget\nSäkerställa servicestandard",
        },
        {
          title: "Regionchef",
          trackKey: "M",
          purpose: "Leder en grupp butiker för jämn regional prestation.",
          responsibilities:
            "Leda flera butikschefer\nSätta regionala mål\nDriva försäljning över butiker\nSäkerställa enhetlig drift",
        },
      ],
    },
    {
      name: "E-handel",
      roles: [
        {
          title: "E-handelsspecialist",
          trackKey: "IC",
          purpose:
            "Driver och förbättrar webbutiken för att öka onlineförsäljningen.",
          responsibilities:
            "Underhålla produktlistningar\nFölja onlineprestanda\nStödja kampanjer och erbjudanden\nFörbättra kundresan",
        },
        {
          title: "E-handelsansvarig",
          trackKey: "M",
          purpose: "Leder e-handelskanalen mot mål för tillväxt online.",
          responsibilities:
            "Sätta e-handelsstrategi\nLeda onlineteamet\nDriva trafik och konvertering\nÄga målen för onlineförsäljning",
        },
      ],
    },
    {
      name: "Inköp",
      roles: [
        {
          title: "Inköpare",
          trackKey: "IC",
          purpose:
            "Anskaffar och köper produkter på rätt villkor för verksamheten.",
          responsibilities:
            "Välja produkter och leverantörer\nFörhandla priser och villkor\nHantera inköpsorder\nFölja lagernivåer",
        },
        {
          title: "Inköpschef",
          trackKey: "M",
          purpose:
            "Leder inköp för att säkra rätt produkter till rätt kostnad.",
          responsibilities:
            "Sätta inköpsstrategi\nLeda inköpsteamet\nFörhandla viktiga leverantörsavtal\nStyra inköpsbudget",
        },
      ],
    },
    {
      name: "Lager och logistik",
      roles: [
        {
          title: "Lagermedarbetare",
          trackKey: "IC",
          purpose: "Hanterar varor på lagret så att order rör sig korrekt.",
          responsibilities:
            "Ta emot och lagra varor\nPlocka och packa order\nHålla ordning på lagret\nFölja säkerhetsrutiner",
        },
        {
          title: "Lagerchef",
          trackKey: "M",
          purpose:
            "Leder lagerverksamheten för korrekt och snabb varuhantering.",
          responsibilities:
            "Leda lagerpersonalen\nPlanera lagring och flöden\nStyra lagerprecision\nSäkerställa säkerhet och effektivitet",
        },
      ],
    },
  ],
  publicSector: [
    {
      name: "Handläggning",
      roles: [
        {
          title: "Handläggare",
          trackKey: "IC",
          purpose:
            "Hanterar ärenden och beslut i enlighet med regler och föreskrifter.",
          responsibilities:
            "Bedöma och handlägga ärenden\nTillämpa relevanta regler\nDokumentera beslut\nKommunicera med sökande",
        },
        {
          title: "Gruppledare",
          trackKey: "Lead",
          purpose:
            "Samordnar ett handläggarteam för enhetliga och snabba beslut.",
          responsibilities:
            "Fördela och prioritera ärenden\nVägleda och stödja teamet\nÖvervaka ärendekvalitet\nLösa komplexa frågor",
        },
        {
          title: "Enhetschef",
          trackKey: "M",
          purpose:
            "Leder en enhet för att uppfylla dess uppdrag och utveckla medarbetarna.",
          responsibilities:
            "Leda och utveckla personalen\nPlanera enhetens verksamhet\nSätta mål och följa upp\nSäkerställa regelefterlevnad",
        },
      ],
    },
    {
      name: "Verksamhetsutveckling",
      roles: [
        {
          title: "Verksamhetsutvecklare",
          trackKey: "IC",
          purpose:
            "Driver förbättringsinitiativ som stärker den offentliga verksamheten.",
          responsibilities:
            "Analysera utvecklingsbehov\nFöreslå förbättringar\nStödja genomförande\nFölja upp resultat",
        },
        {
          title: "Projektledare",
          trackKey: "Lead",
          purpose:
            "Leder projekt för att nå avsedda resultat i tid och inom budget.",
          responsibilities:
            "Planera och avgränsa projekt\nSamordna projektmedlemmar\nHantera tidplan och budget\nRapportera framsteg",
        },
      ],
    },
    {
      name: "Administration",
      roles: [
        {
          title: "Administratör",
          trackKey: "IC",
          purpose: "Ger administrativt stöd som håller verksamheten igång.",
          responsibilities:
            "Hantera administrativa uppgifter\nUnderhålla register och system\nStödja interna processer\nSamordna scheman och möten",
        },
        {
          title: "Registrator",
          trackKey: "IC",
          purpose:
            "Hanterar allmänna handlingar för korrekt och tillgänglig dokumentation.",
          responsibilities:
            "Registrera inkommande handlingar\nUnderhålla diariesystemet\nSäkerställa korrekt klassning\nStödja begäran om handlingar",
        },
      ],
    },
  ],
  healthcare: [
    {
      name: "Vård",
      roles: [
        {
          title: "Undersköterska",
          trackKey: "IC",
          purpose:
            "Ger praktisk omvårdnad som stödjer patienternas dagliga välbefinnande.",
          responsibilities:
            "Hjälpa patienter med daglig omvårdnad\nStödja vårdpersonalen\nÖvervaka patienternas tillstånd\nDokumentera given vård",
        },
        {
          title: "Sjuksköterska",
          trackKey: "IC",
          purpose:
            "Ger omvårdnad och värnar patientsäkerhet och välbefinnande.",
          responsibilities:
            "Bedöma och planera omvårdnad\nGe behandlingar och läkemedel\nÖvervaka patienternas tillstånd\nDokumentera och rapportera vård",
        },
        {
          title: "Specialistsjuksköterska",
          trackKey: "IC",
          purpose: "Ger avancerad omvårdnad inom en klinisk specialitet.",
          responsibilities:
            "Ge specialiserad vård\nVägleda kollegor inom specialiteten\nLeda kliniska bedömningar\nStödja vårdens utveckling",
        },
        {
          title: "Enhetschef",
          trackKey: "M",
          purpose:
            "Leder en vårdenhet för säker vård av kvalitet och utvecklar personalen.",
          responsibilities:
            "Leda och utveckla personalen\nPlanera bemanning och drift\nSäkerställa vårdkvalitet och säkerhet\nHantera enhetens budget",
        },
      ],
    },
    {
      name: "Omsorg",
      roles: [
        {
          title: "Omsorgsassistent",
          trackKey: "IC",
          purpose:
            "Stödjer personer med vardagsbehov för bibehållen livskvalitet.",
          responsibilities:
            "Hjälpa till med dagliga aktiviteter\nStödja personlig omvårdnad\nObservera och rapportera förändringar\nDokumentera givet stöd",
        },
        {
          title: "Stödpedagog",
          trackKey: "IC",
          purpose:
            "Stödjer personers utveckling och självständighet i vardagen.",
          responsibilities:
            "Planera och ge stöd\nUppmuntra färdigheter och självständighet\nFölja individuella stödplaner\nDokumentera framsteg",
        },
      ],
    },
    {
      name: "Administration",
      roles: [
        {
          title: "Vårdadministratör",
          trackKey: "IC",
          purpose: "Ger administrativt stöd som håller vårdverksamheten igång.",
          responsibilities:
            "Hantera administrativa uppgifter\nUnderhålla register och scheman\nStödja vårdpersonalen\nSamordna besök",
        },
        {
          title: "Verksamhetschef",
          trackKey: "M",
          purpose:
            "Leder vårdverksamheten för tjänster av kvalitet och utvecklar personalen.",
          responsibilities:
            "Leda och utveckla personalen\nPlanera och driva verksamheten\nStyra budget och kvalitet\nSäkerställa regelefterlevnad",
        },
      ],
    },
  ],
  finance: [
    {
      name: "Rådgivning",
      roles: [
        {
          title: "Rådgivare",
          trackKey: "IC",
          purpose:
            "Ger kunder råd om finansiella produkter utifrån deras behov.",
          responsibilities:
            "Bedöma kundens behov\nRekommendera finansiella produkter\nHantera kundrelationer\nSäkerställa regelefterlevnad i rådgivningen",
        },
        {
          title: "Kontorschef",
          trackKey: "M",
          purpose:
            "Leder ett kontor för att nå affärsmål och betjäna kunder väl.",
          responsibilities:
            "Leda kontorets personal\nDriva försäljning och mål\nSäkerställa servicekvalitet\nÖverse kontorets regelefterlevnad",
        },
      ],
    },
    {
      name: "Analys",
      roles: [
        {
          title: "Analytiker",
          trackKey: "IC",
          purpose: "Analyserar finansiella data för välgrundade affärsbeslut.",
          responsibilities:
            "Samla in och analysera data\nBygga finansiella modeller\nTa fram rapporter och insikter\nStödja beslutsfattande",
        },
        {
          title: "Chefsanalytiker",
          trackKey: "Lead",
          purpose:
            "Leder analysarbetet och sätter standarden för finansiell analys.",
          responsibilities:
            "Leda komplexa analyser\nVägleda och granska analytiker\nSätta analysmetoder\nPresentera insikter för ledningen",
        },
      ],
    },
    {
      name: "Risk och compliance",
      roles: [
        {
          title: "Compliance Officer",
          trackKey: "IC",
          purpose:
            "Säkerställer att organisationen verkar inom lagar och regler.",
          responsibilities:
            "Övervaka regelefterlevnad\nBedöma compliancerisker\nRåda om krav\nRapportera complianceavvikelser",
        },
        {
          title: "Riskchef",
          trackKey: "M",
          purpose:
            "Leder riskfunktionen för att identifiera och kontrollera väsentliga risker.",
          responsibilities:
            "Sätta ramverket för risk\nLeda riskteamet\nÖverse riskbedömning\nRapportera risk till ledningen",
        },
      ],
    },
    {
      name: "Backoffice",
      roles: [
        {
          title: "Handläggare",
          trackKey: "IC",
          purpose:
            "Hanterar transaktioner och register korrekt för att stödja verksamheten.",
          responsibilities:
            "Hantera transaktioner\nUnderhålla korrekta register\nStämma av konton\nLösa avvikelser",
        },
        {
          title: "Teamledare",
          trackKey: "Lead",
          purpose:
            "Samordnar ett backoffice-team för korrekt och snabb hantering.",
          responsibilities:
            "Fördela och prioritera arbete\nVägleda och stödja teamet\nÖvervaka kvalitet i hanteringen\nLösa komplexa fall",
        },
      ],
    },
  ],
  realEstateConstruction: [
    {
      name: "Projekt",
      roles: [
        {
          title: "Projektingenjör",
          trackKey: "IC",
          purpose: "Ger tekniskt stöd för att genomföra byggprojekt korrekt.",
          responsibilities:
            "Ta fram teknisk dokumentation\nStödja projektplanering\nSamordna med entreprenörer\nÖvervaka teknisk kvalitet",
        },
        {
          title: "Projektledare",
          trackKey: "Lead",
          purpose:
            "Leder projektleverans för att nå mål för omfattning, tid och budget.",
          responsibilities:
            "Planera och avgränsa projekt\nSamordna projektteamet\nHantera tidplan och budget\nRapportera framsteg",
        },
        {
          title: "Projektchef",
          trackKey: "M",
          purpose:
            "Äger projektets resultat och hanterar intressenter, kostnad och risk.",
          responsibilities:
            "Leda projektleverans\nHantera budget och kontrakt\nHantera intressenter och risk\nSäkerställa projektkvalitet",
        },
      ],
    },
    {
      name: "Produktion",
      roles: [
        {
          title: "Hantverkare",
          trackKey: "IC",
          purpose:
            "Utför yrkesarbete enligt gällande standard på arbetsplatsen.",
          responsibilities:
            "Utföra yrkesarbete på plats\nFölja ritningar och specifikationer\nUpprätthålla kvalitet och säkerhet\nRapportera framsteg och avvikelser",
        },
        {
          title: "Arbetsledare",
          trackKey: "Lead",
          purpose:
            "Samordnar arbetet på plats så att det är säkert, i tid och enligt standard.",
          responsibilities:
            "Leda arbetet på plats\nSamordna yrkesgrupper och lag\nÖvervaka säkerhet och kvalitet\nRapportera om framsteg på plats",
        },
        {
          title: "Platschef",
          trackKey: "M",
          purpose: "Leder arbetsplatsen för att bygga säkert och enligt plan.",
          responsibilities:
            "Leda personal och arbetslag\nPlanera och driva arbetsplatsen\nStyra kostnad och tidplan\nSäkerställa säkerhet och kvalitet på plats",
        },
      ],
    },
    {
      name: "Förvaltning",
      roles: [
        {
          title: "Fastighetstekniker",
          trackKey: "IC",
          purpose:
            "Underhåller fastigheter så att byggnader är säkra och fungerar.",
          responsibilities:
            "Utföra fastighetsunderhåll\nHantera reparationer och fel\nInspektera byggnadssystem\nBesvara hyresgästers förfrågningar",
        },
        {
          title: "Fastighetsförvaltare",
          trackKey: "IC",
          purpose:
            "Förvaltar fastigheter så att de drivs väl och hyresgäster är nöjda.",
          responsibilities:
            "Sköta fastighetens drift\nHantera hyresgästrelationer\nSamordna underhåll\nFölja fastighetens budget",
        },
        {
          title: "Förvaltningschef",
          trackKey: "M",
          purpose:
            "Leder fastighetsförvaltningen för att optimera fastighetsbeståndet.",
          responsibilities:
            "Sätta förvaltningsstrategi\nLeda förvaltningsteamet\nOptimera beståndets resultat\nStyra fastighetsbudgetar",
        },
      ],
    },
  ],
  other: [
    {
      name: "Verksamhet",
      roles: [
        {
          title: "Medarbetare",
          trackKey: "IC",
          purpose: "Utför det dagliga arbete som håller verksamheten igång.",
          responsibilities:
            "Utföra dagliga uppgifter\nFölja etablerade processer\nStödja teamets mål\nRapportera avvikelser och resultat",
        },
        {
          title: "Teamledare",
          trackKey: "Lead",
          purpose: "Samordnar ett team för att nå dess dagliga mål.",
          responsibilities:
            "Fördela och prioritera arbete\nVägleda och stödja teamet\nÖvervaka kvalitet och framsteg\nLösa dagliga problem",
        },
        {
          title: "Chef",
          trackKey: "M",
          purpose:
            "Leder ett team för att nå dess mål och utveckla medarbetarna.",
          responsibilities:
            "Leda och utveckla teamet\nPlanera och driva verksamheten\nSätta mål och följa upp\nStyra budget och kvalitet",
        },
      ],
    },
    {
      name: "Försäljning",
      roles: [
        {
          title: "Säljare",
          trackKey: "IC",
          purpose: "Driver försäljning genom att vinna och betjäna kunder.",
          responsibilities:
            "Driva säljmöjligheter\nHantera kundrelationer\nFörhandla och stänga affärer\nNå säljmål",
        },
        {
          title: "Säljchef",
          trackKey: "M",
          purpose: "Leder säljarbetet mot tillväxt- och intäktsmål.",
          responsibilities:
            "Sätta säljmål\nLeda säljteamet\nPrognostisera och följa upp resultat\nUtveckla viktiga kundrelationer",
        },
      ],
    },
    {
      name: "Administration",
      roles: [
        {
          title: "Administratör",
          trackKey: "IC",
          purpose: "Ger administrativt stöd som håller verksamheten igång.",
          responsibilities:
            "Hantera administrativa uppgifter\nUnderhålla register och system\nStödja interna processer\nSamordna scheman och möten",
        },
        {
          title: "Ekonomiansvarig",
          trackKey: "M",
          purpose:
            "Leder den ekonomiska styrningen och säkerställer god ekonomisk kontroll.",
          responsibilities:
            "Hantera budget och rapportering\nÖverse redovisningsprocesser\nSäkerställa ekonomisk regelefterlevnad\nLeda ekonomiteamet",
        },
      ],
    },
  ],
}
