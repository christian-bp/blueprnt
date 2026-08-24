import type { ZoneContent } from "./zoneContent.content.en"

// Danish content for the zone and level descriptions (the masterdokument's
// sections 14.5 and 14.6). Translated from zoneContentSv (the substance
// source), cross-checked against zoneContentEn where a Swedish phrase was
// ambiguous. Reviewed against en and sv for terminology, register and false
// friends; "zone" is the Danish term the message files already use, and
// "væsentlig" carries the materiality sense.
export const zoneContentDa: ZoneContent = {
  zones: {
    A: {
      shortName: "Strategisk ledelse",
      name: "Virksomhedsomfattende og strategiske roller",
      character:
        "Former virksomhedens langsigtede retning, kritiske valg eller samlede evne til at lykkes.",
      typicalProfile:
        "Virksomhedsledende roller, forretningskritiske ledende eksperter eller roller med virksomhedsomfattende ansvar.",
      summary: "Strategisk og virksomhedsomfattende indflydelse.",
    },
    B: {
      shortName: "Bredt lederskab",
      name: "Ledende specialist- og lederroller med bred indflydelse",
      character:
        "Har bred, varig og ofte tværfunktionel indflydelse på en væsentlig del af virksomheden.",
      typicalProfile:
        "Funktionsledende roller, seniore ledere og ledende specialister med betydeligt mandat eller konsekvensansvar.",
      summary: "Bred og varig indflydelse på en væsentlig del af virksomheden.",
    },
    C: {
      shortName: "Selvstændige specialister",
      name: "Selvstændige specialist- og operative lederroller",
      character:
        "Har selvstændigt ansvar for et tydeligt område, avancerede arbejdskrav eller indflydelse på team og nærliggende funktioner.",
      typicalProfile:
        "Seniore specialister, teamledere, operative ledere og roller med etableret professionelt ansvar.",
      summary:
        "Selvstændigt ansvar og avancerede krav inden for et tydeligt område.",
    },
    D: {
      shortName: "Professionel kerne",
      name: "Professionelle og støttende roller med mere afgrænset indflydelse",
      character:
        "Har tydelige og relevante krav, men normalt mere afgrænset rækkevidde, lavere beslutningsniveau eller mere etablerede rammer.",
      typicalProfile:
        "Professionelle roller, koordinerende roller, administrativ støtte og operative roller.",
      summary: "Tydelige og relevante, men normalt mere afgrænsede, rollekrav.",
    },
  },
  levelFunctions: {
    A: {
      entry: {
        label: "Indgang til zonen",
        meaning:
          "Rollen opfylder zonens grundlæggende kvalitative krav og profilkrav.",
      },
      established: {
        label: "Etableret zoneprofil",
        meaning:
          "Rollen opfylder zonens krav tydeligt og har en stabil, typisk profil for zonen.",
      },
      upper: {
        label: "Øvre del af zonen",
        meaning:
          "Rollen ligger højest i arkitekturen. Ingen zone står over den, og rollens rækkevidde, kompleksitet, ansvar og konsekvens er det største, modellen beskriver.",
      },
    },
    B: {
      entry: {
        label: "Indgang til zonen",
        meaning:
          "Rollen opfylder zonens grundlæggende kvalitative krav og profilkrav.",
      },
      established: {
        label: "Etableret zoneprofil",
        meaning:
          "Rollen opfylder zonens krav tydeligt og har en stabil, typisk profil for zonen.",
      },
      upper: {
        label: "Øvre del af zonen",
        meaning:
          "Rollen ligger tæt på næste zone gennem højere rækkevidde, kompleksitet, ansvar eller konsekvens, men opfylder endnu ikke næste zones samlede profil.",
      },
    },
    C: {
      entry: {
        label: "Indgang til zonen",
        meaning:
          "Rollen opfylder zonens grundlæggende kvalitative krav og profilkrav.",
      },
      established: {
        label: "Etableret zoneprofil",
        meaning:
          "Rollen opfylder zonens krav tydeligt og har en stabil, typisk profil for zonen.",
      },
      upper: {
        label: "Øvre del af zonen",
        meaning:
          "Rollen ligger tæt på næste zone gennem højere rækkevidde, kompleksitet, ansvar eller konsekvens, men opfylder endnu ikke næste zones samlede profil.",
      },
    },
    D: {
      entry: {
        label: "Indgang til zonen",
        meaning:
          "Rollen opfylder zonens grundlæggende kvalitative krav og profilkrav.",
      },
      established: {
        label: "Etableret zoneprofil",
        meaning:
          "Rollen opfylder zonens krav tydeligt og har en stabil, typisk profil for zonen.",
      },
      upper: {
        label: "Øvre del af zonen",
        meaning:
          "Rollen ligger tæt på næste zone gennem højere rækkevidde, kompleksitet, ansvar eller konsekvens, men opfylder endnu ikke næste zones samlede profil.",
      },
    },
  },
}
