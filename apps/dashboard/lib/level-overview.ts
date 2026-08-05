// Pure derivation of the overview's level-distribution card from the same
// getResults query the /work level views read (no stored aggregate, like
// buildTodo/buildOverviewStats). One entry per model level, in level order
// (Level 1 highest, ascending), zero-filled so an empty level still renders a
// (zero-height) bar rather than shifting the others.
export type LevelCount = { level: number; count: number }
export type LevelOverview = {
  totalRoles: number
  levelCount: number
  levelCounts: LevelCount[]
}

export type LevelOverviewInput = {
  rows: { level: number | null }[]
  levels: { level: number }[]
}

// null when there is nothing to chart yet: no levels configured (no model),
// or no role has resolved a level (no results yet). The overview omits the
// card entirely in that case rather than rendering an empty/misleading chart.
export function buildLevelOverview(
  input: LevelOverviewInput
): LevelOverview | null {
  if (input.levels.length === 0) return null

  const levelCounts: LevelCount[] = [...input.levels]
    .sort((a, b) => a.level - b.level)
    .map((l) => ({
      level: l.level,
      count: input.rows.filter((r) => r.level === l.level).length,
    }))

  const totalRoles = levelCounts.reduce((sum, c) => sum + c.count, 0)
  if (totalRoles === 0) return null

  const levelCount = levelCounts.filter((c) => c.count > 0).length
  return { totalRoles, levelCount, levelCounts }
}
