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
        "Kravet er tydelig definert, lokalt eller begrenset i omfang. Etablerte rammer og arbeidsmåter er normalt nok.",
    },
    "2": {
      name: "Grunnleggende til moderat krav",
      meaning:
        "Kravet er tilbakevendende innenfor et tydelig avgrenset område. Variasjoner og enklere avvik må håndteres.",
    },
    "3": {
      name: "Selvstendig og etablert krav",
      meaning:
        "Kravet er en tydelig og tilbakevendende del av området. Faglige vurderinger gjøres innenfor etablerte rammer.",
    },
    "4": {
      name: "Avansert eller bredt krav",
      meaning:
        "Kravet er avansert, har bredere rekkevidde eller krever selvstendige avveininger der etablerte arbeidsmåter ikke alltid strekker til.",
    },
    "5": {
      name: "Svært avansert, omfattende eller virksomhetskritisk krav",
      meaning:
        "Kravet har svært stort omfang, vanskelighetsgrad, konsekvens eller strategisk betydning. Det kan påvirke retning, standarder, løsninger eller resultater også utenfor det nærmeste området.",
    },
  },
  midpoints: {
    step2: "Et gjennomtenkt mellomnivå mellom trinn 1 og 3.",
    step4: "Et gjennomtenkt mellomnivå mellom trinn 3 og 5.",
  },
  criteria: {
    "knowledge-depth": {
      name: "Kunnskapsdybde og spesialistnivå",
      shortUiText: "Dyp spesialistkunnskap innenfor et avgrenset fagområde.",
      fullDefinition:
        "Omfatter dyp fagkunnskap, spesialistmetoder og relevant erfaring innenfor ett hovedområde. Kriteriet gjelder hvor avansert kunnskapen må være for å håndtere vanskelige spørsmål innenfor området. Det gjelder ikke kunnskapsbredde, formelle autorisasjoner, virksomhetskontekst eller rådgivning som eget område.",
      measures:
        "Dyp fagkunnskap, spesialistmetoder, relevant og varig erfaring innenfor ett område.",
      notMeasures:
        "Antall kunnskapsområder, formell eksamen eller sertifisering i seg selv, kunnskap om en bestemt bransje eller organisasjon i seg selv, beslutningsmandat eller individuell prestasjon.",
      whenSuitable:
        "Velg når dyp spesialistkunnskap innenfor et fagområde skal ha særlig betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for utdanningskrav, bred samhandling mellom flere fagområder eller rådgivning. Vurder i stedet om et av de nærliggende kriteriene bedre fanger det virksomheten vil prioritere.",
      controlQuestion:
        "Er dyp spesialistkunnskap et område dere vil legge særlig vekt på i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av spesialistkunnskapsdybde krever rollen normalt og varig?",
      anchor1:
        "Etablert og veldokumentert fagkunnskap innenfor et tydelig avgrenset område. Kjente metoder er nok for velkjente spørsmål.",
      anchor3:
        "Fordypet spesialistkunnskap og etablert fagmetodikk brukes selvstendig for tilbakevendende og mer krevende spørsmål innenfor området.",
      anchor5:
        "Svært dyp spesialistkunnskap brukes for feltets vanskeligste spørsmål. Kunnskapen bidrar til å utvikle metoder, kvalitetsnivåer eller faglig praksis.",
    },
    "knowledge-breadth": {
      name: "Kunnskapsbredde og tverrfaglig forståelse",
      shortUiText:
        "Evne til å koble sammen flere kunnskapsområder og forstå sammenhengene mellom dem.",
      fullDefinition:
        "Omfatter behovet for å kombinere kunnskap fra flere ulike områder, for eksempel forretning, teknologi, data, produkt og virksomhet. Kriteriet gjelder forståelse for sammenhenger og avveininger mellom områdene. Det gjelder ikke dybden i ett enkelt fagområde eller antallet kontakter og samarbeidspartnere.",
      measures:
        "Bredde av kunnskapsområder, forståelse for sammenhenger mellom områder, evne til å gjøre avveininger mellom ulike perspektiver.",
      notMeasures:
        "Dyp spesialistkunnskap innenfor ett område, antall møter, interessenter eller kontaktflater, organisatorisk rekkevidde.",
      whenSuitable:
        "Velg når helhetssyn og evnen til å forene flere kunnskapsområder skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for mange kontaktflater. Handler det først og fremst om dyp fagkunnskap innenfor ett område, treffer 7.1 bedre.",
      controlQuestion:
        "Er evnen til å forene flere kunnskapsområder sentral for hvordan virksomheten skaper verdi?",
      assessmentQuestion:
        "Hvilket nivå av tverrfaglig bredde krever rollen normalt og varig?",
      anchor1:
        "Ett hovedområde for kunnskap brukes. Koblinger til andre områder trengs sjelden.",
      anchor3:
        "Noen få etablerte kunnskapsområder kombineres selvstendig, med forståelse for hvordan de påvirker hverandre.",
      anchor5:
        "Mange ulike kunnskapsområder kobles sammen på en måte som påvirker hvordan større løsninger, tilbud eller arbeidsmåter utformes.",
    },
    "formal-qualifications": {
      name: "Formelle kvalifikasjons-, autorisasjons- og sertifiseringskrav",
      shortUiText:
        "Obligatorisk autorisasjon, godkjenning eller sertifisering.",
      fullDefinition:
        "Omfatter formelle krav som må være oppfylt for å få utføre, godkjenne, signere eller ha ansvar for en bestemt type virksomhet. Eksempler er autorisasjon, lovpålagt godkjenning og obligatorisk sertifisering. Kriteriet gjelder obligatoriske krav, ikke utdanninger, kurs eller eksamener som er meritterende, men ikke nødvendige.",
      measures:
        "Obligatorisk autorisasjon, lovpålagt eller virksomhetsstyrt godkjenning, obligatorisk sertifisering.",
      notMeasures:
        "Generelt utdanningsnivå, frivillige kurs, prestisjefylt eksamen uten krav om godkjenning.",
      whenSuitable:
        "Velg når obligatoriske autorisasjoner, godkjenninger eller sertifiseringer skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke når utdanning først og fremst er en vei til kunnskap som allerede fanges av 7.1 Kunnskapsdybde og spesialistnivå.",
      controlQuestion:
        "Skal obligatoriske autorisasjoner, godkjenninger eller sertifiseringer slå gjennom i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av formell kvalifikasjon, autorisasjon eller sertifisering krever rollen normalt og varig?",
      anchor1:
        "Ingen obligatoriske krav, eller et grunnleggende og tydelig avgrenset krav med begrenset fornyelse eller omfang.",
      anchor3:
        "Etablert yrkesautorisasjon eller sertifisering som er et tilbakevendende og selvstendig vilkår for å utøve et område.",
      anchor5:
        "Avansert eller virksomhetskritisk godkjenning som kreves for å godkjenne, signere eller ha ansvar for virksomhet med svært store konsekvenser.",
    },
    "domain-knowledge": {
      name: "Domene- og virksomhetskunnskap",
      shortUiText:
        "Dyp kunnskap om bransje, produkt, kundemiljø eller virksomhetskontekst.",
      fullDefinition:
        "Omfatter kunnskap om sammenhengen virksomheten drives i, for eksempel bransje, produkt, kundemiljø, forretningsmodell eller regelverk. Kriteriet gjelder kontekstspesifikk kunnskap som ikke raskt erstattes av allmenn yrkeskunnskap. Det gjelder ikke vanlig organisasjonskjennskap som bygges opp gjennom introduksjon og erfaring over tid.",
      measures:
        "Bransjekunnskap, produkt- og kundekunnskap, kunnskap om forretningsmodell eller regelverkskontekst.",
      notMeasures:
        "Allmenn yrkesdyktighet, vanlig organisasjonskjennskap, formell godkjenning.",
      whenSuitable:
        "Velg når spesifikk kunnskap om virksomhetens sammenheng skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke når generell yrkeskunnskap og vanlig introduksjon er nok til å forstå virksomhetens sammenheng.",
      controlQuestion:
        "Vil dere veie inn hvor mye virksomhets- og bransjekunnskap som trengs innenfor ulike områder?",
      assessmentQuestion:
        "Hvilket nivå av domene- og virksomhetskunnskap krever rollen normalt og varig?",
      anchor1:
        "Kunnskap om en tydelig avgrenset produkt-, prosess- eller kundekontekst.",
      anchor3:
        "Etablert og selvstendig kunnskap om virksomhetens sammenheng som ikke raskt erstattes av allmenn yrkeskunnskap.",
      anchor5:
        "Svært dyp og vanskelig erstattelig kunnskap om bransje, marked, kunder eller regelverk som påvirker viktige veivalg og arbeidsmåter.",
    },
    "advisory-judgment": {
      name: "Rådgivnings- og vurderingskompetanse",
      shortUiText:
        "Kvalifisert rådgivning og faglig vurdering som grunnlag for andres beslutninger.",
      fullDefinition:
        "Omfatter kvalifisert rådgivning som en tilbakevendende del av virksomhetens tilbud eller som avgjørende beslutningsstøtte til kunder, partnere eller interne beslutningstakere. Det innebærer å veie fakta, vurdere usikkert eller motstridende grunnlag og formulere råd eller anbefalinger som andre bruker i sine veivalg. Kriteriet gjelder kvaliteten i rådgivningen og vurderingen. Det gjelder ikke den formelle retten til å ta den endelige beslutningen.",
      measures:
        "Kvalifisert vurdering av grunnlag, rådgivning og anbefalinger, faglig vurdering i spørsmål med avveininger.",
      notMeasures:
        "Formelt beslutningsmandat, å dele generell informasjon, spesialistkunnskap i seg selv.",
      whenSuitable:
        "Velg når kvalifisert rådgivning og faglig vurdering skal ha særlig betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for kunnskapsdeling eller rutinemessige svar. Rådgivningen skal ha tydelig betydning for veivalg eller beslutninger.",
      controlQuestion:
        "Er kvalifisert rådgivning og faglig vurdering noe dere vil gi vekt i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av rådgivnings- og vurderingskompetanse krever rollen normalt og varig?",
      anchor1:
        "Grunnlag eller ukompliserte råd innenfor et tydelig avgrenset område, med støtte i etablert veiledning.",
      anchor3:
        "Selvstendige og etablerte faglige råd innenfor et område, basert på avveining av relevant informasjon.",
      anchor5:
        "Råd og vurderinger i svært avanserte eller sensitive spørsmål som har stor betydning for virksomhetens veivalg eller håndtering av risiko.",
    },
    "complexity-ambiguity": {
      name: "Kompleksitet og uklarhet",
      shortUiText:
        "Vanskelighetsgrad, usikkerhet og uklarhet i spørsmålene som må håndteres.",
      fullDefinition:
        "Omfatter graden av usikkerhet, motstridende krav, uklare mål og mangel på ferdige løsninger. Kriteriet gjelder selve problemenes karakter. Det gjelder ikke mengden analyse som legges ned i å håndtere dem, arbeidstempo eller organisatorisk rekkevidde.",
      measures:
        "Uklare rammer og mål, motstridende krav og avveininger, usikkerhet og komplekse avhengigheter.",
      notMeasures:
        "Omfanget av analysearbeid, høy arbeidsmengde eller tempo, spesialistkunnskap i seg selv.",
      whenSuitable:
        "Velg når håndtering av vanskelige, uklare eller sammensatte spørsmål skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for omfattende analyse eller mange samtidige oppgaver. Disse fanges av henholdsvis 8.2 og 8.4 dersom de velges.",
      controlQuestion:
        "Vil dere ta hensyn til graden av uklarhet og vanskelighet i spørsmålene virksomheten må håndtere?",
      assessmentQuestion:
        "Hvilket nivå av kompleksitet og uklarhet håndterer rollen normalt og varig?",
      anchor1:
        "Tydelig definerte spørsmål, etablerte metoder og forutsigbare situasjoner.",
      anchor2:
        "Tilbakevendende variasjoner og enklere avvik håndteres gjennom valg mellom kjente alternativer.",
      anchor3:
        "Komplekse spørsmål innenfor etablerte rammer, der analyse, prioritering og tilpasning trengs.",
      anchor4:
        "Avanserte, tverrfunksjonelle eller delvis uklare problemer håndteres der etablerte løsninger ikke alltid strekker til.",
      anchor5:
        "Svært komplekse eller strategisk betydningsfulle spørsmål med høy usikkerhet, der nye tilnærminger eller langsiktige løsninger må utformes.",
    },
    "analytical-effort": {
      name: "Analytisk og problemløsende innsats",
      shortUiText:
        "Omfanget av systematisk analyse, feilsøking og problemløsning.",
      fullDefinition:
        "Omfatter systematisk analyse, feilsøking, modellering, diagnostikk, testing og beregning som trengs for å komme fram til løsninger. Kriteriet gjelder den analytiske innsatsen. Det gjelder ikke bare at problemet er uklart, eller hvilken spesialistkunnskap som ligger bak analysen.",
      measures:
        "Systematisk analyse, feilsøking og diagnostikk, modellering, testing og beregning.",
      notMeasures:
        "Uklarhet i problemet i seg selv, spesialistkunnskap i seg selv, midlertidig høy arbeidsmengde.",
      whenSuitable:
        "Velg når systematisk analyse- og problemløsningsarbeid skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for uklare spørsmål. Det skal finnes et tilbakevendende og tydelig innslag av analyse, feilsøking eller diagnostikk.",
      controlQuestion:
        "Skal omfanget av systematisk analyse- og problemløsningsarbeid ha betydning i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av analytisk og problemløsende innsats bærer rollen normalt og varig?",
      anchor1:
        "Ukomplisert analyse eller feilsøking i et tydelig avgrenset spørsmål, etter etablerte trinn.",
      anchor3:
        "Selvstendig og etablert analyse, diagnostikk eller systematisk problemløsning innenfor et område.",
      anchor5:
        "Svært avansert eller omfattende analyse, modellering eller diagnostikk med stor betydning for virksomhetens evne til å løse kritiske eller tilbakevendende problemer.",
    },
    "communication-effort": {
      name: "Kommunikasjons- og relasjonskrevende arbeid",
      shortUiText:
        "Krav til kvalifisert kommunikasjon, forhandling og håndtering av motstridende interesser.",
      fullDefinition:
        "Omfatter vanskelighetsgraden i kommunikasjon, forhandling, påvirkning, konflikthåndtering og oversettelse mellom ulike behov og interesser. Kriteriet gjelder den kommunikative og relasjonelle innsatsen. Det gjelder ikke antallet kontakter, organisatorisk rekkevidde eller forretningsansvar.",
      measures:
        "Forhandling og påvirkning, håndtering av vanskelige samtaler og konflikter, oversettelse mellom ulike behov og interesser.",
      notMeasures:
        "Antall kontakter eller møter, kunde- eller inntektsansvar, organisatorisk rekkevidde.",
      whenSuitable:
        "Velg når kvalifisert kommunikasjon, forhandling og håndtering av motstridende interesser skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for mange møter eller kundekontakter. Vanskelighetsgraden i kommunikasjonen skal være det som prioriteres.",
      controlQuestion:
        "Skal kvalifisert kommunikasjon, forhandling og håndtering av motstridende interesser ha betydning i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av kommunikasjons- og relasjonsinnsats bærer rollen normalt og varig?",
      anchor1:
        "Tydelig avgrenset og i hovedsak rutinemessig kommunikasjon med etablerte motparter.",
      anchor3:
        "Selvstendig og tilbakevendende kommunikasjon, forhandling eller konflikthåndtering innenfor etablerte rammer.",
      anchor5:
        "Svært avansert eller sensitiv kommunikasjon, forhandling eller konflikthåndtering der utfallet har stor betydning for virksomhetens relasjoner eller veivalg.",
    },
    "operational-intensity": {
      name: "Operativ intensitet og samtidighetskrav",
      shortUiText:
        "Krav om å håndtere flere samtidige strømmer og prioritere løpende.",
      fullDefinition:
        "Omfatter krav til oppmerksomhet, evne til å håndtere flere ting samtidig og løpende prioritering mellom flere strømmer i normalsituasjonen. Eksempler kan være kundesaker, alarmer, leveranser eller driftsstrømmer. Kriteriet gjelder et stabilt og strukturelt krav, ikke midlertidige topper, ressursmangel eller mangelfull planlegging.",
      measures:
        "Flere samtidige strømmer, løpende prioritering, oppmerksomhet under tidspress i normalsituasjonen.",
      notMeasures:
        "Midlertidig høy arbeidsbelastning, underbemanning, kompleksitet i selve saken.",
      whenSuitable:
        "Velg når håndtering og prioritering av flere samtidige strømmer skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke for å kompensere for midlertidige arbeidstopper eller ressursmangel. Kravet skal være en varig del av virksomhetens arbeidsmåte.",
      controlQuestion:
        "Vil dere veie inn krav om å håndtere flere samtidige strømmer og prioritere løpende?",
      assessmentQuestion:
        "Hvilket nivå av operativ intensitet og samtidighetskrav bærer rollen normalt og varig?",
      anchor1:
        "Én strøm eller én oppgave om gangen innenfor en tydelig avgrenset rytme.",
      anchor3:
        "Flere etablerte og samtidige strømmer håndteres selvstendig med løpende prioritering.",
      anchor5:
        "Svært høy operativ intensitet over mange samtidige strømmer, der feil prioritering raskt kan få store følger for virksomheten.",
    },
    "physical-sensory": {
      name: "Fysisk eller sensorisk anstrengelse",
      shortUiText:
        "Tilbakevendende fysisk belastning, presisjon eller krav til utholdende sansekonsentrasjon.",
      fullDefinition:
        "Omfatter fysisk belastning, ergonomisk krevende momenter, presisjon og konsentrasjon med syn, hørsel eller andre sanser. Kriteriet gjelder krav til kropp og oppmerksomhet. Det gjelder ikke risikomiljøer, eksponering for farlige stoffer eller konsekvensen for virksomheten dersom noe går galt.",
      measures:
        "Fysisk og ergonomisk belastning, presisjonskrav, utholdende konsentrasjon med sansene.",
      notMeasures:
        "Risikomiljø eller eksponering, allmenn stress, konsekvenser av feil.",
      whenSuitable:
        "Velg når fysisk belastning, presisjon eller sensorisk konsentrasjon skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for risiko i arbeidsmiljøet. Er eksponering og verneetiltak det sentrale, passer 10.1 bedre.",
      controlQuestion:
        "Skal tilbakevendende fysisk belastning, presisjon eller utholdende konsentrasjon ha betydning i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av fysisk eller sensorisk anstrengelse bærer rollen normalt og varig?",
      anchor1:
        "Lette og enkeltstående fysiske eller sensoriske krav innenfor en tydelig avgrenset oppgave.",
      anchor3:
        "Tilbakevendende fysisk belastning, presisjonsmomenter eller sensorisk konsentrasjon som en etablert del av området.",
      anchor5:
        "Svært krevende og utholdende fysisk eller sensorisk anstrengelse der presisjon og konsekvent utførelse er avgjørende.",
    },
    "scope-impact": {
      name: "Omfang og påvirkning",
      shortUiText: "Rekkevidden for resultater og påvirkning i virksomheten.",
      fullDefinition:
        "Omfatter hvor langt resultater, valg og leveranser får gjennomslag i virksomheten: fra et tydelig avgrenset område til team, funksjoner, flere deler av selskapet eller hele selskapet. Kriteriet gjelder hvor effekten merkes. Det gjelder ikke formell beslutningsrett, personalansvar eller budsjettstørrelse i seg selv.",
      measures:
        "Rekkevidde for resultater og påvirkning, omfanget av berørte deler av virksomheten, varige følger for virksomhetens leveranse eller retning.",
      notMeasures:
        "Formelt personalansvar, beslutningsmandat, ressurs- eller budsjettansvar i seg selv.",
      whenSuitable:
        "Velg når rekkevidden for resultater og påvirkning skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for tittel, ledernivå, budsjettstørrelse eller beslutningsrett. Vurder om et av de separate ansvarskriteriene bedre fanger det som skal prioriteres.",
      controlQuestion:
        "Er det relevant for dere å veie inn hvor langt resultater og påvirkning når i virksomheten?",
      assessmentQuestion:
        "Hvor langt strekker rollens normale og varige påvirkning seg?",
      anchor1:
        "Resultater og påvirkning er hovedsakelig begrenset til et tydelig avgrenset område eller en enkelt leveranse.",
      anchor2:
        "Påvirkningen når et avgrenset arbeidsområde eller en tilbakevendende leveranse innenfor et team.",
      anchor3:
        "Resultater og påvirkning når et tydelig område og påvirker leveranser eller prioriteringer i nærliggende deler av virksomheten.",
      anchor4:
        "Påvirkningen når flere team, en funksjon eller en vesentlig del av virksomheten gjennom valg, prioriteringer eller løsninger med varige følger.",
      anchor5:
        "Resultater og påvirkning når flere deler av selskapet eller selskapsnivå og har betydning for overordnet retning, resultat eller evne til å lykkes.",
    },
    "autonomy-mandate": {
      name: "Autonomi og beslutningsmandat",
      shortUiText:
        "Selvstendighet og mandat til å gjøre avveininger og fatte beslutninger.",
      fullDefinition:
        "Omfatter mandatet til selvstendig å gjøre avveininger og fatte beslutninger innenfor et definert område. Kriteriet gjelder hvilket rom som finnes til å velge retning, prioritere mellom alternativer og beslutte egnede løsninger innenfor området. Det gjelder ikke hvor langt beslutningens effekt når, hvor store følger en feil kan få, eller hvilken type ansvar beslutningen gjelder.",
      measures:
        "Mandat til å fatte selvstendige beslutninger, rom til å velge mellom relevante alternativer, mandat til å prioritere og gjøre avveininger, grad av selvstendighet innenfor et definert område.",
      notMeasures:
        "Rekkevidden for resultater eller påvirkning, konsekvensen av feilaktige beslutninger, personal-, ressurs- eller kundeansvar i seg selv, selskapets interne godkjenningsprosesser eller former for samråd.",
      whenSuitable:
        "Velg når selvstendig beslutningsmandat skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke for å beskrive hvor langt beslutningens effekt når, hvilke følger en feil kan få, eller hvilken type ansvar beslutningen gjelder. Det fanges av andre ansvarskriterier dersom de velges.",
      controlQuestion:
        "Skal graden av selvstendig beslutningsmandat ha betydning i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av autonomi og beslutningsmandat har rollen normalt og varig?",
      anchor1:
        "Begrenset mandat til å velge mellom tydelig angitte alternativer innenfor etablerte instrukser.",
      anchor3:
        "Selvstendig mandat til å gjøre etablerte avveininger, prioritere mellom alternativer og fatte beslutninger innenfor et definert område.",
      anchor5:
        "Svært bredt mandat til å gjøre avveininger og fatte beslutninger som setter retning, prinsipper eller prioriteringer for flere deler av virksomheten.",
    },
    "risk-consequence": {
      name: "Risiko og konsekvens",
      shortUiText:
        "Alvoret i mulige følger av feil, mangler eller feilaktige beslutninger.",
      fullDefinition:
        "Omfatter hvilke følger feil, mangler eller feilaktige beslutninger kan få for for eksempel kunder, kvalitet, økonomi, sikkerhet, informasjon, etterlevelse og tillit. Kriteriet gjelder følgen dersom noe går galt. Det gjelder ikke hvem som har det formelle ansvaret for å kontrollere at regler eller vern fungerer.",
      measures:
        "Konsekvenser for kunde, kvalitet og leveranse, konsekvenser for sikkerhet, informasjon og etterlevelse, økonomiske og omdømmemessige følger.",
      notMeasures:
        "Individets opplevde stress, budsjettstørrelse i seg selv, formelt kontrollansvar.",
      whenSuitable:
        "Velg når forskjeller i mulige følger av feil og mangler skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke for å beskrive hvor presset eller krevende noe oppleves. Vurder den saklige og mulige følgen dersom noe blir feil.",
      controlQuestion:
        "Er forskjeller i de følgene feil eller mangler kan få relevante å veie inn i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av risiko og konsekvens bærer rollens beslutninger og arbeid normalt og varig?",
      anchor1:
        "Feil eller mangler har normalt begrensede og lett korrigerbare følger innenfor et avgrenset område.",
      anchor2:
        "Feil eller mangler kan påvirke teamets kvalitet, effektivitet eller leveranse og krever normalt korrigering innenfor etablerte prosesser.",
      anchor3:
        "Feil, mangler eller feilaktige beslutninger kan få tydelige følger for kunde, leveranse, kvalitet, økonomi eller etterlevelse innenfor et område.",
      anchor4:
        "Feil, beslutninger eller mangler kan få betydelige følger for flere deler av virksomheten, viktige kunder, kritiske prosesser eller regeletterlevelse.",
      anchor5:
        "Feil eller mangler kan få svært store, langvarige eller virksomhetskritiske følger for sikkerhet, etterlevelse, tillit, økonomi eller virksomhetens fortsatte evne til å fungere.",
    },
    "people-leadership": {
      name: "Ledelses- og personalansvar",
      shortUiText:
        "Ansvar for å lede mennesker, samordne virksomhet og skape resultater gjennom andre.",
      fullDefinition:
        "Omfatter ansvar for å lede og samordne mennesker eller deler av virksomheten for å skape resultater gjennom andre. Det kan innebære ansvar for prioriteringer, arbeidsfordeling, retning, utvikling av arbeidsmåter eller samordning av leveranse. Formelt personalansvar inngår når ansvaret også omfatter medarbeidernes mål, utvikling, prestasjon og arbeidsmiljø. Kriteriet gjelder ledelsesansvar gjennom andre, ikke bare spesialistinnflytelse, prosjektkoordinering eller et stort eget beslutningsmandat.",
      measures:
        "Ansvar for å lede og samordne arbeid gjennom andre, ansvar for retning, prioriteringer og leveranse i en virksomhetsdel, ansvar for å utvikle arbeidsmåter eller kapasitet gjennom andre, formelt ansvar for medarbeidernes mål, utvikling og prestasjon.",
      notMeasures:
        "Spesialistinnflytelse uten ansvar for andres arbeid eller for en virksomhetsdel, midlertidig samordning av enkeltoppgaver, prosjektledelse uten varig ansvar for mennesker eller en virksomhetsdel, eget beslutningsmandat uten ansvar for å skape resultater gjennom andre.",
      whenSuitable:
        "Velg når ansvar for å lede mennesker eller deler av virksomheten gjennom andre skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare fordi samordning, spesialiststøtte eller prosjektledelse forekommer. Det skal finnes et varig ansvar for retning, prioriteringer, leveranse eller utvikling gjennom andre.",
      controlQuestion:
        "Skal ansvar for å lede mennesker eller virksomhetsdeler gjennom andre ha betydning i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av personal- og ledelsesansvar bærer rollen normalt og varig?",
      anchor1:
        "Begrenset ansvar for å samordne andres arbeid innenfor et tydelig avgrenset område. Ikke noe varig ansvar for retning, leveranse eller medarbeidernes utvikling.",
      anchor3:
        "Varig ansvar for å lede og samordne et team, en arbeidsflyt eller en virksomhetsdel gjennom andre. Ansvaret omfatter prioriteringer, arbeidsfordeling og leveranse. Formelt personalansvar kan forekomme, men er ikke et krav på dette nivået.",
      anchor5:
        "Omfattende ansvar for å lede en større virksomhetsdel eller flere team gjennom andre. Ansvaret omfatter retning, kapasitet, resultater og utvikling over tid. Formelt personalansvar for andre ledere eller en større organisasjon inngår normalt på dette nivået.",
    },
    "resource-capacity": {
      name: "Ressurs- og kapasitetsansvar",
      shortUiText:
        "Ansvar for å prioritere begrensede ressurser mellom virksomhetens behov.",
      fullDefinition:
        "Omfatter ansvar for å gjøre avveininger mellom konkurrerende behov når ressursene er begrensede. Ressurser kan for eksempel være tid, budsjett, utstyr, lager, bemanning eller leveransekapasitet. Kriteriet gjelder hvilke prioriteringer som trengs for at ressurser og kapasitet skal brukes der de gjør mest nytte for virksomheten. Kriteriet gjelder ikke ledelse, utvikling eller samordning av mennesker som sådan. Det gjelder heller ikke rutinemessig budsjettoppfølging, innkjøp eller fordeling innenfor små og forhåndsbestemte rammer.",
      measures:
        "Prioritering mellom konkurrerende behov, fordeling av begrensede ressurser og kapasitet, avveining mellom tilgjengelige ressurser, behov og leveranseevne.",
      notMeasures:
        "Ledelse eller utvikling av mennesker, rutinemessig budsjettoppfølging, innkjøp innenfor små faste rammer, forretningsresultat i seg selv.",
      whenSuitable:
        "Velg når ansvar for å prioritere begrensede ressurser mellom virksomhetens behov skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for budsjettoppfølging, innkjøp eller samordning av mennesker. Det skal finnes et varig ansvar for avveininger mellom konkurrerende behov og begrensede ressurser.",
      controlQuestion:
        "Vil dere legge vekt på ansvar for å prioritere begrensede ressurser mellom ulike behov i virksomheten?",
      assessmentQuestion:
        "Hvilket nivå av ressurs- og kapasitetsansvar bærer rollen normalt og varig?",
      anchor1:
        "Prioritering innenfor et lite og tydelig avgrenset sett av ressurser, der effekten av valgene er begrenset og lett å korrigere.",
      anchor3:
        "Selvstendig prioritering mellom etablerte behov og begrensede ressurser eller kapasitet innenfor et område.",
      anchor5:
        "Prioritering mellom svært betydelige eller virksomhetskritiske behov og ressurser, der avveiningene påvirker flere deler av virksomhetens evne til å levere.",
    },
    "business-customer": {
      name: "Forretnings- og kundeansvar",
      shortUiText:
        "Ansvar for viktige kunder, inntekter eller forretningsresultat.",
      fullDefinition:
        "Omfatter et varig ansvar for å skape, sikre eller utvikle forretningsverdi gjennom for eksempel kunderelasjoner, inntektsstrømmer, avtaler, forretningsporteføljer eller markedsposisjon. Kriteriet gjelder ansvar som inngår i virksomheten. Det gjelder ikke enkeltstående salgsresultater, provisjon eller dyktighet i en isolert forhandling.",
      measures:
        "Ansvar for kunderelasjoner, ansvar for inntekter eller forretningsportefølje, ansvar for forretningsresultat eller markedsposisjon.",
      notMeasures:
        "Kundekontakt i seg selv, individuell salgsprestasjon, forhandlingsdyktighet i seg selv.",
      whenSuitable:
        "Velg når ansvar for kunder, inntekter eller forretningsresultat skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for kundekontakt eller salg. Det skal finnes et varig ansvar for kundeverdi, inntekter eller forretningsresultat.",
      controlQuestion:
        "Er ansvar for kunder, inntekter eller forretningsresultat noe dere vil gi særlig vekt i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av forretnings- og kundeansvar bærer rollen normalt og varig?",
      anchor1:
        "Støtte til en etablert kunderelasjon eller forretningsaktivitet innenfor en avgrenset konto eller et avgrenset område.",
      anchor3:
        "Selvstendig og etablert ansvar for en kunderelasjon, inntektsstrøm eller forretningsportefølje.",
      anchor5:
        "Ansvar for kunder, inntekter eller forretningsområder med stor betydning for selskapet og påvirkning på markedsposisjon eller framtidig forretning.",
    },
    "compliance-control": {
      name: "Informasjons-, sikkerhets- eller etterlevelsesansvar",
      shortUiText:
        "Formelt ansvar for kontroll, vern, kvalitetssikring eller etterlevelse av regelverk.",
      fullDefinition:
        "Omfatter formelt ansvar for å kontrollere, kvalitetssikre eller sikre at viktige krav følges, for eksempel innenfor informasjonssikkerhet, kvalitet, sikkerhet eller regelverk. Kriteriet gjelder ansvar for at kravene anvendes riktig. Det gjelder ikke den allmenne plikten til å følge regler eller være risikobevisst.",
      measures:
        "Kontroll- og kvalitetssikringsansvar, ansvar for vern av informasjon eller sikkerhet, ansvar for korrekt anvendelse av krav og regelverk.",
      notMeasures:
        "Allmenn risikobevissthet, å følge rutiner som noen andre har ansvar for, konsekvensen dersom feil oppstår.",
      whenSuitable:
        "Velg når formelt ansvar for kontroll, vern og etterlevelse skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke når området bare omfatter å følge etablerte kontrollrutiner. Det skal finnes et tydelig ansvar for at kontroller og krav fungerer.",
      controlQuestion:
        "Skal formelt ansvar for kontroll, vern og etterlevelse veies inn i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av informasjons-, sikkerhets- eller regeletterlevelsesansvar bærer rollen normalt og varig?",
      anchor1:
        "Etablerte kontrollrutiner følges innenfor et tydelig avgrenset område, uten selvstendig kontrollansvar.",
      anchor3:
        "Selvstendig og formelt ansvar for vern, kvalitetssikring eller etterlevelseskontroll innenfor et område.",
      anchor5:
        "Svært avansert eller virksomhetskritisk kontrollansvar der tolkninger og arbeidsmåter styrer hvordan viktige krav følges i flere deler av virksomheten.",
    },
    "safety-exposure": {
      name: "Sikkerhets- og eksponeringsforhold",
      shortUiText:
        "Varig eksponering for fysiske, kjemiske, biologiske eller miljømessige risikoer.",
      fullDefinition:
        "Omfatter tilbakevendende arbeid i miljøer med faktisk fysisk, kjemisk, biologisk eller miljømessig eksponering og krav om verneetiltak. Eksempler er støy, farlige stoffer, smitte, høyde, varme, kulde og farlige maskiner. Kriteriet gjelder arbeidsforholdet, ikke fysisk anstrengelse eller konsekvensen for virksomheten dersom noe går galt.",
      measures:
        "Risikomiljø og faktisk eksponering, tilbakevendende behov for verneetiltak, særlige sikkerhetsforhold i miljøet.",
      notMeasures:
        "Fysisk eller sensorisk anstrengelse i seg selv, formelt sikkerhetsansvar, forretningsmessig eller organisatorisk risiko.",
      whenSuitable:
        "Velg når særlige sikkerhets- og eksponeringsforhold skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for sikkerhetsansvar eller beslutningsrisiko. Det skal handle om faktisk og varig eksponering i virksomhetens miljøer.",
      controlQuestion:
        "Er arbeid under særlige sikkerhets- eller eksponeringsforhold noe dere vil ta hensyn til i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av sikkerhet og eksponering arbeider rollen normalt og varig under?",
      anchor1:
        "Enkeltstående og lav eksponering under tydelig avgrensede forhold med standardiserte verneetiltak.",
      anchor3:
        "Tilbakevendende eksponering i et etablert risikomiljø som krever konsekvent bruk av verneetiltak.",
      anchor5:
        "Svært krevende eller virksomhetskritiske eksponeringsforhold der vern, sikkerhetsrutiner og korrekt opptreden er avgjørende for sikker drift.",
    },
    "on-call": {
      name: "Vakt, beredskap og tilgjengelighetskrav",
      shortUiText:
        "Tilbakevendende vakt, beredskap eller krav om rask tilgjengelighet.",
      fullDefinition:
        "Omfatter tilbakevendende krav om å være tilgjengelig eller kunne handle utenfor ordinær arbeidstid, eller å kunne svare umiddelbart i løpet av et skift. Kriteriet gjelder planlagt eller forventet beredskap som er en stabil del av virksomhetens forutsetninger. Det gjelder ikke enkeltstående overtid, frivillig fleksibilitet eller midlertidig høy arbeidsbelastning.",
      measures:
        "Vakt og beredskap, krav om rask tilgjengelighet, tilbakevendende utrykning utenfor ordinær arbeidstid.",
      notMeasures:
        "Midlertidig overtid, uformelle forventninger om å svare, generelt høy arbeidsmengde.",
      whenSuitable:
        "Velg når vakt, beredskap eller krav om rask tilgjengelighet skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke når tilgjengelighet bare oppstår ved enkeltstående kriser eller mangler en tydelig og tilbakevendende forankring i virksomheten.",
      controlQuestion:
        "Er tilbakevendende vakt, beredskap eller krav om rask tilgjengelighet en arbeidsforutsetning dere vil ta hensyn til i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av beredskapsvakt, hjemmevakt og tilgjengelighet bærer rollen normalt og varig?",
      anchor1: "Enkeltstående og tydelig avgrenset beredskap med lav frekvens.",
      anchor3:
        "Etablert og tilbakevendende beredskap eller tilgjengelighet utenfor ordinær arbeidstid.",
      anchor5:
        "Svært krevende beredskap med hyppig eller umiddelbar utrykningsplikt, der virksomheten er sterkt avhengig av rask tilgjengelighet.",
    },
    "irregularity-mobility": {
      name: "Uregelmessighet, mobilitet og stedbundethet",
      shortUiText:
        "Varige krav om uregelmessige tider, reiser eller arbeid på bestemte steder.",
      fullDefinition:
        "Omfatter varige krav om uregelmessig arbeidstid, omfattende reising eller stedbundet arbeid, for eksempel feltvirksomhet, skiftarbeid eller internasjonal tilstedeværelse. Kriteriet gjelder et stabilt og strukturelt forhold i virksomheten. Det gjelder ikke enkeltstående reiser, personlige ønsker eller midlertidige prosjekter.",
      measures:
        "Uregelmessig arbeidstid, omfattende og tilbakevendende reising, felt-, skift- eller stedbundet arbeid.",
      notMeasures:
        "Enkeltstående tjenestereiser, midlertidige prosjekter, vakt eller beredskap utenfor arbeidstid.",
      whenSuitable:
        "Velg når uregelmessige tider, mobilitet eller stedbundethet skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke når kravet er midlertidig eller forekommer sjelden uten å være en stabil del av virksomhetens forutsetninger.",
      controlQuestion:
        "Vil dere veie inn varige krav om uregelmessige tider, reiser eller stedbundet arbeid?",
      assessmentQuestion:
        "Hvilket nivå av uregelmessighet, mobilitet eller stedbundethet bærer rollen normalt og varig?",
      anchor1:
        "Tilbakevendende, men begrensede krav om uregelmessige tider, reiser eller stedbundet arbeid.",
      anchor3:
        "Etablert og tilbakevendende mønster av uregelmessige tider, reiser eller stedbundet arbeid.",
      anchor5:
        "Svært omfattende krav om skift, reiser, feltarbeid eller internasjonal tilstedeværelse som tydelig påvirker planlegging og bemanning.",
    },
    "restricted-environments": {
      name: "Særlige sikkerhets-, taushets- eller kontrollmiljøer",
      shortUiText:
        "Arbeid under særlige regler for tilgang, taushetsplikt, sikkerhet eller kontroll.",
      fullDefinition:
        "Omfatter arbeidsforhold med særlige begrensninger for tilgang, taushetsplikt, sikkerhet eller kontroll, for eksempel sikkerhetsklassifiserte miljøer eller informasjon som krever særskilt vern. Kriteriet gjelder de reglene og begrensningene som gjelder i miljøet. Det gjelder ikke ansvar for å utforme, følge opp eller kontrollere informasjonssikkerhet.",
      measures:
        "Særlige tilgangsbegrensninger, taushets- og sikkerhetsrestriksjoner, kontrollkrav som påvirker hvordan arbeidet kan utføres.",
      notMeasures:
        "Formelt ansvar for informasjonssikkerhet, allmenn taushetsplikt, allmenn risikobevissthet.",
      whenSuitable:
        "Velg når særlige tilgangs-, taushets- eller sikkerhetsrestriksjoner skal ha betydning i synet på likeverdighet.",
      whenNotSuitable:
        "Velg ikke bare for konfidensiell informasjon. Begrensningene skal være særskilte, tilbakevendende og påvirke hvordan arbeidet kan utføres.",
      controlQuestion:
        "Skal arbeid under særlige tilgangs-, taushets- eller sikkerhetsrestriksjoner ha betydning i synet på likeverdighet?",
      assessmentQuestion:
        "Hvilket nivå av sikkerhets-, konfidensialitets- eller kontrollrestriksjon arbeider rollen normalt og varig under?",
      anchor1:
        "Enkeltstående og tydelig avgrensede tilgangs- eller taushetsrestriksjoner på lavt nivå.",
      anchor3:
        "Etablerte og tilbakevendende tilgangs-, kontroll- eller sikkerhetsrestriksjoner.",
      anchor5:
        "Svært strenge eller virksomhetskritiske sikkerhets-, taushets- eller kontrollrestriksjoner som i stor grad styrer planlegging, gjennomføring og dokumentasjon.",
    },
  },
}
