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
      compliance: {
        purpose:
          "Mäter rollens organisatoriska räckvidd: hur stort område rollen påverkar och hur långt effekterna av dess arbete, beslut och prioriteringar sträcker sig, oberoende av person eller hierarkisk nivå.",
        whyRelevant:
          "Räckvidd och påverkan speglar rollens bidrag till verksamhetens resultat. Det bedöms utifrån faktiskt organisatoriskt genomslag, inte utifrån titel eller synligt mandat, vilket gör kriteriet könsneutralt.",
        overlapNotes:
          "Överlappar delvis med Autonomi (beslutsmandat) och Personal-/Ledningsansvar; här ligger fokus specifikt på hur långt rollens effekter når i organisationen.",
        biasRisk: "low",
        biasComment:
          "Att belöna synligt mandat mer än faktiskt genomslag kan gynna traditionellt synliga roller. Nivåbeskrivningarna utgår från effekt och ansvar snarare än rang och är könsneutrala.",
        biasAction:
          "Nivåankarna beskriver faktisk räckvidd och resultat, inte formell position, så att även roller utan synlig titel kan bedömas högt.",
      },
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
      compliance: {
        purpose:
          "Mäter vilka konsekvenser rollens beslut, arbete eller brister kan få för verksamheten: kvalitet, leverans, ekonomi, efterlevnad, säkerhet, kundrelationer och varumärke.",
        whyRelevant:
          "Konsekvensernas omfattning är en del av rollens värde för verksamheten. Det bedöms utifrån vad som faktiskt står på spel, inte utifrån hur synligt eller dramatiskt arbetet är, vilket gör kriteriet könsneutralt.",
        overlapNotes:
          "Överlappar delvis med Scope & Påverkan; här ligger fokus på konsekvenserna av fel eller brister snarare än på räckvidden i sig.",
        biasRisk: "low",
        biasComment:
          "Synliga operativa eller tekniska risker kan övervärderas medan tyst kvalitets-, omsorgs- eller efterlevnadsarbete undervärderas. Nivåbeskrivningarna omfattar även kvalitet, efterlevnad och relationer och är könsneutrala.",
        biasAction:
          "Ankartexterna inkluderar konsekvenser för kvalitet, efterlevnad och kundrelationer, inte bara ekonomiska eller tekniska fel, så att olika typer av ansvar bedöms likvärdigt.",
      },
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
      compliance: {
        purpose:
          "Mäter arbetets svårighetsgrad: teknisk, affärsmässig och organisatorisk komplexitet samt graden av osäkerhet när information, riktning eller lösning inte är given från början.",
        whyRelevant:
          "Förmågan att hantera många variabler, beroenden och avvägningar är en central del av en rolls värde. Det bedöms utifrån uppgifternas faktiska komplexitet, inte utifrån hur tekniskt arbetet framstår, vilket gör kriteriet könsneutralt.",
        overlapNotes:
          "Överlappar delvis med Kunskapsdjup/Bredd; här ligger fokus på problemens komplexitet och osäkerhet snarare än på den kunskap som krävs.",
        biasRisk: "low",
        biasComment:
          "Teknisk komplexitet kan övervärderas medan relationell, samordnande eller mångtydig komplexitet undervärderas. Nivåbeskrivningarna omfattar även organisatorisk och affärsmässig komplexitet och är könsneutrala.",
        biasAction:
          "Ankartexterna beskriver komplexitet brett (teknisk, affärsmässig och organisatorisk) så att även samordnande och tvetydiga sammanhang bedöms som komplexa.",
      },
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
      compliance: {
        purpose:
          "Mäter rollens handlingsutrymme och beslutsnivå: grad av självständighet, hur mycket styrning rollen arbetar under och vilket mandat den har att påverka riktning, prioriteringar och utfall.",
        whyRelevant:
          "Självständighet och beslutsmandat speglar det ansvar rollen bär. Det bedöms utifrån vilka beslut som faktiskt fattas, inte utifrån formell titel, vilket gör kriteriet könsneutralt.",
        overlapNotes:
          "Överlappar delvis med Scope & Påverkan och Personal-/Ledningsansvar; här ligger fokus på självständighet och beslutsmandat snarare än på räckvidd eller att leda andra.",
        biasRisk: "medium",
        biasComment:
          "Synligt beslutsmandat kan övervärderas jämfört med faktiskt genomslag, vilket kan gynna formellt mandatbärande roller framför seniora specialister med reellt inflytande. Nivåbeskrivningarna är könsneutrala.",
        biasAction:
          "Ankartexterna omfattar även självständigt initiativ och problemlösning, inte bara formellt beslutsmandat, så att reellt inflytande utan titel kan bedömas högt.",
      },
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
      compliance: {
        purpose:
          "Mäter bredden i rollens kontaktytor och samverkansbehov: interna och externa intressenter, tvärfunktionellt samarbete och behovet av att samordna arbete mellan personer, team och parter.",
        whyRelevant:
          "Bred samverkan och samordning är ett reellt bidrag till verksamheten. Kriteriet synliggör relationellt och samordnande arbete, vilket bedöms utifrån samverkans faktiska omfattning och är könsneutralt.",
        overlapNotes:
          "Överlappar delvis med Scope & Påverkan; här ligger fokus på bredden och variationen i samverkan snarare än på räckvidden av resultatet.",
        biasRisk: "low",
        biasComment:
          "Detta kriterium motverkar en känd bias genom att uttryckligen värdera relationellt och samordnande arbete. Kvarstående risk: extern, synlig representation kan övervärderas jämfört med internt samordningsarbete. Nivåbeskrivningarna är könsneutrala.",
        biasAction:
          "Ankartexterna värderar intern tvärfunktionell samordning likvärdigt med extern representation, så att synligt externt nätverkande inte i sig väger tyngre.",
      },
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
      compliance: {
        purpose:
          "Mäter vilken typ och nivå av kunskap rollen bygger på: specialistdjup, praktisk erfarenhet, metodförståelse och förmåga att arbeta över flera discipliner eller områden.",
        whyRelevant:
          "Kunskapsnivå och erfarenhet är en del av rollens värde. Kriteriet bedömer faktisk kompetens och tillämpad förmåga, inte formella meriter i sig, vilket gör det könsneutralt.",
        overlapNotes:
          "Överlappar delvis med Komplexitet & Otydlighet och Formell kompetens; här ligger fokus på faktisk kunskap och erfarenhet snarare än på problemens komplexitet eller formella krav.",
        biasRisk: "low",
        biasComment:
          "Formellt erkänd eller synlig expertis kan övervärderas jämfört med tyst, erfarenhetsbaserad kunskap. Nivåbeskrivningarna utgår från tillämpad kompetens, inte enbart titel eller utbildning, och är könsneutrala.",
        biasAction:
          "Ankartexterna värderar praktisk erfarenhet och tillämpad metodförståelse likvärdigt med formellt erkänd specialisering.",
      },
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
      compliance: {
        purpose:
          "Mäter rollens ansvar för ekonomiska resurser eller utfall: budget, kostnader, intäkter, lönsamhet, investeringar eller ansvar för ett affärsområdes ekonomi.",
        whyRelevant:
          "Ekonomiskt ansvar är en del av rollens bidrag, men värderas utifrån graden av faktiskt beslutsansvar för ekonomin, inte utifrån budgetens storlek i sig, vilket gör kriteriet könsneutralt.",
        overlapNotes:
          "Överlappar delvis med Autonomi (beslutsmandat) och Scope & Påverkan; här ligger fokus specifikt på ansvar för ekonomiska ramar och resultat.",
        biasRisk: "medium",
        biasComment:
          "Stor budget kan ges för stor vikt jämfört med komplexitet, ansvar och specialistkunskap, vilket kan gynna traditionellt mansdominerade budgetbärande roller. Nivåbeskrivningarna är könsneutrala.",
        biasAction:
          "Kriteriet hålls på en måttlig vikt i modellen så att budgetstorlek inte i sig dominerar värderingen, och nivåerna beskriver beslutsansvar snarare än enbart beloppens storlek.",
      },
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
      compliance: {
        purpose:
          "Mäter rollens ansvar för att leda andra: formellt personalansvar, operativ arbetsledning, teamledning och ansvar för kapacitet, prioritering och utveckling genom andra människor.",
        whyRelevant:
          "Att leda andra är en del av rollens bidrag till verksamhetens värde. Det bedöms utifrån ledaruppdragets omfattning och innehåll, inte utifrån titel eller antal underställda, så att det att leda ett litet team väl och att leda ett stort bedöms på faktiskt ansvar snarare än på synlig rang.",
        overlapNotes:
          "Överlappar delvis med Scope & Påverkan (organisatorisk räckvidd) och Autonomi (beslutsmandat); här ligger fokus specifikt på ansvar som utövas genom andra människor.",
        biasRisk: "medium",
        biasComment:
          "Att belöna synligt mandat och antal underställda mer än faktisk ledarpåverkan kan övervärdera traditionellt mansdominerade chefsroller och undervärdera seniora specialister och samordningstungt arbete. Nivåbeskrivningarna i sig är könsneutrala.",
        biasAction:
          "Nivåankarna beskriver ledarskapets innehåll snarare än enbart antal underställda, och kriteriet hålls på en måttlig vikt så att en chefstitel inte i sig dominerar utvärderingen.",
      },
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
      compliance: {
        purpose:
          "Mäter de formella kompetenskrav som typiskt är knutna till rollen: utbildningsnivå, examen, certifiering, legitimation eller annan formellt erkänd kompetens, oberoende av den nuvarande individens bakgrund.",
        whyRelevant:
          "Formella kvalifikationskrav kan spegla den kunskapsnivå rollen förutsätter. Kriteriet beskriver rollens formella inträdesnivå, inte individen, och hålls kopplat till faktiskt arbetsinnehåll för att förbli könsneutralt.",
        overlapNotes:
          "Överlappar delvis med Kunskapsdjup/Bredd; här ligger fokus på formella krav snarare än på faktisk tillämpad kunskap och erfarenhet.",
        biasRisk: "medium",
        biasComment:
          "Att vila på formell status i stället för faktiskt arbetsinnehåll kan missgynna kompetens som förvärvats på andra vägar än traditionell utbildning. Nivåbeskrivningarna tillåter motsvarande dokumenterad erfarenhet och är könsneutrala.",
        biasAction:
          "Nivåerna erkänner uttryckligen motsvarande erfarenhet vid sidan av formell utbildning, och kriteriet hålls på låg vikt så att formella meriter inte i sig driver värderingen.",
      },
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
