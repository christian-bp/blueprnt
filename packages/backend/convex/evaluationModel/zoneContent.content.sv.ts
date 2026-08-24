import type { ZoneContent } from "./zoneContent.content.en"

// Swedish content for the zone and level descriptions (the masterdokument's
// sections 14.5 and 14.6). Swedish is the substance source locale: the zone
// names, character lines and typical role profiles, the section 14.5.1
// overview lines, and the section 14.6 functions are verbatim from
// docs/rollvardering-masterdokument.md. Two deliberate departures: a zone's
// name drops the table's letter prefix, which ZONE_KEYS already carries, and
// zone A's top level says what it is instead of the table's "close to the
// next zone", which is not true of the highest level in the architecture.
export const zoneContentSv: ZoneContent = {
  zones: {
    A: {
      shortName: "Strategiskt ledarskap",
      name: "Företagsövergripande och strategiska roller",
      character:
        "Formar bolagets långsiktiga riktning, kritiska vägval eller samlade förmåga att lyckas.",
      typicalProfile:
        "Företagsledande roller, verksamhetskritiska ledande experter eller roller med företagsövergripande ansvar.",
      summary: "Strategisk och företagsövergripande påverkan.",
    },
    B: {
      shortName: "Brett ledarskap",
      name: "Ledande specialist- och chefsroller med bred påverkan",
      character:
        "Har bred, varaktig och ofta tvärfunktionell påverkan på en väsentlig del av verksamheten.",
      typicalProfile:
        "Funktionsledande roller, seniora chefer och ledande specialister med betydande mandat eller konsekvensansvar.",
      summary:
        "Bred och varaktig påverkan på en väsentlig del av verksamheten.",
    },
    C: {
      shortName: "Självständiga specialister",
      name: "Självständiga specialist- och operativa ledarroller",
      character:
        "Har självständigt ansvar för ett tydligt område, avancerade arbetskrav eller påverkan på team och närliggande funktioner.",
      typicalProfile:
        "Seniora specialister, teamchefer, operativa ledare och roller med etablerat professionellt ansvar.",
      summary:
        "Självständigt ansvar och avancerade krav inom ett tydligt område.",
    },
    D: {
      shortName: "Professionell kärna",
      name: "Professionella och stödjande roller med mer avgränsad påverkan",
      character:
        "Har tydliga och relevanta krav, men normalt mer avgränsad räckvidd, lägre beslutshöjd eller mer etablerade ramar.",
      typicalProfile:
        "Professionella roller, koordinerande roller, administrativt stöd och operativa roller.",
      summary: "Tydliga och relevanta, men normalt mer avgränsade, rollkrav.",
    },
  },
  levelFunctions: {
    A: {
      entry: {
        label: "Inträde till zonen",
        meaning:
          "Rollen uppfyller zonens grundläggande kvalitativa krav och profilkrav.",
      },
      established: {
        label: "Etablerad zonprofil",
        meaning:
          "Rollen uppfyller zonens krav tydligt och har en stabil, typisk profil för zonen.",
      },
      upper: {
        label: "Övre del av zonen",
        meaning:
          "Rollen ligger högst i arkitekturen. Ingen zon står över den, och rollens räckvidd, komplexitet, ansvar och konsekvens är det största modellen beskriver.",
      },
    },
    B: {
      entry: {
        label: "Inträde till zonen",
        meaning:
          "Rollen uppfyller zonens grundläggande kvalitativa krav och profilkrav.",
      },
      established: {
        label: "Etablerad zonprofil",
        meaning:
          "Rollen uppfyller zonens krav tydligt och har en stabil, typisk profil för zonen.",
      },
      upper: {
        label: "Övre del av zonen",
        meaning:
          "Rollen ligger nära nästa zon genom högre räckvidd, komplexitet, ansvar eller konsekvens, men uppfyller ännu inte nästa zons samlade profil.",
      },
    },
    C: {
      entry: {
        label: "Inträde till zonen",
        meaning:
          "Rollen uppfyller zonens grundläggande kvalitativa krav och profilkrav.",
      },
      established: {
        label: "Etablerad zonprofil",
        meaning:
          "Rollen uppfyller zonens krav tydligt och har en stabil, typisk profil för zonen.",
      },
      upper: {
        label: "Övre del av zonen",
        meaning:
          "Rollen ligger nära nästa zon genom högre räckvidd, komplexitet, ansvar eller konsekvens, men uppfyller ännu inte nästa zons samlade profil.",
      },
    },
    D: {
      entry: {
        label: "Inträde till zonen",
        meaning:
          "Rollen uppfyller zonens grundläggande kvalitativa krav och profilkrav.",
      },
      established: {
        label: "Etablerad zonprofil",
        meaning:
          "Rollen uppfyller zonens krav tydligt och har en stabil, typisk profil för zonen.",
      },
      upper: {
        label: "Övre del av zonen",
        meaning:
          "Rollen ligger nära nästa zon genom högre räckvidd, komplexitet, ansvar eller konsekvens, men uppfyller ännu inte nästa zons samlade profil.",
      },
    },
  },
}
