import type { StandardTemplateContent } from "./standardTemplate.content.en"

// Swedish source content for the standard template (source of record). Criterion
// definitions and anchor texts are curated from the Excel prototype tab
// "Vikter & faktorer"; level definitions from the "Track" tab. The Lead3
// definition is from docs/contexts/evaluation-model/standardmall.md.
// description is the short criterion description shown inline; helpText is the
// extended description shown behind the info help and in the rating flow (the
// "Kriteriebeskrivningar" copy). weightLevels are the per-criterion weighting
// explanations for weight points 1..5 (the "Kriterietexter i Viktningsmodellen"
// copy): what it means to give THIS criterion that weight.
export const standardTemplateContentSv: StandardTemplateContent = {
  modelName: "Standardmodell",
  criteria: {
    scope: {
      name: "Scope & Påverkan",
      description:
        "Hur stort område rollen påverkar och på vilken nivå i organisationen effekterna märks.",
      helpText:
        "Detta kriterium beskriver rollens organisatoriska räckvidd. Det omfattar både omfattningen av ansvaret och hur långt effekterna av rollens arbete, beslut eller prioriteringar sträcker sig. Påverkan kan vara begränsad till ett eget arbetsområde eller ett team, men kan också omfatta flera funktioner eller hela bolaget.",
      anchors: [
        "Ansvarar för egna, avgränsade uppgifter. Resultatet påverkar det omedelbara arbetsflödet.",
        "Ansvarar för leveranser som direkt stödjer teamets mål. Resultat märks inom teamet.",
        "Äger en process, ett delområde eller en återkommande leverans. Resultat märks av närliggande funktioner.",
        "Ansvarar för ett större arbetsområde vars resultat påverkar flera team eller funktioner.",
        "Sätter riktning och prioriteringar för ett affärs- eller funktionsområde. Resultat påverkar organisationens konkurrensförmåga.",
        "Bär strategiskt ansvar med direkt effekt på organisationens samlade resultat och långsiktiga position.",
      ],
      weightLevels: [
        "Företaget vill att omfattningen av ansvar och organisatorisk påverkan endast ska ha begränsat genomslag i rollvärderingen. Roller med kortare räckvidd ska alltså inte premieras särskilt starkt på just denna dimension.",
        "Företaget anser att scope och påverkan är relevant, men att det normalt ska väga lättare än modellens mer prioriterade kriterier. Bredare ansvar ska påverka värderingen, men inte vara en huvuddrivare.",
        "Företaget vill att scope och påverkan ska ha en tydlig och balanserad plats i modellen. Roller med större organisatorisk räckvidd ska få genomslag, men utan att denna dimension dominerar värderingen.",
        "Företaget vill att detta kriterium ska ha stark påverkan i modellen. Skillnader i omfång, ansvar och påverkan från teamnivå till bolagsnivå ska tydligt påverka hur roller värderas relativt varandra.",
        "Företaget ser scope och påverkan som en av de mest utslagsgivande dimensionerna i modellen. Roller med stor organisatorisk räckvidd och omfattande påverkan ska därför värderas tydligt högre när detta kriterium bedöms högt.",
      ],
    },
    risk: {
      name: "Risk & Konsekvens",
      description:
        "Vilka följder rollens beslut, arbete eller brister kan få för verksamheten.",
      helpText:
        "Detta kriterium beskriver vilka konsekvenser rollen kan ha för verksamheten om något blir fel, missas eller hanteras otillräckligt. Det omfattar påverkan på exempelvis kvalitet, leverans, ekonomi, efterlevnad, säkerhet, kundrelationer och varumärke. Fokus ligger på konsekvensernas omfattning och betydelse för verksamheten.",
      anchors: [
        "Fel upptäcks snabbt och korrigeras utan mätbar kostnad eller påverkan utanför den egna uppgiften.",
        "Fel påverkar den egna eller teamets effektivitet. Begränsad spridning – korrigering kräver timmar, inte dagar.",
        "Fel kan påverka kvalitet, tidsplan eller kostnader i mindre skala. Kräver aktiv korrigering men orsakar inte bestående skada.",
        "Fel får tydliga konsekvenser för processer, kundrelationer eller interna beroenden. Kan kräva eskalering och extern kommunikation.",
        "Fel kan medföra betydande ekonomisk skada, regulatoriska brister, varumärkesskada eller förlust av strategiska relationer.",
        "Fel eller underlåtenhet kan hota organisationens fortlevnad, strategiska position eller grundläggande legala ställning.",
      ],
      weightLevels: [
        "Företaget vill att risk och konsekvens endast ska ha begränsad påverkan på rollvärderingen. Roller där fel får större följder ska alltså inte premieras särskilt mycket på denna dimension.",
        "Företaget bedömer att risk och konsekvens är relevant, men att detta kriterium normalt ska väga lättare än de mest prioriterade dimensionerna i modellen.",
        "Företaget vill att risk och konsekvens ska ha en balanserad plats i modellen. Skillnader i påverkan på kvalitet, efterlevnad, verksamhet eller varumärke ska beaktas på en normal nivå.",
        "Företaget vill att risk och konsekvens ska ha stark påverkan på hur roller värderas. Roller där fel kan få tydliga följder för verksamhet, kund, ekonomi, efterlevnad eller förtroende ska därför premieras högre.",
        "Företaget ser risk och konsekvens som en av de mest utslagsgivande faktorerna i modellen. Höga rollpoäng på denna dimension ska därför få mycket stort genomslag i den samlade värderingen och därmed normalt även i den relativa lönepositioneringen.",
      ],
    },
    complexity: {
      name: "Komplexitet & Otydlighet",
      description:
        "Hur komplexa, mångfacetterade och otydliga frågor rollen hanterar.",
      helpText:
        "Detta kriterium beskriver arbetets svårighetsgrad. Det omfattar teknisk, affärsmässig och organisatorisk komplexitet samt graden av osäkerhet i situationer där information, riktning eller lösning inte är tydlig från början. Kriteriet fångar hur många variabler, beroenden och avvägningar som typiskt finns i rollen.",
      anchors: [
        "Uppgifterna har kända lösningar och tydliga instruktioner. Utfallet är förutsägbart.",
        "Uppgifterna följer kända mönster. Variation förekommer men hanteras med befintliga metoder.",
        "Uppgifterna varierar regelbundet. Kräver egen analys och val av tillvägagångssätt bland etablerade metoder.",
        "Problem innefattar flera beroenden, motstridiga krav eller ofullständig information. Kräver syntes och prioritering.",
        "Rollen arbetar med oklara förutsättningar, motsägelsefulla krav och hög osäkerhet. Utvecklar nya lösningsmodeller.",
        "Rollen definierar nya problemställningar i outforskade områden. Etablerad praxis saknas.",
      ],
      weightLevels: [
        "Företaget vill att komplexitet och otydlighet endast ska ha liten påverkan på den samlade rollvärderingen. Roller med mer komplexa och osäkra förutsättningar ska därför inte premieras särskilt mycket på denna dimension.",
        "Företaget bedömer att komplexitet och osäkerhet är relevant, men att denna dimension normalt ska väga lättare än de mest prioriterade kriterierna.",
        "Företaget vill att komplexitet och otydlighet ska ha en balanserad och tydlig plats i modellen. Roller som kräver problemlösning i mer osäkra eller svårtolkade sammanhang ska få ett normalt genomslag i värderingen.",
        "Företaget vill att komplexitet och otydlighet ska ha stark påverkan på rollvärderingen. Roller som hanterar svåra, tvetydiga eller osäkra problem ska därför premieras tydligt högre i modellen.",
        "Företaget ser komplexitet och otydlighet som en av de mest utslagsgivande faktorerna i modellen. Det betyder att roller som får höga rollbedömningspoäng på detta kriterium också ska få stort genomslag i den samlade värderingen och därmed normalt värderas relativt högre lönemässigt.",
      ],
    },
    autonomy: {
      name: "Autonomi & Beslutsmandat",
      description:
        "Hur självständig rollen är och vilket mandat den har att fatta beslut.",
      helpText:
        "Detta kriterium beskriver rollens handlingsutrymme och beslutsnivå. Det omfattar graden av självständighet, hur mycket styrning rollen arbetar under och vilken typ av beslut som naturligt ligger inom uppdraget. Kriteriet fångar både friheten att agera och det mandat rollen har att påverka riktning, prioriteringar eller utfall.",
      anchors: [
        "Arbetar enligt givna instruktioner. Beslut fattas av närmaste chef.",
        "Genomför arbete självständigt inom definierade ramar. Eskalerar vid avvikelse.",
        "Tar egna initiativ, prioriterar och löser problem inom sitt ansvarsområde utan att invänta instruktioner.",
        "Fattar beslut som påverkar teamets eller processens riktning, resurser och tidsplan.",
        "Fattar strategiska beslut inom sin domän. Sätter riktlinjer och ramar som andra följer.",
        "Fattar beslut som formar flera domäner eller hela organisationens riktning. Definierar styrmodell och delegation.",
      ],
      weightLevels: [
        "Företaget vill att grad av självständighet och beslutsmandat endast ska ha liten påverkan på den samlade rollvärderingen.",
        "Företaget anser att autonomi och beslutsnivå är relevant, men att det normalt ska väga lättare än de mer prioriterade kriterierna i modellen.",
        "Företaget vill att autonomi och beslutsmandat ska ha en tydlig och balanserad plats i modellen. Rollen ska påverkas av hur självständigt den verkar, men utan att detta kriterium ges extra stark tyngd.",
        "Företaget vill att detta kriterium ska ha stark påverkan. Roller med större självständighet och högre beslutsmandat ska därför få tydligt större genomslag i den samlade värderingen.",
        "Företaget ser autonomi och beslutsmandat som en av de mest utslagsgivande dimensionerna i modellen. Roller som bedöms högt på självständighet och beslutsnivå ska därför värderas tydligt högre relativt andra roller.",
      ],
    },
    stakeholders: {
      name: "Intressentbredd",
      description:
        "Hur bred och varierad rollens samverkan med interna och externa parter är.",
      helpText:
        "Detta kriterium beskriver bredden i rollens kontaktytor och samverkansbehov. Det omfattar interna och externa intressenter, tvärfunktionella samarbeten och behovet av att samordna arbete mellan olika personer, team, funktioner eller externa parter. Kriteriet fångar hur varierad och omfattande denna samverkan är.",
      anchors: [
        "Samarbete sker inom det egna teamet. Kontaktytan utanför är minimal.",
        "Regelbunden kontakt med närliggande team för att koordinera den egna leveransen.",
        "Aktiv samverkan med flera funktioner i organisationen. Rollen är en kontaktpunkt i tvärfunktionella flöden.",
        "Koordinerar med externa parter (kunder, leverantörer, myndigheter) eller samordnar flera interna intressentgrupper.",
        "Navigerar en miljö med motstridiga intressen och hög förhandlingskomplexitet. Balanserar krav från flera starka parter.",
        "Representerar organisationen på strategisk nivå mot styrelse, nyckelkunder, myndigheter eller branschorgan.",
      ],
      weightLevels: [
        "Företaget vill att bredden i samverkan och koordinering endast ska ha liten påverkan på hur roller värderas relativt varandra.",
        "Företaget bedömer att intressentbredd är relevant, men att kriteriet normalt ska väga lättare än de mest prioriterade dimensionerna i modellen.",
        "Företaget vill att intressentbredd ska ha en tydlig och balanserad plats i modellen. Roller med bred intern eller extern samverkan ska få ett normalt genomslag i värderingen.",
        "Företaget vill att detta kriterium ska ha stark påverkan. Roller som kräver bred koordinering, många kontaktytor och omfattande samverkan ska därför värderas tydligt högre.",
        "Företaget ser intressentbredd som en av de mest utslagsgivande faktorerna i modellen. Höga rollbedömningspoäng på denna dimension ska därför ge stort genomslag i hur roller relativvärderas och positioneras.",
      ],
    },
    knowledge: {
      name: "Kunskapsdjup/Bredd",
      description:
        "Vilken nivå av specialistkunskap, erfarenhet och bredd över flera områden rollen kräver.",
      helpText:
        "Detta kriterium beskriver vilken typ och nivå av kunskap rollen bygger på. Det omfattar specialistdjup, praktisk erfarenhet, metodförståelse och förmåga att arbeta över flera discipliner eller områden. Kriteriet fångar om rollen främst kräver fördjupning inom ett område eller en kombination av flera perspektiv och kompetenser.",
      anchors: [
        "Rollen kan utföras genom introduktion och handledning. Inga specifika förkunskaper utöver grundläggande arbetsförmåga.",
        "Kräver stabil kunskap inom ett avgränsat område. Tillämpar standardiserade metoder och verktyg självständigt.",
        "Kräver förmåga att välja och anpassa metoder, förstå bakomliggande principer och hantera komplexare situationer.",
        "Kräver djup kunskap inom en eller flera deldomäner. Löser icke-standardiserade problem och designar lösningar som andra förlitar sig på.",
        "Definierar metoder, standarder och kvalitetsnormer inom domänen. Intern referenspunkt i kvalificerade frågor.",
        "Utvecklar ny kunskap, metodik eller teknik. Sätter principer som styr organisationens framtida förmåga. Kan påverka branschen externt.",
      ],
      weightLevels: [
        "Företaget vill att krav på djup expertis, erfarenhet eller tvärdisciplinär bredd endast ska ha begränsad påverkan på den samlade rollvärderingen.",
        "Företaget anser att kunskapsdjup och bredd är relevant, men att det normalt ska väga lättare än de mest prioriterade kriterierna.",
        "Företaget vill att kunskapsdjup och bredd ska ha en tydlig och balanserad plats i modellen. Expertis och erfarenhetskrav ska påverka värderingen på en normal nivå.",
        "Företaget vill att detta kriterium ska ha stark påverkan. Roller som kräver djup specialistkunskap, bred domänförståelse eller omfattande erfarenhet ska därför värderas tydligt högre i modellen.",
        "Företaget ser kunskapsdjup och bredd som en av de mest utslagsgivande dimensionerna i modellen. Höga poäng på denna faktor ska därför ge starkt genomslag i den samlade rollvärderingen och normalt bidra till högre relativ lönepositionering.",
      ],
    },
    financial: {
      name: "Finansiellt ansvar",
      description:
        "Hur stort ansvar rollen har för budget, kostnader, intäkter eller ekonomiskt resultat.",
      helpText:
        "Detta kriterium beskriver rollens ansvar för ekonomiska resurser eller ekonomiska utfall. Det kan omfatta budget, kostnader, intäkter, lönsamhet, investeringar eller ansvar för ett affärsområde, en portfölj eller andra ekonomiska ramar. Kriteriet fångar hur central den ekonomiska dimensionen är i rollen.",
      anchors: [
        "Rollen har inget ansvar för ekonomiska ramar. Arbetar inom resurser som andra tilldelat.",
        "Rollens val av metod och tidsanvändning påverkar kostnader – men utan eget budgetmandat.",
        "Ansvarar för en mindre budget, projektdel eller kostnadsram. Godkänner inköp inom fastställda gränser.",
        "Tydligt budgetansvar för team eller delverksamhet. Planerar, följer upp och justerar resursanvändning.",
        "Ansvarar för betydande budget, portfölj eller ett affärsområdes intäkter och kostnader.",
        "Bär direkt ansvar för väsentlig del av organisationens totala resultat eller finansiella strategi.",
      ],
      weightLevels: [
        "Företaget vill att ekonomiskt ansvar endast ska ha begränsad påverkan på den samlade rollvärderingen. Budget- eller resultatansvar ska alltså inte ges särskilt stor tyngd i modellen.",
        "Företaget anser att finansiellt ansvar är relevant, men att det normalt ska väga lättare än de mest prioriterade kriterierna.",
        "Företaget vill att finansiellt ansvar ska ha en tydlig och balanserad plats i modellen. Budgetpåverkan, kostnadsansvar eller resultatansvar ska räknas in som en normal del av värderingen.",
        "Företaget vill att detta kriterium ska ha stark påverkan. Roller med tydlig påverkan på budget, kostnader, intäkter eller ekonomiska resultat ska därför värderas högre relativt andra roller.",
        "Företaget ser finansiellt ansvar som en av de mest utslagsgivande dimensionerna i modellen. Höga poäng på ekonomiskt ansvar ska därför få mycket starkt genomslag i den samlade rollvärderingen och normalt bidra till högre relativ lönepositionering.",
      ],
    },
    people: {
      name: "Personal-/Ledningsansvar",
      description:
        "Hur stort ansvar rollen har för att leda andra, organisera arbete och skapa resultat genom människor.",
      helpText:
        "Detta kriterium beskriver rollens ansvar för ledning av andra. Det omfattar formellt personalansvar, operativ arbetsledning, teamledning och ansvar för större organisatoriska enheter eller andra chefer. Kriteriet fångar både omfattningen av ledningsuppdraget och ansvaret för kapacitet, prioritering, utveckling och riktning genom andra.",
      anchors: [
        "Rollen leder inte andra och har inget personalansvar.",
        "Fördelar och samordnar arbete i gruppen – utan formellt HR-ansvar.",
        "Formellt personalansvar: lönesamtal, utvecklingssamtal, arbetsmiljö, rehabilitering.",
        "Leder chefer med personalansvar. Bygger ledningskapacitet och sätter ramar för chefsskapet i nästa led.",
        "Leder en hel funktion med flera chefsled. Ansvarar för organisationsdesign och funktionens samlade prestation.",
        "Del av företagsledningen. Sätter riktning för ledarskap, kultur och organisationsmodell på företagsnivå.",
      ],
      weightLevels: [
        "Företaget vill att personal- och ledningsansvar endast ska ha begränsad påverkan på den samlade rollvärderingen. Formellt ledarskap ska alltså inte i sig driva värderingen särskilt mycket.",
        "Företaget bedömer att personal- och ledningsansvar är relevant, men att det normalt ska väga lättare än de mest prioriterade kriterierna i modellen.",
        "Företaget vill att personal- och ledningsansvar ska ha en tydlig och balanserad plats i modellen. Att leda andra ska påverka värderingen, men utan att ges särskilt förstärkt tyngd.",
        "Företaget vill att detta kriterium ska ha stark påverkan. Roller med större chefsansvar, teamansvar eller formellt ledarskap ska därför värderas tydligt högre relativt andra roller.",
        "Företaget ser personal- och ledningsansvar som en av de mest utslagsgivande faktorerna i modellen. Höga rollbedömningspoäng på denna dimension ska därför få stort genomslag i den samlade värderingen och normalt också i den relativa lönelogiken.",
      ],
    },
    formal: {
      name: "Formell kompetens",
      description:
        "Vilka formella kvalifikationskrav, såsom utbildning eller certifiering, som normalt är kopplade till rollen.",
      helpText:
        "Detta kriterium beskriver de formella kompetenskrav som typiskt är knutna till rollen. Det kan omfatta utbildningsnivå, examen, certifiering, legitimation eller annan formellt erkänd kompetens som krävs eller vanligtvis efterfrågas. Kriteriet fångar den formella inträdesnivån till rollen, oberoende av den nuvarande individens bakgrund.",
      anchors: [
        "Rollen kan läras in via introduktion. Ingen utbildning eller certifiering krävs.",
        "Kräver kortare yrkesutbildning, kurser eller dokumenterad praktisk erfarenhet som styrker grundläggande yrkesskicklighet.",
        "Kräver yrkeshögskoleutbildning, branschcertifiering eller motsvarande teoretisk/praktisk grund.",
        "Kräver kandidatexamen, ingenjörsexamen eller motsvarande kvalificerad förkunskap.",
        "Kräver masterexamen, avancerad professionell certifiering (t.ex. CPA, juristexamen, CISA, PMP avancerad) eller motsvarande.",
        "Kräver forskningsnivå, doktorsexamen eller unik domänexpertis på en nivå som normerar fältet.",
      ],
      weightLevels: [
        "Företaget vill att krav på formell kompetens endast ska ha begränsad påverkan på den samlade rollvärderingen.",
        "Företaget bedömer att formell kompetens är relevant, men att kriteriet normalt ska väga lättare än de mer prioriterade dimensionerna i modellen.",
        "Företaget vill att formell kompetens ska ha en tydlig och balanserad plats i modellen. Utbildningskrav eller motsvarande erfarenhetskrav ska påverka värderingen på en normal nivå.",
        "Företaget vill att detta kriterium ska ha stark påverkan. Roller där formell kompetens eller motsvarande erfarenhetsnivå är särskilt viktig ska därför få tydligt större genomslag i modellen.",
        "Företaget ser formell kompetens som en av de mest utslagsgivande dimensionerna i modellen. Höga bedömningspoäng på denna faktor ska därför påverka den samlade rollvärderingen starkt och normalt bidra till högre relativ lönepositionering.",
      ],
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
