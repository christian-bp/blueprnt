import { describe, expect, it } from "vitest"
import {
  fteBaseMonthly,
  fteTotalMonthly,
  isHourlyRow,
  type PayMappingSnapshotRow,
} from "./pay-mapping-gap-types"

// A minimal priced row, overridden per test. basis/basicAmount/hoursPerMonth
// are left unset by default (the "monthly" row shape, matching a row frozen
// before the hourly basis existed).
function makeRow(
  overrides: Partial<PayMappingSnapshotRow> = {}
): PayMappingSnapshotRow {
  return {
    personPublicId: "p1",
    displayName: "Person 1",
    erased: false,
    gender: "Kvinna",
    roleTitle: "SWE",
    trackKey: "ic",
    seniority: "Senior",
    level: 3,
    basicMonthly: 40000,
    components: [],
    ...overrides,
  }
}

describe("fteTotalMonthly", () => {
  it("returns the plain sum for an hourly row, never dividing by ftePercent", () => {
    // basicMonthly on an hourly row is already the full-time-equivalent
    // monthly figure (rate x full-time hours), so grossing it up again by
    // ftePercent would double-count.
    expect(
      fteTotalMonthly(
        makeRow({ basis: "hourly", basicMonthly: 32175, ftePercent: 50 })
      )
    ).toBe(32175)
  })

  it("still grosses up a monthly row by ftePercent", () => {
    expect(
      fteTotalMonthly(makeRow({ basicMonthly: 20000, ftePercent: 50 }))
    ).toBe(40000)
  })

  it("treats an absent basis as monthly (rows frozen before the hourly basis existed)", () => {
    const withoutBasis = fteTotalMonthly(
      makeRow({ basicMonthly: 20000, ftePercent: 50 })
    )
    const explicitlyMonthly = fteTotalMonthly(
      makeRow({ basis: "monthly", basicMonthly: 20000, ftePercent: 50 })
    )
    expect(withoutBasis).toBe(explicitlyMonthly)
    expect(withoutBasis).toBe(40000)
  })

  it("includes components in the hourly row's plain sum", () => {
    expect(
      fteTotalMonthly(
        makeRow({
          basis: "hourly",
          basicMonthly: 32175,
          components: [{ kind: "bonus", monthlyAmount: 1000 }],
          ftePercent: 50,
        })
      )
    ).toBe(33175)
  })
})

describe("fteBaseMonthly", () => {
  it("returns the plain base figure for an hourly row, never dividing by ftePercent", () => {
    expect(
      fteBaseMonthly(
        makeRow({ basis: "hourly", basicMonthly: 32175, ftePercent: 50 })
      )
    ).toBe(32175)
  })

  it("still grosses up a monthly row's base by ftePercent", () => {
    expect(
      fteBaseMonthly(makeRow({ basicMonthly: 20000, ftePercent: 50 }))
    ).toBe(40000)
  })
})

describe("isHourlyRow", () => {
  it("is true for an hourly row and false for a monthly or absent basis", () => {
    expect(isHourlyRow(makeRow({ basis: "hourly" }))).toBe(true)
    expect(isHourlyRow(makeRow({ basis: "monthly" }))).toBe(false)
    expect(isHourlyRow(makeRow())).toBe(false)
  })
})
