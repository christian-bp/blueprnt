import type { CriteriaLibraryContent } from "./criteriaLibrary.content.en"

// Danish content for the criteria library (the masterdokument's sections
// 5-13.5). Machine-translated from criteriaLibraryContentSv (the substance
// source), cross-checked against criteriaLibraryContentEn where a Swedish
// phrase was ambiguous. Structure mirrors en/sv exactly: only the three
// section 13.5 entries (scope-impact, complexity-ambiguity,
// risk-consequence) carry anchor2/anchor4. Reviewed against en and sv for
// terminology, register and false friends; "væsentlig" is the Danish term
// for material in the materiality sense, never "materiel".
export const criteriaLibraryContentDa: CriteriaLibraryContent = {
  modelName: "Rollevurderingsmodel",
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
      name: "Ansvar og påvirkning",
      question:
        "Hvilken rækkevidde, hvilket mandat og hvilke konsekvenser har rollen?",
      why: "Fanger ansvar for beslutninger, resultater, risiko, mennesker, kvalitet og forretning.",
    },
    workingConditions: {
      name: "Arbejdsforhold",
      question:
        "Findes der særlige, objektive og varige arbejdsforhold, som påvirker kravene?",
      why: "Synliggør for eksempel rådighed, eksponering, sikkerhedskrav og uregelmæssige forhold.",
    },
  },
  workingConditionsTest: {
    question:
      "Findes der mindst én rollefamilie, hvor særlige arbejdsforhold er en tilbagevendende, objektiv og væsentlig del af rollens krav, og hvor kravet ikke allerede fanges korrekt af et andet kriterium?",
    notMaterialLabel: "Testet, men ikke væsentligt relevant",
  },
  sharedScale: {
    "1": {
      name: "Afgrænset krav",
      meaning:
        "Kravet er tydeligt defineret, lokalt eller begrænset i omfang. Etablerede rammer og arbejdsmåder rækker normalt.",
    },
    "2": {
      name: "Grundlæggende til moderat krav",
      meaning:
        "Kravet er tilbagevendende inden for et tydeligt afgrænset område. Variationer og enklere afvigelser skal håndteres.",
    },
    "3": {
      name: "Selvstændigt og etableret krav",
      meaning:
        "Kravet er en tydelig og tilbagevendende del af området. Faglige vurderinger foretages inden for etablerede rammer.",
    },
    "4": {
      name: "Avanceret eller bredt krav",
      meaning:
        "Kravet er avanceret, har bredere rækkevidde eller kræver selvstændige afvejninger, hvor etablerede arbejdsmåder ikke altid rækker.",
    },
    "5": {
      name: "Meget avanceret, omfattende eller forretningskritisk krav",
      meaning:
        "Kravet har meget stort omfang, sværhedsgrad, konsekvens eller strategisk betydning. Det kan påvirke retning, standarder, løsninger eller resultater også uden for det nærmeste område.",
    },
  },
  midpoints: {
    step2: "Et gennemtænkt mellemniveau mellem trin 1 og 3.",
    step4: "Et gennemtænkt mellemniveau mellem trin 3 og 5.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Vidensdybde og specialistniveau",
      shortUiText: "Dyb specialistviden inden for et afgrænset fagområde.",
      fullDefinition:
        "Omfatter dyb faglig viden, specialistmetoder og relevant erfaring inden for ét hovedområde. Kriteriet vedrører, hvor avanceret viden skal være for at håndtere vanskelige spørgsmål inden for området. Det vedrører ikke videnbredde, formelle autorisationer, virksomhedskontekst eller rådgivning som selvstændigt område.",
      measures:
        "Dyb faglig viden, specialistmetoder, relevant og varig erfaring inden for ét område.",
      notMeasures:
        "Antallet af vidensområder, formel eksamen eller certificering i sig selv, viden om en bestemt branche eller organisation i sig selv, beslutningsmandat eller individuel præstation.",
      whenSuitable:
        "Vælg, når dyb specialistviden inden for et fagområde skal have særlig betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for uddannelseskrav, bredt samarbejde mellem flere fagområder eller rådgivning. Vurder i stedet, om et af de nærliggende kriterier bedre fanger det, virksomheden vil prioritere.",
      controlQuestion:
        "Er dyb specialistviden et område, I vil lægge særlig vægt på i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af specialistvidensdybde kræver rollen normalt og varigt?",
      anchor1:
        "Etableret og veldokumenteret faglig viden inden for et tydeligt afgrænset område. Kendte metoder rækker til velkendte spørgsmål.",
      anchor3:
        "Uddybet specialistviden og etableret faglig metodik anvendes selvstændigt til tilbagevendende og mere krævende spørgsmål inden for området.",
      anchor5:
        "Meget dyb specialistviden anvendes til feltets sværeste spørgsmål. Viden bidrager til at udvikle metoder, kvalitetsniveauer eller faglig praksis.",
    },
    "knowledge-breadth": {
      name: "Videnbredde og tværfaglig forståelse",
      shortUiText:
        "Evne til at forbinde flere vidensområder og forstå sammenhængene mellem dem.",
      fullDefinition:
        "Omfatter behovet for at kombinere viden fra flere forskellige områder, for eksempel forretning, teknologi, data, produkt og drift. Kriteriet vedrører forståelse for sammenhænge og afvejninger mellem områderne. Det vedrører ikke dybden i et enkelt fagområde eller antallet af kontakter og samarbejdspartnere.",
      measures:
        "Bredde af vidensområder, forståelse for sammenhænge mellem områder, evne til at foretage afvejninger mellem forskellige perspektiver.",
      notMeasures:
        "Dyb specialistviden inden for ét område, antal møder, interessenter eller kontaktflader, organisatorisk rækkevidde.",
      whenSuitable:
        "Vælg, når helhedssyn og evnen til at forene flere vidensområder skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for mange kontaktflader. Handler det først og fremmest om dyb faglig viden inden for ét område, rammer 7.1 bedre.",
      controlQuestion:
        "Er evnen til at forene flere vidensområder central for, hvordan virksomheden skaber værdi?",
      assessmentQuestion:
        "Hvilken grad af tværfaglig bredde kræver rollen normalt og varigt?",
      anchor1:
        "Ét hovedvidensområde anvendes. Koblinger til andre områder er sjældent nødvendige.",
      anchor3:
        "Nogle få etablerede vidensområder kombineres selvstændigt, med forståelse for hvordan de påvirker hinanden.",
      anchor5:
        "Mange forskellige vidensområder forbindes på en måde, der påvirker, hvordan større løsninger, tilbud eller arbejdsmåder udformes.",
    },
    "formal-qualifications": {
      name: "Formelle kvalifikations-, autorisations- og certificeringskrav",
      shortUiText:
        "Obligatorisk autorisation, godkendelse eller certificering.",
      fullDefinition:
        "Omfatter formelle krav, der skal være opfyldt for at måtte udføre, godkende, underskrive eller have ansvar for en bestemt type virksomhed. Eksempler er autorisation, lovpligtig godkendelse og obligatorisk certificering. Kriteriet vedrører obligatoriske krav, ikke uddannelser, kurser eller eksamener, der er meriterende, men ikke nødvendige.",
      measures:
        "Obligatorisk autorisation, lovpligtig eller virksomhedsstyret godkendelse, obligatorisk certificering.",
      notMeasures:
        "Generelt uddannelsesniveau, frivillige kurser, prestigefyldt eksamen uden krav om godkendelse.",
      whenSuitable:
        "Vælg, når obligatoriske autorisationer, godkendelser eller certificeringer skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke, når uddannelse først og fremmest er en vej til viden, som 7.1 Vidensdybde og specialistniveau allerede fanger.",
      controlQuestion:
        "Skal obligatoriske autorisationer, godkendelser eller certificeringer slå igennem i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af formel kvalifikation, autorisation eller certificering kræver rollen normalt og varigt?",
      anchor1:
        "Intet obligatorisk krav, eller et grundlæggende og tydeligt afgrænset krav med begrænset fornyelse eller omfang.",
      anchor3:
        "Etableret erhvervsautorisation eller certificering, som er et tilbagevendende og selvstændigt vilkår for at udøve et område.",
      anchor5:
        "Avanceret eller forretningskritisk godkendelse, som kræves for at godkende, underskrive eller have ansvar for virksomhed med meget store konsekvenser.",
    },
    "domain-knowledge": {
      name: "Domæne- og virksomhedsviden",
      shortUiText:
        "Dyb viden om branche, produkt, kundemiljø eller virksomhedskontekst.",
      fullDefinition:
        "Omfatter viden om den sammenhæng, virksomheden drives i, for eksempel branche, produkt, kundemiljø, forretningsmodel eller regelsæt. Kriteriet vedrører kontekstspecifik viden, som ikke hurtigt erstattes af almen faglig viden. Det vedrører ikke almindeligt organisationskendskab, der opbygges gennem introduktion og erfaring over tid.",
      measures:
        "Branchekendskab, produkt- og kundekendskab, viden om forretningsmodel eller regelsætskontekst.",
      notMeasures:
        "Almen faglig dygtighed, almindeligt organisationskendskab, formel godkendelse.",
      whenSuitable:
        "Vælg, når specifik viden om virksomhedens sammenhæng skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke, når generel faglig viden og almindelig introduktion rækker til at forstå virksomhedens sammenhæng.",
      controlQuestion:
        "Vil I veje ind, hvor meget virksomheds- og branchekendskab der er brug for inden for forskellige områder?",
      assessmentQuestion:
        "Hvilken grad af domæne- og forretningsviden kræver rollen normalt og varigt?",
      anchor1:
        "Viden om en tydeligt afgrænset produkt-, proces- eller kundekontekst.",
      anchor3:
        "Etableret og selvstændig viden om virksomhedens sammenhæng, som ikke hurtigt erstattes af almen faglig viden.",
      anchor5:
        "Meget dyb og svært erstattelig viden om branche, marked, kunder eller regelsæt, som påvirker vigtige valg og arbejdsmåder.",
    },
    "advisory-judgment": {
      name: "Rådgivnings- og vurderingskompetence",
      shortUiText:
        "Kvalificeret rådgivning og faglig vurdering som grundlag for andres beslutninger.",
      fullDefinition:
        "Omfatter kvalificeret rådgivning som en tilbagevendende del af virksomhedens tilbud eller som afgørende beslutningsstøtte til kunder, partnere eller interne beslutningstagere. Det indebærer at afveje fakta, vurdere usikkert eller modstridende grundlag og formulere råd eller anbefalinger, som andre bruger i deres valg. Kriteriet vedrører kvaliteten i rådgivningen og vurderingen. Det vedrører ikke den formelle ret til at træffe den endelige beslutning.",
      measures:
        "Kvalificeret vurdering af grundlag, rådgivning og anbefalinger, faglig vurdering i spørgsmål med afvejninger.",
      notMeasures:
        "Formelt beslutningsmandat, at dele generel information, specialistviden i sig selv.",
      whenSuitable:
        "Vælg, når kvalificeret rådgivning og faglig vurdering skal have særlig betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for videndeling eller rutinemæssige svar. Rådgivningen skal have tydelig betydning for valg eller beslutninger.",
      controlQuestion:
        "Er kvalificeret rådgivning og faglig vurdering noget, I vil give vægt i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af rådgivnings- og vurderingskompetence kræver rollen normalt og varigt?",
      anchor1:
        "Grundlag eller ukomplicerede råd inden for et tydeligt afgrænset område, med støtte i etableret vejledning.",
      anchor3:
        "Selvstændige og etablerede faglige råd inden for et område, baseret på afvejning af relevant information.",
      anchor5:
        "Råd og vurderinger i meget avancerede eller følsomme spørgsmål, som har stor betydning for virksomhedens valg eller håndtering af risici.",
    },
    "complexity-ambiguity": {
      name: "Kompleksitet og uklarhed",
      shortUiText:
        "Sværhedsgrad, usikkerhed og uklarhed i de spørgsmål, der skal håndteres.",
      fullDefinition:
        "Omfatter graden af usikkerhed, modstridende krav, uklare mål og mangel på færdige løsninger. Kriteriet vedrører selve problemernes karakter. Det vedrører ikke mængden af analyse, der lægges i at håndtere dem, arbejdstempo eller organisatorisk rækkevidde.",
      measures:
        "Uklare rammer og mål, modstridende krav og afvejninger, usikkerhed og komplekse afhængigheder.",
      notMeasures:
        "Omfanget af analysearbejde, høj arbejdsmængde eller tempo, specialistviden i sig selv.",
      whenSuitable:
        "Vælg, når håndtering af vanskelige, uklare eller mangesidede spørgsmål skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for omfattende analyse eller mange samtidige opgaver. Disse fanges af henholdsvis 8.2 og 8.4, hvis de vælges.",
      controlQuestion:
        "Vil I tage hensyn til graden af uklarhed og sværhedsgrad i de spørgsmål, virksomheden skal håndtere?",
      assessmentQuestion:
        "Hvilken grad af kompleksitet og uklarhed håndterer rollen normalt og varigt?",
      anchor1:
        "Tydeligt definerede spørgsmål, etablerede metoder og forudsigelige situationer.",
      anchor2:
        "Tilbagevendende variationer og enklere afvigelser håndteres gennem valg mellem kendte alternativer.",
      anchor3:
        "Komplekse spørgsmål inden for etablerede rammer, hvor analyse, prioritering og tilpasning er nødvendig.",
      anchor4:
        "Avancerede, tværfunktionelle eller delvist uklare problemer håndteres, hvor etablerede løsninger ikke altid slår til.",
      anchor5:
        "Meget komplekse eller strategisk betydningsfulde spørgsmål med høj usikkerhed, hvor nye tilgange eller langsigtede løsninger skal udformes.",
    },
    "analytical-effort": {
      name: "Analytisk og problemløsende indsats",
      shortUiText:
        "Omfanget af systematisk analyse, fejlfinding og problemløsning.",
      fullDefinition:
        "Omfatter systematisk analyse, fejlfinding, modellering, diagnostik, test og beregning, som er nødvendig for at nå frem til løsninger. Kriteriet vedrører den analytiske indsats. Det vedrører ikke blot, at problemet er uklart, eller hvilken specialistviden der ligger bag analysen.",
      measures:
        "Systematisk analyse, fejlfinding og diagnostik, modellering, test og beregning.",
      notMeasures:
        "Uklarhed i selve problemet, specialistviden i sig selv, midlertidig høj arbejdsmængde.",
      whenSuitable:
        "Vælg, når systematisk analyse- og problemløsningsarbejde skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for uklare spørgsmål. Der skal være et tilbagevendende og tydeligt element af analyse, fejlfinding eller diagnostik.",
      controlQuestion:
        "Skal omfanget af systematisk analyse- og problemløsningsarbejde have betydning i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af analytisk og problemløsende indsats bærer rollen normalt og varigt?",
      anchor1:
        "Ukompliceret analyse eller fejlfinding i et tydeligt afgrænset spørgsmål efter etablerede trin.",
      anchor3:
        "Selvstændig og etableret analyse, diagnostik eller systematisk problemløsning inden for et område.",
      anchor5:
        "Meget avanceret eller omfattende analyse, modellering eller diagnostik med stor betydning for virksomhedens evne til at løse kritiske eller tilbagevendende problemer.",
    },
    "communication-effort": {
      name: "Kommunikations- og relationskrævende arbejde",
      shortUiText:
        "Krav om kvalificeret kommunikation, forhandling og håndtering af modstridende interesser.",
      fullDefinition:
        "Omfatter sværhedsgraden i kommunikation, forhandling, påvirkning, konflikthåndtering og oversættelse mellem forskellige behov og interesser. Kriteriet vedrører den kommunikative og relationelle indsats. Det vedrører ikke antallet af kontakter, organisatorisk rækkevidde eller forretningsansvar.",
      measures:
        "Forhandling og påvirkning, håndtering af vanskelige samtaler og konflikter, oversættelse mellem forskellige behov og interesser.",
      notMeasures:
        "Antal kontakter eller møder, kunde- eller indtægtsansvar, organisatorisk rækkevidde.",
      whenSuitable:
        "Vælg, når kvalificeret kommunikation, forhandling og håndtering af modstridende interesser skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for mange møder eller kundekontakter. Sværhedsgraden i kommunikationen skal være det, der prioriteres.",
      controlQuestion:
        "Skal kvalificeret kommunikation, forhandling og håndtering af modstridende interesser have betydning i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af kommunikations- og relationsindsats bærer rollen normalt og varigt?",
      anchor1:
        "Tydeligt afgrænset og hovedsagelig rutinemæssig kommunikation med etablerede modparter.",
      anchor3:
        "Selvstændig og tilbagevendende kommunikation, forhandling eller konflikthåndtering inden for etablerede rammer.",
      anchor5:
        "Meget avanceret eller følsom kommunikation, forhandling eller konflikthåndtering, hvor udfaldet har stor betydning for virksomhedens relationer eller valg.",
    },
    "operational-intensity": {
      name: "Operativ intensitet og samtidighedskrav",
      shortUiText:
        "Krav om at håndtere flere samtidige strømme og prioritere løbende.",
      fullDefinition:
        "Omfatter krav til opmærksomhed, evnen til at håndtere flere ting på én gang og løbende prioritering mellem flere strømme i normalsituationen. Eksempler kan være kundesager, alarmer, leverancer eller driftsstrømme. Kriteriet vedrører et stabilt og strukturelt krav, ikke midlertidige spidsbelastninger, ressourcemangel eller mangelfuld planlægning.",
      measures:
        "Flere samtidige strømme, løbende prioritering, opmærksomhed under tidspres i normalsituationen.",
      notMeasures:
        "Midlertidig høj arbejdsbelastning, underbemanding, kompleksitet i selve sagen.",
      whenSuitable:
        "Vælg, når håndtering og prioritering af flere samtidige strømme skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke for at kompensere for midlertidige arbejdsspidser eller ressourcemangel. Kravet skal være en varig del af virksomhedens arbejdsmåde.",
      controlQuestion:
        "Vil I veje krav om at håndtere flere samtidige strømme og prioritere løbende ind?",
      assessmentQuestion:
        "Hvilken grad af operationel intensitet og samtidighedskrav bærer rollen normalt og varigt?",
      anchor1:
        "Én strøm eller én opgave ad gangen inden for en tydeligt afgrænset rytme.",
      anchor3:
        "Flere etablerede og samtidige strømme håndteres selvstændigt med løbende prioritering.",
      anchor5:
        "Meget høj operativ intensitet på tværs af mange samtidige strømme, hvor forkert prioritering hurtigt kan få store følger for virksomheden.",
    },
    "physical-sensory": {
      name: "Fysisk eller sensorisk anstrengelse",
      shortUiText:
        "Tilbagevendende fysisk belastning, præcision eller krav om vedvarende sansekoncentration.",
      fullDefinition:
        "Omfatter fysisk belastning, ergonomisk krævende momenter, præcision og koncentration med syn, hørelse eller andre sanser. Kriteriet vedrører krav til krop og opmærksomhed. Det vedrører ikke risikomiljøer, eksponering for farlige stoffer eller konsekvensen for virksomheden, hvis noget går galt.",
      measures:
        "Fysisk og ergonomisk belastning, præcisionskrav, vedvarende koncentration med sanserne.",
      notMeasures:
        "Risikomiljø eller eksponering, almindelig stress, konsekvenser af fejl.",
      whenSuitable:
        "Vælg, når fysisk belastning, præcision eller sensorisk koncentration skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for risiko i arbejdsmiljøet. Er eksponering og beskyttelsesforanstaltninger det centrale, passer 10.1 bedre.",
      controlQuestion:
        "Skal tilbagevendende fysisk belastning, præcision eller vedvarende koncentration have betydning i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af fysisk eller sensorisk anstrengelse bærer rollen normalt og varigt?",
      anchor1:
        "Lette og enkeltstående fysiske eller sensoriske krav inden for en tydeligt afgrænset opgave.",
      anchor3:
        "Tilbagevendende fysisk belastning, præcisionsmomenter eller sensorisk koncentration som en etableret del af området.",
      anchor5:
        "Meget krævende og vedvarende fysisk eller sensorisk anstrengelse, hvor præcision og konsekvent udførelse er afgørende.",
    },
    "scope-impact": {
      name: "Omfang og påvirkning",
      shortUiText: "Rækkevidden af resultater og påvirkning i virksomheden.",
      fullDefinition:
        "Omfatter hvor langt resultater, valg og leverancer slår igennem i virksomheden: fra et tydeligt afgrænset område til teams, funktioner, flere dele af virksomheden eller hele virksomheden. Kriteriet vedrører, hvor effekten mærkes. Det vedrører ikke formel beslutningsret, personaleansvar eller budgetstørrelse i sig selv.",
      measures:
        "Rækkevidde for resultater og påvirkning, omfanget af berørte dele af virksomheden, varige følger for virksomhedens leverance eller retning.",
      notMeasures:
        "Formelt personaleansvar, beslutningsmandat, ressource- eller budgetansvar i sig selv.",
      whenSuitable:
        "Vælg, når rækkevidden af resultater og påvirkning skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for titel, ledelsesniveau, budgetstørrelse eller beslutningsret. Vurder, om et af de separate ansvarskriterier bedre fanger det, der skal prioriteres.",
      controlQuestion:
        "Er det relevant for jer at veje ind, hvor langt resultater og påvirkning når i virksomheden?",
      assessmentQuestion:
        "Hvor langt rækker rollens normale og varige indflydelse?",
      anchor1:
        "Resultater og påvirkning er hovedsagelig begrænset til et tydeligt afgrænset område eller en enkelt leverance.",
      anchor2:
        "Påvirkningen når et afgrænset arbejdsområde eller en tilbagevendende leverance inden for et team.",
      anchor3:
        "Resultater og påvirkning når et tydeligt område og påvirker leverancer eller prioriteringer i nærliggende dele af virksomheden.",
      anchor4:
        "Påvirkningen når flere teams, en funktion eller en væsentlig del af virksomheden gennem valg, prioriteringer eller løsninger med varige følger.",
      anchor5:
        "Resultater og påvirkning når flere dele af virksomheden eller virksomhedsniveau og har betydning for overordnet retning, resultat eller evne til at lykkes.",
    },
    "autonomy-mandate": {
      name: "Autonomi og beslutningsmandat",
      shortUiText:
        "Selvstændighed og mandat til at foretage afvejninger og træffe beslutninger.",
      fullDefinition:
        "Omfatter mandatet til selvstændigt at foretage afvejninger og træffe beslutninger inden for et defineret område. Kriteriet vedrører det råderum, der er til at vælge retning, prioritere mellem alternativer og beslutte egnede løsninger inden for området. Det vedrører ikke, hvor langt beslutningens effekt når, hvor store følger en fejl kan få, eller hvilken type ansvar beslutningen angår.",
      measures:
        "Mandat til at træffe selvstændige beslutninger, råderum til at vælge mellem relevante alternativer, mandat til at prioritere og foretage afvejninger, grad af selvstændighed inden for et defineret område.",
      notMeasures:
        "Rækkevidden af resultater eller påvirkning, konsekvensen af forkerte beslutninger, personale-, ressource- eller kundeansvar i sig selv, virksomhedens interne godkendelsesprocesser eller former for samråd.",
      whenSuitable:
        "Vælg, når selvstændigt beslutningsmandat skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke for at beskrive, hvor langt beslutningens effekt når, hvilke følger en fejl kan få, eller hvilken type ansvar beslutningen angår. Det fanges af andre ansvarskriterier, hvis de vælges.",
      controlQuestion:
        "Skal graden af selvstændigt beslutningsmandat have betydning i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af autonomi og beslutningsmandat har rollen normalt og varigt?",
      anchor1:
        "Begrænset mandat til at vælge mellem tydeligt angivne alternativer inden for etablerede instrukser.",
      anchor3:
        "Selvstændigt mandat til at foretage etablerede afvejninger, prioritere mellem alternativer og træffe beslutninger inden for et defineret område.",
      anchor5:
        "Meget bredt mandat til at foretage afvejninger og træffe beslutninger, som sætter retning, principper eller prioriteringer for flere dele af virksomheden.",
    },
    "risk-consequence": {
      name: "Risiko og konsekvens",
      shortUiText:
        "Alvoret i mulige følger af fejl, mangler eller forkerte beslutninger.",
      fullDefinition:
        "Omfatter hvilke følger fejl, mangler eller forkerte beslutninger kan få for eksempelvis kunder, kvalitet, økonomi, sikkerhed, information, efterlevelse og tillid. Kriteriet vedrører følgen, hvis noget går galt. Det vedrører ikke, hvem der har det formelle ansvar for at kontrollere, at regler eller beskyttelse fungerer.",
      measures:
        "Konsekvenser for kunde, kvalitet og leverance, konsekvenser for sikkerhed, information og efterlevelse, økonomiske og omdømmemæssige følger.",
      notMeasures:
        "Individets oplevede stress, budgetstørrelse i sig selv, formelt kontrolansvar.",
      whenSuitable:
        "Vælg, når forskelle i mulige følger af fejl og mangler skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke for at beskrive, hvor presset eller krævende noget opleves. Vurder den saglige og mulige følge, hvis noget går galt.",
      controlQuestion:
        "Er forskelle i de følger, fejl eller mangler kan få, relevante at veje ind i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af risiko og konsekvens bærer rollens beslutninger og arbejde normalt og varigt?",
      anchor1:
        "Fejl eller mangler har normalt begrænsede og let korrigerbare følger inden for et afgrænset område.",
      anchor2:
        "Fejl eller mangler kan påvirke teamets kvalitet, effektivitet eller leverance og kræver normalt korrigering inden for etablerede processer.",
      anchor3:
        "Fejl, mangler eller forkerte beslutninger kan få tydelige følger for kunde, leverance, kvalitet, økonomi eller efterlevelse inden for et område.",
      anchor4:
        "Fejl, beslutninger eller mangler kan få betydelige følger for flere dele af virksomheden, vigtige kunder, kritiske processer eller regelefterlevelse.",
      anchor5:
        "Fejl eller mangler kan få meget store, langvarige eller forretningskritiske følger for sikkerhed, efterlevelse, tillid, økonomi eller virksomhedens fortsatte evne til at fungere.",
    },
    "people-leadership": {
      name: "Ledelses- og personaleansvar",
      shortUiText:
        "Ansvar for at lede mennesker, koordinere virksomhed og skabe resultater gennem andre.",
      fullDefinition:
        "Omfatter ansvar for at lede og koordinere mennesker eller dele af virksomheden for at skabe resultater gennem andre. Det kan indebære ansvar for prioriteringer, arbejdsfordeling, retning, udvikling af arbejdsmåder eller koordinering af leverance. Formelt personaleansvar indgår, når ansvaret også omfatter medarbejdernes mål, udvikling, præstation og arbejdsmiljø. Kriteriet vedrører ledelsesansvar gennem andre, ikke blot specialistindflydelse, projektkoordinering eller et stort eget beslutningsmandat.",
      measures:
        "Ansvar for at lede og koordinere arbejde gennem andre, ansvar for retning, prioriteringer og leverance i en del af virksomheden, ansvar for at udvikle arbejdsmåder eller kapacitet gennem andre, formelt ansvar for medarbejdernes mål, udvikling og præstation.",
      notMeasures:
        "Specialistindflydelse uden ansvar for andres arbejde eller for en del af virksomheden, midlertidig koordinering af enkeltopgaver, projektledelse uden varigt ansvar for mennesker eller en del af virksomheden, eget beslutningsmandat uden ansvar for at skabe resultater gennem andre.",
      whenSuitable:
        "Vælg, når ansvar for at lede mennesker eller dele af virksomheden gennem andre skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene fordi koordinering, specialiststøtte eller projektledelse forekommer. Der skal være et varigt ansvar for retning, prioriteringer, leverance eller udvikling gennem andre.",
      controlQuestion:
        "Skal ansvar for at lede mennesker eller dele af virksomheden gennem andre have betydning i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af personale- og ledelsesansvar bærer rollen normalt og varigt?",
      anchor1:
        "Begrænset ansvar for at koordinere andres arbejde inden for et tydeligt afgrænset område. Intet varigt ansvar for retning, leverance eller medarbejdernes udvikling.",
      anchor3:
        "Varigt ansvar for at lede og koordinere et team, et arbejdsflow eller en del af virksomheden gennem andre. Ansvaret omfatter prioriteringer, arbejdsfordeling og leverance. Formelt personaleansvar kan forekomme, men er ikke et krav på dette niveau.",
      anchor5:
        "Omfattende ansvar for at lede en større del af virksomheden eller flere teams gennem andre. Ansvaret omfatter retning, kapacitet, resultater og udvikling over tid. Formelt personaleansvar for andre ledere eller en større organisation indgår normalt på dette niveau.",
    },
    "resource-capacity": {
      name: "Ressource- og kapacitetsansvar",
      shortUiText:
        "Ansvar for at prioritere begrænsede ressourcer mellem virksomhedens behov.",
      fullDefinition:
        "Omfatter ansvar for at foretage afvejninger mellem konkurrerende behov, når ressourcerne er begrænsede. Ressourcer kan for eksempel være tid, budget, udstyr, lager, bemanding eller leveringskapacitet. Kriteriet vedrører de prioriteringer, der er nødvendige, for at ressourcer og kapacitet bruges der, hvor de gør mest gavn for virksomheden. Kriteriet vedrører ikke ledelse, udvikling eller koordinering af mennesker som sådan. Det vedrører heller ikke rutinemæssig budgetopfølgning, indkøb eller fordeling inden for små og forudbestemte rammer.",
      measures:
        "Prioritering mellem konkurrerende behov, fordeling af begrænsede ressourcer og kapacitet, afvejning mellem tilgængelige ressourcer, behov og leveringsevne.",
      notMeasures:
        "Ledelse eller udvikling af mennesker, rutinemæssig budgetopfølgning, indkøb inden for små faste rammer, forretningsresultat i sig selv.",
      whenSuitable:
        "Vælg, når ansvar for at prioritere begrænsede ressourcer mellem virksomhedens behov skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for budgetopfølgning, indkøb eller koordinering af mennesker. Der skal være et varigt ansvar for afvejninger mellem konkurrerende behov og begrænsede ressourcer.",
      controlQuestion:
        "Vil I lægge vægt på ansvar for at prioritere begrænsede ressourcer mellem forskellige behov i virksomheden?",
      assessmentQuestion:
        "Hvilken grad af ressource- og kapacitetsansvar bærer rollen normalt og varigt?",
      anchor1:
        "Prioritering inden for et lille og tydeligt afgrænset sæt af ressourcer, hvor effekten af valgene er begrænset og let at korrigere.",
      anchor3:
        "Selvstændig prioritering mellem etablerede behov og begrænsede ressourcer eller kapacitet inden for et område.",
      anchor5:
        "Prioritering mellem meget betydelige eller forretningskritiske behov og ressourcer, hvor afvejningerne påvirker flere dele af virksomhedens evne til at levere.",
    },
    "business-customer": {
      name: "Forretnings- og kundeansvar",
      shortUiText:
        "Ansvar for vigtige kunder, indtægter eller forretningsresultater.",
      fullDefinition:
        "Omfatter et varigt ansvar for at skabe, sikre eller udvikle forretningsværdi gennem for eksempel kunderelationer, indtægtsstrømme, aftaler, forretningsporteføljer eller markedsposition. Kriteriet vedrører ansvar, der indgår i virksomheden. Det vedrører ikke enkeltstående salgsresultater, provision eller dygtighed i en isoleret forhandling.",
      measures:
        "Ansvar for kunderelationer, ansvar for indtægter eller forretningsportefølje, ansvar for forretningsresultat eller markedsposition.",
      notMeasures:
        "Kundekontakt i sig selv, individuel salgspræstation, forhandlingsdygtighed i sig selv.",
      whenSuitable:
        "Vælg, når ansvar for kunder, indtægter eller forretningsresultater skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for kundekontakt eller salg. Der skal være et varigt ansvar for kundeværdi, indtægter eller forretningsresultater.",
      controlQuestion:
        "Er ansvar for kunder, indtægter eller forretningsresultater noget, I vil give særlig vægt i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af forretnings- og kundeansvar bærer rollen normalt og varigt?",
      anchor1:
        "Støtte til en etableret kunderelation eller forretningsaktivitet inden for en afgrænset konto eller et afgrænset område.",
      anchor3:
        "Selvstændigt og etableret ansvar for en kunderelation, indtægtsstrøm eller forretningsportefølje.",
      anchor5:
        "Ansvar for kunder, indtægter eller forretningsområder med stor betydning for virksomheden og påvirkning på markedsposition eller fremtidig forretning.",
    },
    "compliance-control": {
      name: "Informations-, sikkerheds- eller efterlevelsesansvar",
      shortUiText:
        "Formelt ansvar for kontrol, beskyttelse, kvalitetssikring eller efterlevelse af regler.",
      fullDefinition:
        "Omfatter formelt ansvar for at kontrollere, kvalitetssikre eller sikre, at vigtige krav følges, for eksempel inden for informationssikkerhed, kvalitet, sikkerhed eller regelsæt. Kriteriet vedrører ansvar for, at kravene anvendes korrekt. Det vedrører ikke den almindelige pligt til at følge regler eller være risikobevidst.",
      measures:
        "Kontrol- og kvalitetssikringsansvar, ansvar for beskyttelse af information eller sikkerhed, ansvar for korrekt anvendelse af krav og regelsæt.",
      notMeasures:
        "Almindelig risikobevidsthed, at følge rutiner, som en anden har ansvar for, konsekvensen hvis der opstår fejl.",
      whenSuitable:
        "Vælg, når formelt ansvar for kontrol, beskyttelse og efterlevelse skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke, når området kun omfatter at følge etablerede kontrolrutiner. Der skal være et tydeligt ansvar for, at kontroller og krav fungerer.",
      controlQuestion:
        "Skal formelt ansvar for kontrol, beskyttelse og efterlevelse vejes ind i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af informations-, sikkerheds- eller regelefterlevelsesansvar bærer rollen normalt og varigt?",
      anchor1:
        "Etablerede kontrolrutiner følges inden for et tydeligt afgrænset område, uden selvstændigt kontrolansvar.",
      anchor3:
        "Selvstændigt og formelt ansvar for beskyttelse, kvalitetssikring eller efterlevelseskontrol inden for et område.",
      anchor5:
        "Meget avanceret eller forretningskritisk kontrolansvar, hvor fortolkninger og arbejdsmåder styrer, hvordan vigtige krav følges i flere dele af virksomheden.",
    },
    "safety-exposure": {
      name: "Sikkerheds- og eksponeringsforhold",
      shortUiText:
        "Varig eksponering for fysiske, kemiske, biologiske eller miljømæssige risici.",
      fullDefinition:
        "Omfatter tilbagevendende arbejde i miljøer med faktisk fysisk, kemisk, biologisk eller miljømæssig eksponering og krav om beskyttelsesforanstaltninger. Eksempler er støj, farlige stoffer, smitte, højde, varme, kulde og farlige maskiner. Kriteriet vedrører arbejdsforholdet, ikke fysisk anstrengelse eller konsekvensen for virksomheden, hvis noget går galt.",
      measures:
        "Risikomiljø og faktisk eksponering, tilbagevendende behov for beskyttelsesforanstaltninger, særlige sikkerhedsforhold i miljøet.",
      notMeasures:
        "Fysisk eller sensorisk anstrengelse i sig selv, formelt sikkerhedsansvar, forretningsmæssig eller organisatorisk risiko.",
      whenSuitable:
        "Vælg, når særlige sikkerheds- og eksponeringsforhold skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for sikkerhedsansvar eller beslutningsrisiko. Det skal handle om faktisk og varig eksponering i virksomhedens miljøer.",
      controlQuestion:
        "Er arbejde under særlige sikkerheds- eller eksponeringsforhold noget, I vil tage hensyn til i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af sikkerhed og eksponering arbejder rollen normalt og varigt under?",
      anchor1:
        "Enkeltstående og lav eksponering under tydeligt afgrænsede forhold med standardiserede beskyttelsesforanstaltninger.",
      anchor3:
        "Tilbagevendende eksponering i et etableret risikomiljø, som kræver konsekvent brug af beskyttelsesforanstaltninger.",
      anchor5:
        "Meget krævende eller forretningskritiske eksponeringsforhold, hvor beskyttelse, sikkerhedsrutiner og korrekt adfærd er afgørende for sikker drift.",
    },
    "on-call": {
      name: "Vagt, beredskab og tilgængelighedskrav",
      shortUiText:
        "Tilbagevendende vagt, beredskab eller krav om hurtig tilgængelighed.",
      fullDefinition:
        "Omfatter tilbagevendende krav om at være tilgængelig eller kunne handle uden for almindelig arbejdstid, eller at kunne svare omgående under en vagt. Kriteriet vedrører planlagt eller forventet beredskab, som er en stabil del af virksomhedens forudsætninger. Det vedrører ikke enkeltstående overarbejde, frivillig fleksibilitet eller midlertidig høj arbejdsbelastning.",
      measures:
        "Vagt og beredskab, krav om hurtig tilgængelighed, tilbagevendende udkald uden for almindelig arbejdstid.",
      notMeasures:
        "Midlertidigt overarbejde, uformelle forventninger om at svare, generelt høj arbejdsmængde.",
      whenSuitable:
        "Vælg, når vagt, beredskab eller krav om hurtig tilgængelighed skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke, når tilgængelighed kun opstår ved enkeltstående kriser eller mangler en tydelig og tilbagevendende forankring i virksomheden.",
      controlQuestion:
        "Er tilbagevendende vagt, beredskab eller krav om hurtig tilgængelighed en arbejdsforudsætning, I vil tage hensyn til i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af rådighed, beredskab og tilgængelighed bærer rollen normalt og varigt?",
      anchor1:
        "Enkeltstående og tydeligt afgrænset beredskab med lav hyppighed.",
      anchor3:
        "Etableret og tilbagevendende beredskab eller tilgængelighed uden for almindelig arbejdstid.",
      anchor5:
        "Meget krævende beredskab med hyppig eller omgående udrykningspligt, hvor virksomheden er stærkt afhængig af hurtig tilgængelighed.",
    },
    "irregularity-mobility": {
      name: "Uregelmæssighed, mobilitet og stedbundethed",
      shortUiText:
        "Varige krav om uregelmæssige tider, rejser eller arbejde på bestemte steder.",
      fullDefinition:
        "Omfatter varige krav om uregelmæssig arbejdstid, omfattende rejseaktivitet eller stedbundet arbejde, for eksempel feltarbejde, skifteholdsarbejde eller international tilstedeværelse. Kriteriet vedrører et stabilt og strukturelt forhold i virksomheden. Det vedrører ikke enkeltstående rejser, personlige ønsker eller midlertidige projekter.",
      measures:
        "Uregelmæssig arbejdstid, omfattende og tilbagevendende rejseaktivitet, felt-, skifteholds- eller stedbundet arbejde.",
      notMeasures:
        "Enkeltstående tjenesterejser, midlertidige projekter, vagt eller beredskab uden for arbejdstid.",
      whenSuitable:
        "Vælg, når uregelmæssige tider, mobilitet eller stedbundethed skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke, når kravet er midlertidigt eller forekommer sjældent uden at være en stabil del af virksomhedens forudsætninger.",
      controlQuestion:
        "Vil I veje varige krav om uregelmæssige tider, rejser eller stedbundet arbejde ind?",
      assessmentQuestion:
        "Hvilken grad af uregelmæssighed, mobilitet eller stedbundethed bærer rollen normalt og varigt?",
      anchor1:
        "Tilbagevendende, men begrænsede krav om uregelmæssige tider, rejser eller stedbundet arbejde.",
      anchor3:
        "Etableret og tilbagevendende mønster af uregelmæssige tider, rejser eller stedbundet arbejde.",
      anchor5:
        "Meget omfattende krav om skifteholdsarbejde, rejser, feltarbejde eller international tilstedeværelse, som tydeligt påvirker planlægning og bemanding.",
    },
    "restricted-environments": {
      name: "Særlige sikkerheds-, fortroligheds- eller kontrolmiljøer",
      shortUiText:
        "Arbejde under særlige regler for adgang, fortrolighed, sikkerhed eller kontrol.",
      fullDefinition:
        "Omfatter arbejdsforhold med særlige begrænsninger for adgang, fortrolighed, sikkerhed eller kontrol, for eksempel sikkerhedsklassificerede miljøer eller information, der kræver særlig beskyttelse. Kriteriet vedrører de regler og begrænsninger, der gælder i miljøet. Det vedrører ikke ansvar for at udforme, følge op på eller kontrollere informationssikkerhed.",
      measures:
        "Særlige adgangsbegrænsninger, fortroligheds- og sikkerhedsrestriktioner, kontrolkrav, der påvirker, hvordan arbejdet kan udføres.",
      notMeasures:
        "Formelt ansvar for informationssikkerhed, almindelig tavshedspligt, almindelig risikobevidsthed.",
      whenSuitable:
        "Vælg, når særlige adgangs-, fortroligheds- eller sikkerhedsrestriktioner skal have betydning i synet på ligeværdighed.",
      whenNotSuitable:
        "Vælg ikke alene for fortrolig information. Begrænsningerne skal være særlige, tilbagevendende og påvirke, hvordan arbejdet kan udføres.",
      controlQuestion:
        "Skal arbejde under særlige adgangs-, fortroligheds- eller sikkerhedsrestriktioner have betydning i synet på ligeværdighed?",
      assessmentQuestion:
        "Hvilken grad af sikkerheds-, fortroligheds- eller kontrolrestriktion arbejder rollen normalt og varigt under?",
      anchor1:
        "Enkeltstående og tydeligt afgrænsede adgangs- eller fortrolighedsrestriktioner på lavt niveau.",
      anchor3:
        "Etablerede og tilbagevendende adgangs-, kontrol- eller sikkerhedsrestriktioner.",
      anchor5:
        "Meget strenge eller forretningskritiske sikkerheds-, fortroligheds- eller kontrolrestriktioner, som i høj grad styrer planlægning, gennemførelse og dokumentation.",
    },
  },
}
