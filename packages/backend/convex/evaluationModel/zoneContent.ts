import { ZONE_LEVEL_RANGES, zoneForLevel } from "@workspace/core"
import { clampLocale, type ProductContentLocale } from "./localize"
import { zoneContentDa } from "./zoneContent.da"
import {
  type ZoneContent,
  type ZoneEntryContent,
  zoneContentEn,
  type ZoneLevelFunctionContent,
} from "./zoneContent.en"
import { zoneContentFi } from "./zoneContent.fi"
import { zoneContentNb } from "./zoneContent.nb"
import { zoneContentSv } from "./zoneContent.sv"

// The words for the four-zone, twelve-level architecture (the
// masterdokument's sections 14.5 and 14.6). The geometry itself is structural
// law in @workspace/core (ZONE_KEYS, ZONE_LEVEL_RANGES); this module carries
// only prose, per locale, plus the mapping from a level to the text that
// describes its place inside its own zone.
// Source: docs/rollvardering-masterdokument.md.

// A level's position inside its own zone. Section 14.6 describes the POSITION,
// not the level number: the twelve levels are four zones times these three.
// Listed in the source table's order; the ladder renders them the other way
// round, because a zone's top level carries its lowest number.
export const ZONE_POSITIONS = ["entry", "established", "upper"] as const
export type ZonePosition = (typeof ZONE_POSITIONS)[number]

export type { ZoneContent, ZoneEntryContent, ZoneLevelFunctionContent }

export type ZoneContentLocale = ProductContentLocale

const CONTENT_BY_LOCALE: Record<ZoneContentLocale, ZoneContent> = {
  en: zoneContentEn,
  sv: zoneContentSv,
  nb: zoneContentNb,
  da: zoneContentDa,
  fi: zoneContentFi,
}

// The parity guard asserts against this: the en fallback below would
// otherwise make a missing locale look complete.
export const REGISTERED_ZONE_LOCALES = Object.keys(CONTENT_BY_LOCALE)

export function zoneContent(locale: string): ZoneContent {
  return CONTENT_BY_LOCALE[clampLocale(locale)]
}

// Level 1 is the highest level, so a zone's `from` is its top and its `to` is
// where a role enters it. Every zone spans exactly three levels, so whatever
// is neither end is the established middle.
export function zonePositionForLevel(level: number): ZonePosition {
  const { from, to } = ZONE_LEVEL_RANGES[zoneForLevel(level)]
  if (level === from) return "upper"
  if (level === to) return "entry"
  return "established"
}

// The one text a level row needs. Takes resolved content rather than a locale
// so a ladder resolves the locale once and not once per row.
export function levelFunction(
  content: ZoneContent,
  level: number
): ZoneLevelFunctionContent {
  return content.levelFunctions[zoneForLevel(level)][
    zonePositionForLevel(level)
  ]
}
