import { type ZoneKey, ZONE_KEYS, ZONE_LEVEL_RANGES } from "@workspace/core"
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

// Splits the model's configured level ranges into the four zone bands, in
// ZONE_KEYS order (A first, the highest). A zone with no configured level is
// returned with an empty `ranges` and a null `span` so the caller decides
// whether an empty band is drawn; every caller today drops it.
export function zoneBands(ranges: readonly LevelRange[]): ZoneBand[] {
  return ZONE_KEYS.map((zone) => {
    const { from, to } = ZONE_LEVEL_RANGES[zone]
    const inZone = ranges
      .filter((range) => range.level >= from && range.level <= to)
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
