import type { ZoneKey } from "@workspace/core"
import type { ZonePosition } from "./zoneContent"

export interface ZoneEntryContent {
  // The zone's name without its letter: ZONE_KEYS carries the letter, and a
  // surface that shows both would read it twice.
  name: string
  // Section 14.5's overall character column: what the zone is.
  character: string
  // Section 14.5's typical role profile column: the kinds of role that
  // normally land here, never a rule about which role belongs where.
  typicalProfile: string
  // Section 14.5.1's short character line for the architecture overview,
  // where the full line does not fit.
  summary: string
}

export interface ZoneLevelFunctionContent {
  // Section 14.6's function column: what this position in the zone is.
  label: string
  // Section 14.6's interpretation column: what it means for the role.
  meaning: string
}

export interface ZoneContent {
  zones: Record<ZoneKey, ZoneEntryContent>
  // Four zones times three positions: one cell per level, total in both axes,
  // so a level can never resolve to a missing text. The three functions are
  // the same in every zone except zone A's top, which has no zone above it.
  levelFunctions: Record<
    ZoneKey,
    Record<ZonePosition, ZoneLevelFunctionContent>
  >
}

// English content for the zone and level descriptions (the masterdokument's
// sections 14.5 and 14.6). This module is type-defining, like the criteria
// library's en module: every other locale content module implements
// ZoneContent. All structure (zone keys, level ranges, positions) lives in
// @workspace/core and zoneContent.ts; this module carries only prose.
// Source: docs/rollvardering-masterdokument.md.
export const zoneContentEn: ZoneContent = {
  zones: {
    A: {
      name: "Company-wide and strategic roles",
      character:
        "Shapes the company's long-term direction, its critical choices or its overall ability to succeed.",
      typicalProfile:
        "Company-leading roles, business-critical leading experts, or roles with company-wide responsibility.",
      summary: "Strategic and company-wide impact.",
    },
    B: {
      name: "Leading specialist and manager roles with broad impact",
      character:
        "Has broad, lasting and often cross-functional impact on a material part of the business.",
      typicalProfile:
        "Function-leading roles, senior managers and leading specialists with a substantial mandate or responsibility for consequences.",
      summary: "Broad and lasting impact on a material part of the business.",
    },
    C: {
      name: "Independent specialist and operational leadership roles",
      character:
        "Has independent responsibility for a clearly defined area, advanced work requirements, or impact on teams and adjacent functions.",
      typicalProfile:
        "Senior specialists, team managers, operational leaders and roles with established professional responsibility.",
      summary:
        "Independent responsibility and advanced requirements within a clearly defined area.",
    },
    D: {
      name: "Professional and supporting roles with more limited impact",
      character:
        "Has clear and relevant requirements, but normally a more limited reach, lower decision-making authority or more established frames.",
      typicalProfile:
        "Professional roles, coordinating roles, administrative support and operational roles.",
      summary:
        "Clear and relevant role requirements, but normally more limited ones.",
    },
  },
  levelFunctions: {
    A: {
      entry: {
        label: "Entry to the zone",
        meaning:
          "The role meets the zone's basic qualitative requirements and profile requirements.",
      },
      established: {
        label: "Established zone profile",
        meaning:
          "The role meets the zone's requirements clearly and has a stable profile that is typical for the zone.",
      },
      // Zone A's top level is the top of the architecture, so section 14.6's
      // "close to the next zone" cannot be said here: there is no zone above.
      upper: {
        label: "Upper part of the zone",
        meaning:
          "The role sits at the top of the architecture. No zone stands above it, and its reach, complexity, responsibility and consequence are the greatest the model describes.",
      },
    },
    B: {
      entry: {
        label: "Entry to the zone",
        meaning:
          "The role meets the zone's basic qualitative requirements and profile requirements.",
      },
      established: {
        label: "Established zone profile",
        meaning:
          "The role meets the zone's requirements clearly and has a stable profile that is typical for the zone.",
      },
      upper: {
        label: "Upper part of the zone",
        meaning:
          "The role sits close to the next zone through greater reach, complexity, responsibility or consequence, but does not yet meet the next zone's overall profile.",
      },
    },
    C: {
      entry: {
        label: "Entry to the zone",
        meaning:
          "The role meets the zone's basic qualitative requirements and profile requirements.",
      },
      established: {
        label: "Established zone profile",
        meaning:
          "The role meets the zone's requirements clearly and has a stable profile that is typical for the zone.",
      },
      upper: {
        label: "Upper part of the zone",
        meaning:
          "The role sits close to the next zone through greater reach, complexity, responsibility or consequence, but does not yet meet the next zone's overall profile.",
      },
    },
    D: {
      entry: {
        label: "Entry to the zone",
        meaning:
          "The role meets the zone's basic qualitative requirements and profile requirements.",
      },
      established: {
        label: "Established zone profile",
        meaning:
          "The role meets the zone's requirements clearly and has a stable profile that is typical for the zone.",
      },
      upper: {
        label: "Upper part of the zone",
        meaning:
          "The role sits close to the next zone through greater reach, complexity, responsibility or consequence, but does not yet meet the next zone's overall profile.",
      },
    },
  },
}
