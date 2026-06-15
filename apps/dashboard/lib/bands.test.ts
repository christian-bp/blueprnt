import { describe, expect, it } from "vitest"
import { bandRanges, trackColumns } from "./bands"

describe("bandRanges", () => {
  it("derives [min,max] per band with band 1 topping out at 100", () => {
    const bands = [
      { band: 1, minScore: 98 },
      { band: 2, minScore: 83 },
      { band: 3, minScore: 74 },
      { band: 4, minScore: 63 },
      { band: 5, minScore: 53 },
      { band: 6, minScore: 41 },
      { band: 7, minScore: 0 },
    ]
    expect(bandRanges(bands)).toEqual([
      { band: 1, min: 98, max: 100 },
      { band: 2, min: 83, max: 97 },
      { band: 3, min: 74, max: 82 },
      { band: 4, min: 63, max: 73 },
      { band: 5, min: 53, max: 62 },
      { band: 6, min: 41, max: 52 },
      { band: 7, min: 0, max: 40 },
    ])
  })

  it("sorts unordered thresholds by band first", () => {
    expect(
      bandRanges([
        { band: 2, minScore: 50 },
        { band: 1, minScore: 80 },
      ])
    ).toEqual([
      { band: 1, min: 80, max: 100 },
      { band: 2, min: 50, max: 79 },
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
