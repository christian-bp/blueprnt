import type { CriteriaLibraryContent } from "./criteriaLibrary.content.en"

// Norwegian Bokmål content for the criteria library (the masterdokument's
// sections 5-13.5). Machine-translated from criteriaLibraryContentSv (the
// substance source), cross-checked against criteriaLibraryContentEn where a
// Swedish phrase was ambiguous. Structure mirrors en/sv exactly: only the
// three section 13.5 entries (scope-impact, complexity-ambiguity,
// risk-consequence) carry anchor2/anchor4. Reviewed against en and sv for
// terminology, register and false friends; "vesentlig" is the Bokmål term
// for material in the materiality sense, never "materiell".
export const criteriaLibraryContentNb: CriteriaLibraryContent = {
  modelName: "Rollevurderingsmodell",
  dimensions: {
    competence: {
      name: "Kompetanse",
      question:
        "Hvilke kunnskaper, ferdigheter, erfaringer og kvalifikasjoner krever rollen?",
      why: "Beskytter spesialist-, profesjons- og kvalifikasjonskrevende roller mot å bli undervurdert.",
    },
    effort: {
      name: "Innsats og kompleksitet",
      question:
        "Hvor vanskelig, uklar, analytisk, kommunikativt eller fysisk krevende er rollen?",
      why: "Synliggjør krevende arbeid selv når rollen mangler formell ledermakt.",
    },
    responsibility: {
      name: "Ansvar og påvirkning",
      question:
        "Hvilken rekkevidde, hvilket mandat og hvilke konsekvenser har rollen?",
      why: "Fanger opp ansvar for beslutninger, resultater, risiko, mennesker, kvalitet og virksomhet.",
    },
    workingConditions: {
      name: "Arbeidsforhold",
      question:
        "Finnes det særskilte, objektive og varige arbeidsforhold som påvirker kravene?",
      why: "Synliggjør for eksempel beredskap, eksponering, sikkerhetskrav og uregelmessige forhold.",
    },
  },
  workingConditionsTest: {
    question:
      "Finnes det minst én rollfamilie der særskilte arbeidsforhold er en tilbakevendende, objektiv og vesentlig del av rollens krav, og der kravet ikke allerede fanges korrekt opp av et annet kriterium?",
    notMaterialLabel: "Testet, men ikke vesentlig relevant",
  },
  sharedScale: {
    "1": {
      name: "Avgrenset krav",
      meaning:
        "Kravet er tydelig definert, lokalt eller begrenset i omfang. Rollen arbeider hovedsakelig innenfor etablerte rammer.",
    },
    "2": {
      name: "Grunnleggende til moderat krav",
      meaning:
        "Kravet forekommer tilbakevendende, men innenfor et tydelig avgrenset område. Rollen håndterer variasjoner og enklere avvik.",
    },
    "3": {
      name: "Selvstendig og etablert krav",
      meaning:
        "Kravet er en tydelig og tilbakevendende del av rollen. Rollen gjør profesjonelle vurderinger innenfor sitt område.",
    },
    "4": {
      name: "Avansert eller bredt krav",
      meaning:
        "Kravet er avansert, har bredere rekkevidde eller krever selvstendige avveininger der etablerte arbeidsmåter ikke alltid strekker til.",
    },
    "5": {
      name: "Svært avansert, omfattende eller virksomhetskritisk krav",
      meaning:
        "Kravet har svært stort omfang, vanskelighetsgrad, konsekvens eller strategisk betydning. Rollen former ofte retning, standarder, løsninger eller resultater utenfor sitt eget nærmeste område.",
    },
  },
  midpoints: {
    step2: "Et gjennomtenkt mellomnivå mellom trinn 1 og 3.",
    step4: "Et gjennomtenkt mellomnivå mellom trinn 3 og 5.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Kunnskapsdybde og spesialistnivå",
      shortUiText:
        "Rollens krav til fordypet spesialistkunnskap og avansert problemløsning.",
      fullDefinition:
        "Fanger rollens krav til fordypet fagkunnskap, spesialistmetodikk, avansert problemløsning og relevant erfaring. Kriteriet måler dybden i den ekspertisen rollen normalt bruker, ikke en formell eksamen i seg selv eller hvordan et enkelt problem tilfeldigvis ble løst.",
      measures:
        "Krav til fordypet fagkunnskap, spesialistmetodikk, avansert problemløsning og relevant erfaring.",
      notMeasures:
        "Formell eksamen i seg selv, vanskelighetsgraden i et enkelt problem eller individets prestasjon.",
      whenSuitable: "Nesten alltid relevant i kunnskapsintensive virksomheter.",
      whenNotSuitable:
        "Velg normalt dette eller det bredere samlede kompetansekriteriet, ikke begge.",
      controlQuestion:
        "Har dybden i den spesialistkunnskapen rollen krever, betydning i seg selv, atskilt fra dens bredde, formelle kvalifikasjoner, domenekontekst og rådgivningsvurdering?",
      assessmentQuestion:
        "Hvilket nivå av spesialistkunnskapsdybde krever rollen normalt og varig?",
      anchor1:
        "Rollen bruker etablert, veldokumentert fagkunnskap innenfor et tydelig avgrenset område og anvender kjente metoder på velkjente problemer.",
      anchor3:
        "Rollen anvender selvstendig fordypet spesialistkunnskap og etablert fagmetodikk for å løse problemer innenfor sitt eget område.",
      anchor5:
        "Rollen besitter spesialistkunnskap på svært avansert nivå og engasjeres ofte for fagfeltets vanskeligste problemer, noe som former profesjonelle standarder eller praksis utenfor eget team.",
    },
    "knowledge-breadth": {
      name: "Kunnskapsbredde og tverrfaglig forståelse",
      shortUiText:
        "Rollens krav til å integrere flere kompetanseområder og forstå sammenhengen mellom dem.",
      fullDefinition:
        "Fanger rollens krav til å kombinere og integrere flere kompetanseområder, for eksempel produkt, data, forretning og teknologi, og å forstå hvordan de henger sammen. Kriteriet måler bredden i integrasjonen, ikke antallet personer rollen samarbeider med.",
      measures:
        "Krav til å integrere flere kompetanseområder og forstå sammenhengen mellom dem.",
      notMeasures: "Antall samarbeidspartnere eller organisatorisk påvirkning.",
      whenSuitable:
        "Når roller må kombinere flere fagområder, for eksempel produkt, data, forretning og teknologi.",
      whenNotSuitable:
        "Velg bare når bredde er en selvstendig forskjell fra spesialistdybde.",
      controlQuestion:
        "Har bredden i kompetansen rollen integrerer, betydning i seg selv, atskilt fra hvor dyp spesialistkunnskapen er?",
      assessmentQuestion:
        "Hvilket nivå av tverrfaglig bredde krever rollen normalt og varig?",
      anchor1:
        "Rollen bruker hovedsakelig ett kompetanseområde og trenger sjelden å koble det til andre disipliner.",
      anchor3:
        "Rollen kombinerer selvstendig et fåtall etablerte kompetanseområder og forstår hvordan de påvirker hverandre.",
      anchor5:
        "Rollen integrerer mange ulike kompetanseområder på svært avansert nivå og er den man stoler på for å koble dem sammen på måter som former løsninger eller retning utenfor eget område.",
    },
    "formal-qualifications": {
      name: "Formelle kvalifikasjons-, autorisasjons- og sertifiseringskrav",
      shortUiText:
        "Rollens krav til obligatorisk autorisasjon, godkjenning eller sertifisering.",
      fullDefinition:
        "Fanger formelle krav rollen må oppfylle for lovlig å utøve, signere eller ha ansvar for arbeidet, for eksempel en obligatorisk autorisasjon, godkjenning eller sertifisering. Kriteriet måler det formelle kravet i seg selv, ikke generell utdanningsstatus eller en prestisjefylt eksamen som ikke kreves for å utføre arbeidet.",
      measures:
        "Formelle krav som kreves for å utøve, signere eller ha ansvar for arbeidet.",
      notMeasures:
        "Generell utdanningsstatus, prestisjefylt eksamen eller frivillige kurs.",
      whenSuitable:
        "Regulerte eller sikkerhetskritiske roller med obligatorisk autorisasjon, godkjenning eller sertifisering.",
      whenNotSuitable:
        "Skal ikke brukes hvis utdanning bare er en vei til kompetanse som allerede fanges av Kunnskapsdybde.",
      controlQuestion:
        "Har rollens obligatoriske autorisasjon, godkjenning eller sertifisering betydning i seg selv, atskilt fra spesialistkunnskapen den også krever?",
      assessmentQuestion:
        "Hvilket nivå av formell kvalifikasjon, autorisasjon eller sertifisering krever rollen normalt og varig?",
      anchor1:
        "Rollen har ikke noe krav til autorisasjon, godkjenning eller sertifisering, eller bare et grunnleggende, tydelig definert slikt krav med begrenset krav til fornyelse eller omfang.",
      anchor3:
        "Rollen krever en etablert yrkesautorisasjon eller sertifisering som er et tilbakevendende, selvstendig vilkår for å utøve rollen.",
      anchor5:
        "Rollen krever en avansert eller virksomhetskritisk autorisasjon, godkjenning eller sertifisering, uten hvilken rollen ikke lovlig kan utøves, signeres eller ansvares for, og som ofte setter standarden andre må oppfylle.",
    },
    "domain-knowledge": {
      name: "Domene- og virksomhetskunnskap",
      shortUiText:
        "Rollens krav til dyp, vanskelig erstattbar kunnskap om sin spesifikke bransje eller virksomhetskontekst.",
      fullDefinition:
        "Fanger rollens krav til dyp kontekstkunnskap, for eksempel bransje, produkt, kundemiljø eller regelverkskontekst, som ikke raskt kan erstattes av generell yrkesdyktighet. Kriteriet måler dybden i kontekstkunnskapen, ikke den generelle erfaringen eller organisasjonskunnskapen alle forventes å bygge opp over tid.",
      measures:
        "Dyp kontekstkunnskap som ikke raskt erstattes av generell yrkesdyktighet.",
      notMeasures:
        "Generell erfaring eller organisasjonskunnskap som alle forventes å bygge opp.",
      whenSuitable:
        "Når spesifikk bransje-, produkt-, kundemiljø- eller regelverkskunnskap er en egen forutsetning for rollen.",
      whenNotSuitable:
        "Domene = konteksten; spesialistnivå = profesjonell metode og ferdighet.",
      controlQuestion:
        "Har rollens kontekstspesifikke domenekunnskap betydning i seg selv, atskilt fra dens generelle spesialistmetode og ferdighet?",
      assessmentQuestion:
        "Hvilket nivå av domene- og virksomhetskunnskap krever rollen normalt og varig?",
      anchor1:
        "Rollen krever domenekunnskap begrenset til en tydelig avgrenset produkt-, prosess- eller kundekontekst.",
      anchor3:
        "Rollen krever etablert, selvstendig kunnskap om sitt virksomhetsdomene som ikke raskt erstattes av generell yrkesdyktighet.",
      anchor5:
        "Rollen krever svært dyp, virksomhetskritisk domenekunnskap som er vanskelig å erstatte og som ofte former hvordan domenets standarder eller praksis fastsettes utenfor rollens eget område.",
    },
    "advisory-judgment": {
      name: "Rådgivnings- og vurderingskompetanse",
      shortUiText:
        "Rollens krav til å veie informasjon og omsette ekspertise i kvalifiserte anbefalinger.",
      fullDefinition:
        "Fanger rollens krav til å veie informasjon, utøve profesjonell vurderingsevne og omsette ekspertise i kvalifiserte råd eller anbefalinger som andre handler ut fra. Kriteriet måler selve rådgivningsvurderingen, ikke det formelle mandatet til å beslutte hva som skjer videre.",
      measures:
        "Krav til å vurdere informasjon, gi kvalifiserte råd og omsette ekspertise i anbefalinger.",
      notMeasures: "Formelt beslutningsmandat.",
      whenSuitable:
        "Konsulent-, partner-, spesialist- og ledende ekspertroller der kvalifiserte råd er kjerneleveransen.",
      whenNotSuitable:
        "Skal ikke kombineres med Kunnskapsdybde hvis det bare beskriver samme ekspertise med andre ord.",
      controlQuestion:
        "Har rollens krav til å utøve rådgivningsvurdering betydning i seg selv, atskilt fra spesialistkunnskapen vurderingen bygger på?",
      assessmentQuestion:
        "Hvilket nivå av rådgivnings- og vurderingskompetanse krever rollen normalt og varig?",
      anchor1:
        "Rollen bidrar med underlag eller ukompliserte råd innenfor et tydelig avgrenset område, i tråd med etablert veiledning.",
      anchor3:
        "Rollen veier selvstendig informasjon og gir etablerte, profesjonelle råd som andre stoler på innenfor sitt eget område.",
      anchor5:
        "Rollens råd og vurderinger etterspørres i svært avanserte eller virksomhetskritiske spørsmål og former ofte de anbefalingene, standardene eller retningen andre deler av virksomheten følger.",
    },
    "complexity-ambiguity": {
      name: "Kompleksitet og uklarhet",
      shortUiText:
        "Rollens krav til å håndtere usikkerhet, mangefasetterte spørsmål og uklare rammer med kvalifisert vurderingsevne.",
      fullDefinition:
        "Fanger usikkerheten, de mangefasetterte spørsmålene, uklare rammer og behovet for kvalifisert vurderingsevne rollen normalt arbeider med. Kriteriet måler karakteren til problemene rollen håndterer, ikke kunnskapskravet i seg selv, arbeidstempoet eller den organisatoriske rekkevidden.",
      measures:
        "Usikkerhet, mangefasetterte spørsmål, uklare rammer og behov for kvalifisert vurderingsevne.",
      notMeasures:
        "Kunnskapskravet i seg selv, høyt arbeidstempo eller organisatorisk rekkevidde.",
      whenSuitable: "Nesten alltid relevant.",
      whenNotSuitable: "Bør normalt være hovedkriteriet innenfor dimensjonen.",
      controlQuestion:
        "Har kompleksiteten og uklarheten rollen håndterer, betydning i seg selv, atskilt fra den analytiske innsatsen som legges i å arbeide seg gjennom den?",
      assessmentQuestion:
        "Hvilket nivå av kompleksitet og uklarhet håndterer rollen normalt og varig?",
      anchor1:
        "Rollen arbeider hovedsakelig med tydelig definerte spørsmål, etablerte metoder og forutsigbare situasjoner.",
      anchor2:
        "Rollen håndterer tilbakevendende variasjoner og enklere avvik der den velger mellom kjente alternativer.",
      anchor3:
        "Rollen håndterer selvstendig komplekse spørsmål innenfor sitt område og må analysere, prioritere og tilpasse løsninger.",
      anchor4:
        "Rollen håndterer avanserte, tverrfunksjonelle eller delvis uklare problemer der etablerte løsninger ikke alltid strekker til.",
      anchor5:
        "Rollen definerer og håndterer svært komplekse eller strategisk viktige problemer under høy usikkerhet, og former ofte tilnærming, prinsipper eller langsiktige løsninger.",
    },
    "analytical-effort": {
      name: "Analytisk og problemløsende innsats",
      shortUiText:
        "Omfanget av analyse, feilsøking eller systematisk problemløsning rollen normalt utfører.",
      fullDefinition:
        "Fanger omfanget av analyse, feilsøking, modellering, diagnostikk eller systematisk problemløsning rollen normalt utfører. Kriteriet måler det analytiske arbeidet i seg selv, ikke spesialistkunnskapen bak det eller bare forekomsten av uklare problemer.",
      measures:
        "Omfang av analyse, feilsøking, modellering, diagnostikk eller systematisk problemløsning.",
      notMeasures: "Spesialistkunnskap eller bare uklare problemer.",
      whenSuitable:
        "Når den mentale analysebyrden skiller seg tydelig mellom roller til tross for sammenlignbar kompleksitet.",
      whenNotSuitable:
        "Kombiner med Kompleksitet bare hvis forskjellen kan forklares: kompleksitet = problemets natur; analyse = arbeidet som kreves for å håndtere det.",
      controlQuestion:
        "Har den analytiske innsatsen rollen legger i å løse problemer, betydning i seg selv, atskilt fra hvor komplekse eller uklare disse problemene er?",
      assessmentQuestion:
        "Hvilket nivå av analytisk og problemløsende innsats bærer rollen normalt og varig?",
      anchor1:
        "Rollen utfører ukomplisert analyse eller feilsøking innenfor en tydelig avgrenset oppgave, i tråd med etablerte trinn.",
      anchor3:
        "Rollen utfører selvstendig etablert analyse, diagnostikk eller systematisk problemløsning som en tilbakevendende del av sitt eget område.",
      anchor5:
        "Rollen utfører svært avansert eller omfattende analyse, modellering eller diagnostikk som ofte er virksomhetskritisk og former hvordan lignende problemer angripes utenfor eget område.",
    },
    "communication-effort": {
      name: "Kommunikasjons- og relasjonskrevende arbeid",
      shortUiText:
        "Rollens krav til avansert kommunikasjon, forhandling eller konflikthåndtering.",
      fullDefinition:
        "Fanger rollens krav til avansert kommunikasjon, forhandling, påvirkning, konflikthåndtering eller oversettelse mellom ulike interesser. Kriteriet måler den kommunikative innsatsen, ikke antallet interessenter rollen tilfeldigvis håndterer eller dens organisatoriske påvirkning.",
      measures:
        "Krav til avansert kommunikasjon, forhandling, påvirkning, konflikthåndtering eller oversettelse mellom interesser.",
      notMeasures: "Antall interessenter eller organisatorisk påvirkning.",
      whenSuitable:
        "Kundenære, forhandlende, rådgivende eller konflikthåndterende virksomheter der dette er en sentral del av arbeidet.",
      whenNotSuitable:
        "Måles som kommunikativ innsats, ikke som størrelsen på nettverket.",
      controlQuestion:
        "Har den kommunikative innsatsen rollen bærer, betydning i seg selv, atskilt fra hvor mange interessenter eller hvor stor organisatorisk rekkevidde den har?",
      assessmentQuestion:
        "Hvilket nivå av kommunikasjons- og relasjonsinnsats bærer rollen normalt og varig?",
      anchor1:
        "Rollen kommuniserer innenfor et tydelig avgrenset, for det meste rutinemessig samspill med etablerte motparter.",
      anchor3:
        "Rollen gjennomfører selvstendig etablert, tilbakevendende kommunikasjon, forhandling eller konflikthåndtering som en del av sitt eget område.",
      anchor5:
        "Rollen bærer svært avansert eller virksomhetskritisk kommunikasjon, forhandling eller konflikthåndtering og former ofte hvordan sensitive relasjoner eller tvister håndteres utenfor eget område.",
    },
    "operational-intensity": {
      name: "Operativ intensitet og samtidighetskrav",
      shortUiText:
        "Rollens normale krav til å holde oppmerksomheten på flere samtidige strømmer og prioritere fortløpende.",
      fullDefinition:
        "Fanger oppmerksomheten, simultanevnen og den kontinuerlige prioriteringen rollen normalt krever i sin ordinære arbeidsmodus. Kriteriet måler et varig, strukturelt krav, ikke midlertidige topper, underbemanning eller dårlig planlegging som tilfeldigvis øker arbeidsmengden.",
      measures:
        "Oppmerksomhet, simultanevne og kontinuerlig prioritering i normalmodus.",
      notMeasures:
        "Midlertidige topper, underbemanning eller dårlig planlegging.",
      whenSuitable:
        "Drift, kundeservice, logistikk eller overvåkning med varige krav til flere samtidige strømmer og raske prioriteringer.",
      whenNotSuitable:
        "Skal ikke brukes til å belønne arbeidsmengde som oppstår på grunn av ressursmangel.",
      controlQuestion:
        "Har rollens normale operative intensitet betydning i seg selv, atskilt fra midlertidige topper forårsaket av underbemanning eller dårlig planlegging?",
      assessmentQuestion:
        "Hvilket nivå av operativ intensitet og samtidighetskrav bærer rollen normalt og varig?",
      anchor1:
        "Rollen håndterer normalt én strøm eller oppgave om gangen innenfor en tydelig avgrenset arbeidsrytme.",
      anchor3:
        "Rollen håndterer selvstendig flere etablerte, samtidige strømmer og prioriterer mellom dem som en normal del av sitt eget område.",
      anchor5:
        "Rollen opprettholder svært høy, virksomhetskritisk operativ intensitet over mange samtidige strømmer, og hvordan den prioriterer setter ofte mønsteret andre følger.",
    },
    "physical-sensory": {
      name: "Fysisk eller sensorisk anstrengelse",
      shortUiText:
        "Rollens tilbakevendende fysiske belastning, presisjonskrav eller sensoriske konsentrasjon.",
      fullDefinition:
        "Fanger den tilbakevendende fysiske belastningen, presisjonen, ergonomisk krevende moment eller sensoriske konsentrasjonen rollen normalt krever. Kriteriet måler den fysiske eller sensoriske anstrengelsen i seg selv, ikke sikkerhetsrisikoen eller eksponeringen arbeidet også kan innebære.",
      measures:
        "Tilbakevendende fysisk belastning, presisjon, ergonomisk krevende moment eller sensorisk konsentrasjon.",
      notMeasures: "Sikkerhetsrisiko eller fysisk eksponering.",
      whenSuitable:
        "Industri, helse, lager, produksjon, feltservice eller laboratorier.",
      whenNotSuitable:
        "Risikomiljø og eksponering hører normalt til Arbeidsforhold.",
      controlQuestion:
        "Har den fysiske eller sensoriske anstrengelsen rollen bærer, betydning i seg selv, atskilt fra sikkerhetsrisikoen eller eksponeringen den også kan innebære?",
      assessmentQuestion:
        "Hvilket nivå av fysisk eller sensorisk anstrengelse bærer rollen normalt og varig?",
      anchor1:
        "Rollen innebærer lette, midlertidige fysiske eller sensoriske krav innenfor en tydelig avgrenset oppgave.",
      anchor3:
        "Rollen bærer selvstendig etablert, tilbakevendende fysisk belastning, presisjonsarbeid eller sensorisk konsentrasjon som en normal del av sitt eget område.",
      anchor5:
        "Rollen bærer svært krevende, vedvarende fysisk eller sensorisk anstrengelse som ofte er virksomhetskritisk å utføre riktig, for eksempel presisjonsarbeid som setter standarden andre måles mot.",
    },
    "scope-impact": {
      name: "Omfang og påvirkning",
      shortUiText:
        "Rollens rekkevidde: fra en avgrenset oppgave til team, funksjon, flere funksjoner eller hele selskapet.",
      fullDefinition:
        "Fanger hvor langt rollens resultater og beslutninger strekker seg i organisasjonen, fra tydelig avgrensede egne oppgaver til selskapsovergripende påvirkning. Kriteriet måler rekkevidde, ikke formell myndighet.",
      measures:
        "Rollens rekkevidde: fra avgrenset oppgave til team, funksjon, flere funksjoner eller selskap.",
      notMeasures:
        "Formelt personalansvar, budsjettstørrelse eller selve mandatet.",
      whenSuitable: "Nesten alltid relevant.",
      whenNotSuitable:
        "Skal ikke kombineres med et separat kriterium som bare måler organisatorisk rekkevidde.",
      controlQuestion:
        "Har forskjellen i rekkevidde mellom rollene deres betydning i seg selv, utover mandat og konsekvens?",
      assessmentQuestion:
        "Hvor langt strekker rollens normale og varige påvirkning seg?",
      anchor1:
        "Rollen påvirker først og fremst kvaliteten, effektiviteten eller resultatet i egne tydelig avgrensede arbeidsoppgaver.",
      anchor2:
        "Rollen påvirker et avgrenset arbeidsområde eller tilbakevendende leveranse innenfor et team.",
      anchor3:
        "Rollen har selvstendig ansvar for resultater innenfor et tydelig område og påvirker teamets eller nærliggende funksjoners leveranse og prioriteringer.",
      anchor4:
        "Rollen påvirker flere team, en funksjon eller en vesentlig del av virksomheten gjennom valg, prioriteringer eller løsninger med varige følger.",
      anchor5:
        "Rollen påvirker selskapets overordnede retning, resultater eller evne til å lykkes gjennom beslutninger og ansvar med selskapsovergripende eller strategisk effekt.",
    },
    "autonomy-mandate": {
      name: "Autonomi og beslutningsmandat",
      shortUiText:
        "Hvor selvstendig rollen beslutter, og på hvilket nivå, før eskalering kreves.",
      fullDefinition:
        "Fanger hvor selvstendig rollen fatter beslutninger, på hvilket nivå beslutningene ligger og hvor mye som må eskaleres til noen andre. Kriteriet måler selve beslutningsmandatet, ikke konsekvensen av beslutningen eller hvor langt effekten strekker seg.",
      measures: "Selvstendighet, beslutningenes nivå og behov for eskalering.",
      notMeasures:
        "Konsekvensen av beslutningen eller dens organisatoriske rekkevidde.",
      whenSuitable: "Nesten alltid relevant.",
      whenNotSuitable:
        "Mandat = retten til å beslutte; omfang = hvor effekten merkes; risiko = følgen hvis det blir feil.",
      controlQuestion:
        "Har nivået av beslutningsmandat rollen har, betydning i seg selv, atskilt fra hvor effektene merkes og hva konsekvensene ville blitt om det ble feil?",
      assessmentQuestion:
        "Hvilket nivå av autonomi og beslutningsmandat har rollen normalt og varig?",
      anchor1:
        "Rollen fatter beslutninger innenfor en tydelig avgrenset oppgave og eskalerer alt som ligger utenfor etablert rutine.",
      anchor3:
        "Rollen fatter selvstendig etablerte beslutninger innenfor sitt eget område og eskalerer bare genuint nye eller tverrgående spørsmål.",
      anchor5:
        "Rollen har svært bredt eller virksomhetskritisk beslutningsmandat og beslutter i spørsmål der retningen eller standardene strekker seg utenfor eget nærmeste område, med lite behov for eskalering.",
    },
    "risk-consequence": {
      name: "Risiko og konsekvens",
      shortUiText:
        "Konsekvensene for virksomheten hvis rollens beslutninger, feil eller mangler slår feil.",
      fullDefinition:
        "Fanger konsekvensene rollens beslutninger, feil eller mangler kan få for sikkerhet, kunde, kvalitet, etterlevelse, informasjon eller merkevare. Kriteriet måler konsekvens bredt, ikke bare økonomisk risiko eller hvor belastende individet opplever rollen.",
      measures:
        "Følger av beslutninger, feil eller mangler for sikkerhet, kunde, kvalitet, etterlevelse, informasjon eller merkevare.",
      notMeasures: "Bare økonomisk risiko eller individets stressnivå.",
      whenSuitable: "Nesten alltid relevant.",
      whenNotSuitable:
        "Unngå separat compliance-risiko hvis den bare er et eksempel på samme risiko og konsekvens.",
      controlQuestion:
        "Har konsekvensen av rollens beslutninger eller feil betydning i seg selv, atskilt fra det formelle etterlevelsesansvaret den også kan bære?",
      assessmentQuestion:
        "Hvilket nivå av risiko og konsekvens bærer rollens beslutninger og arbeid normalt og varig?",
      anchor1:
        "Feil eller mangler får normalt begrensede og lett korrigerbare følger innenfor eget arbeidsområde.",
      anchor2:
        "Feil eller mangler kan påvirke teamets kvalitet, effektivitet eller leveranse og krever normalt korrigering innenfor etablerte prosesser.",
      anchor3:
        "Feil, beslutninger eller mangler kan få tydelige følger for kunde, leveranse, kvalitet, økonomi eller etterlevelse innenfor et område.",
      anchor4:
        "Feil, beslutninger eller mangler kan få betydelige følger for flere deler av virksomheten, viktige kunder, kritiske prosesser eller regeletterlevelse.",
      anchor5:
        "Feil, beslutninger eller mangler kan få svært store, langvarige eller virksomhetskritiske følger for strategi, sikkerhet, etterlevelse, tillit eller overlevelsesevne.",
    },
    "people-leadership": {
      name: "Personal- og ledelsesansvar",
      shortUiText:
        "Rollens formelle ansvar for å lede mennesker og skape resultater gjennom dem.",
      fullDefinition:
        "Fanger rollens formelle ansvar for å lede mennesker: fordele arbeid, utvikle deres kapasitet og skape resultater gjennom andre. Kriteriet måler formelt personalansvar, ikke prosjektledelse uten dette, spesialistledelse eller teamstørrelse brukt som eneste mål.",
      measures:
        "Ansvar for å lede mennesker, fordele arbeid, utvikle kapasitet og skape resultater gjennom andre.",
      notMeasures:
        "Prosjektledelse uten personalansvar, spesialistledelse eller teamstørrelse som eneste mål.",
      whenSuitable:
        "Når formelt personalansvar er en vesentlig forskjell mellom roller.",
      whenNotSuitable:
        "Skal normalt ha lav til moderat vekt siden lederskap ofte allerede vises i omfang og mandat.",
      controlQuestion:
        "Har rollens formelle personalansvar betydning i seg selv, utover det dens omfang og beslutningsmandat allerede fanger?",
      assessmentQuestion:
        "Hvilket nivå av personal- og ledelsesansvar bærer rollen normalt og varig?",
      anchor1:
        "Rollen har ingen eller svært begrenset formelt personalansvar, for eksempel å enkelte ganger samordne oppgavene til én eller to andre.",
      anchor3:
        "Rollen har etablert, selvstendig ansvar for å lede et team: fordele arbeid, utvikle kapasitet og skape resultater gjennom andre.",
      anchor5:
        "Rollen bærer svært avansert eller virksomhetskritisk personal- og ledelsesansvar, leder ledere eller en stor organisasjon, og setter ofte standarden for hvordan mennesker ledes utenfor eget team.",
    },
    "resource-capacity": {
      name: "Ressurs- og kapasitetsansvar",
      shortUiText:
        "Rollens ansvar for å prioritere og bruke vesentlige ressurser eller kapasitet.",
      fullDefinition:
        "Fanger rollens ansvar for å prioritere og bruke vesentlige ressurser, kapasitet, eiendeler eller kritisk leveringsevne slik at virksomheten fortsetter å fungere. Kriteriet måler selvstendig ressursstyring, ikke rutinemessig budsjettoppfølging eller innkjøp innenfor små, forhåndsbestemte rammer.",
      measures:
        "Ansvar for å prioritere og bruke ressurser slik at virksomheten fungerer.",
      notMeasures:
        "Vanlig budsjettoppfølging eller innkjøp innenfor små rammer.",
      whenSuitable:
        "Når rollen selvstendig disponerer vesentlige ressurser, kapasitet, eiendeler eller kritisk leveringsevne.",
      whenNotSuitable:
        "Skal ikke velges samtidig med et snevert finansielt ansvar hvis begge måler samme ressursstyring.",
      controlQuestion:
        "Har rollens selvstendige ansvar for ressurser eller kapasitet betydning i seg selv, atskilt fra rutinemessig budsjettoppfølging innenfor forhåndsbestemte rammer?",
      assessmentQuestion:
        "Hvilket nivå av ressurs- og kapasitetsansvar bærer rollen normalt og varig?",
      anchor1:
        "Rollen prioriterer selvstendig bruken av et lite, tydelig avgrenset sett med ressurser eller kapasitet innenfor sitt eget område, der dens valg har begrenset og lett korrigerbar effekt.",
      anchor3:
        "Rollen prioriterer og fordeler selvstendig etablerte ressurser eller kapasitet slik at eget område fortsetter å fungere.",
      anchor5:
        "Rollen forvalter selvstendig svært betydelige eller virksomhetskritiske ressurser, kapasitet eller leveringsevne, med beslutninger som former ressursprioriteringer utenfor eget område.",
    },
    "business-customer": {
      name: "Forretnings- og kundeansvar",
      shortUiText:
        "Rollens ansvar for å skape, sikre eller utvikle vesentlig forretningsverdi.",
      fullDefinition:
        "Fanger rollens ansvar for å skape, sikre eller utvikle vesentlig forretningsverdi gjennom en vesentlig kunderelasjon, inntektsstrøm, forretningsportefølje eller kommersiell posisjon. Kriteriet måler stabiliteten i dette forretningsansvaret, ikke individuell salgsprestasjon, provisjon eller forhandlingsferdighet i seg selv.",
      measures:
        "Ansvar for å skape, sikre eller utvikle vesentlig forretningsverdi.",
      notMeasures:
        "Individuell salgsprestasjon, provisjon eller forhandlingsferdighet i seg selv.",
      whenSuitable:
        "Når rollen har direkte ansvar for vesentlig kunderelasjon, inntektsstrøm, forretningsportefølje eller kommersiell posisjon.",
      whenNotSuitable:
        "Skal ikke automatisk favorisere salgsroller; ansvaret må være en stabil del av rollen.",
      controlQuestion:
        "Har rollens stabile ansvar for forretnings- eller kundeverdi betydning i seg selv, atskilt fra individuell salgsprestasjon eller forhandlingsferdighet?",
      assessmentQuestion:
        "Hvilket nivå av forretnings- og kundeansvar bærer rollen normalt og varig?",
      anchor1:
        "Rollen støtter en kunderelasjon eller forretningsaktivitet innenfor en tydelig avgrenset, etablert kundekonto eller oppgave.",
      anchor3:
        "Rollen har selvstendig etablert ansvar for en kunderelasjon, inntektsstrøm eller forretningsportefølje som er en stabil del av rollen.",
      anchor5:
        "Rollen bærer svært betydelig eller virksomhetskritisk ansvar for store kunderelasjoner, inntekter eller kommersiell posisjon, med beslutninger som former virksomhetens retning utenfor egen portefølje.",
    },
    "compliance-control": {
      name: "Informasjons-, sikkerhets- eller regeletterlevelsesansvar",
      shortUiText:
        "Rollens formelle ansvar for beskyttelse, kvalitetssikring eller etterlevelseskontroll.",
      fullDefinition:
        "Fanger rollens formelle ansvar for beskyttelse, kvalitetssikring, kontroll eller korrekt anvendelse av kritiske krav, for eksempel informasjonssikkerhet eller regeletterlevelse. Kriteriet måler et separat, formelt kontrollansvar, ikke den generelle risikobevisstheten hver rolle forventes å ha.",
      measures:
        "Ansvar for beskyttelse, kvalitetssikring, kontroll eller korrekt anvendelse av kritiske krav.",
      notMeasures: "Generell risikobevissthet.",
      whenSuitable:
        "Regulerte, sikkerhetskritiske eller datatunge virksomheter med et separat formelt kontrollansvar.",
      whenNotSuitable:
        "Velg bare hvis ansvaret er separat fra Risiko og konsekvens.",
      controlQuestion:
        "Har rollens formelle kontrollansvar betydning i seg selv, atskilt fra den generelle risikoen og konsekvensen den også bærer?",
      assessmentQuestion:
        "Hvilket nivå av informasjons-, sikkerhets- eller regeletterlevelsesansvar bærer rollen normalt og varig?",
      anchor1:
        "Rollen følger etablerte kontrollrutiner innenfor et tydelig avgrenset område, uten selvstendig kontrollansvar.",
      anchor3:
        "Rollen har selvstendig etablert, formelt ansvar for beskyttelse, kvalitetssikring eller etterlevelseskontroll innenfor sitt eget område.",
      anchor5:
        "Rollen bærer svært avansert eller virksomhetskritisk kontrollansvar, og hvordan den anvender kritiske krav setter ofte standarden for etterlevelse utenfor eget område.",
    },
    "safety-exposure": {
      name: "Sikkerhets- og eksponeringsforhold",
      shortUiText:
        "Rollens varige krav til å arbeide i et risikomiljø under beskyttelsestiltak.",
      fullDefinition:
        "Fanger det varige risikomiljøet rollen arbeider i og kravet om å arbeide under beskyttelsestiltak, som omfatter faktisk fysisk, kjemisk, biologisk eller miljømessig eksponering. Kriteriet måler selve arbeidsforholdet, ikke konsekvensen for virksomheten hvis noe går galt.",
      measures: "Varig risikomiljø og krav om arbeid under beskyttelsestiltak.",
      notMeasures: "Konsekvens for selskapet av en feil.",
      whenSuitable:
        "Roller med faktisk fysisk, kjemisk, biologisk, miljømessig eller annen eksponering.",
      whenNotSuitable:
        "Velg ikke samtidig med et bredere arbeidsforholdkriterium som dekker samme eksponering.",
      controlQuestion:
        "Har rollens eksponering for et varig risikomiljø betydning i seg selv, utover det kriteriet fysisk eller sensorisk anstrengelse allerede fanger?",
      assessmentQuestion:
        "Hvilket nivå av sikkerhet og eksponering arbeider rollen normalt og varig under?",
      anchor1:
        "Rollen utsettes enkelte ganger for et tydelig avgrenset sikkerhets- eller eksponeringsforhold på lavt nivå, med standardiserte beskyttelsestiltak.",
      anchor3:
        "Rollen arbeider under et etablert, tilbakevendende risikomiljø som krever konsekvent bruk av beskyttelsestiltak som en normal del av arbeidet.",
      anchor5:
        "Rollen arbeider under svært krevende eller virksomhetskritiske eksponeringsforhold, der beskyttelsesstandarden den følger eller setter, ofte strekker seg utenfor eget nærmeste team.",
    },
    "on-call": {
      name: "Beredskapsvakt, hjemmevakt og tilgjengelighetskrav",
      shortUiText:
        "Rollens tilbakevendende krav til å være tilgjengelig utenfor ordinær arbeidstid eller å svare umiddelbart.",
      fullDefinition:
        "Fanger rollens tilbakevendende krav til å være tilgjengelig utenfor ordinær arbeidstid, eller å svare umiddelbart, som en integrert forutsetning for rollen. Kriteriet måler et vesentlig, tilbakevendende beredskapskrav, ikke midlertidig overtid, frivillig fleksibilitet eller en generelt høy arbeidsmengde.",
      measures:
        "Tilbakevendende krav til tilgjengelighet utenfor ordinær arbeidstid eller umiddelbar innsats.",
      notMeasures:
        "Midlertidig overtid, frivillig fleksibilitet eller høy arbeidsmengde.",
      whenSuitable:
        "Drift, IT, helse, sikkerhet og andre roller der beredskap er en integrert forutsetning for rollen.",
      whenNotSuitable:
        "Skal være et eget kriterium bare når beredskap er vesentlig og tilbakevendende.",
      controlQuestion:
        "Har rollens tilbakevendende beredskapskrav betydning i seg selv, utover midlertidig overtid eller en generelt høy arbeidsmengde?",
      assessmentQuestion:
        "Hvilket nivå av beredskapsvakt, hjemmevakt og tilgjengelighet bærer rollen normalt og varig?",
      anchor1:
        "Rollen dekker enkelte ganger et tydelig avgrenset beredskapskrav med lav frekvens.",
      anchor3:
        "Rollen bærer et etablert, tilbakevendende beredskaps- eller tilgjengelighetskrav utenfor ordinær arbeidstid som en normal del av rollen.",
      anchor5:
        "Rollen bærer et svært krevende eller virksomhetskritisk beredskapskrav, med hyppig eller umiddelbar innsatsplikt som andre rollers tilgjengelighet ofte bygges rundt.",
    },
    "irregularity-mobility": {
      name: "Uregelmessighet, mobilitet og stedbundethet",
      shortUiText:
        "Rollens varige krav til uregelmessige tider, omfattende reising eller arbeid på bestemte steder.",
      fullDefinition:
        "Fanger rollens varige krav til uregelmessig arbeidstid, omfattende reising eller arbeid knyttet til bestemte steder, for eksempel felt-, skift- eller internasjonalt arbeid. Kriteriet måler et stabilt, strukturelt forhold ved rollen, ikke enkeltstående reiser, personlige ønsker eller et midlertidig prosjekt.",
      measures:
        "Varige krav til uregelmessige tider, omfattende reising eller arbeid på bestemte steder.",
      notMeasures:
        "Enkeltstående reiser, personlige ønsker eller midlertidige prosjekter.",
      whenSuitable:
        "Feltroller, internasjonal virksomhet, skiftarbeid eller høy reisefrekvens.",
      whenNotSuitable:
        "Kan slås sammen med Beredskapsvakt/hjemmevakt bare når begge inngår i samme stabile arbeidsforhold.",
      controlQuestion:
        "Har rollens varige krav til uregelmessighet eller mobilitet betydning i seg selv, utover enkeltstående reiser eller et midlertidig prosjekt?",
      assessmentQuestion:
        "Hvilket nivå av uregelmessighet, mobilitet eller stedbundethet bærer rollen normalt og varig?",
      anchor1:
        "Rollen bærer et tilbakevendende, men begrenset krav til uregelmessige tider, reising eller stedbundet arbeid, for eksempel et regelmessig, men sjeldent forekommende mønster som er en varig del av rollen.",
      anchor3:
        "Rollen bærer et etablert, tilbakevendende mønster av uregelmessige tider, reising eller stedbundet arbeid som en normal og stabil del av rollen.",
      anchor5:
        "Rollen bærer svært omfattende eller virksomhetskritisk uregelmessighet, mobilitet eller stedbundethet, for eksempel varige internasjonale forpliktelser, skiftforpliktelser eller feltforpliktelser som former hvordan rollen kan bemannes.",
    },
    "restricted-environments": {
      name: "Særskilte sikkerhets-, konfidensialitets- eller kontrollmiljøer",
      shortUiText:
        "Rollens krav til å arbeide under særskilte tilgangs-, kontroll- eller sikkerhetsrestriksjoner.",
      fullDefinition:
        "Fanger arbeidsforholdet ved å operere under særskilte tilgangs-, kontroll- eller sikkerhetsrestriksjoner, for eksempel et sikkerhetsklarert eller konfidensialitetssensitivt miljø. Kriteriet måler restriksjonen rollen arbeider under, ikke ansvaret for informasjonssikkerhet i seg selv.",
      measures:
        "Arbeidsforholdet ved å arbeide under særskilte tilgangs-, kontroll- eller sikkerhetsrestriksjoner.",
      notMeasures: "Ansvar for informasjonssikkerhet.",
      whenSuitable:
        "Sikkerhetsklarerte, konfidensialitetssensitive eller strengt kontrollerte miljøer med faktiske begrensninger.",
      whenNotSuitable:
        "Bruk bare når det er arbeidsmiljøet/forutsetningen, ikke kontrollansvaret, som måles.",
      controlQuestion:
        "Har rollens krav til å arbeide under særskilte tilgangs- eller sikkerhetsrestriksjoner betydning i seg selv, atskilt fra det formelle kontrollansvaret den også kan bære?",
      assessmentQuestion:
        "Hvilket nivå av sikkerhets-, konfidensialitets- eller kontrollrestriksjon arbeider rollen normalt og varig under?",
      anchor1:
        "Rollen arbeider enkelte ganger under en tydelig avgrenset tilgangs- eller konfidensialitetsrestriksjon på lavt nivå.",
      anchor3:
        "Rollen arbeider under et etablert, tilbakevendende sett med tilgangs-, kontroll- eller sikkerhetsrestriksjoner som en normal del av rollen.",
      anchor5:
        "Rollen arbeider under svært strenge eller virksomhetskritiske sikkerhets-, konfidensialitets- eller kontrollrestriksjoner som former hvordan rollen og dens omgivelser må drives.",
    },
  },
}
