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
        "Ansvar för egna uppgifter inom ett tydligt begränsat område.",
        "Påverkan inom det egna teamet; ansvar för avgränsade leveranser.",
        "Ägarskap för ett delområde eller återkommande process; påverkan inom en mindre funktion.",
        "Ansvar för ett större område, projekt eller flöde; påverkar flera team/funktioner.",
        "Påverkar affärs-/funktionsområde; definierar riktning för större delar av organisationen.",
        "Företagsövergripande påverkan; strategiskt ansvar och direkt effekt på organisationens resultat.",
      ],
    },
    risk: {
      name: "Risk & Konsekvens",
      description: "Kostnad av fel, efterlevnad, varumärke.",
      helpText:
        "Väg konsekvensen om rollen gör fel: från lätt rättade misstag till kritisk påverkan på resultat, rykte eller regelefterlevnad.",
      anchors: [
        "Låg påverkan; fel kan enkelt rättas.",
        "Påverkar främst eget arbete eller team.",
        "Fel påverkar leveranser eller kvalitet i mindre skala.",
        "Fel får märkbara följder för processer, deadlines eller kundrelationer.",
        "Hög påverkan på ekonomi, rykte eller efterlevnad.",
        "Kritisk påverkan på organisationens resultat, strategi eller regelefterlevnad.",
      ],
    },
    complexity: {
      name: "Komplexitet & Otydlighet",
      description: "Teknisk/affärsmässig komplexitet & osäkerhet.",
      helpText:
        "Väg svårighetsgraden och osäkerheten i arbetet: från rutinmässiga, väldefinierade uppgifter till nya områden med hög osäkerhet.",
      anchors: [
        "Arbete är rutinmässigt och väl definierat med tydliga instruktioner.",
        "Hanterar standardiserade uppgifter med låg variation.",
        "Löser uppgifter med viss variation och behov av egen analys.",
        "Arbetar med flera beroenden och avvägningar; kräver tolkning och prioritering.",
        "Hög komplexitet; hanterar motsägande krav och otydliga förutsättningar.",
        "Extrema komplexa situationer; driver utveckling i okända/innovativa områden med hög osäkerhet.",
      ],
    },
    autonomy: {
      name: "Autonomi & Beslutsmandat",
      description: "Självständighet och nivå på beslut.",
      helpText:
        "Väg hur självständigt rollen agerar och hur tunga beslut den fattar: från att följa instruktioner till beslut som påverkar hela organisationen.",
      anchors: [
        "Arbetar nära styrt; följer instruktioner.",
        "Självständig i vardagliga moment inom definierade ramar.",
        "Tar egna initiativ och prioriteringar inom sitt område.",
        "Tar taktiska beslut som påverkar team eller arbetsflöde.",
        "Fattar strategiska beslut inom domän och sätter riktning för delområde.",
        "Tar beslut som påverkar flera domäner eller hela organisationen.",
      ],
    },
    stakeholders: {
      name: "Intressentbredd",
      description: "Intern/extern samverkan, tvärfunktionell koordinering.",
      helpText:
        "Väg bredden och komplexiteten i rollens samverkan: från samarbete inom eget team till hantering av strategiska externa intressenter.",
      anchors: [
        "Samarbete främst inom eget team.",
        "Samarbete inom närliggande funktioner.",
        "Regelbunden tvärfunktionell samverkan.",
        "Samordning med externa parter/kunder eller flera interna funktioner.",
        "Hanterar komplex stakeholder-miljö med konkurrerande intressen.",
        "Representerar organisationen externt och hanterar strategiska intressenter.",
      ],
    },
    knowledge: {
      name: "Kunskapsdjup/Bredd",
      description: "Expertisnivå, tvärdisciplinär bredd, erfarenhet.",
      helpText:
        "Väg den kunskap rollen kräver: från introduktionsnivå med etablerade rutiner till domänledande kompetens som sätter riktning för organisationens framtida förmågor.",
      anchors: [
        "Rollen kräver grundläggande kunskap. Rollen förutsätter introduktionsnivå inom sitt område och att arbetsuppgifter kan utföras genom etablerade rutiner och instruktioner.",
        "Rollen kräver stabil yrkeskunskap inom ett avgränsat område. Rollen behöver en tydligt definierad och etablerad kompetens inom sin domän, med förmåga att tillämpa standardiserade arbetssätt.",
        "Rollen kräver fördjupad kompetens och metodförståelse. Rollen behöver kunna hantera komplexare uppgifter, använda mer avancerade metoder/verktyg och ha god förståelse för hur området fungerar i praktiken.",
        "Rollen kräver avancerad specialistkompetens. Rollen kräver djupare kunskap inom ett eller flera delområden och förmåga att hantera svårare problem, göra analyser och ta fram lösningar som blir vägledande i det operativa arbetet.",
        "Rollen kräver expertkompetens inom en komplex domän. Rollen förutsätter att innehavaren definierar metoder, strukturer och arbetssätt inom sin domän och fungerar som intern expert i kvalificerade frågor.",
        "Rollen kräver domänledande kompetens och kunskapsutveckling. Rollen kräver att innehavaren utvecklar nya arbetssätt, modeller eller tekniker och sätter riktning och principer för organisationens framtida förmågor inom området.",
      ],
    },
    financial: {
      name: "Finansiellt ansvar",
      description: "Budget/resultaträkning/portfölj.",
      helpText:
        "Väg rollens ekonomiska ansvar: från inget budgetansvar till ansvar för en betydande del av företagets ekonomi eller P&L.",
      anchors: [
        "Inget budget- eller kostnadsansvar.",
        "Påverkar kostnader indirekt genom beslut.",
        "Ansvar för mindre kostnadsram eller projekt/budgetdel.",
        "Budgetansvar inom eget område/team.",
        "Ansvar för större budget/affärsområde.",
        "Ansvar för betydande del av företagets ekonomi eller P&L.",
      ],
    },
    people: {
      name: "Personal-/Ledningsansvar",
      description: "Lead/M1-M3/Head och teamstorlek.",
      helpText:
        "Väg rollens formella personal- och ledningsansvar: från inget ansvar till strategiskt ledarskap på företagsnivå.",
      anchors: [
        "Inget personal- eller ledningsansvar.",
        "Operativ ledning av arbete, men inget HR-ansvar.",
        "Personalansvar för medarbetare (M1).",
        "Chef över flera team eller första linjens chefer (M2).",
        "Funktionschef med flera chefsled eller större organisation.",
        "Strategisk ledare på företagsnivå (Head/Director/C-nivå).",
      ],
    },
    formal: {
      name: "Formell kompetens",
      description:
        "Efterfrågad utbildningsnivå eller likvärdig erfarenhet vid rekrytering.",
      helpText:
        "Väg den formella utbildning eller likvärdiga erfarenhet rollen kräver vid rekrytering: från inga förkunskaper till professionell expertis på högsta nivå.",
      anchors: [
        "Inga formella förkunskaper krävs. Rollen kan läras in från grunden via intern introduktion. Kräver ingen särskild teoretisk bas eller yrkesutbildning.",
        "Grundläggande yrkeskunskap krävs. Rollen kräver viss förkunskap inom området (t.ex. kortare kurser eller praktisk erfarenhet), men ingen eftergymnasial utbildning.",
        "Eftergymnasial yrkesutbildning eller motsvarande förkunskap krävs. Rollen kräver en yrkeshögskoleutbildning, certifiering eller motsvarande teoretisk grund för att kunna utföra arbetsuppgifterna.",
        "Högskoleexamen eller motsvarande kvalificerad förkunskap krävs. Rollen kräver kandidatexamen/ingenjör eller motsvarande dokumenterad kompetens för att kunna hantera typiska arbetsuppgifter.",
        "Fördjupad akademisk nivå eller avancerad specialistcertifiering krävs. Rollen kräver t.ex. masterutbildning, avancerad certifiering (IFRS, TISAX, säkerhetscertifikat, CPA etc.) eller motsvarande hög teoretisk nivå.",
        "Professionell expertis på högsta nivå krävs. Rollen kräver forskningsnära kompetens, avancerad expertackreditering eller mycket tung domänspecifik expertis som normerar området.",
      ],
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
