import { describe, expect, it } from "vitest"
import { bandCounts } from "./results"

describe("bandCounts", () => {
  it("counts complete roles per band and ignores incomplete ones", () => {
    const bands = [1, 2, 3, 4, 5, 6, 7].map((band) => ({ band }))
    const rows = [
      { band: 1 },
      { band: 1 },
      { band: 6 },
      { band: null },
      { band: null },
    ]
    expect(bandCounts(bands, rows)).toEqual([
      { band: 1, count: 2 },
      { band: 2, count: 0 },
      { band: 3, count: 0 },
      { band: 4, count: 0 },
      { band: 5, count: 0 },
      { band: 6, count: 1 },
      { band: 7, count: 0 },
    ])
  })
})
