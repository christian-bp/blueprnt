import { describe, expect, it } from "vitest"
import { buildLevelOverview } from "./level-overview"

describe("buildLevelOverview", () => {
  it("returns null when the org has no model (no levels configured)", () => {
    expect(buildLevelOverview({ rows: [], levels: [] })).toBeNull()
  })

  it("returns null when no role has resolved a level yet", () => {
    const result = buildLevelOverview({
      rows: [{ level: null }, { level: null }],
      levels: [{ level: 1 }, { level: 2 }],
    })
    expect(result).toBeNull()
  })

  it("counts roles per level, zero-filled, sorted ascending by level", () => {
    const result = buildLevelOverview({
      rows: [{ level: 2 }, { level: 1 }, { level: 2 }, { level: null }],
      levels: [{ level: 2 }, { level: 1 }, { level: 3 }],
    })
    expect(result).toEqual({
      totalRoles: 3,
      levelCount: 2,
      levelCounts: [
        { level: 1, count: 1 },
        { level: 2, count: 2 },
        { level: 3, count: 0 },
      ],
    })
  })

  it("ignores a resolved level that no longer matches any configured level", () => {
    const result = buildLevelOverview({
      rows: [{ level: 5 }],
      levels: [{ level: 1 }],
    })
    expect(result).toBeNull()
  })
})
