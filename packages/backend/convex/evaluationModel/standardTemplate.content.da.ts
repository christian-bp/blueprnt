import type { StandardTemplateContent } from "./standardTemplate.content.en"

// Danish content for the standard template. This is a translation draft of
// the Swedish source (standardTemplate.content.sv.ts) and must be reviewed by
// a native speaker before it ships to users. All structural decisions live in
// standardTemplate.ts; this module carries only prose.
export const standardTemplateContentDa: StandardTemplateContent = {
  modelName: "Standardmodel",
  criteria: {
    scope: {
      name: "Omfang og indvirkning",
      description: "Udfaldets/ansvarets rækkevidde (team til virksomhed).",
      helpText:
        "Vægt rollens rækkevidde: hvor langt dens udfald og ansvar strækker sig, fra egne opgaver til effekt på hele virksomheden.",
      anchors: [
        "Ansvar for egne opgaver inden for et tydeligt afgrænset område.",
        "Indvirkning inden for eget team; ansvar for veldefinerede leverancer.",
        "Ejerskab af et delområde eller en tilbagevendende proces; indvirkning inden for en mindre funktion.",
        "Ansvar for et større område, projekt eller flow; påvirker flere teams/funktioner.",
        "Påvirker et forretnings-/funktionsområde; sætter retning for større dele af organisationen.",
        "Virksomhedsomfattende indvirkning; strategisk ansvar og direkte effekt på organisationens resultater.",
      ],
    },
    risk: {
      name: "Risiko og konsekvens",
      description: "Omkostning ved fejl, compliance, brand.",
      helpText:
        "Vægt konsekvensen, hvis rollen begår fejl: fra fejl der let rettes til kritisk påvirkning af resultater, omdømme eller compliance.",
      anchors: [
        "Lav påvirkning; fejl kan let rettes.",
        "Påvirker hovedsageligt eget arbejde eller team.",
        "Fejl påvirker leverancer eller kvalitet i mindre skala.",
        "Fejl har mærkbare konsekvenser for processer, deadlines eller kunderelationer.",
        "Høj påvirkning på økonomi, omdømme eller compliance.",
        "Kritisk påvirkning på organisationens resultater, strategi eller regelefterlevelse.",
      ],
    },
    complexity: {
      name: "Kompleksitet og tvetydighed",
      description: "Teknisk/forretningsmæssig kompleksitet og usikkerhed.",
      helpText:
        "Vægt arbejdets sværhedsgrad og usikkerhed: fra rutinemæssige, veldefinerede opgaver til nye områder med høj usikkerhed.",
      anchors: [
        "Arbejdet er rutinemæssigt og godt defineret med tydelige instruktioner.",
        "Håndterer standardiserede opgaver med lav variation.",
        "Løser opgaver med en vis variation og behov for egen analyse.",
        "Arbejder med flere afhængigheder og afvejninger; kræver fortolkning og prioritering.",
        "Høj kompleksitet; håndterer modstridende krav og uklare forudsætninger.",
        "Ekstremt komplekse situationer; driver fremdrift i ukendte/innovative områder med høj usikkerhed.",
      ],
    },
    autonomy: {
      name: "Autonomi og beslutningskompetence",
      description: "Selvstændighed og beslutningernes niveau.",
      helpText:
        "Vægt hvor selvstændigt rollen agerer, og hvor tunge beslutninger den træffer: fra at følge instruktioner til beslutninger der påvirker hele organisationen.",
      anchors: [
        "Arbejder tæt styret; følger instruktioner.",
        "Selvstændig i hverdagsopgaver inden for definerede rammer.",
        "Tager egne initiativer og prioriteringer inden for sit område.",
        "Træffer taktiske beslutninger der påvirker et team eller en arbejdsgang.",
        "Træffer strategiske beslutninger inden for et domæne og sætter retning for et delområde.",
        "Træffer beslutninger der påvirker flere domæner eller hele organisationen.",
      ],
    },
    stakeholders: {
      name: "Interessentbredde",
      description: "Internt/eksternt samarbejde, tværfunktionel koordinering.",
      helpText:
        "Vægt bredden og kompleksiteten i rollens samarbejde: fra at arbejde i eget team til at håndtere strategiske eksterne interessenter.",
      anchors: [
        "Samarbejde hovedsageligt inden for eget team.",
        "Samarbejde inden for tilstødende funktioner.",
        "Regelmæssigt tværfunktionelt samarbejde.",
        "Koordinering med eksterne parter/kunder eller flere interne funktioner.",
        "Håndterer et komplekst interessentmiljø med modstridende interesser.",
        "Repræsenterer organisationen eksternt og håndterer strategiske interessenter.",
      ],
    },
    knowledge: {
      name: "Vidensdybde/-bredde",
      description: "Ekspertiseniveau, tværfaglig bredde, erfaring.",
      helpText:
        "Vægt den viden rollen kræver: fra introduktionsniveau med etablerede rutiner til domæneledende ekspertise der sætter retning for organisationens fremtidige evner.",
      anchors: [
        "Rollen kræver grundlæggende viden. Rollen forudsætter introduktionsniveau inden for sit område, og at opgaver kan udføres gennem etablerede rutiner og instruktioner.",
        "Rollen kræver solid faglig viden inden for et defineret område. Rollen har brug for tydeligt defineret og etableret kompetence inden for sit domæne, med evne til at anvende standardiserede arbejdsmetoder.",
        "Rollen kræver fordybet kompetence og metodeforståelse. Rollen skal håndtere mere komplekse opgaver, bruge mere avancerede metoder/værktøjer og have god forståelse af, hvordan området fungerer i praksis.",
        "Rollen kræver avanceret specialistkompetence. Rollen kræver dybere viden inden for et eller flere delområder og evnen til at håndtere sværere problemer, gennemføre analyser og udarbejde løsninger, der bliver retningsgivende i det operative arbejde.",
        "Rollen kræver ekspertkompetence inden for et komplekst domæne. Rollen forudsætter, at indehaveren definerer metoder, strukturer og arbejdsgange inden for sit domæne og fungerer som intern ekspert i kvalificerede spørgsmål.",
        "Rollen kræver domæneledende kompetence og vidensudvikling. Rollen kræver, at indehaveren udvikler nye arbejdsgange, modeller eller teknikker og sætter retning og principper for organisationens fremtidige evner inden for området.",
      ],
    },
    financial: {
      name: "Økonomisk ansvar",
      description: "Budget/resultatopgørelse/portefølje.",
      helpText:
        "Vægt rollens økonomiske ansvar: fra intet budgetansvar til ansvar for en betydelig del af virksomhedens økonomi eller P&L.",
      anchors: [
        "Intet budget- eller omkostningsansvar.",
        "Påvirker omkostninger indirekte gennem beslutninger.",
        "Ansvar for en mindre omkostningsramme eller del af et projekt/budget.",
        "Budgetansvar inden for eget område/team.",
        "Ansvar for et større budget/forretningsområde.",
        "Ansvar for en betydelig del af virksomhedens økonomi eller P&L.",
      ],
    },
    people: {
      name: "Personale-/ledelsesansvar",
      description: "Lead/M1-M3/Head og teamstørrelse.",
      helpText:
        "Vægt rollens formelle personale- og ledelsesansvar: fra intet ansvar til strategisk ledelse på virksomhedsniveau.",
      anchors: [
        "Intet personale- eller ledelsesansvar.",
        "Operativ styring af arbejde, men intet HR-ansvar.",
        "Personaleansvar for medarbejdere (M1).",
        "Leder over flere teams eller førstelinjeledere (M2).",
        "Funktionschef med flere ledelseslag eller en større organisation.",
        "Strategisk leder på virksomhedsniveau (Head/Director/C-level).",
      ],
    },
    formal: {
      name: "Formelle kvalifikationer",
      description:
        "Krævet uddannelsesniveau eller tilsvarende erfaring ved rekruttering.",
      helpText:
        "Vægt den formelle uddannelse eller tilsvarende erfaring rollen kræver ved rekruttering: fra ingen forudsætninger til fagekspertise på højeste niveau.",
      anchors: [
        "Ingen formelle forudsætninger kræves. Rollen kan læres fra bunden gennem intern oplæring. Kræver ingen særlig teoretisk base eller erhvervsuddannelse.",
        "Grundlæggende faglig viden kræves. Rollen kræver en vis forhåndsviden inden for området (f.eks. kortere kurser eller praktisk erfaring), men ingen videregående uddannelse.",
        "Erhvervsrettet videregående uddannelse eller tilsvarende forhåndsviden kræves. Rollen kræver en erhvervsakademiuddannelse, certificering eller tilsvarende teoretisk base for at kunne udføre opgaverne.",
        "Universitetsgrad eller tilsvarende kvalificeret forhåndsviden kræves. Rollen kræver en bachelorgrad/ingeniøruddannelse eller tilsvarende dokumenteret kompetence til at håndtere typiske opgaver.",
        "Avanceret akademisk niveau eller avanceret specialistcertificering kræves. Rollen kræver f.eks. en kandidatgrad, avanceret certificering (IFRS, TISAX, sikkerhedsgodkendelse, CPA osv.) eller tilsvarende højt teoretisk niveau.",
        "Fagekspertise på højeste niveau kræves. Rollen kræver kompetence på forskningsniveau, avanceret ekspertakkreditering eller særdeles betydelig domænespecifik ekspertise, der sætter normen for området.",
      ],
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
