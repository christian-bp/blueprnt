import {
  LEVEL_COUNT,
  type ZoneKey,
  ZONE_KEYS,
  ZONE_LEVEL_RANGES,
  zoneForLevel,
} from "@workspace/core"
import type { LevelRange, LevelRoleRow } from "@/lib/levels"

// The four zone bands the levels surfaces group into.
//
// The GEOMETRY is the engine's, never this module's: ZONE_KEYS gives the order
// and the letters, ZONE_LEVEL_RANGES gives each zone's span. A UI that hard-
// coded "levels 1-3 are zone A" would be a second authority on structural law
// (ADR-0022), and the day the architecture gains a zone or moves a boundary it
// would keep drawing yesterday's ladder.
export interface ZoneBand {
  zone: ZoneKey
  // The zone's levels, highest first, as the ladder and matrix render them.
  // Only the levels the model actually configures: a model with fewer than
  // twelve level rules leaves the missing ones out rather than inventing them.
  ranges: LevelRange[]
  // The span the band header states, from the model's own configured levels.
  // Null when the model configures none of this zone's levels, which is the
  // one case where a band has nothing to say and is not rendered.
  span: { from: number; to: number } | null
}

// Every level the ARCHITECTURE puts in a zone, highest first, whether or not
// the model configures it. zoneBands filters the model's own ranges against
// this; a caller that wants the full span regardless of configuration (the
// level-rules editor offers a field for every level, rule or no rule) wants
// this directly. It lives here rather than privately in that editor because
// this module claims to be the home of UI zone geometry, and a second private
// derivation from ZONE_LEVEL_RANGES makes that claim false.
export function zoneLevels(zone: ZoneKey): number[] {
  const { from, to } = ZONE_LEVEL_RANGES[zone]
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

// One heading format for "which zone is this", so the surfaces that name a
// zone cannot drift into four different punctuations, and none of them can
// bypass i18n on the way (two were building `${zone}. ${name}` from the raw
// letter). It takes the ALREADY LOCALIZED label, because this module owns the
// geometry and has no business reaching for a translator; what it owns here is
// that the letter comes first and the zone's name follows it.
export function zoneHeading(zoneLabel: string, name: string): string {
  return `${zoneLabel}: ${name}`
}

// Splits the model's configured level ranges into the four zone bands, in
// ZONE_KEYS order (A first, the highest). A zone with no configured level is
// returned with an empty `ranges` and a null `span` so the caller decides
// whether an empty band is drawn; every caller today drops it.
export function zoneBands(ranges: readonly LevelRange[]): ZoneBand[] {
  return ZONE_KEYS.map((zone) => {
    const levels = zoneLevels(zone)
    const inZone = ranges
      .filter((range) => levels.includes(range.level))
      .sort((a, b) => a.level - b.level)
    const first = inZone[0]
    const last = inZone[inZone.length - 1]
    return {
      zone,
      ranges: inZone,
      span:
        first === undefined || last === undefined
          ? null
          : { from: first.level, to: last.level },
    }
  })
}

// WHERE ONE ZONE ENDS AND THE NEXT BEGINS, as column indexes into the levels
// a matrix lays across its horizontal axis. Index 0 is never a boundary: the
// first column has no neighbour on its left to be separated from.
//
// Derived from the engine's own zone geometry rather than from "every third
// column", so a model that configures only some of its levels still puts the
// rule where the ARCHITECTURE changes zone rather than where the count says.
//
// Defensive about a level the engine would not recognise: zoneForLevel THROWS
// on one out of range, and this runs inside render on the page that already
// went down once from an in-render throw. An unrecognised level simply starts
// no boundary.
export function zoneBoundaryIndexes(
  ranges: readonly LevelRange[]
): ReadonlySet<number> {
  const zoneAt = (index: number): ZoneKey | null => {
    const level = ranges[index]?.level
    if (
      level === undefined ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > LEVEL_COUNT
    ) {
      return null
    }
    return zoneForLevel(level)
  }
  const boundaries = new Set<number>()
  for (let index = 1; index < ranges.length; index += 1) {
    const here = zoneAt(index)
    const before = zoneAt(index - 1)
    if (here !== null && before !== null && here !== before)
      boundaries.add(index)
  }
  return boundaries
}

// Which band a placed role belongs to.
//
// Reads the row's OWN zone, which is the engine's placement (placeRole), and
// never `zoneForLevel(row.level)`. The two agree today by construction, because
// a profile-capped role is moved to the top level of the zone it landed in, so
// deriving would produce the same answer and the difference would be invisible.
// That is exactly why it is worth being deliberate about: the engine owns where
// a role sits, the UI reports it, and if the placement rules ever separate the
// two (a cap that keeps a role's level while moving its zone, a fifth zone, a
// changed boundary) the ladder follows the engine instead of quietly drawing
// its own opinion. A row with no zone is not placed and belongs to no band.
export function bandRowsFor(
  rows: readonly LevelRoleRow[],
  zone: ZoneKey
): LevelRoleRow[] {
  return rows.filter((row) => row.level !== null && row.zone === zone)
}
