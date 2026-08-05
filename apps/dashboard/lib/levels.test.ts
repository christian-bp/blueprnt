import { describe, expect, it } from "vitest"
import { levelRanges, trackColumns } from "./levels"

describe("levelRanges", () => {
  it("derives [min,max] per level with level 1 topping out at 100", () => {
    const levels = [
      { level: 1, minScore: 98 },
      { level: 2, minScore: 83 },
      { level: 3, minScore: 74 },
      { level: 4, minScore: 63 },
      { level: 5, minScore: 53 },
      { level: 6, minScore: 41 },
      { level: 7, minScore: 0 },
    ]
    expect(levelRanges(levels)).toEqual([
      { level: 1, min: 98, max: 100 },
      { level: 2, min: 83, max: 97 },
      { level: 3, min: 74, max: 82 },
      { level: 4, min: 63, max: 73 },
      { level: 5, min: 53, max: 62 },
      { level: 6, min: 41, max: 52 },
      { level: 7, min: 0, max: 40 },
    ])
  })

  it("sorts unordered thresholds by level first", () => {
    expect(
      levelRanges([
        { level: 2, minScore: 50 },
        { level: 1, minScore: 80 },
      ])
    ).toEqual([
      { level: 1, min: 80, max: 100 },
      { level: 2, min: 50, max: 79 },
    ])
  })
})

describe("trackColumns", () => {
  it("returns distinct tracks in IC, Lead, M order with unknowns last", () => {
    expect(
      trackColumns([
        { trackKey: "M", trackName: "Manager" },
        { trackKey: "IC", trackName: "Individual contributor" },
        { trackKey: "M", trackName: "Manager" },
        { trackKey: "X", trackName: "Other" },
        { trackKey: "Lead", trackName: "Lead" },
      ])
    ).toEqual([
      { key: "IC", name: "Individual contributor" },
      { key: "Lead", name: "Lead" },
      { key: "M", name: "Manager" },
      { key: "X", name: "Other" },
    ])
  })
})
