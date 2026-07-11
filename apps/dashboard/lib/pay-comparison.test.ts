import { describe, expect, it } from "vitest"
import { buildPayComparisonRows } from "./pay-comparison"

describe("buildPayComparisonRows", () => {
  it("orders the track ladder highest-first and maps points to rows", () => {
    const { levels, data } = buildPayComparisonRows("IC", [
      { level: "IC2", amount: 40000, isSelf: false },
      { level: "IC5", amount: 90000, isSelf: true },
    ])
    expect(levels).toEqual(["IC5", "IC4", "IC3", "IC2", "IC1"])
    expect(data).toEqual([
      { level: "IC2", amount: 40000, isSelf: false, row: 3 },
      { level: "IC5", amount: 90000, isSelf: true, row: 0 },
    ])
  })

  it("appends off-ladder levels below the ladder instead of dropping them", () => {
    const { levels, data } = buildPayComparisonRows("M", [
      { level: "M1", amount: 50000, isSelf: true },
      { level: "Legacy-9", amount: 45000, isSelf: false },
    ])
    expect(levels).toEqual(["M3", "M2", "M1", "Legacy-9"])
    expect(data[1]?.row).toBe(3)
  })

  it("treats an unknown track as all off-ladder in encounter order", () => {
    const { levels } = buildPayComparisonRows(undefined, [
      { level: "B", amount: 1, isSelf: false },
      { level: "A", amount: 2, isSelf: true },
    ])
    expect(levels).toEqual(["B", "A"])
  })
})
