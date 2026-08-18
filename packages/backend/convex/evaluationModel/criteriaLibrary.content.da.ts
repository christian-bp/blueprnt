import type { CriteriaLibraryContent } from "./criteriaLibrary.content.en"

// Danish content for the criteria library (the masterdokument's sections
// 5-13.5). Machine-translated from criteriaLibraryContentSv (the substance
// source), cross-checked against criteriaLibraryContentEn where a Swedish
// phrase was ambiguous. Structure mirrors en/sv exactly: only the three
// section 13.5 entries (scope-impact, complexity-ambiguity,
// risk-consequence) carry anchor2/anchor4. Machine draft, flagged for
// native review.
export const criteriaLibraryContentDa: CriteriaLibraryContent = {
  dimensions: {
    competence: {
      name: "Kompetence",
      question:
        "Hvilke kundskaber, færdigheder, erfaringer og kvalifikationer kræver rollen?",
      why: "Beskytter specialist-, professions- og kvalifikationskrævende roller mod at blive undervurderet.",
    },
    effort: {
      name: "Indsats og kompleksitet",
      question:
        "Hvor vanskelig, uklar, analytisk, kommunikativt eller fysisk krævende er rollen?",
      why: "Synliggør krævende arbejde, selv når rollen mangler formel ledelsesmagt.",
    },
    responsibility: {
      name: "Ansvar og indflydelse",
      question:
        "Hvilken rækkevidde, hvilket mandat og hvilke konsekvenser har rollen?",
      why: "Fanger ansvar for beslutninger, resultater, risiko, mennesker, kvalitet og forretning.",
    },
    workingConditions: {
      name: "Arbejdsforhold",
      question:
        "Findes der særlige, objektive og varige arbejdsvilkår, som påvirker kravene?",
      why: "Synliggør for eksempel rådighed, eksponering, sikkerhedskrav og uregelmæssige forhold.",
    },
  },
  workingConditionsTest: {
    question:
      "Findes der mindst én rollefamilie, hvor særlige arbejdsforhold er en tilbagevendende, objektiv og væsentlig del af rollens krav, og hvor kravet ikke allerede fanges korrekt af et andet kriterium?",
    notMaterialLabel: "Vurderet, men ikke væsentligt relevant",
  },
  sharedScale: {
    "1": {
      name: "Afgrænset krav",
      meaning:
        "Kravet er tydeligt defineret, lokalt eller begrænset i omfang. Rollen arbejder hovedsageligt inden for etablerede rammer.",
    },
    "2": {
      name: "Grundlæggende til moderat krav",
      meaning:
        "Kravet forekommer tilbagevendende, men inden for et tydeligt afgrænset område. Rollen håndterer variationer og enklere afvigelser.",
    },
    "3": {
      name: "Selvstændigt og etableret krav",
      meaning:
        "Kravet er en tydelig og tilbagevendende del af rollen. Rollen foretager professionelle vurderinger inden for sit område.",
    },
    "4": {
      name: "Avanceret eller bredt krav",
      meaning:
        "Kravet er avanceret, har bredere rækkevidde eller kræver selvstændige afvejninger, hvor etablerede arbejdsmåder ikke altid slår til.",
    },
    "5": {
      name: "Meget avanceret, omfattende eller forretningskritisk krav",
      meaning:
        "Kravet har meget stort omfang, sværhedsgrad, konsekvens eller strategisk betydning. Rollen former ofte retning, standarder, løsninger eller resultater uden for eget nærmeste område.",
    },
  },
  midpoints: {
    step2: "Et gennemtænkt mellemniveau mellem trin 1 og 3.",
    step4: "Et gennemtænkt mellemniveau mellem trin 3 og 5.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Videndybde og specialistniveau",
      shortUiText:
        "Rollens krav om fordybet specialistviden og avanceret problemløsning.",
      fullDefinition:
        "Fanger rollens krav om fordybet fagviden, specialistmetodik, avanceret problemløsning og relevant erfaring. Kriteriet måler dybden i den ekspertise, rollen normalt bruger, ikke en formel eksamen i sig selv eller hvordan et enkelt problem tilfældigvis blev løst.",
      measures:
        "Krav om fordybet fagviden, specialistmetodik, avanceret problemløsning og relevant erfaring.",
      notMeasures:
        "Formel eksamen i sig selv, sværhedsgraden i et enkelt problem eller individets præstation.",
      whenSuitable: "Næsten altid relevant i videnintensive virksomheder.",
      whenNotSuitable:
        "Vælg normalt dette eller det bredere samlede kompetencekriterium, ikke begge.",
      controlQuestion:
        "Har dybden i den specialistviden, rollen kræver, betydning i sig selv, adskilt fra dens bredde, formelle kvalifikationer, domænekontekst og rådgivningsvurdering?",
      assessmentQuestion:
        "Hvilket niveau af specialistvidensdybde kræver rollen normalt og varigt?",
      anchor1:
        "Rollen bruger etableret, veldokumenteret fagviden inden for et tydeligt afgrænset område og anvender kendte metoder på velkendte problemer.",
      anchor3:
        "Rollen anvender selvstændigt fordybet specialistviden og etableret fagmetodik til at løse problemer inden for sit eget område.",
      anchor5:
        "Rollen besidder specialistviden på meget avanceret niveau og bliver ofte inddraget i fagfeltets sværeste problemer, hvilket former professionelle standarder eller praksis uden for eget team.",
    },
    "knowledge-breadth": {
      name: "Vidensbredde og tværfaglig forståelse",
      shortUiText:
        "Rollens krav om at integrere flere kompetenceområder og forstå sammenhængen mellem dem.",
      fullDefinition:
        "Fanger rollens krav om at kombinere og integrere flere kompetenceområder, for eksempel produkt, data, forretning og teknologi, og at forstå hvordan de hænger sammen. Kriteriet måler bredden i integrationen, ikke antallet af personer, rollen samarbejder med.",
      measures:
        "Krav om at integrere flere kompetenceområder og forstå sammenhængen mellem dem.",
      notMeasures: "Antal samarbejdspartnere eller organisatorisk indflydelse.",
      whenSuitable:
        "Når roller skal kombinere flere fagområder, for eksempel produkt, data, forretning og teknologi.",
      whenNotSuitable:
        "Vælg kun når bredde er en selvstændig forskel fra specialistdybde.",
      controlQuestion:
        "Har bredden i den kompetence, rollen integrerer, betydning i sig selv, adskilt fra hvor dyb dens specialistviden er?",
      assessmentQuestion:
        "Hvilket niveau af tværfaglig bredde kræver rollen normalt og varigt?",
      anchor1:
        "Rollen bruger hovedsageligt ét kompetenceområde og har sjældent behov for at koble det til andre discipliner.",
      anchor3:
        "Rollen kombinerer selvstændigt et fåtal etablerede kompetenceområder og forstår, hvordan de påvirker hinanden.",
      anchor5:
        "Rollen integrerer mange forskellige kompetenceområder på meget avanceret niveau og er den, man stoler på til at koble dem sammen på måder, der former løsninger eller retning uden for eget område.",
    },
    "formal-qualifications": {
      name: "Formelle kvalifikations-, autorisations- og certificeringskrav",
      shortUiText:
        "Rollens krav om obligatorisk autorisation, godkendelse eller certificering.",
      fullDefinition:
        "Fanger formelle krav, rollen skal opfylde for lovligt at udøve, underskrive eller have ansvar for arbejdet, for eksempel en obligatorisk autorisation, godkendelse eller certificering. Kriteriet måler det formelle krav i sig selv, ikke generel uddannelsesstatus eller en prestigefyldt eksamen, der ikke kræves for at udføre arbejdet.",
      measures:
        "Formelle krav, der kræves for at udøve, underskrive eller have ansvar for arbejdet.",
      notMeasures:
        "Generel uddannelsesstatus, prestigefyldt eksamen eller frivillige kurser.",
      whenSuitable:
        "Regulerede eller sikkerhedskritiske roller med obligatorisk autorisation, godkendelse eller certificering.",
      whenNotSuitable:
        "Bør ikke bruges, hvis uddannelse blot er en vej til kompetence, der allerede fanges af Videndybde.",
      controlQuestion:
        "Har rollens obligatoriske autorisation, godkendelse eller certificering betydning i sig selv, adskilt fra den specialistviden, den også kræver?",
      assessmentQuestion:
        "Hvilket niveau af formel kvalifikation, autorisation eller certificering kræver rollen normalt og varigt?",
      anchor1:
        "Rollen har intet krav om autorisation, godkendelse eller certificering, eller kun et grundlæggende, tydeligt defineret sådant krav med begrænset krav om fornyelse eller omfang.",
      anchor3:
        "Rollen kræver en etableret erhvervsautorisation eller certificering, der er et tilbagevendende, selvstændigt vilkår for at udøve rollen.",
      anchor5:
        "Rollen kræver en avanceret eller forretningskritisk autorisation, godkendelse eller certificering, uden hvilken rollen ikke lovligt kan udøves, underskrives eller ansvares for, og som ofte sætter den standard, andre skal opfylde.",
    },
    "domain-knowledge": {
      name: "Domæne- og forretningsviden",
      shortUiText:
        "Rollens krav om dyb, vanskeligt erstattelig viden om sin specifikke branche eller forretningskontekst.",
      fullDefinition:
        "Fanger rollens krav om dyb kontekstviden, for eksempel branche, produkt, kundemiljø eller regelsætskontekst, som ikke hurtigt kan erstattes af generel faglig dygtighed. Kriteriet måler dybden i kontekstviden, ikke den generelle erfaring eller organisationskendskab, alle forventes at opbygge over tid.",
      measures:
        "Dyb kontekstviden, der ikke hurtigt erstattes af generel faglig dygtighed.",
      notMeasures:
        "Generel erfaring eller organisationskendskab, som alle forventes at opbygge.",
      whenSuitable:
        "Når specifik branche-, produkt-, kundemiljø- eller regelsætsviden er en selvstændig forudsætning for rollen.",
      whenNotSuitable:
        "Domæne = konteksten; specialistniveau = professionel metode og færdighed.",
      controlQuestion:
        "Har rollens kontekstspecifikke domæneviden betydning i sig selv, adskilt fra dens generelle specialistmetode og færdighed?",
      assessmentQuestion:
        "Hvilket niveau af domæne- og forretningsviden kræver rollen normalt og varigt?",
      anchor1:
        "Rollen kræver domæneviden begrænset til en tydeligt afgrænset produkt-, proces- eller kundekontekst.",
      anchor3:
        "Rollen kræver etableret, selvstændig viden om sit forretningsdomæne, som ikke hurtigt erstattes af generel faglig dygtighed.",
      anchor5:
        "Rollen kræver meget dyb, forretningskritisk domæneviden, som er svær at erstatte, og som ofte former, hvordan domænets standarder eller praksis fastsættes uden for rollens eget område.",
    },
    "advisory-judgment": {
      name: "Rådgivnings- og vurderingskompetence",
      shortUiText:
        "Rollens krav om at afveje information og omsætte ekspertise til kvalificerede anbefalinger.",
      fullDefinition:
        "Fanger rollens krav om at afveje information, udøve professionel vurderingsevne og omsætte ekspertise til kvalificerede råd eller anbefalinger, som andre handler ud fra. Kriteriet måler selve rådgivningsvurderingen, ikke det formelle mandat til at beslutte, hvad der sker herefter.",
      measures:
        "Krav om at vurdere information, give kvalificerede råd og omsætte ekspertise til anbefalinger.",
      notMeasures: "Formelt beslutningsmandat.",
      whenSuitable:
        "Konsulent-, partner-, specialist- og ledende ekspertroller, hvor kvalificerede råd er kerneleverancen.",
      whenNotSuitable:
        "Bør ikke kombineres med Videndybde, hvis det blot beskriver samme ekspertise med andre ord.",
      controlQuestion:
        "Har rollens krav om at udøve rådgivningsvurdering betydning i sig selv, adskilt fra den specialistviden, vurderingen bygger på?",
      assessmentQuestion:
        "Hvilket niveau af rådgivnings- og vurderingskompetence kræver rollen normalt og varigt?",
      anchor1:
        "Rollen bidrager med grundlag eller ukomplicerede råd inden for et tydeligt afgrænset område, i tråd med etableret vejledning.",
      anchor3:
        "Rollen afvejer selvstændigt information og giver etablerede, professionelle råd, som andre stoler på inden for sit eget område.",
      anchor5:
        "Rollens råd og vurderinger efterspørges i meget avancerede eller forretningskritiske spørgsmål og former ofte de anbefalinger, standarder eller den retning, andre dele af virksomheden følger.",
    },
    "complexity-ambiguity": {
      name: "Kompleksitet og uklarhed",
      shortUiText:
        "Rollens krav om at håndtere usikkerhed, mangefacetterede spørgsmål og uklare rammer med kvalificeret vurderingsevne.",
      fullDefinition:
        "Fanger usikkerheden, de mangefacetterede spørgsmål, uklare rammer og behovet for kvalificeret vurderingsevne, rollen normalt arbejder med. Kriteriet måler karakteren af de problemer, rollen håndterer, ikke vidensbehovet i sig selv, arbejdstempoet eller den organisatoriske rækkevidde.",
      measures:
        "Usikkerhed, mangefacetterede spørgsmål, uklare rammer og behov for kvalificeret vurderingsevne.",
      notMeasures:
        "Vidensbehovet i sig selv, højt arbejdstempo eller organisatorisk rækkevidde.",
      whenSuitable: "Næsten altid relevant.",
      whenNotSuitable: "Bør normalt være hovedkriteriet inden for dimensionen.",
      controlQuestion:
        "Har kompleksiteten og uklarheden, rollen håndterer, betydning i sig selv, adskilt fra den analytiske indsats, der lægges i at arbejde sig igennem den?",
      assessmentQuestion:
        "Hvilket niveau af kompleksitet og uklarhed håndterer rollen normalt og varigt?",
      anchor1:
        "Rollen arbejder hovedsageligt med tydeligt definerede spørgsmål, etablerede metoder og forudsigelige situationer.",
      anchor2:
        "Rollen håndterer tilbagevendende variationer og enklere afvigelser, hvor den vælger mellem kendte alternativer.",
      anchor3:
        "Rollen håndterer selvstændigt komplekse spørgsmål inden for sit område og skal analysere, prioritere og tilpasse løsninger.",
      anchor4:
        "Rollen håndterer avancerede, tværfunktionelle eller delvist uklare problemer, hvor etablerede løsninger ikke altid slår til.",
      anchor5:
        "Rollen definerer og håndterer meget komplekse eller strategisk vigtige problemer under høj usikkerhed og former ofte tilgang, principper eller langsigtede løsninger.",
    },
    "analytical-effort": {
      name: "Analytisk og problemløsende indsats",
      shortUiText:
        "Omfanget af analyse, fejlfinding eller systematisk problemløsning, rollen normalt udfører.",
      fullDefinition:
        "Fanger omfanget af analyse, fejlfinding, modellering, diagnostik eller systematisk problemløsning, rollen normalt udfører. Kriteriet måler det analytiske arbejde i sig selv, ikke specialistviden bag det eller blot forekomsten af uklare problemer.",
      measures:
        "Omfang af analyse, fejlfinding, modellering, diagnostik eller systematisk problemløsning.",
      notMeasures: "Specialistviden eller blot uklare problemer.",
      whenSuitable:
        "Når den mentale analysebyrde adskiller sig tydeligt mellem roller på trods af sammenlignelig kompleksitet.",
      whenNotSuitable:
        "Kombiner med Kompleksitet kun hvis forskellen kan forklares: kompleksitet = problemets natur; analyse = arbejdet, der kræves for at håndtere det.",
      controlQuestion:
        "Har den analytiske indsats, rollen lægger i at løse problemer, betydning i sig selv, adskilt fra hvor komplekse eller uklare disse problemer er?",
      assessmentQuestion:
        "Hvilket niveau af analytisk og problemløsende indsats bærer rollen normalt og varigt?",
      anchor1:
        "Rollen udfører ukompliceret analyse eller fejlfinding inden for en tydeligt afgrænset opgave, i tråd med etablerede trin.",
      anchor3:
        "Rollen udfører selvstændigt etableret analyse, diagnostik eller systematisk problemløsning som en tilbagevendende del af sit eget område.",
      anchor5:
        "Rollen udfører meget avanceret eller omfattende analyse, modellering eller diagnostik, der ofte er forretningskritisk og former, hvordan lignende problemer angribes uden for eget område.",
    },
    "communication-effort": {
      name: "Kommunikations- og relationskrævende arbejde",
      shortUiText:
        "Rollens krav om avanceret kommunikation, forhandling eller konflikthåndtering.",
      fullDefinition:
        "Fanger rollens krav om avanceret kommunikation, forhandling, påvirkning, konflikthåndtering eller oversættelse mellem forskellige interesser. Kriteriet måler den kommunikative indsats, ikke antallet af interessenter, rollen tilfældigvis håndterer, eller dens organisatoriske indflydelse.",
      measures:
        "Krav om avanceret kommunikation, forhandling, påvirkning, konflikthåndtering eller oversættelse mellem interesser.",
      notMeasures: "Antal interessenter eller organisatorisk indflydelse.",
      whenSuitable:
        "Kundenære, forhandlende, rådgivende eller konflikthåndterende virksomheder, hvor dette er en central del af arbejdet.",
      whenNotSuitable:
        "Måles som kommunikativ indsats, ikke som størrelsen på netværket.",
      controlQuestion:
        "Har den kommunikative indsats, rollen bærer, betydning i sig selv, adskilt fra hvor mange interessenter eller hvor stor organisatorisk rækkevidde den har?",
      assessmentQuestion:
        "Hvilket niveau af kommunikations- og relationsindsats bærer rollen normalt og varigt?",
      anchor1:
        "Rollen kommunikerer inden for et tydeligt afgrænset, overvejende rutinemæssigt samspil med etablerede modparter.",
      anchor3:
        "Rollen gennemfører selvstændigt etableret, tilbagevendende kommunikation, forhandling eller konflikthåndtering som en del af sit eget område.",
      anchor5:
        "Rollen bærer meget avanceret eller forretningskritisk kommunikation, forhandling eller konflikthåndtering og former ofte, hvordan følsomme relationer eller tvister håndteres uden for eget område.",
    },
    "operational-intensity": {
      name: "Operationel intensitet og samtidighedskrav",
      shortUiText:
        "Rollens normale krav om at holde opmærksomheden på flere samtidige strømme og prioritere løbende.",
      fullDefinition:
        "Fanger opmærksomheden, evnen til at håndtere flere ting samtidig og den kontinuerlige prioritering, rollen normalt kræver i sin ordinære arbejdsform. Kriteriet måler et varigt, strukturelt krav, ikke midlertidige toppe, underbemanding eller dårlig planlægning, der tilfældigvis øger arbejdsmængden.",
      measures:
        "Opmærksomhed, evne til at håndtere flere ting samtidig og kontinuerlig prioritering i normalformen.",
      notMeasures:
        "Midlertidige toppe, underbemanding eller dårlig planlægning.",
      whenSuitable:
        "Drift, kundeservice, logistik eller overvågning med varige krav om flere samtidige strømme og hurtige prioriteringer.",
      whenNotSuitable:
        "Må ikke bruges til at belønne arbejdsmængde, der opstår som følge af ressourcemangel.",
      controlQuestion:
        "Har rollens normale operationelle intensitet betydning i sig selv, adskilt fra midlertidige toppe forårsaget af underbemanding eller dårlig planlægning?",
      assessmentQuestion:
        "Hvilket niveau af operationel intensitet og samtidighedskrav bærer rollen normalt og varigt?",
      anchor1:
        "Rollen håndterer normalt én strøm eller opgave ad gangen inden for en tydeligt afgrænset arbejdsrytme.",
      anchor3:
        "Rollen håndterer selvstændigt flere etablerede, samtidige strømme og prioriterer mellem dem som en normal del af sit eget område.",
      anchor5:
        "Rollen opretholder meget høj, forretningskritisk operationel intensitet på tværs af mange samtidige strømme, og hvordan den prioriterer, sætter ofte det mønster, andre følger.",
    },
    "physical-sensory": {
      name: "Fysisk eller sensorisk anstrengelse",
      shortUiText:
        "Rollens tilbagevendende fysiske belastning, præcisionskrav eller sensoriske koncentration.",
      fullDefinition:
        "Fanger den tilbagevendende fysiske belastning, præcision, ergonomisk krævende moment eller sensoriske koncentration, rollen normalt kræver. Kriteriet måler den fysiske eller sensoriske anstrengelse i sig selv, ikke sikkerhedsrisikoen eller eksponeringen, arbejdet også kan indebære.",
      measures:
        "Tilbagevendende fysisk belastning, præcision, ergonomisk krævende moment eller sensorisk koncentration.",
      notMeasures: "Sikkerhedsrisiko eller fysisk eksponering.",
      whenSuitable:
        "Industri, sundhed, lager, produktion, feltservice eller laboratorier.",
      whenNotSuitable:
        "Risikomiljø og eksponering hører normalt under Arbejdsforhold.",
      controlQuestion:
        "Har den fysiske eller sensoriske anstrengelse, rollen bærer, betydning i sig selv, adskilt fra sikkerhedsrisikoen eller eksponeringen, den også kan indebære?",
      assessmentQuestion:
        "Hvilket niveau af fysisk eller sensorisk anstrengelse bærer rollen normalt og varigt?",
      anchor1:
        "Rollen indebærer lette, midlertidige fysiske eller sensoriske krav inden for en tydeligt afgrænset opgave.",
      anchor3:
        "Rollen bærer selvstændigt etableret, tilbagevendende fysisk belastning, præcisionsarbejde eller sensorisk koncentration som en normal del af sit eget område.",
      anchor5:
        "Rollen bærer meget krævende, vedvarende fysisk eller sensorisk anstrengelse, der ofte er forretningskritisk at udføre korrekt, for eksempel præcisionsarbejde hvis standard andre holdes til.",
    },
    "scope-impact": {
      name: "Omfang og indflydelse",
      shortUiText:
        "Rollens rækkevidde: fra en afgrænset opgave til team, funktion, flere funktioner eller hele virksomheden.",
      fullDefinition:
        "Fanger hvor langt rollens resultater og beslutninger rækker i organisationen, fra tydeligt afgrænsede egne opgaver til virksomhedsomfattende indflydelse. Kriteriet måler rækkevidde, ikke formel bemyndigelse.",
      measures:
        "Rollens rækkevidde: fra afgrænset opgave til team, funktion, flere funktioner eller virksomhed.",
      notMeasures:
        "Formelt personaleansvar, budgetstørrelse eller selve mandatet.",
      whenSuitable: "Næsten altid relevant.",
      whenNotSuitable:
        "Bør ikke kombineres med et separat kriterium, der kun måler organisatorisk rækkevidde.",
      controlQuestion:
        "Har forskellen i rækkevidde mellem jeres roller betydning i sig selv, ud over mandat og konsekvens?",
      assessmentQuestion:
        "Hvor langt rækker rollens normale og varige indflydelse?",
      anchor1:
        "Rollen påvirker primært kvaliteten, effektiviteten eller resultatet af egne tydeligt afgrænsede arbejdsopgaver.",
      anchor2:
        "Rollen påvirker et afgrænset arbejdsområde eller tilbagevendende leverance inden for et team.",
      anchor3:
        "Rollen har selvstændigt ansvar for resultater inden for et tydeligt område og påvirker teamets eller nærliggende funktioners leverance og prioriteringer.",
      anchor4:
        "Rollen påvirker flere teams, en funktion eller en væsentlig del af virksomheden gennem valg, prioriteringer eller løsninger med varige følger.",
      anchor5:
        "Rollen påvirker virksomhedens overordnede retning, resultater eller evne til at lykkes gennem beslutninger og ansvar med virksomhedsomfattende eller strategisk effekt.",
    },
    "autonomy-mandate": {
      name: "Autonomi og beslutningsmandat",
      shortUiText:
        "Hvor selvstændigt rollen beslutter, og på hvilket niveau, før eskalering kræves.",
      fullDefinition:
        "Fanger hvor selvstændigt rollen træffer beslutninger, på hvilket niveau beslutningerne ligger, og hvor meget der skal eskaleres til andre. Kriteriet måler selve beslutningsmandatet, ikke konsekvensen af beslutningen eller hvor langt dens effekt rækker.",
      measures:
        "Selvstændighed, beslutningernes niveau og behov for eskalering.",
      notMeasures:
        "Konsekvensen af beslutningen eller dens organisatoriske rækkevidde.",
      whenSuitable: "Næsten altid relevant.",
      whenNotSuitable:
        "Mandat = retten til at beslutte; omfang = hvor effekten mærkes; risiko = følgen, hvis det går galt.",
      controlQuestion:
        "Har det niveau af beslutningsmandat, rollen har, betydning i sig selv, adskilt fra hvor effekterne mærkes, og hvad konsekvenserne ville blive, hvis det gik galt?",
      assessmentQuestion:
        "Hvilket niveau af autonomi og beslutningsmandat har rollen normalt og varigt?",
      anchor1:
        "Rollen træffer beslutninger inden for en tydeligt afgrænset opgave og eskalerer alt, der ligger uden for etableret rutine.",
      anchor3:
        "Rollen træffer selvstændigt etablerede beslutninger inden for sit eget område og eskalerer kun genuint nye eller tværgående spørgsmål.",
      anchor5:
        "Rollen har meget bredt eller forretningskritisk beslutningsmandat og beslutter i spørgsmål, hvor retningen eller standarderne rækker ud over eget nærmeste område, med lille behov for eskalering.",
    },
    "risk-consequence": {
      name: "Risiko og konsekvens",
      shortUiText:
        "Konsekvenserne for virksomheden, hvis rollens beslutninger, fejl eller mangler slår fejl.",
      fullDefinition:
        "Fanger de konsekvenser, rollens beslutninger, fejl eller mangler kan få for sikkerhed, kunde, kvalitet, efterlevelse, information eller brand. Kriteriet måler konsekvens bredt, ikke kun økonomisk risiko eller hvor belastende individet oplever rollen.",
      measures:
        "Følger af beslutninger, fejl eller mangler for sikkerhed, kunde, kvalitet, efterlevelse, information eller brand.",
      notMeasures: "Kun økonomisk risiko eller individets stressniveau.",
      whenSuitable: "Næsten altid relevant.",
      whenNotSuitable:
        "Undgå separat compliance-risiko, hvis den blot er et eksempel på samme risiko og konsekvens.",
      controlQuestion:
        "Har konsekvensen af rollens beslutninger eller fejl betydning i sig selv, adskilt fra det formelle efterlevelsesansvar, den også kan bære?",
      assessmentQuestion:
        "Hvilket niveau af risiko og konsekvens bærer rollens beslutninger og arbejde normalt og varigt?",
      anchor1:
        "Fejl eller mangler får normalt begrænsede og let korrigerbare følger inden for eget arbejdsområde.",
      anchor2:
        "Fejl eller mangler kan påvirke teamets kvalitet, effektivitet eller leverance og kræver normalt korrigering inden for etablerede processer.",
      anchor3:
        "Fejl, beslutninger eller mangler kan få tydelige følger for kunde, leverance, kvalitet, økonomi eller efterlevelse inden for et område.",
      anchor4:
        "Fejl, beslutninger eller mangler kan få betydelige følger for flere dele af virksomheden, vigtige kunder, kritiske processer eller regelefterlevelse.",
      anchor5:
        "Fejl, beslutninger eller mangler kan få meget store, langvarige eller forretningskritiske følger for strategi, sikkerhed, efterlevelse, tillid eller overlevelsesevne.",
    },
    "people-leadership": {
      name: "Personale- og ledelsesansvar",
      shortUiText:
        "Rollens formelle ansvar for at lede mennesker og skabe resultater gennem dem.",
      fullDefinition:
        "Fanger rollens formelle ansvar for at lede mennesker: fordele arbejde, udvikle deres kapacitet og skabe resultater gennem andre. Kriteriet måler formelt personaleansvar, ikke projektledelse uden dette, specialistledelse eller teamstørrelse brugt som eneste mål.",
      measures:
        "Ansvar for at lede mennesker, fordele arbejde, udvikle kapacitet og skabe resultater gennem andre.",
      notMeasures:
        "Projektledelse uden personaleansvar, specialistledelse eller teamstørrelse som eneste mål.",
      whenSuitable:
        "Når formelt personaleansvar er en væsentlig forskel mellem roller.",
      whenNotSuitable:
        "Bør normalt have lav til moderat vægt, da lederskab ofte allerede fremgår af omfang og mandat.",
      controlQuestion:
        "Har rollens formelle personaleansvar betydning i sig selv, ud over hvad dens omfang og beslutningsmandat allerede fanger?",
      assessmentQuestion:
        "Hvilket niveau af personale- og ledelsesansvar bærer rollen normalt og varigt?",
      anchor1:
        "Rollen har intet eller meget begrænset formelt personaleansvar, for eksempel enkeltvis at koordinere en eller to andres opgaver.",
      anchor3:
        "Rollen har etableret, selvstændigt ansvar for at lede et team: fordele arbejde, udvikle kapacitet og skabe resultater gennem andre.",
      anchor5:
        "Rollen bærer meget avanceret eller forretningskritisk personale- og ledelsesansvar, leder ledere eller en stor organisation og sætter ofte standarden for, hvordan mennesker ledes uden for eget team.",
    },
    "resource-capacity": {
      name: "Ressource- og kapacitetsansvar",
      shortUiText:
        "Rollens ansvar for at prioritere og anvende væsentlige ressourcer eller kapacitet.",
      fullDefinition:
        "Fanger rollens ansvar for at prioritere og anvende væsentlige ressourcer, kapacitet, aktiver eller kritisk leveringsevne, så virksomheden fortsætter med at fungere. Kriteriet måler selvstændig ressourcestyring, ikke rutinemæssig budgetopfølgning eller indkøb inden for små, forudbestemte rammer.",
      measures:
        "Ansvar for at prioritere og anvende ressourcer, så virksomheden fungerer.",
      notMeasures:
        "Almindelig budgetopfølgning eller indkøb inden for små rammer.",
      whenSuitable:
        "Når rollen selvstændigt disponerer væsentlige ressourcer, kapacitet, aktiver eller kritisk leveringsevne.",
      whenNotSuitable:
        "Bør ikke vælges samtidig med et snævert finansielt ansvar, hvis begge måler samme ressourcestyring.",
      controlQuestion:
        "Har rollens selvstændige ansvar for ressourcer eller kapacitet betydning i sig selv, adskilt fra rutinemæssig budgetopfølgning inden for forudbestemte rammer?",
      assessmentQuestion:
        "Hvilket niveau af ressource- og kapacitetsansvar bærer rollen normalt og varigt?",
      anchor1:
        "Rollen prioriterer selvstændigt brugen af et lille, tydeligt afgrænset sæt ressourcer eller kapacitet inden for sit eget område, hvor dens valg har begrænset og let korrigerbar effekt.",
      anchor3:
        "Rollen prioriterer og fordeler selvstændigt etablerede ressourcer eller kapacitet, så eget område fortsætter med at fungere.",
      anchor5:
        "Rollen forvalter selvstændigt meget betydelige eller forretningskritiske ressourcer, kapacitet eller leveringsevne med beslutninger, der former ressourceprioriteringer uden for eget område.",
    },
    "business-customer": {
      name: "Forretnings- og kundeansvar",
      shortUiText:
        "Rollens ansvar for at skabe, sikre eller udvikle materiel forretningsværdi.",
      fullDefinition:
        "Fanger rollens ansvar for at skabe, sikre eller udvikle materiel forretningsværdi gennem en væsentlig kunderelation, indtægtsstrøm, forretningsportefølje eller kommerciel position. Kriteriet måler stabiliteten i dette forretningsansvar, ikke individuel salgspræstation, provision eller forhandlingsevne i sig selv.",
      measures:
        "Ansvar for at skabe, sikre eller udvikle materiel forretningsværdi.",
      notMeasures:
        "Individuel salgspræstation, provision eller forhandlingsevne i sig selv.",
      whenSuitable:
        "Når rollen har direkte ansvar for væsentlig kunderelation, indtægtsstrøm, forretningsportefølje eller kommerciel position.",
      whenNotSuitable:
        "Må ikke automatisk favorisere salgsroller; ansvaret skal være en stabil del af rollen.",
      controlQuestion:
        "Har rollens stabile ansvar for forretnings- eller kundeværdi betydning i sig selv, adskilt fra individuel salgspræstation eller forhandlingsevne?",
      assessmentQuestion:
        "Hvilket niveau af forretnings- og kundeansvar bærer rollen normalt og varigt?",
      anchor1:
        "Rollen understøtter en kunderelation eller forretningsaktivitet inden for en tydeligt afgrænset, etableret kundekonto eller opgave.",
      anchor3:
        "Rollen har selvstændigt etableret ansvar for en kunderelation, indtægtsstrøm eller forretningsportefølje, der er en stabil del af rollen.",
      anchor5:
        "Rollen bærer meget betydeligt eller forretningskritisk ansvar for store kunderelationer, indtægter eller kommerciel position med beslutninger, der former virksomhedens retning uden for egen portefølje.",
    },
    "compliance-control": {
      name: "Informations-, sikkerheds- eller regelefterlevelsesansvar",
      shortUiText:
        "Rollens formelle ansvar for beskyttelse, kvalitetssikring eller efterlevelseskontrol.",
      fullDefinition:
        "Fanger rollens formelle ansvar for beskyttelse, kvalitetssikring, kontrol eller korrekt anvendelse af kritiske krav, for eksempel informationssikkerhed eller regelefterlevelse. Kriteriet måler et separat, formelt kontrolansvar, ikke den generelle risikobevidsthed, enhver rolle forventes at have.",
      measures:
        "Ansvar for beskyttelse, kvalitetssikring, kontrol eller korrekt anvendelse af kritiske krav.",
      notMeasures: "Generel risikobevidsthed.",
      whenSuitable:
        "Regulerede, sikkerhedskritiske eller datatunge virksomheder med et separat formelt kontrolansvar.",
      whenNotSuitable:
        "Vælg kun hvis ansvaret er adskilt fra Risiko og konsekvens.",
      controlQuestion:
        "Har rollens formelle kontrolansvar betydning i sig selv, adskilt fra den generelle risiko og konsekvens, den også bærer?",
      assessmentQuestion:
        "Hvilket niveau af informations-, sikkerheds- eller regelefterlevelsesansvar bærer rollen normalt og varigt?",
      anchor1:
        "Rollen følger etablerede kontrolrutiner inden for et tydeligt afgrænset område, uden selvstændigt kontrolansvar.",
      anchor3:
        "Rollen har selvstændigt etableret, formelt ansvar for beskyttelse, kvalitetssikring eller efterlevelseskontrol inden for sit eget område.",
      anchor5:
        "Rollen bærer meget avanceret eller forretningskritisk kontrolansvar, og hvordan den anvender kritiske krav, sætter ofte standarden for efterlevelse uden for eget område.",
    },
    "safety-exposure": {
      name: "Sikkerheds- og eksponeringsforhold",
      shortUiText:
        "Rollens varige krav om at arbejde i et risikomiljø under beskyttelsesforanstaltninger.",
      fullDefinition:
        "Fanger det varige risikomiljø, rollen arbejder i, og kravet om at arbejde under beskyttelsesforanstaltninger, hvilket omfatter faktisk fysisk, kemisk, biologisk eller miljømæssig eksponering. Kriteriet måler selve arbejdsforholdet, ikke konsekvensen for virksomheden, hvis noget går galt.",
      measures:
        "Varigt risikomiljø og krav om arbejde under beskyttelsesforanstaltninger.",
      notMeasures: "Konsekvens for virksomheden af en fejl.",
      whenSuitable:
        "Roller med faktisk fysisk, kemisk, biologisk, miljømæssig eller anden eksponering.",
      whenNotSuitable:
        "Vælg ikke samtidig med et bredere arbejdsforholdskriterium, der dækker samme eksponering.",
      controlQuestion:
        "Har rollens eksponering for et varigt risikomiljø betydning i sig selv, ud over hvad kriteriet fysisk eller sensorisk anstrengelse allerede fanger?",
      assessmentQuestion:
        "Hvilket niveau af sikkerhed og eksponering arbejder rollen normalt og varigt under?",
      anchor1:
        "Rollen udsættes enkeltvis for et tydeligt afgrænset sikkerheds- eller eksponeringsforhold på lavt niveau med standardiserede beskyttelsesforanstaltninger.",
      anchor3:
        "Rollen arbejder under et etableret, tilbagevendende risikomiljø, der kræver konsekvent brug af beskyttelsesforanstaltninger som en normal del af arbejdet.",
      anchor5:
        "Rollen arbejder under meget krævende eller forretningskritiske eksponeringsforhold, hvor den beskyttelsesstandard, den følger eller sætter, ofte rækker ud over eget nærmeste team.",
    },
    "on-call": {
      name: "Rådigheds-, beredskabs- og tilgængelighedskrav",
      shortUiText:
        "Rollens tilbagevendende krav om at være tilgængelig uden for ordinær arbejdstid eller at reagere øjeblikkeligt.",
      fullDefinition:
        "Fanger rollens tilbagevendende krav om at være tilgængelig uden for ordinær arbejdstid, eller at reagere øjeblikkeligt, som en integreret forudsætning for rollen. Kriteriet måler et væsentligt, tilbagevendende rådighedskrav, ikke midlertidig overarbejde, frivillig fleksibilitet eller en generelt høj arbejdsmængde.",
      measures:
        "Tilbagevendende krav om tilgængelighed uden for ordinær arbejdstid eller øjeblikkelig indsats.",
      notMeasures:
        "Midlertidigt overarbejde, frivillig fleksibilitet eller høj arbejdsmængde.",
      whenSuitable:
        "Drift, IT, sundhed, sikkerhed og andre roller, hvor rådighed er en integreret forudsætning for rollen.",
      whenNotSuitable:
        "Bør kun være et selvstændigt kriterium, når rådighed er væsentlig og tilbagevendende.",
      controlQuestion:
        "Har rollens tilbagevendende rådighedskrav betydning i sig selv, ud over midlertidigt overarbejde eller en generelt høj arbejdsmængde?",
      assessmentQuestion:
        "Hvilket niveau af rådighed, beredskab og tilgængelighed bærer rollen normalt og varigt?",
      anchor1:
        "Rollen dækker enkeltvis et tydeligt afgrænset rådighedskrav med lav frekvens.",
      anchor3:
        "Rollen bærer et etableret, tilbagevendende rådigheds- eller tilgængelighedskrav uden for ordinær arbejdstid som en normal del af rollen.",
      anchor5:
        "Rollen bærer et meget krævende eller forretningskritisk rådighedskrav med hyppig eller øjeblikkelig indsatspligt, som andre rollers tilgængelighed ofte bygges omkring.",
    },
    "irregularity-mobility": {
      name: "Uregelmæssighed, mobilitet og stedbundethed",
      shortUiText:
        "Rollens varige krav om uregelmæssige tider, omfattende rejseaktivitet eller arbejde på bestemte steder.",
      fullDefinition:
        "Fanger rollens varige krav om uregelmæssig arbejdstid, omfattende rejseaktivitet eller arbejde knyttet til bestemte steder, for eksempel felt-, skifte- eller internationalt arbejde. Kriteriet måler et stabilt, strukturelt forhold ved rollen, ikke enkeltstående rejser, personlige ønsker eller et midlertidigt projekt.",
      measures:
        "Varige krav om uregelmæssige tider, omfattende rejseaktivitet eller arbejde på bestemte steder.",
      notMeasures:
        "Enkeltstående rejser, personlige ønsker eller midlertidige projekter.",
      whenSuitable:
        "Feltroller, international virksomhed, skifteholdsarbejde eller høj rejsefrekvens.",
      whenNotSuitable:
        "Kan lægges sammen med Rådighed/beredskab kun når begge indgår i samme stabile arbejdsvilkår.",
      controlQuestion:
        "Har rollens varige krav om uregelmæssighed eller mobilitet betydning i sig selv, ud over enkeltstående rejser eller et midlertidigt projekt?",
      assessmentQuestion:
        "Hvilket niveau af uregelmæssighed, mobilitet eller stedbundethed bærer rollen normalt og varigt?",
      anchor1:
        "Rollen bærer et tilbagevendende, men begrænset krav om uregelmæssige tider, rejseaktivitet eller stedbundet arbejde, for eksempel et regelmæssigt, men sjældent forekommende mønster, der er en varig del af rollen.",
      anchor3:
        "Rollen bærer et etableret, tilbagevendende mønster af uregelmæssige tider, rejseaktivitet eller stedbundet arbejde som en normal og stabil del af rollen.",
      anchor5:
        "Rollen bærer meget omfattende eller forretningskritisk uregelmæssighed, mobilitet eller stedbundethed, for eksempel varige internationale forpligtelser, skifteholds- eller feltforpligtelser, der former, hvordan rollen kan bemandes.",
    },
    "restricted-environments": {
      name: "Særlige sikkerheds-, fortroligheds- eller kontrolmiljøer",
      shortUiText:
        "Rollens krav om at arbejde under særlige adgangs-, kontrol- eller sikkerhedsrestriktioner.",
      fullDefinition:
        "Fanger arbejdsforholdet ved at operere under særlige adgangs-, kontrol- eller sikkerhedsrestriktioner, for eksempel et sikkerhedsgodkendt eller fortrolighedsfølsomt miljø. Kriteriet måler restriktionen, rollen arbejder under, ikke ansvaret for informationssikkerhed i sig selv.",
      measures:
        "Arbejdsforholdet ved at arbejde under særlige adgangs-, kontrol- eller sikkerhedsrestriktioner.",
      notMeasures: "Ansvar for informationssikkerhed.",
      whenSuitable:
        "Sikkerhedsgodkendte, fortrolighedsfølsomme eller strengt kontrollerede miljøer med faktiske begrænsninger.",
      whenNotSuitable:
        "Brug kun når det er arbejdsmiljøet/forudsætningen, ikke kontrolansvaret, der måles.",
      controlQuestion:
        "Har rollens krav om at arbejde under særlige adgangs- eller sikkerhedsrestriktioner betydning i sig selv, adskilt fra det formelle kontrolansvar, den også kan bære?",
      assessmentQuestion:
        "Hvilket niveau af sikkerheds-, fortroligheds- eller kontrolrestriktion arbejder rollen normalt og varigt under?",
      anchor1:
        "Rollen arbejder enkeltvis under en tydeligt afgrænset adgangs- eller fortrolighedsrestriktion på lavt niveau.",
      anchor3:
        "Rollen arbejder under et etableret, tilbagevendende sæt adgangs-, kontrol- eller sikkerhedsrestriktioner som en normal del af rollen.",
      anchor5:
        "Rollen arbejder under meget strenge eller forretningskritiske sikkerheds-, fortroligheds- eller kontrolrestriktioner, der former, hvordan rollen og dens omgivelser skal drives.",
    },
  },
}
