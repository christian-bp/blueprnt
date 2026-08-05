import { describe, expect, it } from "vitest"
import { buildPayComparisonRows } from "./pay-comparison"

describe("buildPayComparisonRows", () => {
  it("orders the track ladder highest-first and maps points to rows", () => {
    const { seniorities, data } = buildPayComparisonRows("IC", [
      { seniority: "IC2", amount: 40000, isSelf: false },
      { seniority: "IC5", amount: 90000, isSelf: true },
    ])
    expect(seniorities).toEqual(["IC5", "IC4", "IC3", "IC2", "IC1"])
    expect(data).toEqual([
      { seniority: "IC2", amount: 40000, isSelf: false, row: 3 },
      { seniority: "IC5", amount: 90000, isSelf: true, row: 0 },
    ])
  })

  it("appends off-ladder seniorities below the ladder instead of dropping them", () => {
    const { seniorities, data } = buildPayComparisonRows("M", [
      { seniority: "M1", amount: 50000, isSelf: true },
      { seniority: "Legacy-9", amount: 45000, isSelf: false },
    ])
    expect(seniorities).toEqual(["M3", "M2", "M1", "Legacy-9"])
    expect(data[1]?.row).toBe(3)
  })

  it("treats an unknown track as all off-ladder in encounter order", () => {
    const { seniorities } = buildPayComparisonRows(undefined, [
      { seniority: "B", amount: 1, isSelf: false },
      { seniority: "A", amount: 2, isSelf: true },
    ])
    expect(seniorities).toEqual(["B", "A"])
  })
})
