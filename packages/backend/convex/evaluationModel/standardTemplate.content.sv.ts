import type { StandardTemplateContent } from "./standardTemplate.content.en"

// Swedish source content for the standard template (source of record). Criterion
// definitions and anchor texts are curated from the Excel prototype tab
// "Vikter & faktorer"; level definitions from the "Track" tab. The Lead3
// definition is from docs/contexts/evaluation-model/standardmall.md.
// helpText is authored assessor guidance derived from each criterion's anchor
// span (the Excel has no distinct help text per criterion).
export const standardTemplateContentSv: StandardTemplateContent = {
  modelName: "Standardmodell",
  criteria: {
    scope: {
      name: "Scope & Påverkan",
      description: "Omfattning av resultat/ansvar (team till bolag).",
      helpText:
        "Väg rollens räckvidd: hur långt sträcker sig dess resultat och ansvar, från egna uppgifter till företagsövergripande effekt.",
      anchors: [
        "0 – Ansvar för egna uppgifter inom ett tydligt begränsat område.",
        "1 – Påverkan inom det egna teamet; ansvar för avgränsade leveranser.",
        "2 – Ägarskap för ett delområde eller återkommande process; påverkan inom en mindre funktion.",
        "3 – Ansvar för ett större område, projekt eller flöde; påverkar flera team/funktioner.",
        "4 – Påverkar affärs-/funktionsområde; definierar riktning för större delar av organisationen.",
        "5 – Företagsövergripande påverkan; strategiskt ansvar och direkt effekt på organisationens resultat.",
      ],
    },
    risk: {
      name: "Risk & Konsekvens",
      description: "Kostnad av fel, efterlevnad, varumärke.",
      helpText:
        "Väg konsekvensen om rollen gör fel: från lätt rättade misstag till kritisk påverkan på resultat, rykte eller regelefterlevnad.",
      anchors: [
        "0 – Låg påverkan; fel kan enkelt rättas.",
        "1 – Påverkar främst eget arbete eller team.",
        "2 – Fel påverkar leveranser eller kvalitet i mindre skala.",
        "3 – Fel får märkbara följder för processer, deadlines eller kundrelationer.",
        "4 – Hög påverkan på ekonomi, rykte eller efterlevnad.",
        "5 – Kritisk påverkan på organisationens resultat, strategi eller regelefterlevnad.",
      ],
    },
    complexity: {
      name: "Komplexitet & Otydlighet",
      description: "Teknisk/affärsmässig komplexitet & osäkerhet.",
      helpText:
        "Väg svårighetsgraden och osäkerheten i arbetet: från rutinmässiga, väldefinierade uppgifter till nya områden med hög osäkerhet.",
      anchors: [
        "0 – Arbete är rutinmässigt och väl definierat med tydliga instruktioner.",
        "1 – Hanterar standardiserade uppgifter med låg variation.",
        "2 – Löser uppgifter med viss variation och behov av egen analys.",
        "3 – Arbetar med flera beroenden och avvägningar; kräver tolkning och prioritering.",
        "4 – Hög komplexitet; hanterar motsägande krav och otydliga förutsättningar.",
        "5 – Extrema komplexa situationer; driver utveckling i okända/innovativa områden med hög osäkerhet.",
      ],
    },
    autonomy: {
      name: "Autonomi & Beslutsmandat",
      description: "Självständighet och nivå på beslut.",
      helpText:
        "Väg hur självständigt rollen agerar och hur tunga beslut den fattar: från att följa instruktioner till beslut som påverkar hela organisationen.",
      anchors: [
        "0 – Arbetar nära styrt; följer instruktioner.",
        "1 – Självständig i vardagliga moment inom definierade ramar.",
        "2 – Tar egna initiativ och prioriteringar inom sitt område.",
        "3 – Tar taktiska beslut som påverkar team eller arbetsflöde.",
        "4 – Fattar strategiska beslut inom domän och sätter riktning för delområde.",
        "5 – Tar beslut som påverkar flera domäner eller hela organisationen.",
      ],
    },
    stakeholders: {
      name: "Intressentbredd",
      description: "Intern/extern samverkan, tvärfunktionell koordinering.",
      helpText:
        "Väg bredden och komplexiteten i rollens samverkan: från samarbete inom eget team till hantering av strategiska externa intressenter.",
      anchors: [
        "0 – Samarbete främst inom eget team.",
        "1 – Samarbete inom närliggande funktioner.",
        "2 – Regelbunden tvärfunktionell samverkan.",
        "3 – Samordning med externa parter/kunder eller flera interna funktioner.",
        "4 – Hanterar komplex stakeholder-miljö med konkurrerande intressen.",
        "5 – Representerar organisationen externt och hanterar strategiska intressenter.",
      ],
    },
    knowledge: {
      name: "Kunskapsdjup/Bredd",
      description: "Expertisnivå, tvärdisciplinär bredd, erfarenhet.",
      helpText:
        "Väg den kunskap rollen kräver: från introduktionsnivå med etablerade rutiner till domänledande kompetens som sätter riktning för organisationens framtida förmågor.",
      anchors: [
        "0 – Rollen kräver grundläggande kunskap. Rollen förutsätter introduktionsnivå inom sitt område och att arbetsuppgifter kan utföras genom etablerade rutiner och instruktioner.",
        "1 – Rollen kräver stabil yrkeskunskap inom ett avgränsat område. Rollen behöver en tydligt definierad och etablerad kompetens inom sin domän, med förmåga att tillämpa standardiserade arbetssätt.",
        "2 – Rollen kräver fördjupad kompetens och metodförståelse. Rollen behöver kunna hantera komplexare uppgifter, använda mer avancerade metoder/verktyg och ha god förståelse för hur området fungerar i praktiken.",
        "3 – Rollen kräver avancerad specialistkompetens. Rollen kräver djupare kunskap inom ett eller flera delområden och förmåga att hantera svårare problem, göra analyser och ta fram lösningar som blir vägledande i det operativa arbetet.",
        "4 – Rollen kräver expertkompetens inom en komplex domän. Rollen förutsätter att innehavaren definierar metoder, strukturer och arbetssätt inom sin domän och fungerar som intern expert i kvalificerade frågor.",
        "5 – Rollen kräver domänledande kompetens och kunskapsutveckling. Rollen kräver att innehavaren utvecklar nya arbetssätt, modeller eller tekniker och sätter riktning och principer för organisationens framtida förmågor inom området.",
      ],
    },
    financial: {
      name: "Finansiellt ansvar",
      description: "Budget/resultaträkning/portfölj.",
      helpText:
        "Väg rollens ekonomiska ansvar: från inget budgetansvar till ansvar för en betydande del av företagets ekonomi eller P&L.",
      anchors: [
        "0 – Inget budget- eller kostnadsansvar.",
        "1 – Påverkar kostnader indirekt genom beslut.",
        "2 – Ansvar för mindre kostnadsram eller projekt/budgetdel.",
        "3 – Budgetansvar inom eget område/team.",
        "4 – Ansvar för större budget/affärsområde.",
        "5 – Ansvar för betydande del av företagets ekonomi eller P&L.",
      ],
    },
    people: {
      name: "Personal-/Ledningsansvar",
      description: "Lead/M1-M3/Head och teamstorlek.",
      helpText:
        "Väg rollens formella personal- och ledningsansvar: från inget ansvar till strategiskt ledarskap på företagsnivå.",
      anchors: [
        "0 – Inget personal- eller ledningsansvar.",
        "1 – Operativ ledning av arbete, men inget HR-ansvar.",
        "2 – Personalansvar för medarbetare (M1).",
        "3 – Chef över flera team eller första linjens chefer (M2).",
        "4 – Funktionschef med flera chefsled eller större organisation.",
        "5 – Strategisk ledare på företagsnivå (Head/Director/C-nivå).",
      ],
    },
    formal: {
      name: "Formell kompetens",
      description:
        "Efterfrågad utbildningsnivå eller likvärdig erfarenhet vid rekrytering.",
      helpText:
        "Väg den formella utbildning eller likvärdiga erfarenhet rollen kräver vid rekrytering: från inga förkunskaper till professionell expertis på högsta nivå.",
      anchors: [
        "0 – Inga formella förkunskaper krävs. Rollen kan läras in från grunden via intern introduktion. Kräver ingen särskild teoretisk bas eller yrkesutbildning.",
        "1 – Grundläggande yrkeskunskap krävs. Rollen kräver viss förkunskap inom området (t.ex. kortare kurser eller praktisk erfarenhet), men ingen eftergymnasial utbildning.",
        "2 – Eftergymnasial yrkesutbildning eller motsvarande förkunskap krävs. Rollen kräver en yrkeshögskoleutbildning, certifiering eller motsvarande teoretisk grund för att kunna utföra arbetsuppgifterna.",
        "3 – Högskoleexamen eller motsvarande kvalificerad förkunskap krävs. Rollen kräver kandidatexamen/ingenjör eller motsvarande dokumenterad kompetens för att kunna hantera typiska arbetsuppgifter.",
        "4 – Fördjupad akademisk nivå eller avancerad specialistcertifiering krävs. Rollen kräver t.ex. masterutbildning, avancerad certifiering (IFRS, TISAX, säkerhetscertifikat, CPA etc.) eller motsvarande hög teoretisk nivå.",
        "5 – Professionell expertis på högsta nivå krävs. Rollen kräver forskningsnära kompetens, avancerad expertackreditering eller mycket tung domänspecifik expertis som normerar området.",
      ],
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
  levelNames: {
    IC1: "IC1",
    IC2: "IC2",
    IC3: "IC3",
    IC4: "IC4",
    IC5: "IC5",
    Lead1: "Lead1",
    Lead2: "Lead2",
    Lead3: "Lead3",
    M1: "M1",
    M2: "M2",
    M3: "M3",
  },
  levelDefinitions: {
    IC1: "IC1 – Grundläggande yrkesroll. Utför tydligt definierade arbetsuppgifter. Följer etablerade arbetssätt och behöver stöd vid mer komplexa moment.",
    IC2: "IC2 – Självständig yrkesroll. Arbetar självständigt inom ett avgränsat område. Bidrar stabilt till teamets leveranser och hanterar rutinmässiga komplexa uppgifter.",
    IC3: "IC3 – Avancerad yrkesroll / områdesansvar. Tar ansvar för ett eget arbetsområde. Prioriterar och löser mer komplexa frågor och bidrar med vägledning till andra i teamet.",
    IC4: "IC4 – Domänansvarig eller expertinriktad roll. Driver utveckling inom ett större arbets- eller teknikområde. Hanterar betydande komplexitet och påverkar arbetssätt i flera team.",
    IC5: "IC5 – Strategisk domänroll / principalnivå. Formar riktning, metoder och principer inom sin domän. Har tydlig tvärfunktionell påverkan och bidrar till långsiktig utveckling.",
    Lead1:
      "Lead-1 – Operativ koordinerande roll (utan personalansvar). Samordnar planering, prioritering och arbetsflöden i teamet. Driver operativ struktur och genomförande utan personalansvar.",
    Lead2:
      "Lead-2 – Tvärfunktionell koordinerande roll. Driver större initiativ eller flera team. Säkerställer helhet och hanterar beroenden mellan funktioner.",
    Lead3:
      "Lead-3 – Strategisk koordinerande roll (utan fullt personalansvar). Ger riktning åt och samordnar flera områden, team eller initiativ och säkerställer strategisk helhet, prioritering och hantering av beroenden på tvärs. Påverkar genom inflytande, koordinering och vägledning snarare än formellt personalansvar.",
    M1: "M1 – Första linjes chef. Formellt personalansvar. Leder teamets mål, utveckling, arbetsmiljö och leverans.",
    M2: "M2 – Funktionsansvarig chef / chef över chefer. Styr en hel funktion genom M1-roller. Ansvarar för taktik, resursfördelning, budget och funktionens helhet.",
    M3: "Head of X – Strategisk ledningsroll. Övergripande ledningsansvar för funktion eller verksamhetsområde. Påverkar strategi, prioriteringar och organisationens långsiktiga riktning.",
  },
}
