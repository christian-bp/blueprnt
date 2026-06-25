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
        "Ansvar för egna uppgifter inom ett tydligt begränsat område.",
        "Påverkan inom det egna teamet; ansvar för avgränsade leveranser.",
        "Ägarskap för ett delområde eller återkommande process; påverkan inom en mindre funktion.",
        "Ansvar för ett större område, projekt eller flöde; påverkar flera team/funktioner.",
        "Påverkar affärs-/funktionsområde; definierar riktning för större delar av organisationen.",
        "Företagsövergripande påverkan; strategiskt ansvar och direkt effekt på organisationens resultat.",
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
        "Låg påverkan; fel kan enkelt rättas.",
        "Påverkar främst eget arbete eller team.",
        "Fel påverkar leveranser eller kvalitet i mindre skala.",
        "Fel får märkbara följder för processer, deadlines eller kundrelationer.",
        "Hög påverkan på ekonomi, rykte eller efterlevnad.",
        "Kritisk påverkan på organisationens resultat, strategi eller regelefterlevnad.",
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
        "Arbete är rutinmässigt och väl definierat med tydliga instruktioner.",
        "Hanterar standardiserade uppgifter med låg variation.",
        "Löser uppgifter med viss variation och behov av egen analys.",
        "Arbetar med flera beroenden och avvägningar; kräver tolkning och prioritering.",
        "Hög komplexitet; hanterar motsägande krav och otydliga förutsättningar.",
        "Extrema komplexa situationer; driver utveckling i okända/innovativa områden med hög osäkerhet.",
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
        "Arbetar nära styrt; följer instruktioner.",
        "Självständig i vardagliga moment inom definierade ramar.",
        "Tar egna initiativ och prioriteringar inom sitt område.",
        "Tar taktiska beslut som påverkar team eller arbetsflöde.",
        "Fattar strategiska beslut inom domän och sätter riktning för delområde.",
        "Tar beslut som påverkar flera domäner eller hela organisationen.",
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
        "Samarbete främst inom eget team.",
        "Samarbete inom närliggande funktioner.",
        "Regelbunden tvärfunktionell samverkan.",
        "Samordning med externa parter/kunder eller flera interna funktioner.",
        "Hanterar komplex stakeholder-miljö med konkurrerande intressen.",
        "Representerar organisationen externt och hanterar strategiska intressenter.",
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
        "Rollen kräver grundläggande kunskap. Rollen förutsätter introduktionsnivå inom sitt område och att arbetsuppgifter kan utföras genom etablerade rutiner och instruktioner.",
        "Rollen kräver stabil yrkeskunskap inom ett avgränsat område. Rollen behöver en tydligt definierad och etablerad kompetens inom sin domän, med förmåga att tillämpa standardiserade arbetssätt.",
        "Rollen kräver fördjupad kompetens och metodförståelse. Rollen behöver kunna hantera komplexare uppgifter, använda mer avancerade metoder/verktyg och ha god förståelse för hur området fungerar i praktiken.",
        "Rollen kräver avancerad specialistkompetens. Rollen kräver djupare kunskap inom ett eller flera delområden och förmåga att hantera svårare problem, göra analyser och ta fram lösningar som blir vägledande i det operativa arbetet.",
        "Rollen kräver expertkompetens inom en komplex domän. Rollen förutsätter att innehavaren definierar metoder, strukturer och arbetssätt inom sin domän och fungerar som intern expert i kvalificerade frågor.",
        "Rollen kräver domänledande kompetens och kunskapsutveckling. Rollen kräver att innehavaren utvecklar nya arbetssätt, modeller eller tekniker och sätter riktning och principer för organisationens framtida förmågor inom området.",
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
        "Inget budget- eller kostnadsansvar.",
        "Påverkar kostnader indirekt genom beslut.",
        "Ansvar för mindre kostnadsram eller projekt/budgetdel.",
        "Budgetansvar inom eget område/team.",
        "Ansvar för större budget/affärsområde.",
        "Ansvar för betydande del av företagets ekonomi eller P&L.",
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
        "Inget personal- eller ledningsansvar.",
        "Operativ ledning av arbete, men inget HR-ansvar.",
        "Personalansvar för medarbetare (M1).",
        "Chef över flera team eller första linjens chefer (M2).",
        "Funktionschef med flera chefsled eller större organisation.",
        "Strategisk ledare på företagsnivå (Head/Director/C-nivå).",
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
        "Inga formella förkunskaper krävs. Rollen kan läras in från grunden via intern introduktion. Kräver ingen särskild teoretisk bas eller yrkesutbildning.",
        "Grundläggande yrkeskunskap krävs. Rollen kräver viss förkunskap inom området (t.ex. kortare kurser eller praktisk erfarenhet), men ingen eftergymnasial utbildning.",
        "Eftergymnasial yrkesutbildning eller motsvarande förkunskap krävs. Rollen kräver en yrkeshögskoleutbildning, certifiering eller motsvarande teoretisk grund för att kunna utföra arbetsuppgifterna.",
        "Högskoleexamen eller motsvarande kvalificerad förkunskap krävs. Rollen kräver kandidatexamen/ingenjör eller motsvarande dokumenterad kompetens för att kunna hantera typiska arbetsuppgifter.",
        "Fördjupad akademisk nivå eller avancerad specialistcertifiering krävs. Rollen kräver t.ex. masterutbildning, avancerad certifiering (IFRS, TISAX, säkerhetscertifikat, CPA etc.) eller motsvarande hög teoretisk nivå.",
        "Professionell expertis på högsta nivå krävs. Rollen kräver forskningsnära kompetens, avancerad expertackreditering eller mycket tung domänspecifik expertis som normerar området.",
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
