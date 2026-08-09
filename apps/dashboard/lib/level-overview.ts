// Pure derivation of the overview's level tile from the same getResults query
// the /work level views read (no stored aggregate, like buildTodo /
// buildOverviewStats): how many roles are placed, across how many levels.
//
// Two figures, not a distribution. This once fed a bar per level, which the
// dashboard rebuild replaced with a stat tile, so the per-level array is
// derived here and consumed here rather than returned.
export type LevelOverview = {
  totalRoles: number
  levelCount: number
}

export type LevelOverviewInput = {
  rows: { level: number | null }[]
  levels: { level: number }[]
}

// null when there is nothing to say yet: no levels configured (no model), or
// no role has resolved a level (no results yet). The tile then shows its own
// empty line rather than a zero.
export function buildLevelOverview(
  input: LevelOverviewInput
): LevelOverview | null {
  if (input.levels.length === 0) return null

  const perLevel = input.levels.map(
    (l) => input.rows.filter((r) => r.level === l.level).length
  )

  const totalRoles = perLevel.reduce((sum, count) => sum + count, 0)
  if (totalRoles === 0) return null

  return {
    totalRoles,
    levelCount: perLevel.filter((count) => count > 0).length,
  }
}
