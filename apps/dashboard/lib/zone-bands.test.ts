import { ZONE_KEYS, ZONE_LEVEL_RANGES } from "@workspace/core"
import { describe, expect, it } from "vitest"
import type { LevelRange, LevelRoleRow } from "@/lib/levels"
import { bandRowsFor, zoneBands } from "@/lib/zone-bands"

const ALL_LEVELS: LevelRange[] = Array.from({ length: 12 }, (_, index) => ({
  level: index + 1,
  min: 0,
  max: 100,
}))

function row(overrides: Partial<LevelRoleRow>): LevelRoleRow {
  return {
    roleId: "r1",
    slug: "r1",
    title: "Role",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: 50,
    level: 5,
    zone: "B",
    ratedCount: 9,
    totalCriteria: 9,
    readyToLock: false,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

describe("zoneBands", () => {
  it("splits the twelve levels into the engine's four zones, A first", () => {
    const bands = zoneBands(ALL_LEVELS)
    expect(bands.map((band) => band.zone)).toEqual([...ZONE_KEYS])
    for (const band of bands) {
      expect(band.ranges.map((range) => range.level)).toEqual([
        ZONE_LEVEL_RANGES[band.zone].from,
        ZONE_LEVEL_RANGES[band.zone].from + 1,
        ZONE_LEVEL_RANGES[band.zone].to,
      ])
    }
  })

  // Derived from ZONE_LEVEL_RANGES, never restated here: the geometry is
  // structural law and the UI may not hold a second copy of it.
  it("spans each band from the engine's own range", () => {
    for (const band of zoneBands(ALL_LEVELS)) {
      expect(band.span).toEqual(ZONE_LEVEL_RANGES[band.zone])
    }
  })

  it("orders every band's levels highest first", () => {
    for (const band of zoneBands([...ALL_LEVELS].reverse())) {
      const levels = band.ranges.map((range) => range.level)
      expect(levels).toEqual([...levels].sort((a, b) => a - b))
    }
  })

  // A model may configure fewer levels than the architecture allows; a band
  // then spans what actually exists rather than what the range permits.
  it("spans only the levels the model configures", () => {
    const bands = zoneBands([
      { level: 2, min: 0, max: 100 },
      { level: 7, min: 0, max: 100 },
    ])
    const a = bands.find((band) => band.zone === "A")
    expect(a?.span).toEqual({ from: 2, to: 2 })
    const c = bands.find((band) => band.zone === "C")
    expect(c?.span).toEqual({ from: 7, to: 7 })
  })

  it("marks a zone the model configures no level for", () => {
    const bands = zoneBands([{ level: 1, min: 0, max: 100 }])
    expect(bands.find((band) => band.zone === "A")?.span).not.toBeNull()
    for (const zone of ["B", "C", "D"] as const) {
      const band = bands.find((entry) => entry.zone === zone)
      expect(band?.span).toBeNull()
      expect(band?.ranges).toEqual([])
    }
  })

  it("returns four empty bands for a model with no levels", () => {
    const bands = zoneBands([])
    expect(bands).toHaveLength(4)
    expect(bands.every((band) => band.span === null)).toBe(true)
  })
})

describe("bandRowsFor", () => {
  it("takes the rows the ENGINE placed in the zone", () => {
    const rows = [
      row({ roleId: "a", level: 2, zone: "A" }),
      row({ roleId: "b", level: 5, zone: "B" }),
      row({ roleId: "c", level: 11, zone: "D" }),
    ]
    expect(bandRowsFor(rows, "A").map((r) => r.roleId)).toEqual(["a"])
    expect(bandRowsFor(rows, "B").map((r) => r.roleId)).toEqual(["b"])
    expect(bandRowsFor(rows, "D").map((r) => r.roleId)).toEqual(["c"])
  })

  // THE RULE. The engine's placeRole may cap a role into a lower zone, and it
  // is the engine that decides where a role sits. A row whose zone and level
  // disagree follows its ZONE: if this ever followed the level instead, the UI
  // would be a second authority on structural law and would quietly out-vote
  // the engine the day the two separate.
  it("follows the row's zone, never the zone its level would imply", () => {
    const capped = row({ roleId: "capped", level: 2, zone: "C" })
    expect(bandRowsFor([capped], "C").map((r) => r.roleId)).toEqual(["capped"])
    expect(bandRowsFor([capped], "A")).toEqual([])
  })

  it("places no unrated row in any band", () => {
    const unrated = row({ roleId: "u", level: null, zone: null })
    for (const zone of ZONE_KEYS) {
      expect(bandRowsFor([unrated], zone)).toEqual([])
    }
  })

  // A locked role whose zone somehow arrived without a level is not placed
  // either: a band draws roles at a level, and a row with none has no lane.
  it("places no row that has a zone but no level", () => {
    const odd = row({ roleId: "odd", level: null, zone: "B" })
    expect(bandRowsFor([odd], "B")).toEqual([])
  })
})
