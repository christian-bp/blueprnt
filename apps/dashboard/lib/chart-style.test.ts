import { describe, expect, it } from "vitest"
import { chartSeriesInk } from "./chart-style"

describe("chartSeriesInk", () => {
  it("assigns the five --chart-* tokens in order for the first five series", () => {
    expect([0, 1, 2, 3, 4].map(chartSeriesInk)).toEqual([
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ])
  })

  it("cycles back to --chart-1 for the sixth series onward", () => {
    expect(chartSeriesInk(5)).toBe("var(--chart-1)")
    expect(chartSeriesInk(6)).toBe("var(--chart-2)")
    expect(chartSeriesInk(7)).toBe("var(--chart-3)")
  })
})
