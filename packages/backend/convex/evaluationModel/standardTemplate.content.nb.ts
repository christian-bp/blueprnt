import type { StandardTemplateContent } from "./standardTemplate.content.en"

// Norwegian (Bokmal) content for the standard template. This is a translation
// draft of the Swedish source (standardTemplate.content.sv.ts) and must be
// reviewed by a native speaker before it ships to users. All structural
// decisions live in standardTemplate.ts; this module carries only prose.
// For each criterion, `description` is the short criterion description shown
// inline, and `helpText` is the extended description shown behind the info
// help and in the rating flow.
export const standardTemplateContentNb: StandardTemplateContent = {
  modelName: "Standardmodell",
  criteria: {
    scope: {
      name: "Omfang og påvirkning",
      description:
        "Hvor stort område rollen påvirker, og på hvilket nivå i organisasjonen effektene merkes.",
      helpText:
        "Dette kriteriet beskriver rollens organisatoriske rekkevidde. Det omfatter både omfanget av ansvaret og hvor langt effektene av rollens arbeid, beslutninger eller prioriteringer strekker seg. Påvirkningen kan være begrenset til et eget arbeidsområde eller et team, men kan også omfatte flere funksjoner eller hele selskapet.",
      anchors: [
        "Ansvar for egne oppgaver innenfor et tydelig avgrenset område.",
        "Påvirkning innenfor eget team; ansvar for veldefinerte leveranser.",
        "Eierskap til et delområde eller en gjentakende prosess; påvirkning innenfor en mindre funksjon.",
        "Ansvar for et større område, prosjekt eller en flyt; påvirker flere team/funksjoner.",
        "Påvirker et forretnings-/funksjonsområde; setter retning for større deler av organisasjonen.",
        "Selskapsomfattende påvirkning; strategisk ansvar og direkte effekt på organisasjonens resultater.",
      ],
      weightLevels: [
        "Selskapet ønsker at omfanget av ansvar og organisatorisk påvirkning bare skal ha begrenset gjennomslag i rollevurderingen. Roller med kortere rekkevidde skal altså ikke premieres spesielt sterkt nettopp på denne dimensjonen.",
        "Selskapet mener at omfang og påvirkning er relevant, men at det normalt skal veie lettere enn modellens høyere prioriterte kriterier. Bredere ansvar skal påvirke vurderingen, men ikke være en hoveddriver.",
        "Selskapet ønsker at omfang og påvirkning skal ha en tydelig og balansert plass i modellen. Roller med større organisatorisk rekkevidde skal få gjennomslag, men uten at denne dimensjonen dominerer vurderingen.",
        "Selskapet ønsker at dette kriteriet skal ha sterk påvirkning i modellen. Forskjeller i omfang, ansvar og påvirkning fra teamnivå til selskapsnivå skal tydelig påvirke hvordan roller vurderes relativt til hverandre.",
        "Selskapet ser omfang og påvirkning som en av de mest avgjørende dimensjonene i modellen. Roller med stor organisatorisk rekkevidde og omfattende påvirkning skal derfor vurderes tydelig høyere når dette kriteriet vektes høyt.",
      ],
      compliance: {
        purpose:
          "Måler rollens organisatoriske rekkevidde: hvor stort område rollen påvirker og hvor langt effektene av dens arbeid, beslutninger og prioriteringer strekker seg, uavhengig av person eller hierarkisk nivå.",
        whyRelevant:
          "Rekkevidde og påvirkning speiler rollens bidrag til virksomhetens resultater. Det vurderes ut fra faktisk organisatorisk gjennomslag, ikke ut fra tittel eller synlig mandat, noe som gjør kriteriet kjønnsnøytralt.",
        overlapNotes:
          "Overlapper delvis med Autonomi og beslutningsmyndighet (beslutningsmandat) og Personal-/lederansvar; her ligger fokus spesifikt på hvor langt rollens effekter når i organisasjonen.",
        biasRisk: "low",
        biasComment:
          "Å belønne synlig mandat mer enn faktisk gjennomslag kan gagne tradisjonelt synlige roller. Nivåbeskrivelsene tar utgangspunkt i effekt og ansvar snarere enn rang og er kjønnsnøytrale.",
        biasAction:
          "Nivåankrene beskriver faktisk rekkevidde og resultater, ikke formell posisjon, slik at også roller uten synlig tittel kan vurderes høyt.",
      },
    },
    risk: {
      name: "Risiko og konsekvens",
      description:
        "Hvilke følger rollens beslutninger, arbeid eller mangler kan få for virksomheten.",
      helpText:
        "Dette kriteriet beskriver hvilke konsekvenser rollen kan ha for virksomheten hvis noe blir feil, blir oversett eller håndteres utilstrekkelig. Det omfatter påvirkning på for eksempel kvalitet, leveranse, økonomi, etterlevelse, sikkerhet, kunderelasjoner og omdømme. Fokus ligger på konsekvensenes omfang og betydning for virksomheten.",
      anchors: [
        "Lav påvirkning; feil kan enkelt rettes.",
        "Påvirker hovedsakelig eget arbeid eller team.",
        "Feil påvirker leveranser eller kvalitet i mindre skala.",
        "Feil har merkbare konsekvenser for prosesser, frister eller kunderelasjoner.",
        "Høy påvirkning på økonomi, omdømme eller etterlevelse.",
        "Kritisk påvirkning på organisasjonens resultater, strategi eller regeletterlevelse.",
      ],
      weightLevels: [
        "Selskapet ønsker at risiko og konsekvens bare skal ha begrenset påvirkning på rollevurderingen. Roller der feil får større følger skal altså ikke premieres spesielt mye på denne dimensjonen.",
        "Selskapet vurderer at risiko og konsekvens er relevant, men at dette kriteriet normalt skal veie lettere enn de høyest prioriterte dimensjonene i modellen.",
        "Selskapet ønsker at risiko og konsekvens skal ha en balansert plass i modellen. Forskjeller i påvirkning på kvalitet, etterlevelse, virksomhet eller omdømme skal tas hensyn til på et normalt nivå.",
        "Selskapet ønsker at risiko og konsekvens skal ha sterk påvirkning på hvordan roller vurderes. Roller der feil kan få tydelige følger for virksomhet, kunde, økonomi, etterlevelse eller tillit skal derfor premieres høyere.",
        "Selskapet ser risiko og konsekvens som en av de mest avgjørende faktorene i modellen. Høye rollepoeng på denne dimensjonen skal derfor få svært stort gjennomslag i den samlede vurderingen og dermed normalt også i den relative lønnsposisjoneringen.",
      ],
      compliance: {
        purpose:
          "Måler hvilke konsekvenser rollens beslutninger, arbeid eller mangler kan få for virksomheten: kvalitet, leveranse, økonomi, etterlevelse, sikkerhet, kunderelasjoner og omdømme.",
        whyRelevant:
          "Konsekvensenes omfang er en del av rollens verdi for virksomheten. Det vurderes ut fra hva som faktisk står på spill, ikke ut fra hvor synlig eller dramatisk arbeidet er, noe som gjør kriteriet kjønnsnøytralt.",
        overlapNotes:
          "Overlapper delvis med Omfang og påvirkning; her ligger fokus på konsekvensene av feil eller mangler snarere enn på rekkevidden i seg selv.",
        biasRisk: "low",
        biasComment:
          "Synlige operative eller tekniske risikoer kan overvurderes mens stille kvalitets-, omsorgs- eller etterlevelsesarbeid undervurderes. Nivåbeskrivelsene omfatter også kvalitet, etterlevelse og relasjoner og er kjønnsnøytrale.",
        biasAction:
          "Ankertekstene inkluderer konsekvenser for kvalitet, etterlevelse og kunderelasjoner, ikke bare økonomiske eller tekniske feil, slik at ulike typer ansvar vurderes likeverdig.",
      },
    },
    complexity: {
      name: "Kompleksitet og tvetydighet",
      description:
        "Hvor komplekse, sammensatte og uklare spørsmål rollen håndterer.",
      helpText:
        "Dette kriteriet beskriver arbeidets vanskelighetsgrad. Det omfatter teknisk, forretningsmessig og organisatorisk kompleksitet samt graden av usikkerhet i situasjoner der informasjon, retning eller løsning ikke er tydelig fra starten. Kriteriet fanger hvor mange variabler, avhengigheter og avveininger som typisk finnes i rollen.",
      anchors: [
        "Arbeidet er rutinemessig og godt definert med tydelige instruksjoner.",
        "Håndterer standardiserte oppgaver med lav variasjon.",
        "Løser oppgaver med noe variasjon og behov for egen analyse.",
        "Arbeider med flere avhengigheter og avveininger; krever tolkning og prioritering.",
        "Høy kompleksitet; håndterer motstridende krav og uklare forutsetninger.",
        "Ekstremt komplekse situasjoner; driver fremdrift i ukjente/innovative områder med høy usikkerhet.",
      ],
      weightLevels: [
        "Selskapet ønsker at kompleksitet og tvetydighet bare skal ha liten påvirkning på den samlede rollevurderingen. Roller med mer komplekse og usikre forutsetninger skal derfor ikke premieres spesielt mye på denne dimensjonen.",
        "Selskapet vurderer at kompleksitet og usikkerhet er relevant, men at denne dimensjonen normalt skal veie lettere enn de høyest prioriterte kriteriene.",
        "Selskapet ønsker at kompleksitet og tvetydighet skal ha en balansert og tydelig plass i modellen. Roller som krever problemløsning i mer usikre eller vanskelig tolkbare sammenhenger skal få et normalt gjennomslag i vurderingen.",
        "Selskapet ønsker at kompleksitet og tvetydighet skal ha sterk påvirkning på rollevurderingen. Roller som håndterer vanskelige, tvetydige eller usikre problemer skal derfor premieres tydelig høyere i modellen.",
        "Selskapet ser kompleksitet og tvetydighet som en av de mest avgjørende faktorene i modellen. Det betyr at roller som får høye rollevurderingspoeng på dette kriteriet også skal få stort gjennomslag i den samlede vurderingen og dermed normalt vurderes relativt høyere lønnsmessig.",
      ],
      compliance: {
        purpose:
          "Måler arbeidets vanskelighetsgrad: teknisk, forretningsmessig og organisatorisk kompleksitet samt graden av usikkerhet når informasjon, retning eller løsning ikke er gitt fra starten.",
        whyRelevant:
          "Evnen til å håndtere mange variabler, avhengigheter og avveininger er en sentral del av en rolles verdi. Det vurderes ut fra oppgavenes faktiske kompleksitet, ikke ut fra hvor teknisk arbeidet fremstår, noe som gjør kriteriet kjønnsnøytralt.",
        overlapNotes:
          "Overlapper delvis med Kunnskapsdybde/-bredde; her ligger fokus på problemenes kompleksitet og usikkerhet snarere enn på kunnskapen som kreves.",
        biasRisk: "low",
        biasComment:
          "Teknisk kompleksitet kan overvurderes mens relasjonell, koordinerende eller flertydig kompleksitet undervurderes. Nivåbeskrivelsene omfatter også organisatorisk og forretningsmessig kompleksitet og er kjønnsnøytrale.",
        biasAction:
          "Ankertekstene beskriver kompleksitet bredt (teknisk, forretningsmessig og organisatorisk) slik at også koordinerende og flertydige sammenhenger vurderes som komplekse.",
      },
    },
    autonomy: {
      name: "Autonomi og beslutningsmyndighet",
      description:
        "Hvor selvstendig rollen er, og hvilket mandat den har til å ta beslutninger.",
      helpText:
        "Dette kriteriet beskriver rollens handlingsrom og beslutningsnivå. Det omfatter graden av selvstendighet, hvor mye styring rollen arbeider under, og hvilken type beslutninger som naturlig ligger innenfor oppdraget. Kriteriet fanger både friheten til å handle og det mandatet rollen har til å påvirke retning, prioriteringer eller utfall.",
      anchors: [
        "Arbeider tett styrt; følger instruksjoner.",
        "Selvstendig i hverdagsoppgaver innenfor definerte rammer.",
        "Tar egne initiativer og prioriteringer innenfor sitt område.",
        "Tar taktiske beslutninger som påvirker et team eller en arbeidsflyt.",
        "Tar strategiske beslutninger innenfor et domene og setter retning for et delområde.",
        "Tar beslutninger som påvirker flere domener eller hele organisasjonen.",
      ],
      weightLevels: [
        "Selskapet ønsker at grad av selvstendighet og beslutningsmyndighet bare skal ha liten påvirkning på den samlede rollevurderingen.",
        "Selskapet mener at autonomi og beslutningsnivå er relevant, men at det normalt skal veie lettere enn de høyere prioriterte kriteriene i modellen.",
        "Selskapet ønsker at autonomi og beslutningsmyndighet skal ha en tydelig og balansert plass i modellen. Rollen skal påvirkes av hvor selvstendig den virker, men uten at dette kriteriet gis ekstra sterk tyngde.",
        "Selskapet ønsker at dette kriteriet skal ha sterk påvirkning. Roller med større selvstendighet og høyere beslutningsmyndighet skal derfor få tydelig større gjennomslag i den samlede vurderingen.",
        "Selskapet ser autonomi og beslutningsmyndighet som en av de mest avgjørende dimensjonene i modellen. Roller som vurderes høyt på selvstendighet og beslutningsnivå skal derfor vurderes tydelig høyere relativt til andre roller.",
      ],
      compliance: {
        purpose:
          "Måler rollens handlingsrom og beslutningsnivå: grad av selvstendighet, hvor mye styring rollen arbeider under og hvilket mandat den har til å påvirke retning, prioriteringer og utfall.",
        whyRelevant:
          "Selvstendighet og beslutningsmyndighet speiler ansvaret rollen bærer. Det vurderes ut fra hvilke beslutninger som faktisk tas, ikke ut fra formell tittel, noe som gjør kriteriet kjønnsnøytralt.",
        overlapNotes:
          "Overlapper delvis med Omfang og påvirkning og Personal-/lederansvar; her ligger fokus på selvstendighet og beslutningsmyndighet snarere enn på rekkevidde eller det å lede andre.",
        biasRisk: "medium",
        biasComment:
          "Synlig beslutningsmandat kan overvurderes sammenlignet med faktisk gjennomslag, noe som kan gagne roller med formelt mandat fremfor seniore spesialister med reell innflytelse. Nivåbeskrivelsene er kjønnsnøytrale.",
        biasAction:
          "Ankertekstene omfatter også selvstendig initiativ og problemløsning, ikke bare formelt beslutningsmandat, slik at reell innflytelse uten tittel kan vurderes høyt.",
      },
    },
    stakeholders: {
      name: "Interessentbredde",
      description:
        "Hvor bred og variert rollens samhandling med interne og eksterne parter er.",
      helpText:
        "Dette kriteriet beskriver bredden i rollens kontaktflater og samhandlingsbehov. Det omfatter interne og eksterne interessenter, tverrfunksjonelle samarbeider og behovet for å samordne arbeid mellom ulike personer, team, funksjoner eller eksterne parter. Kriteriet fanger hvor variert og omfattende denne samhandlingen er.",
      anchors: [
        "Samarbeid hovedsakelig innenfor eget team.",
        "Samarbeid innenfor tilgrensende funksjoner.",
        "Regelmessig tverrfunksjonelt samarbeid.",
        "Koordinering med eksterne parter/kunder eller flere interne funksjoner.",
        "Håndterer et komplekst interessentmiljø med motstridende interesser.",
        "Representerer organisasjonen eksternt og håndterer strategiske interessenter.",
      ],
      weightLevels: [
        "Selskapet ønsker at bredden i samhandling og koordinering bare skal ha liten påvirkning på hvordan roller vurderes relativt til hverandre.",
        "Selskapet vurderer at interessentbredde er relevant, men at kriteriet normalt skal veie lettere enn de høyest prioriterte dimensjonene i modellen.",
        "Selskapet ønsker at interessentbredde skal ha en tydelig og balansert plass i modellen. Roller med bred intern eller ekstern samhandling skal få et normalt gjennomslag i vurderingen.",
        "Selskapet ønsker at dette kriteriet skal ha sterk påvirkning. Roller som krever bred koordinering, mange kontaktflater og omfattende samhandling skal derfor vurderes tydelig høyere.",
        "Selskapet ser interessentbredde som en av de mest avgjørende faktorene i modellen. Høye rollevurderingspoeng på denne dimensjonen skal derfor gi stort gjennomslag i hvordan roller relativvurderes og posisjoneres.",
      ],
      compliance: {
        purpose:
          "Måler bredden i rollens kontaktflater og samhandlingsbehov: interne og eksterne interessenter, tverrfunksjonelt samarbeid og behovet for å samordne arbeid mellom personer, team og parter.",
        whyRelevant:
          "Bred samhandling og samordning er et reelt bidrag til virksomheten. Kriteriet synliggjør relasjonelt og koordinerende arbeid, som vurderes ut fra samhandlingens faktiske omfang og er kjønnsnøytralt.",
        overlapNotes:
          "Overlapper delvis med Omfang og påvirkning; her ligger fokus på bredden og variasjonen i samhandlingen snarere enn på rekkevidden av resultatet.",
        biasRisk: "low",
        biasComment:
          "Dette kriteriet motvirker en kjent bias ved uttrykkelig å verdsette relasjonelt og koordinerende arbeid. Gjenstående risiko: ekstern, synlig representasjon kan overvurderes sammenlignet med internt samordningsarbeid. Nivåbeskrivelsene er kjønnsnøytrale.",
        biasAction:
          "Ankertekstene verdsetter intern tverrfunksjonell samordning likeverdig med ekstern representasjon, slik at synlig ekstern nettverksbygging ikke i seg selv veier tyngre.",
      },
    },
    knowledge: {
      name: "Kunnskapsdybde/-bredde",
      description:
        "Hvilket nivå av spesialistkunnskap, erfaring og bredde over flere områder rollen krever.",
      helpText:
        "Dette kriteriet beskriver hvilken type og hvilket nivå av kunnskap rollen bygger på. Det omfatter spesialistdybde, praktisk erfaring, metodeforståelse og evne til å arbeide på tvers av flere disipliner eller områder. Kriteriet fanger om rollen først og fremst krever fordypning innenfor ett område eller en kombinasjon av flere perspektiver og kompetanser.",
      anchors: [
        "Rollen krever grunnleggende kunnskap. Rollen forutsetter introduksjonsnivå innenfor sitt område og at oppgaver kan utføres gjennom etablerte rutiner og instruksjoner.",
        "Rollen krever solid fagkunnskap innenfor et definert område. Rollen trenger tydelig definert og etablert kompetanse innenfor sitt domene, med evne til å anvende standardiserte arbeidsmetoder.",
        "Rollen krever fordypet kompetanse og metodeforståelse. Rollen må håndtere mer komplekse oppgaver, bruke mer avanserte metoder/verktøy og ha god forståelse av hvordan området fungerer i praksis.",
        "Rollen krever avansert spesialistkompetanse. Rollen krever dypere kunnskap innenfor ett eller flere delområder og evne til å håndtere vanskeligere problemer, gjennomføre analyser og utarbeide løsninger som blir retningsgivende i det operative arbeidet.",
        "Rollen krever ekspertkompetanse innenfor et komplekst domene. Rollen forutsetter at innehaveren definerer metoder, strukturer og arbeidsmåter innenfor sitt domene og fungerer som intern ekspert i kvalifiserte spørsmål.",
        "Rollen krever domeneledende kompetanse og kunnskapsutvikling. Rollen krever at innehaveren utvikler nye arbeidsmåter, modeller eller teknikker og setter retning og prinsipper for organisasjonens fremtidige evner innenfor området.",
      ],
      weightLevels: [
        "Selskapet ønsker at krav om dyp ekspertise, erfaring eller tverrfaglig bredde bare skal ha begrenset påvirkning på den samlede rollevurderingen.",
        "Selskapet mener at kunnskapsdybde og -bredde er relevant, men at det normalt skal veie lettere enn de høyest prioriterte kriteriene.",
        "Selskapet ønsker at kunnskapsdybde og -bredde skal ha en tydelig og balansert plass i modellen. Ekspertise og erfaringskrav skal påvirke vurderingen på et normalt nivå.",
        "Selskapet ønsker at dette kriteriet skal ha sterk påvirkning. Roller som krever dyp spesialistkunnskap, bred domeneforståelse eller omfattende erfaring skal derfor vurderes tydelig høyere i modellen.",
        "Selskapet ser kunnskapsdybde og -bredde som en av de mest avgjørende dimensjonene i modellen. Høye poeng på denne faktoren skal derfor gi sterkt gjennomslag i den samlede rollevurderingen og normalt bidra til høyere relativ lønnsposisjonering.",
      ],
      compliance: {
        purpose:
          "Måler hvilken type og hvilket nivå av kunnskap rollen bygger på: spesialistdybde, praktisk erfaring, metodeforståelse og evne til å arbeide på tvers av flere disipliner eller områder.",
        whyRelevant:
          "Kunnskapsnivå og erfaring er en del av rollens verdi. Kriteriet vurderer faktisk kompetanse og anvendt evne, ikke formelle meritter i seg selv, noe som gjør det kjønnsnøytralt.",
        overlapNotes:
          "Overlapper delvis med Kompleksitet og tvetydighet og Formelle kvalifikasjoner; her ligger fokus på faktisk kunnskap og erfaring snarere enn på problemenes kompleksitet eller formelle krav.",
        biasRisk: "low",
        biasComment:
          "Formelt anerkjent eller synlig ekspertise kan overvurderes sammenlignet med stille, erfaringsbasert kunnskap. Nivåbeskrivelsene tar utgangspunkt i anvendt kompetanse, ikke bare tittel eller utdanning, og er kjønnsnøytrale.",
        biasAction:
          "Ankertekstene verdsetter praktisk erfaring og anvendt metodeforståelse likeverdig med formelt anerkjent spesialisering.",
      },
    },
    financial: {
      name: "Økonomisk ansvar",
      description:
        "Hvor stort ansvar rollen har for budsjett, kostnader, inntekter eller økonomisk resultat.",
      helpText:
        "Dette kriteriet beskriver rollens ansvar for økonomiske ressurser eller økonomiske utfall. Det kan omfatte budsjett, kostnader, inntekter, lønnsomhet, investeringer eller ansvar for et forretningsområde, en portefølje eller andre økonomiske rammer. Kriteriet fanger hvor sentral den økonomiske dimensjonen er i rollen.",
      anchors: [
        "Ikke noe budsjett- eller kostnadsansvar.",
        "Påvirker kostnader indirekte gjennom beslutninger.",
        "Ansvar for en mindre kostnadsramme eller del av et prosjekt/budsjett.",
        "Budsjettansvar innenfor eget område/team.",
        "Ansvar for et større budsjett/forretningsområde.",
        "Ansvar for en betydelig del av selskapets økonomi eller resultat.",
      ],
      weightLevels: [
        "Selskapet ønsker at økonomisk ansvar bare skal ha begrenset påvirkning på den samlede rollevurderingen. Budsjett- eller resultatansvar skal altså ikke gis spesielt stor tyngde i modellen.",
        "Selskapet mener at økonomisk ansvar er relevant, men at det normalt skal veie lettere enn de høyest prioriterte kriteriene.",
        "Selskapet ønsker at økonomisk ansvar skal ha en tydelig og balansert plass i modellen. Budsjettpåvirkning, kostnadsansvar eller resultatansvar skal regnes inn som en normal del av vurderingen.",
        "Selskapet ønsker at dette kriteriet skal ha sterk påvirkning. Roller med tydelig påvirkning på budsjett, kostnader, inntekter eller økonomiske resultater skal derfor vurderes høyere relativt til andre roller.",
        "Selskapet ser økonomisk ansvar som en av de mest avgjørende dimensjonene i modellen. Høye poeng på økonomisk ansvar skal derfor få svært sterkt gjennomslag i den samlede rollevurderingen og normalt bidra til høyere relativ lønnsposisjonering.",
      ],
      compliance: {
        purpose:
          "Måler rollens ansvar for økonomiske ressurser eller utfall: budsjett, kostnader, inntekter, lønnsomhet, investeringer eller ansvar for et forretningsområdes økonomi.",
        whyRelevant:
          "Økonomisk ansvar er en del av rollens bidrag, men verdsettes ut fra graden av faktisk beslutningsansvar for økonomien, ikke ut fra budsjettets størrelse i seg selv, noe som gjør kriteriet kjønnsnøytralt.",
        overlapNotes:
          "Overlapper delvis med Autonomi og beslutningsmyndighet (beslutningsmandat) og Omfang og påvirkning; her ligger fokus spesifikt på ansvar for økonomiske rammer og resultater.",
        biasRisk: "medium",
        biasComment:
          "Stort budsjett kan gis for stor vekt sammenlignet med kompleksitet, ansvar og spesialistkunnskap, noe som kan gagne tradisjonelt mannsdominerte budsjettbærende roller. Nivåbeskrivelsene er kjønnsnøytrale.",
        biasAction:
          "Kriteriet holdes på en moderat vekt i modellen slik at budsjettstørrelse ikke i seg selv dominerer vurderingen, og nivåene beskriver beslutningsansvar snarere enn bare beløpenes størrelse.",
      },
    },
    people: {
      name: "Personal-/lederansvar",
      description:
        "Hvor stort ansvar rollen har for å lede andre, organisere arbeid og skape resultater gjennom mennesker.",
      helpText:
        "Dette kriteriet beskriver rollens ansvar for ledelse av andre. Det omfatter formelt personalansvar, operativ arbeidsledelse, teamledelse og ansvar for større organisatoriske enheter eller andre ledere. Kriteriet fanger både omfanget av ledelsesoppdraget og ansvaret for kapasitet, prioritering, utvikling og retning gjennom andre.",
      anchors: [
        "Ikke noe personal- eller lederansvar.",
        "Operativ styring av arbeid, men ikke noe HR-ansvar.",
        "Personalansvar for medarbeidere (M1).",
        "Leder over flere team eller førstelinjeledere (M2).",
        "Funksjonsleder med flere ledernivåer eller en større organisasjon.",
        "Strategisk leder på selskapsnivå (Head/Director/C-level).",
      ],
      weightLevels: [
        "Selskapet ønsker at personal- og lederansvar bare skal ha begrenset påvirkning på den samlede rollevurderingen. Formelt lederskap skal altså ikke i seg selv drive vurderingen spesielt mye.",
        "Selskapet vurderer at personal- og lederansvar er relevant, men at det normalt skal veie lettere enn de høyest prioriterte kriteriene i modellen.",
        "Selskapet ønsker at personal- og lederansvar skal ha en tydelig og balansert plass i modellen. Å lede andre skal påvirke vurderingen, men uten å gis spesielt forsterket tyngde.",
        "Selskapet ønsker at dette kriteriet skal ha sterk påvirkning. Roller med større lederansvar, teamansvar eller formelt lederskap skal derfor vurderes tydelig høyere relativt til andre roller.",
        "Selskapet ser personal- og lederansvar som en av de mest avgjørende faktorene i modellen. Høye rollevurderingspoeng på denne dimensjonen skal derfor få stort gjennomslag i den samlede vurderingen og normalt også i den relative lønnslogikken.",
      ],
      compliance: {
        purpose:
          "Måler rollens ansvar for å lede andre: formelt personalansvar, operativ arbeidsledelse, teamledelse og ansvar for kapasitet, prioritering og utvikling gjennom andre mennesker.",
        whyRelevant:
          "Å lede andre er en del av rollens bidrag til virksomhetens verdi. Det vurderes ut fra lederoppdragets omfang og innhold, ikke ut fra tittel eller antall underordnede, slik at det å lede et lite team godt og det å lede et stort vurderes på faktisk ansvar snarere enn på synlig rang.",
        overlapNotes:
          "Overlapper delvis med Omfang og påvirkning (organisatorisk rekkevidde) og Autonomi og beslutningsmyndighet (beslutningsmandat); her ligger fokus spesifikt på ansvar som utøves gjennom andre mennesker.",
        biasRisk: "medium",
        biasComment:
          "Å belønne synlig mandat og antall underordnede mer enn faktisk lederpåvirkning kan overvurdere tradisjonelt mannsdominerte lederroller og undervurdere seniore spesialister og koordineringstungt arbeid. Nivåbeskrivelsene i seg selv er kjønnsnøytrale.",
        biasAction:
          "Nivåankrene beskriver lederskapets innhold snarere enn bare antall underordnede, og kriteriet holdes på en moderat vekt slik at en ledertittel ikke i seg selv dominerer vurderingen.",
      },
    },
    formal: {
      name: "Formelle kvalifikasjoner",
      description:
        "Hvilke formelle kvalifikasjonskrav, som utdanning eller sertifisering, som normalt er knyttet til rollen.",
      helpText:
        "Dette kriteriet beskriver de formelle kompetansekravene som typisk er knyttet til rollen. Det kan omfatte utdanningsnivå, eksamen, sertifisering, autorisasjon eller annen formelt anerkjent kompetanse som kreves eller vanligvis etterspørres. Kriteriet fanger den formelle inngangsnivået til rollen, uavhengig av den nåværende personens bakgrunn.",
      anchors: [
        "Ingen formelle forkunnskaper kreves. Rollen kan læres fra grunnen gjennom intern opplæring. Krever ingen særskilt teoretisk base eller yrkesutdanning.",
        "Grunnleggende fagkunnskap kreves. Rollen krever noe forkunnskap innenfor området (f.eks. kortere kurs eller praktisk erfaring), men ingen utdanning utover videregående.",
        "Yrkesfaglig utdanning etter videregående eller tilsvarende forkunnskaper kreves. Rollen krever fagskoleutdanning, sertifisering eller tilsvarende teoretisk base for å kunne utføre oppgavene.",
        "Universitetsgrad eller tilsvarende kvalifiserte forkunnskaper kreves. Rollen krever en bachelorgrad/ingeniørutdanning eller tilsvarende dokumentert kompetanse for å håndtere typiske oppgaver.",
        "Avansert akademisk nivå eller avansert spesialistsertifisering kreves. Rollen krever f.eks. mastergrad, avansert sertifisering (IFRS, TISAX, sikkerhetsklarering, CPA osv.) eller tilsvarende høyt teoretisk nivå.",
        "Fagekspertise på høyeste nivå kreves. Rollen krever kompetanse på forskningsnivå, avansert ekspertakkreditering eller svært betydelig domenespesifikk ekspertise som setter normen for området.",
      ],
      weightLevels: [
        "Selskapet ønsker at krav om formelle kvalifikasjoner bare skal ha begrenset påvirkning på den samlede rollevurderingen.",
        "Selskapet vurderer at formelle kvalifikasjoner er relevant, men at kriteriet normalt skal veie lettere enn de høyere prioriterte dimensjonene i modellen.",
        "Selskapet ønsker at formelle kvalifikasjoner skal ha en tydelig og balansert plass i modellen. Utdanningskrav eller tilsvarende erfaringskrav skal påvirke vurderingen på et normalt nivå.",
        "Selskapet ønsker at dette kriteriet skal ha sterk påvirkning. Roller der formelle kvalifikasjoner eller tilsvarende erfaringsnivå er spesielt viktig skal derfor få tydelig større gjennomslag i modellen.",
        "Selskapet ser formelle kvalifikasjoner som en av de mest avgjørende dimensjonene i modellen. Høye vurderingspoeng på denne faktoren skal derfor påvirke den samlede rollevurderingen sterkt og normalt bidra til høyere relativ lønnsposisjonering.",
      ],
      compliance: {
        purpose:
          "Måler de formelle kompetansekravene som typisk er knyttet til rollen: utdanningsnivå, eksamen, sertifisering, autorisasjon eller annen formelt anerkjent kompetanse, uavhengig av den nåværende personens bakgrunn.",
        whyRelevant:
          "Formelle kvalifikasjonskrav kan speile kunnskapsnivået rollen forutsetter. Kriteriet beskriver rollens formelle inngangsnivå, ikke individet, og holdes knyttet til faktisk arbeidsinnhold for å forbli kjønnsnøytralt.",
        overlapNotes:
          "Overlapper delvis med Kunnskapsdybde/-bredde; her ligger fokus på formelle krav snarere enn på faktisk anvendt kunnskap og erfaring.",
        biasRisk: "medium",
        biasComment:
          "Å hvile på formell status i stedet for faktisk arbeidsinnhold kan misgunstige kompetanse som er ervervet på andre måter enn tradisjonell utdanning. Nivåbeskrivelsene tillater tilsvarende dokumentert erfaring og er kjønnsnøytrale.",
        biasAction:
          "Nivåene anerkjenner uttrykkelig tilsvarende erfaring ved siden av formell utdanning, og kriteriet holdes på lav vekt slik at formelle meritter ikke i seg selv driver vurderingen.",
      },
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
