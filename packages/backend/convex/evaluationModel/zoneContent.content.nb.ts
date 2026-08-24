import type { ZoneContent } from "./zoneContent.content.en"

// Norwegian Bokmål content for the zone and level descriptions (the
// masterdokument's sections 14.5 and 14.6). Translated from zoneContentSv
// (the substance source), cross-checked against zoneContentEn where a Swedish
// phrase was ambiguous. Reviewed against en and sv for terminology, register
// and false friends; "sone" is the Bokmål term the message files already use
// for a zone, and "vesentlig" carries the materiality sense.
export const zoneContentNb: ZoneContent = {
  zones: {
    A: {
      name: "Selskapsovergripende og strategiske roller",
      character:
        "Former selskapets langsiktige retning, kritiske veivalg eller samlede evne til å lykkes.",
      typicalProfile:
        "Selskapsledende roller, virksomhetskritiske ledende eksperter eller roller med selskapsovergripende ansvar.",
      summary: "Strategisk og selskapsovergripende påvirkning.",
    },
    B: {
      name: "Ledende spesialist- og lederroller med bred påvirkning",
      character:
        "Har bred, varig og ofte tverrfunksjonell påvirkning på en vesentlig del av virksomheten.",
      typicalProfile:
        "Funksjonsledende roller, seniore ledere og ledende spesialister med betydelig mandat eller konsekvensansvar.",
      summary: "Bred og varig påvirkning på en vesentlig del av virksomheten.",
    },
    C: {
      name: "Selvstendige spesialist- og operative lederroller",
      character:
        "Har selvstendig ansvar for et tydelig område, avanserte arbeidskrav eller påvirkning på team og nærliggende funksjoner.",
      typicalProfile:
        "Seniore spesialister, teamledere, operative ledere og roller med etablert profesjonelt ansvar.",
      summary:
        "Selvstendig ansvar og avanserte krav innenfor et tydelig område.",
    },
    D: {
      name: "Profesjonelle og støttende roller med mer avgrenset påvirkning",
      character:
        "Har tydelige og relevante krav, men normalt mer avgrenset rekkevidde, lavere beslutningsnivå eller mer etablerte rammer.",
      typicalProfile:
        "Profesjonelle roller, koordinerende roller, administrativ støtte og operative roller.",
      summary: "Tydelige og relevante, men normalt mer avgrensede, rollekrav.",
    },
  },
  levelFunctions: {
    A: {
      entry: {
        label: "Inngang til sonen",
        meaning:
          "Rollen oppfyller sonens grunnleggende kvalitative krav og profilkrav.",
      },
      established: {
        label: "Etablert soneprofil",
        meaning:
          "Rollen oppfyller sonens krav tydelig og har en stabil, typisk profil for sonen.",
      },
      upper: {
        label: "Øvre del av sonen",
        meaning:
          "Rollen ligger høyest i arkitekturen. Ingen sone står over den, og rollens rekkevidde, kompleksitet, ansvar og konsekvens er det største modellen beskriver.",
      },
    },
    B: {
      entry: {
        label: "Inngang til sonen",
        meaning:
          "Rollen oppfyller sonens grunnleggende kvalitative krav og profilkrav.",
      },
      established: {
        label: "Etablert soneprofil",
        meaning:
          "Rollen oppfyller sonens krav tydelig og har en stabil, typisk profil for sonen.",
      },
      upper: {
        label: "Øvre del av sonen",
        meaning:
          "Rollen ligger nær neste sone gjennom høyere rekkevidde, kompleksitet, ansvar eller konsekvens, men oppfyller ennå ikke neste sones samlede profil.",
      },
    },
    C: {
      entry: {
        label: "Inngang til sonen",
        meaning:
          "Rollen oppfyller sonens grunnleggende kvalitative krav og profilkrav.",
      },
      established: {
        label: "Etablert soneprofil",
        meaning:
          "Rollen oppfyller sonens krav tydelig og har en stabil, typisk profil for sonen.",
      },
      upper: {
        label: "Øvre del av sonen",
        meaning:
          "Rollen ligger nær neste sone gjennom høyere rekkevidde, kompleksitet, ansvar eller konsekvens, men oppfyller ennå ikke neste sones samlede profil.",
      },
    },
    D: {
      entry: {
        label: "Inngang til sonen",
        meaning:
          "Rollen oppfyller sonens grunnleggende kvalitative krav og profilkrav.",
      },
      established: {
        label: "Etablert soneprofil",
        meaning:
          "Rollen oppfyller sonens krav tydelig og har en stabil, typisk profil for sonen.",
      },
      upper: {
        label: "Øvre del av sonen",
        meaning:
          "Rollen ligger nær neste sone gjennom høyere rekkevidde, kompleksitet, ansvar eller konsekvens, men oppfyller ennå ikke neste sones samlede profil.",
      },
    },
  },
}
