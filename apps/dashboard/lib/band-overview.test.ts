import { describe, expect, it } from "vitest"
import { buildBandOverview } from "./band-overview"

describe("buildBandOverview", () => {
  it("returns null when the org has no model (no bands configured)", () => {
    expect(buildBandOverview({ rows: [], bands: [] })).toBeNull()
  })

  it("returns null when no role has resolved a band yet", () => {
    const result = buildBandOverview({
      rows: [{ band: null }, { band: null }],
      bands: [{ band: 1 }, { band: 2 }],
    })
    expect(result).toBeNull()
  })

  it("counts roles per band, zero-filled, sorted ascending by band", () => {
    const result = buildBandOverview({
      rows: [{ band: 2 }, { band: 1 }, { band: 2 }, { band: null }],
      bands: [{ band: 2 }, { band: 1 }, { band: 3 }],
    })
    expect(result).toEqual({
      totalRoles: 3,
      bandCount: 2,
      bandCounts: [
        { band: 1, count: 1 },
        { band: 2, count: 2 },
        { band: 3, count: 0 },
      ],
    })
  })

  it("ignores a resolved band that no longer matches any configured band", () => {
    const result = buildBandOverview({
      rows: [{ band: 5 }],
      bands: [{ band: 1 }],
    })
    expect(result).toBeNull()
  })
})
