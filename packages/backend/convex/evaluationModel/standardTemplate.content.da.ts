import type { StandardTemplateContent } from "./standardTemplate.content.en"

// Danish content for the standard template. This is a translation draft of
// the Swedish source (standardTemplate.content.sv.ts) and must be reviewed by
// a native speaker before it ships to users. All structural decisions live in
// standardTemplate.ts; this module carries only prose.
//
// For each criterion, `description` is the short criterion description shown
// inline; `helpText` is the extended description shown behind the info help and
// in the rating flow.
export const standardTemplateContentDa: StandardTemplateContent = {
  modelName: "Standardmodel",
  criteria: {
    scope: {
      name: "Omfang og indvirkning",
      description:
        "Hvor stort et område rollen påvirker, og på hvilket niveau i organisationen effekterne mærkes.",
      helpText:
        "Dette kriterium beskriver rollens organisatoriske rækkevidde. Det omfatter både omfanget af ansvaret og hvor langt effekterne af rollens arbejde, beslutninger eller prioriteringer strækker sig. Indvirkningen kan være begrænset til et eget arbejdsområde eller et team, men kan også omfatte flere funktioner eller hele virksomheden.",
      anchors: [
        "Ansvar for egne opgaver inden for et tydeligt afgrænset område.",
        "Indvirkning inden for eget team; ansvar for veldefinerede leverancer.",
        "Ejerskab af et delområde eller en tilbagevendende proces; indvirkning inden for en mindre funktion.",
        "Ansvar for et større område, projekt eller flow; påvirker flere teams/funktioner.",
        "Påvirker et forretnings-/funktionsområde; sætter retning for større dele af organisationen.",
        "Virksomhedsomfattende indvirkning; strategisk ansvar og direkte effekt på organisationens resultater.",
      ],
      weightLevels: [
        "Virksomheden ønsker, at omfanget af ansvar og organisatorisk indvirkning kun skal have begrænset gennemslag i rollevurderingen. Roller med kortere rækkevidde skal altså ikke belønnes særlig stærkt på netop denne dimension.",
        "Virksomheden mener, at omfang og indvirkning er relevant, men at det normalt skal veje lettere end modellens mere prioriterede kriterier. Bredere ansvar skal påvirke vurderingen, men ikke være en hoveddrivkraft.",
        "Virksomheden ønsker, at omfang og indvirkning skal have en tydelig og balanceret plads i modellen. Roller med større organisatorisk rækkevidde skal slå igennem, men uden at denne dimension dominerer vurderingen.",
        "Virksomheden ønsker, at dette kriterium skal have stærk indvirkning i modellen. Forskelle i omfang, ansvar og indvirkning fra teamniveau til virksomhedsniveau skal tydeligt påvirke, hvordan roller vurderes i forhold til hinanden.",
        "Virksomheden ser omfang og indvirkning som en af de mest afgørende dimensioner i modellen. Roller med stor organisatorisk rækkevidde og omfattende indvirkning skal derfor vurderes tydeligt højere, når dette kriterium bedømmes højt.",
      ],
      compliance: {
        purpose:
          "Måler rollens organisatoriske rækkevidde: hvor stort et område rollen påvirker, og hvor langt effekterne af dens arbejde, beslutninger og prioriteringer strækker sig, uafhængigt af person eller hierarkisk niveau.",
        whyRelevant:
          "Rækkevidde og indvirkning afspejler rollens bidrag til virksomhedens resultater. Det bedømmes ud fra faktisk organisatorisk gennemslag, ikke ud fra titel eller synligt mandat, hvilket gør kriteriet kønsneutralt.",
        overlapNotes:
          "Overlapper delvist med Autonomi (beslutningskompetence) og Personale-/ledelsesansvar; her ligger fokus specifikt på, hvor langt rollens effekter når ud i organisationen.",
        biasRisk: "low",
        biasComment:
          "Biasrisiko (diagnosespørgsmål 3): at belønne synligt mandat mere end faktisk gennemslag kan begunstige traditionelt synlige roller. Niveaubeskrivelserne tager udgangspunkt i effekt og ansvar snarere end rang og er kønsneutrale (spørgsmål 5).",
        biasAction:
          "Niveauankrene beskriver faktisk rækkevidde og resultater, ikke formel position, så også roller uden synlig titel kan bedømmes højt.",
      },
    },
    risk: {
      name: "Risiko og konsekvens",
      description:
        "Hvilke følger rollens beslutninger, arbejde eller mangler kan få for virksomheden.",
      helpText:
        "Dette kriterium beskriver hvilke konsekvenser rollen kan have for virksomheden, hvis noget går galt, overses eller håndteres utilstrækkeligt. Det omfatter påvirkningen af for eksempel kvalitet, levering, økonomi, compliance, sikkerhed, kunderelationer og brand. Fokus ligger på konsekvensernes omfang og betydning for virksomheden.",
      anchors: [
        "Lav påvirkning; fejl kan let rettes.",
        "Påvirker hovedsageligt eget arbejde eller team.",
        "Fejl påvirker leverancer eller kvalitet i mindre skala.",
        "Fejl har mærkbare konsekvenser for processer, deadlines eller kunderelationer.",
        "Høj påvirkning på økonomi, omdømme eller compliance.",
        "Kritisk påvirkning på organisationens resultater, strategi eller regelefterlevelse.",
      ],
      weightLevels: [
        "Virksomheden ønsker, at risiko og konsekvens kun skal have begrænset indvirkning på rollevurderingen. Roller, hvor fejl får større følger, skal altså ikke belønnes særlig meget på denne dimension.",
        "Virksomheden vurderer, at risiko og konsekvens er relevant, men at dette kriterium normalt skal veje lettere end de mest prioriterede dimensioner i modellen.",
        "Virksomheden ønsker, at risiko og konsekvens skal have en balanceret plads i modellen. Forskelle i påvirkning af kvalitet, compliance, drift eller brand skal indgå på et normalt niveau.",
        "Virksomheden ønsker, at risiko og konsekvens skal have stærk indvirkning på, hvordan roller vurderes. Roller, hvor fejl kan få tydelige følger for driften, kunden, økonomien, compliance eller tilliden, skal derfor belønnes højere.",
        "Virksomheden ser risiko og konsekvens som en af de mest afgørende faktorer i modellen. Høje rollepoint på denne dimension skal derfor have meget stort gennemslag i den samlede vurdering og dermed normalt også i den relative lønpositionering.",
      ],
      compliance: {
        purpose:
          "Måler hvilke konsekvenser rollens beslutninger, arbejde eller mangler kan få for virksomheden: kvalitet, levering, økonomi, compliance, sikkerhed, kunderelationer og brand.",
        whyRelevant:
          "Konsekvensernes omfang er en del af rollens værdi for virksomheden. Det bedømmes ud fra, hvad der faktisk står på spil, ikke ud fra hvor synligt eller dramatisk arbejdet er, hvilket gør kriteriet kønsneutralt.",
        overlapNotes:
          "Overlapper delvist med Omfang og indvirkning; her ligger fokus på konsekvenserne af fejl eller mangler snarere end på selve rækkevidden.",
        biasRisk: "low",
        biasComment:
          "Biasrisiko (diagnosespørgsmål 1 og 2): synlige operative eller tekniske risici kan overvurderes, mens stille kvalitets-, omsorgs- eller compliancearbejde undervurderes. Niveaubeskrivelserne omfatter også kvalitet, compliance og relationer og er kønsneutrale (spørgsmål 5).",
        biasAction:
          "Ankerteksterne inkluderer konsekvenser for kvalitet, compliance og kunderelationer, ikke kun økonomiske eller tekniske fejl, så forskellige typer af ansvar bedømmes ligeværdigt.",
      },
    },
    complexity: {
      name: "Kompleksitet og tvetydighed",
      description:
        "Hvor komplekse, mangefacetterede og uklare spørgsmål rollen håndterer.",
      helpText:
        "Dette kriterium beskriver arbejdets sværhedsgrad. Det omfatter teknisk, forretningsmæssig og organisatorisk kompleksitet samt graden af usikkerhed i situationer, hvor information, retning eller løsning ikke er tydelig fra begyndelsen. Kriteriet fanger, hvor mange variabler, afhængigheder og afvejninger der typisk findes i rollen.",
      anchors: [
        "Arbejdet er rutinemæssigt og godt defineret med tydelige instruktioner.",
        "Håndterer standardiserede opgaver med lav variation.",
        "Løser opgaver med en vis variation og behov for egen analyse.",
        "Arbejder med flere afhængigheder og afvejninger; kræver fortolkning og prioritering.",
        "Høj kompleksitet; håndterer modstridende krav og uklare forudsætninger.",
        "Ekstremt komplekse situationer; driver fremdrift i ukendte/innovative områder med høj usikkerhed.",
      ],
      weightLevels: [
        "Virksomheden ønsker, at kompleksitet og tvetydighed kun skal have lille indvirkning på den samlede rollevurdering. Roller med mere komplekse og usikre forudsætninger skal derfor ikke belønnes særlig meget på denne dimension.",
        "Virksomheden vurderer, at kompleksitet og usikkerhed er relevant, men at denne dimension normalt skal veje lettere end de mest prioriterede kriterier.",
        "Virksomheden ønsker, at kompleksitet og tvetydighed skal have en balanceret og tydelig plads i modellen. Roller, der kræver problemløsning i mere usikre eller svært fortolkelige sammenhænge, skal have et normalt gennemslag i vurderingen.",
        "Virksomheden ønsker, at kompleksitet og tvetydighed skal have stærk indvirkning på rollevurderingen. Roller, der håndterer svære, tvetydige eller usikre problemer, skal derfor belønnes tydeligt højere i modellen.",
        "Virksomheden ser kompleksitet og tvetydighed som en af de mest afgørende faktorer i modellen. Det betyder, at roller, der får høje rollebedømmelsespoint på dette kriterium, også skal have stort gennemslag i den samlede vurdering og dermed normalt vurderes relativt højere lønmæssigt.",
      ],
      compliance: {
        purpose:
          "Måler arbejdets sværhedsgrad: teknisk, forretningsmæssig og organisatorisk kompleksitet samt graden af usikkerhed, når information, retning eller løsning ikke er givet fra begyndelsen.",
        whyRelevant:
          "Evnen til at håndtere mange variabler, afhængigheder og afvejninger er en central del af en rolles værdi. Det bedømmes ud fra opgavernes faktiske kompleksitet, ikke ud fra hvor teknisk arbejdet fremstår, hvilket gør kriteriet kønsneutralt.",
        overlapNotes:
          "Overlapper delvist med Vidensdybde/-bredde; her ligger fokus på problemernes kompleksitet og usikkerhed snarere end på den viden, der kræves.",
        biasRisk: "low",
        biasComment:
          "Biasrisiko (diagnosespørgsmål 2): teknisk kompleksitet kan overvurderes, mens relationel, koordinerende eller flertydig kompleksitet undervurderes. Niveaubeskrivelserne omfatter også organisatorisk og forretningsmæssig kompleksitet og er kønsneutrale (spørgsmål 5).",
        biasAction:
          "Ankerteksterne beskriver kompleksitet bredt (teknisk, forretningsmæssig og organisatorisk), så også koordinerende og flertydige sammenhænge bedømmes som komplekse.",
      },
    },
    autonomy: {
      name: "Autonomi og beslutningskompetence",
      description:
        "Hvor selvstændig rollen er, og hvilket mandat den har til at træffe beslutninger.",
      helpText:
        "Dette kriterium beskriver rollens handlerum og beslutningsniveau. Det omfatter graden af selvstændighed, hvor meget styring rollen arbejder under, og hvilken type beslutninger der naturligt ligger inden for opgaven. Kriteriet fanger både friheden til at handle og det mandat rollen har til at påvirke retning, prioriteringer eller udfald.",
      anchors: [
        "Arbejder tæt styret; følger instruktioner.",
        "Selvstændig i hverdagsopgaver inden for definerede rammer.",
        "Tager egne initiativer og prioriteringer inden for sit område.",
        "Træffer taktiske beslutninger der påvirker et team eller en arbejdsgang.",
        "Træffer strategiske beslutninger inden for et domæne og sætter retning for et delområde.",
        "Træffer beslutninger der påvirker flere domæner eller hele organisationen.",
      ],
      weightLevels: [
        "Virksomheden ønsker, at graden af selvstændighed og beslutningskompetence kun skal have lille indvirkning på den samlede rollevurdering.",
        "Virksomheden mener, at autonomi og beslutningsniveau er relevant, men at det normalt skal veje lettere end de mere prioriterede kriterier i modellen.",
        "Virksomheden ønsker, at autonomi og beslutningskompetence skal have en tydelig og balanceret plads i modellen. Rollen skal påvirkes af, hvor selvstændigt den arbejder, men uden at dette kriterium tillægges ekstra stor vægt.",
        "Virksomheden ønsker, at dette kriterium skal have stærk indvirkning. Roller med større selvstændighed og højere beslutningskompetence skal derfor have tydeligt større gennemslag i den samlede vurdering.",
        "Virksomheden ser autonomi og beslutningskompetence som en af de mest afgørende dimensioner i modellen. Roller, der bedømmes højt på selvstændighed og beslutningsniveau, skal derfor vurderes tydeligt højere i forhold til andre roller.",
      ],
      compliance: {
        purpose:
          "Måler rollens handlerum og beslutningsniveau: graden af selvstændighed, hvor meget styring rollen arbejder under, og hvilket mandat den har til at påvirke retning, prioriteringer og udfald.",
        whyRelevant:
          "Selvstændighed og beslutningskompetence afspejler det ansvar, rollen bærer. Det bedømmes ud fra, hvilke beslutninger der faktisk træffes, ikke ud fra formel titel, hvilket gør kriteriet kønsneutralt.",
        overlapNotes:
          "Overlapper delvist med Omfang og indvirkning og Personale-/ledelsesansvar; her ligger fokus på selvstændighed og beslutningskompetence snarere end på rækkevidde eller det at lede andre.",
        biasRisk: "medium",
        biasComment:
          "Biasrisiko (diagnosespørgsmål 3): synligt beslutningsmandat kan overvurderes i forhold til faktisk gennemslag, hvilket kan begunstige roller med formelt mandat frem for seniorspecialister med reel indflydelse. Niveaubeskrivelserne er kønsneutrale (spørgsmål 5).",
        biasAction:
          "Ankerteksterne omfatter også selvstændigt initiativ og problemløsning, ikke kun formelt beslutningsmandat, så reel indflydelse uden titel kan bedømmes højt.",
      },
    },
    stakeholders: {
      name: "Interessentbredde",
      description:
        "Hvor bred og varieret rollens samspil med interne og eksterne parter er.",
      helpText:
        "Dette kriterium beskriver bredden i rollens kontaktflader og samarbejdsbehov. Det omfatter interne og eksterne interessenter, tværfunktionelle samarbejder og behovet for at koordinere arbejde mellem forskellige personer, teams, funktioner eller eksterne parter. Kriteriet fanger, hvor varieret og omfattende dette samspil er.",
      anchors: [
        "Samarbejde hovedsageligt inden for eget team.",
        "Samarbejde inden for tilstødende funktioner.",
        "Regelmæssigt tværfunktionelt samarbejde.",
        "Koordinering med eksterne parter/kunder eller flere interne funktioner.",
        "Håndterer et komplekst interessentmiljø med modstridende interesser.",
        "Repræsenterer organisationen eksternt og håndterer strategiske interessenter.",
      ],
      weightLevels: [
        "Virksomheden ønsker, at bredden i samspil og koordinering kun skal have lille indvirkning på, hvordan roller vurderes i forhold til hinanden.",
        "Virksomheden vurderer, at interessentbredde er relevant, men at kriteriet normalt skal veje lettere end de mest prioriterede dimensioner i modellen.",
        "Virksomheden ønsker, at interessentbredde skal have en tydelig og balanceret plads i modellen. Roller med bredt internt eller eksternt samspil skal have et normalt gennemslag i vurderingen.",
        "Virksomheden ønsker, at dette kriterium skal have stærk indvirkning. Roller, der kræver bred koordinering, mange kontaktflader og omfattende samspil, skal derfor vurderes tydeligt højere.",
        "Virksomheden ser interessentbredde som en af de mest afgørende faktorer i modellen. Høje rollebedømmelsespoint på denne dimension skal derfor give stort gennemslag i, hvordan roller relativvurderes og positioneres.",
      ],
      compliance: {
        purpose:
          "Måler bredden i rollens kontaktflader og samarbejdsbehov: interne og eksterne interessenter, tværfunktionelt samarbejde og behovet for at koordinere arbejde mellem personer, teams og parter.",
        whyRelevant:
          "Bredt samspil og koordinering er et reelt bidrag til virksomheden. Kriteriet synliggør relationelt og koordinerende arbejde, hvilket bedømmes ud fra samspillets faktiske omfang og er kønsneutralt.",
        overlapNotes:
          "Overlapper delvist med Omfang og indvirkning; her ligger fokus på bredden og variationen i samspillet snarere end på resultatets rækkevidde.",
        biasRisk: "low",
        biasComment:
          "Dette kriterium modvirker en kendt bias ved udtrykkeligt at værdsætte relationelt og koordinerende arbejde (diagnosespørgsmål 2). Resterende risiko (spørgsmål 3): ekstern, synlig repræsentation kan overvurderes i forhold til internt koordineringsarbejde. Niveaubeskrivelserne er kønsneutrale (spørgsmål 5).",
        biasAction:
          "Ankerteksterne værdsætter intern tværfunktionel koordinering på lige fod med ekstern repræsentation, så synligt eksternt netværksarbejde ikke i sig selv vejer tungere.",
      },
    },
    knowledge: {
      name: "Vidensdybde/-bredde",
      description:
        "Hvilket niveau af specialistviden, erfaring og bredde over flere områder rollen kræver.",
      helpText:
        "Dette kriterium beskriver hvilken type og hvilket niveau af viden rollen bygger på. Det omfatter specialistdybde, praktisk erfaring, metodeforståelse og evnen til at arbejde på tværs af flere discipliner eller områder. Kriteriet fanger, om rollen primært kræver fordybelse inden for ét område eller en kombination af flere perspektiver og kompetencer.",
      anchors: [
        "Rollen kræver grundlæggende viden. Rollen forudsætter introduktionsniveau inden for sit område, og at opgaver kan udføres gennem etablerede rutiner og instruktioner.",
        "Rollen kræver solid faglig viden inden for et defineret område. Rollen har brug for tydeligt defineret og etableret kompetence inden for sit domæne, med evne til at anvende standardiserede arbejdsmetoder.",
        "Rollen kræver fordybet kompetence og metodeforståelse. Rollen skal håndtere mere komplekse opgaver, bruge mere avancerede metoder/værktøjer og have god forståelse af, hvordan området fungerer i praksis.",
        "Rollen kræver avanceret specialistkompetence. Rollen kræver dybere viden inden for et eller flere delområder og evnen til at håndtere sværere problemer, gennemføre analyser og udarbejde løsninger, der bliver retningsgivende i det operative arbejde.",
        "Rollen kræver ekspertkompetence inden for et komplekst domæne. Rollen forudsætter, at indehaveren definerer metoder, strukturer og arbejdsgange inden for sit domæne og fungerer som intern ekspert i kvalificerede spørgsmål.",
        "Rollen kræver domæneledende kompetence og vidensudvikling. Rollen kræver, at indehaveren udvikler nye arbejdsgange, modeller eller teknikker og sætter retning og principper for organisationens fremtidige evner inden for området.",
      ],
      weightLevels: [
        "Virksomheden ønsker, at krav om dyb ekspertise, erfaring eller tværfaglig bredde kun skal have begrænset indvirkning på den samlede rollevurdering.",
        "Virksomheden mener, at vidensdybde og -bredde er relevant, men at det normalt skal veje lettere end de mest prioriterede kriterier.",
        "Virksomheden ønsker, at vidensdybde og -bredde skal have en tydelig og balanceret plads i modellen. Ekspertise og erfaringskrav skal påvirke vurderingen på et normalt niveau.",
        "Virksomheden ønsker, at dette kriterium skal have stærk indvirkning. Roller, der kræver dyb specialistviden, bred domæneforståelse eller omfattende erfaring, skal derfor vurderes tydeligt højere i modellen.",
        "Virksomheden ser vidensdybde og -bredde som en af de mest afgørende dimensioner i modellen. Høje point på denne faktor skal derfor give stærkt gennemslag i den samlede rollevurdering og normalt bidrage til en højere relativ lønpositionering.",
      ],
      compliance: {
        purpose:
          "Måler hvilken type og hvilket niveau af viden rollen bygger på: specialistdybde, praktisk erfaring, metodeforståelse og evnen til at arbejde på tværs af flere discipliner eller områder.",
        whyRelevant:
          "Vidensniveau og erfaring er en del af rollens værdi. Kriteriet bedømmer faktisk kompetence og anvendt evne, ikke formelle meritter i sig selv, hvilket gør det kønsneutralt.",
        overlapNotes:
          "Overlapper delvist med Kompleksitet og tvetydighed og Formelle kvalifikationer; her ligger fokus på faktisk viden og erfaring snarere end på problemernes kompleksitet eller de formelle krav.",
        biasRisk: "low",
        biasComment:
          "Biasrisiko (diagnosespørgsmål 1 og 4): formelt anerkendt eller synlig ekspertise kan overvurderes i forhold til stille, erfaringsbaseret viden. Niveaubeskrivelserne tager udgangspunkt i anvendt kompetence, ikke kun titel eller uddannelse, og er kønsneutrale (spørgsmål 5).",
        biasAction:
          "Ankerteksterne værdsætter praktisk erfaring og anvendt metodeforståelse på lige fod med formelt anerkendt specialisering.",
      },
    },
    financial: {
      name: "Økonomisk ansvar",
      description:
        "Hvor stort et ansvar rollen har for budget, omkostninger, indtægter eller økonomisk resultat.",
      helpText:
        "Dette kriterium beskriver rollens ansvar for økonomiske ressourcer eller økonomiske udfald. Det kan omfatte budget, omkostninger, indtægter, lønsomhed, investeringer eller ansvar for et forretningsområde, en portefølje eller andre økonomiske rammer. Kriteriet fanger, hvor central den økonomiske dimension er i rollen.",
      anchors: [
        "Intet budget- eller omkostningsansvar.",
        "Påvirker omkostninger indirekte gennem beslutninger.",
        "Ansvar for en mindre omkostningsramme eller del af et projekt/budget.",
        "Budgetansvar inden for eget område/team.",
        "Ansvar for et større budget/forretningsområde.",
        "Ansvar for en betydelig del af virksomhedens økonomi eller P&L.",
      ],
      weightLevels: [
        "Virksomheden ønsker, at økonomisk ansvar kun skal have begrænset indvirkning på den samlede rollevurdering. Budget- eller resultatansvar skal altså ikke tillægges særlig stor vægt i modellen.",
        "Virksomheden mener, at økonomisk ansvar er relevant, men at det normalt skal veje lettere end de mest prioriterede kriterier.",
        "Virksomheden ønsker, at økonomisk ansvar skal have en tydelig og balanceret plads i modellen. Budgetpåvirkning, omkostningsansvar eller resultatansvar skal regnes med som en normal del af vurderingen.",
        "Virksomheden ønsker, at dette kriterium skal have stærk indvirkning. Roller med tydelig påvirkning af budget, omkostninger, indtægter eller økonomiske resultater skal derfor vurderes højere i forhold til andre roller.",
        "Virksomheden ser økonomisk ansvar som en af de mest afgørende dimensioner i modellen. Høje point på økonomisk ansvar skal derfor have meget stærkt gennemslag i den samlede rollevurdering og normalt bidrage til en højere relativ lønpositionering.",
      ],
      compliance: {
        purpose:
          "Måler rollens ansvar for økonomiske ressourcer eller udfald: budget, omkostninger, indtægter, lønsomhed, investeringer eller ansvar for et forretningsområdes økonomi.",
        whyRelevant:
          "Økonomisk ansvar er en del af rollens bidrag, men vurderes ud fra graden af faktisk beslutningsansvar for økonomien, ikke ud fra budgettets størrelse i sig selv, hvilket gør kriteriet kønsneutralt.",
        overlapNotes:
          "Overlapper delvist med Autonomi (beslutningskompetence) og Omfang og indvirkning; her ligger fokus specifikt på ansvaret for økonomiske rammer og resultater.",
        biasRisk: "medium",
        biasComment:
          "Kendt biasrisiko (diagnosespørgsmål 3 og 6): et stort budget kan tillægges for stor vægt i forhold til kompleksitet, ansvar og specialistviden, hvilket kan begunstige traditionelt mandsdominerede budgetbærende roller. Niveaubeskrivelserne er kønsneutrale (spørgsmål 5).",
        biasAction:
          "Kriteriet holdes på en moderat vægt i modellen, så budgetstørrelse ikke i sig selv dominerer vurderingen, og niveauerne beskriver beslutningsansvar snarere end kun beløbenes størrelse.",
      },
    },
    people: {
      name: "Personale-/ledelsesansvar",
      description:
        "Hvor stort et ansvar rollen har for at lede andre, organisere arbejde og skabe resultater gennem mennesker.",
      helpText:
        "Dette kriterium beskriver rollens ansvar for ledelse af andre. Det omfatter formelt personaleansvar, operativ arbejdsledelse, teamledelse og ansvar for større organisatoriske enheder eller andre ledere. Kriteriet fanger både omfanget af ledelsesopgaven og ansvaret for kapacitet, prioritering, udvikling og retning gennem andre.",
      anchors: [
        "Intet personale- eller ledelsesansvar.",
        "Operativ styring af arbejde, men intet HR-ansvar.",
        "Personaleansvar for medarbejdere (M1).",
        "Leder over flere teams eller førstelinjeledere (M2).",
        "Funktionschef med flere ledelseslag eller en større organisation.",
        "Strategisk leder på virksomhedsniveau (Head/Director/C-level).",
      ],
      weightLevels: [
        "Virksomheden ønsker, at personale- og ledelsesansvar kun skal have begrænset indvirkning på den samlede rollevurdering. Formelt lederskab skal altså ikke i sig selv drive vurderingen særlig meget.",
        "Virksomheden vurderer, at personale- og ledelsesansvar er relevant, men at det normalt skal veje lettere end de mest prioriterede kriterier i modellen.",
        "Virksomheden ønsker, at personale- og ledelsesansvar skal have en tydelig og balanceret plads i modellen. At lede andre skal påvirke vurderingen, men uden at blive tillagt særlig forstærket vægt.",
        "Virksomheden ønsker, at dette kriterium skal have stærk indvirkning. Roller med større lederansvar, teamansvar eller formelt lederskab skal derfor vurderes tydeligt højere i forhold til andre roller.",
        "Virksomheden ser personale- og ledelsesansvar som en af de mest afgørende faktorer i modellen. Høje rollebedømmelsespoint på denne dimension skal derfor have stort gennemslag i den samlede vurdering og normalt også i den relative lønlogik.",
      ],
      compliance: {
        purpose:
          "Måler rollens ansvar for at lede andre: formelt personaleansvar, operativ arbejdsledelse, teamledelse og ansvar for kapacitet, prioritering og udvikling gennem andre mennesker.",
        whyRelevant:
          "At lede andre er en del af rollens bidrag til virksomhedens værdi. Det bedømmes ud fra ledelsesopgavens omfang og indhold, ikke ud fra titel eller antal medarbejdere, så det at lede et lille team godt og det at lede et stort bedømmes på faktisk ansvar snarere end på synlig rang.",
        overlapNotes:
          "Overlapper delvist med Omfang og indvirkning (organisatorisk rækkevidde) og Autonomi (beslutningskompetence); her ligger fokus specifikt på ansvar, der udøves gennem andre mennesker.",
        biasRisk: "medium",
        biasComment:
          "Kendt biasrisiko (diagnosespørgsmål 3 og 6): at belønne synligt mandat og antal medarbejdere mere end faktisk ledelsespåvirkning kan overvurdere traditionelt mandsdominerede lederroller og undervurdere seniorspecialister og koordineringstungt arbejde. Niveaubeskrivelserne i sig selv er kønsneutrale (spørgsmål 5).",
        biasAction:
          "Niveauankrene beskriver ledelsens indhold snarere end kun antal medarbejdere, og kriteriet holdes på en moderat vægt, så en ledertitel ikke i sig selv dominerer evalueringen.",
      },
    },
    formal: {
      name: "Formelle kvalifikationer",
      description:
        "Hvilke formelle kvalifikationskrav, såsom uddannelse eller certificering, der normalt er knyttet til rollen.",
      helpText:
        "Dette kriterium beskriver de formelle kompetencekrav, der typisk er knyttet til rollen. Det kan omfatte uddannelsesniveau, eksamen, certificering, autorisation eller anden formelt anerkendt kompetence, der kræves eller sædvanligvis efterspørges. Kriteriet fanger rollens formelle indgangsniveau, uafhængigt af den nuværende persons baggrund.",
      anchors: [
        "Ingen formelle forudsætninger kræves. Rollen kan læres fra bunden gennem intern oplæring. Kræver ingen særlig teoretisk base eller erhvervsuddannelse.",
        "Grundlæggende faglig viden kræves. Rollen kræver en vis forhåndsviden inden for området (f.eks. kortere kurser eller praktisk erfaring), men ingen videregående uddannelse.",
        "Erhvervsrettet videregående uddannelse eller tilsvarende forhåndsviden kræves. Rollen kræver en erhvervsakademiuddannelse, certificering eller tilsvarende teoretisk base for at kunne udføre opgaverne.",
        "Universitetsgrad eller tilsvarende kvalificeret forhåndsviden kræves. Rollen kræver en bachelorgrad/ingeniøruddannelse eller tilsvarende dokumenteret kompetence til at håndtere typiske opgaver.",
        "Avanceret akademisk niveau eller avanceret specialistcertificering kræves. Rollen kræver f.eks. en kandidatgrad, avanceret certificering (IFRS, TISAX, sikkerhedsgodkendelse, CPA osv.) eller tilsvarende højt teoretisk niveau.",
        "Fagekspertise på højeste niveau kræves. Rollen kræver kompetence på forskningsniveau, avanceret ekspertakkreditering eller særdeles betydelig domænespecifik ekspertise, der sætter normen for området.",
      ],
      weightLevels: [
        "Virksomheden ønsker, at krav om formelle kvalifikationer kun skal have begrænset indvirkning på den samlede rollevurdering.",
        "Virksomheden vurderer, at formelle kvalifikationer er relevant, men at kriteriet normalt skal veje lettere end de mere prioriterede dimensioner i modellen.",
        "Virksomheden ønsker, at formelle kvalifikationer skal have en tydelig og balanceret plads i modellen. Uddannelseskrav eller tilsvarende erfaringskrav skal påvirke vurderingen på et normalt niveau.",
        "Virksomheden ønsker, at dette kriterium skal have stærk indvirkning. Roller, hvor formelle kvalifikationer eller et tilsvarende erfaringsniveau er særlig vigtigt, skal derfor have tydeligt større gennemslag i modellen.",
        "Virksomheden ser formelle kvalifikationer som en af de mest afgørende dimensioner i modellen. Høje bedømmelsespoint på denne faktor skal derfor påvirke den samlede rollevurdering stærkt og normalt bidrage til en højere relativ lønpositionering.",
      ],
      compliance: {
        purpose:
          "Måler de formelle kompetencekrav, der typisk er knyttet til rollen: uddannelsesniveau, eksamen, certificering, autorisation eller anden formelt anerkendt kompetence, uafhængigt af den nuværende persons baggrund.",
        whyRelevant:
          "Formelle kvalifikationskrav kan afspejle det vidensniveau, rollen forudsætter. Kriteriet beskriver rollens formelle indgangsniveau, ikke personen, og holdes knyttet til det faktiske arbejdsindhold for at forblive kønsneutralt.",
        overlapNotes:
          "Overlapper delvist med Vidensdybde/-bredde; her ligger fokus på de formelle krav snarere end på faktisk anvendt viden og erfaring.",
        biasRisk: "medium",
        biasComment:
          "Kendt biasrisiko (diagnosespørgsmål 4): at hvile på formel status i stedet for faktisk arbejdsindhold kan stille kompetence, der er erhvervet ad andre veje end traditionel uddannelse, ringere. Niveaubeskrivelserne tillader tilsvarende dokumenteret erfaring og er kønsneutrale (spørgsmål 5).",
        biasAction:
          "Niveauerne anerkender udtrykkeligt tilsvarende erfaring ved siden af formel uddannelse, og kriteriet holdes på lav vægt, så formelle meritter ikke i sig selv driver vurderingen.",
      },
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
