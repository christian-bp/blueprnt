import type { StandardTemplateContent } from "./standardTemplate.content.en"

// Norwegian (Bokmal) content for the standard template. This is a translation
// draft of the Swedish source (standardTemplate.content.sv.ts) and must be
// reviewed by a native speaker before it ships to users. All structural
// decisions live in standardTemplate.ts; this module carries only prose.
export const standardTemplateContentNb: StandardTemplateContent = {
  modelName: "Standardmodell",
  criteria: {
    scope: {
      name: "Omfang og påvirkning",
      description: "Utfallets/ansvarets rekkevidde (team til selskap).",
      helpText:
        "Vei rollens rekkevidde: hvor langt utfall og ansvar strekker seg, fra egne oppgaver til effekt på hele selskapet.",
      anchors: [
        "Ansvar for egne oppgaver innenfor et tydelig avgrenset område.",
        "Påvirkning innenfor eget team; ansvar for veldefinerte leveranser.",
        "Eierskap til et delområde eller en gjentakende prosess; påvirkning innenfor en mindre funksjon.",
        "Ansvar for et større område, prosjekt eller en flyt; påvirker flere team/funksjoner.",
        "Påvirker et forretnings-/funksjonsområde; setter retning for større deler av organisasjonen.",
        "Selskapsomfattende påvirkning; strategisk ansvar og direkte effekt på organisasjonens resultater.",
      ],
    },
    risk: {
      name: "Risiko og konsekvens",
      description: "Kostnad ved feil, etterlevelse, omdømme.",
      helpText:
        "Vei konsekvensen hvis rollen gjør feil: fra feil som enkelt rettes til kritisk påvirkning på resultater, omdømme eller etterlevelse.",
      anchors: [
        "Lav påvirkning; feil kan enkelt rettes.",
        "Påvirker hovedsakelig eget arbeid eller team.",
        "Feil påvirker leveranser eller kvalitet i mindre skala.",
        "Feil har merkbare konsekvenser for prosesser, frister eller kunderelasjoner.",
        "Høy påvirkning på økonomi, omdømme eller etterlevelse.",
        "Kritisk påvirkning på organisasjonens resultater, strategi eller regeletterlevelse.",
      ],
    },
    complexity: {
      name: "Kompleksitet og tvetydighet",
      description: "Teknisk/forretningsmessig kompleksitet og usikkerhet.",
      helpText:
        "Vei arbeidets vanskelighetsgrad og usikkerhet: fra rutinemessige, veldefinerte oppgaver til nye områder med høy usikkerhet.",
      anchors: [
        "Arbeidet er rutinemessig og godt definert med tydelige instruksjoner.",
        "Håndterer standardiserte oppgaver med lav variasjon.",
        "Løser oppgaver med noe variasjon og behov for egen analyse.",
        "Arbeider med flere avhengigheter og avveininger; krever tolkning og prioritering.",
        "Høy kompleksitet; håndterer motstridende krav og uklare forutsetninger.",
        "Ekstremt komplekse situasjoner; driver fremdrift i ukjente/innovative områder med høy usikkerhet.",
      ],
    },
    autonomy: {
      name: "Autonomi og beslutningsmyndighet",
      description: "Selvstendighet og beslutningenes nivå.",
      helpText:
        "Vei hvor selvstendig rollen handler og hvor tunge beslutninger den tar: fra å følge instruksjoner til beslutninger som påvirker hele organisasjonen.",
      anchors: [
        "Arbeider tett styrt; følger instruksjoner.",
        "Selvstendig i hverdagsoppgaver innenfor definerte rammer.",
        "Tar egne initiativer og prioriteringer innenfor sitt område.",
        "Tar taktiske beslutninger som påvirker et team eller en arbeidsflyt.",
        "Tar strategiske beslutninger innenfor et domene og setter retning for et delområde.",
        "Tar beslutninger som påvirker flere domener eller hele organisasjonen.",
      ],
    },
    stakeholders: {
      name: "Interessentbredde",
      description: "Internt/eksternt samarbeid, tverrfunksjonell koordinering.",
      helpText:
        "Vei bredden og kompleksiteten i rollens samarbeid: fra å arbeide innenfor eget team til å håndtere strategiske eksterne interessenter.",
      anchors: [
        "Samarbeid hovedsakelig innenfor eget team.",
        "Samarbeid innenfor tilgrensende funksjoner.",
        "Regelmessig tverrfunksjonelt samarbeid.",
        "Koordinering med eksterne parter/kunder eller flere interne funksjoner.",
        "Håndterer et komplekst interessentmiljø med motstridende interesser.",
        "Representerer organisasjonen eksternt og håndterer strategiske interessenter.",
      ],
    },
    knowledge: {
      name: "Kunnskapsdybde/-bredde",
      description: "Ekspertisenivå, tverrfaglig bredde, erfaring.",
      helpText:
        "Vei kunnskapen rollen krever: fra introduksjonsnivå med etablerte rutiner til domeneledende ekspertise som setter retning for organisasjonens fremtidige evner.",
      anchors: [
        "Rollen krever grunnleggende kunnskap. Rollen forutsetter introduksjonsnivå innenfor sitt område og at oppgaver kan utføres gjennom etablerte rutiner og instruksjoner.",
        "Rollen krever solid fagkunnskap innenfor et definert område. Rollen trenger tydelig definert og etablert kompetanse innenfor sitt domene, med evne til å anvende standardiserte arbeidsmetoder.",
        "Rollen krever fordypet kompetanse og metodeforståelse. Rollen må håndtere mer komplekse oppgaver, bruke mer avanserte metoder/verktøy og ha god forståelse av hvordan området fungerer i praksis.",
        "Rollen krever avansert spesialistkompetanse. Rollen krever dypere kunnskap innenfor ett eller flere delområder og evne til å håndtere vanskeligere problemer, gjennomføre analyser og utarbeide løsninger som blir retningsgivende i det operative arbeidet.",
        "Rollen krever ekspertkompetanse innenfor et komplekst domene. Rollen forutsetter at innehaveren definerer metoder, strukturer og arbeidsmåter innenfor sitt domene og fungerer som intern ekspert i kvalifiserte spørsmål.",
        "Rollen krever domeneledende kompetanse og kunnskapsutvikling. Rollen krever at innehaveren utvikler nye arbeidsmåter, modeller eller teknikker og setter retning og prinsipper for organisasjonens fremtidige evner innenfor området.",
      ],
    },
    financial: {
      name: "Økonomisk ansvar",
      description: "Budsjett/resultatregnskap/portefølje.",
      helpText:
        "Vei rollens økonomiske ansvar: fra ikke noe budsjettansvar til ansvar for en betydelig del av selskapets økonomi eller resultat.",
      anchors: [
        "Ikke noe budsjett- eller kostnadsansvar.",
        "Påvirker kostnader indirekte gjennom beslutninger.",
        "Ansvar for en mindre kostnadsramme eller del av et prosjekt/budsjett.",
        "Budsjettansvar innenfor eget område/team.",
        "Ansvar for et større budsjett/forretningsområde.",
        "Ansvar for en betydelig del av selskapets økonomi eller resultat.",
      ],
    },
    people: {
      name: "Personal-/lederansvar",
      description: "Lead/M1-M3/Head og teamstørrelse.",
      helpText:
        "Vei rollens formelle personal- og lederansvar: fra ikke noe ansvar til strategisk ledelse på selskapsnivå.",
      anchors: [
        "Ikke noe personal- eller lederansvar.",
        "Operativ styring av arbeid, men ikke noe HR-ansvar.",
        "Personalansvar for medarbeidere (M1).",
        "Leder over flere team eller førstelinjeledere (M2).",
        "Funksjonsleder med flere ledernivåer eller en større organisasjon.",
        "Strategisk leder på selskapsnivå (Head/Director/C-level).",
      ],
    },
    formal: {
      name: "Formelle kvalifikasjoner",
      description:
        "Krav til utdanningsnivå eller tilsvarende erfaring ved rekruttering.",
      helpText:
        "Vei den formelle utdanningen eller tilsvarende erfaring rollen krever ved rekruttering: fra ingen forkunnskaper til fagekspertise på høyeste nivå.",
      anchors: [
        "Ingen formelle forkunnskaper kreves. Rollen kan læres fra grunnen gjennom intern opplæring. Krever ingen særskilt teoretisk base eller yrkesutdanning.",
        "Grunnleggende fagkunnskap kreves. Rollen krever noe forkunnskap innenfor området (f.eks. kortere kurs eller praktisk erfaring), men ingen utdanning utover videregående.",
        "Yrkesfaglig utdanning etter videregående eller tilsvarende forkunnskaper kreves. Rollen krever fagskoleutdanning, sertifisering eller tilsvarende teoretisk base for å kunne utføre oppgavene.",
        "Universitetsgrad eller tilsvarende kvalifiserte forkunnskaper kreves. Rollen krever en bachelorgrad/ingeniørutdanning eller tilsvarende dokumentert kompetanse for å håndtere typiske oppgaver.",
        "Avansert akademisk nivå eller avansert spesialistsertifisering kreves. Rollen krever f.eks. mastergrad, avansert sertifisering (IFRS, TISAX, sikkerhetsklarering, CPA osv.) eller tilsvarende høyt teoretisk nivå.",
        "Fagekspertise på høyeste nivå kreves. Rollen krever kompetanse på forskningsnivå, avansert ekspertakkreditering eller svært betydelig domenespesifikk ekspertise som setter normen for området.",
      ],
    },
  },
  trackNames: {
    IC: "Individual Contributor",
    Lead: "Lead",
    M: "Manager",
  },
}
