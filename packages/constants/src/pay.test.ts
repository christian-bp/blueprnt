import { describe, expect, it } from "vitest"
import {
  BASE_PAY_BASES,
  DEFAULT_BASIS_BY_FIELD,
  PAY_BASIS,
  PAY_COMPONENT_KINDS,
  PAY_PLAUSIBILITY_BY_CURRENCY,
  fteTotalMonthlyComp,
  normalizedMonthlyBase,
  plausibilityFor,
  toMonthly,
  totalMonthlyComp,
} from "./pay"

describe("PAY_COMPONENT_KINDS", () => {
  it("is a non-empty readonly array of strings", () => {
    expect(PAY_COMPONENT_KINDS.length).toBeGreaterThan(0)
    for (const kind of PAY_COMPONENT_KINDS) {
      expect(typeof kind).toBe("string")
    }
  })

  it("includes the canonical component kinds", () => {
    expect(PAY_COMPONENT_KINDS).toContain("variable")
    expect(PAY_COMPONENT_KINDS).toContain("bonus")
    expect(PAY_COMPONENT_KINDS).toContain("benefitInKind")
    expect(PAY_COMPONENT_KINDS).toContain("fixedSupplement")
    expect(PAY_COMPONENT_KINDS).toContain("allowance")
    expect(PAY_COMPONENT_KINDS).toContain("equity")
    expect(PAY_COMPONENT_KINDS).toContain("other")
  })
})

describe("totalMonthlyComp", () => {
  it("returns basicMonthly when there are no components", () => {
    expect(totalMonthlyComp(50_000, [])).toBe(50_000)
  })

  it("adds a single component to basicMonthly", () => {
    expect(totalMonthlyComp(50_000, [{ monthlyAmount: 5_000 }])).toBe(55_000)
  })

  it("sums multiple components and adds to basicMonthly", () => {
    const components = [
      { monthlyAmount: 5_000 },
      { monthlyAmount: 2_000 },
      { monthlyAmount: 1_000 },
    ]
    expect(totalMonthlyComp(40_000, components)).toBe(48_000)
  })

  it("handles zero-valued components", () => {
    expect(totalMonthlyComp(30_000, [{ monthlyAmount: 0 }])).toBe(30_000)
  })
})

describe("fteTotalMonthlyComp", () => {
  it("returns the unadjusted total at 100% FTE", () => {
    expect(fteTotalMonthlyComp(50_000, [], 100, "monthly")).toBe(50_000)
    expect(
      fteTotalMonthlyComp(40_000, [{ monthlyAmount: 8_000 }], 100, "monthly")
    ).toBe(48_000)
  })

  it("grosses up part-time comp to a full-time equivalent at 80% FTE", () => {
    // 40_000 earned on an 80% contract -> full-time equivalent 50_000.
    expect(fteTotalMonthlyComp(40_000, [], 80, "monthly")).toBe(50_000)
  })

  it("treats a zero FTE as 100% (no division by zero)", () => {
    expect(fteTotalMonthlyComp(30_000, [], 0, "monthly")).toBe(30_000)
  })

  it("treats an undefined FTE as 100%", () => {
    expect(fteTotalMonthlyComp(30_000, [], undefined, "monthly")).toBe(30_000)
  })

  it("includes components in the FTE-adjusted total", () => {
    // total 44_000 at 80% -> 55_000.
    expect(
      fteTotalMonthlyComp(40_000, [{ monthlyAmount: 4_000 }], 80, "monthly")
    ).toBe(55_000)
  })
})

describe("toMonthly", () => {
  it("passes a monthly amount through unchanged", () => {
    expect(toMonthly(50000, "monthly")).toBe(50000)
  })
  it("divides an annual amount by 12", () => {
    expect(toMonthly(120000, "annual")).toBe(10000)
  })
})

describe("DEFAULT_BASIS_BY_FIELD", () => {
  it("defaults base salary to monthly and bonus/variable to annual", () => {
    expect(DEFAULT_BASIS_BY_FIELD.basicMonthly).toBe("monthly")
    expect(DEFAULT_BASIS_BY_FIELD.variable).toBe("annual")
    expect(DEFAULT_BASIS_BY_FIELD.bonus).toBe("annual")
    expect(DEFAULT_BASIS_BY_FIELD.benefitInKind).toBe("monthly")
  })
  it("has a basis for basicMonthly and every pay component kind", () => {
    expect(PAY_BASIS).toEqual(["monthly", "annual"])
    for (const kind of PAY_COMPONENT_KINDS) {
      expect(DEFAULT_BASIS_BY_FIELD[kind]).toBeDefined()
    }
  })
})

describe("BASE_PAY_BASES", () => {
  it("is exactly monthly and hourly, in that order", () => {
    expect(BASE_PAY_BASES).toEqual(["monthly", "hourly"])
  })
})

describe("normalizedMonthlyBase", () => {
  it("returns a monthly amount unchanged whatever the hours", () => {
    expect(normalizedMonthlyBase(32000, "monthly", 165)).toBe(32000)
    expect(normalizedMonthlyBase(32000, "monthly", 173.33)).toBe(32000)
  })

  it("multiplies an hourly rate by the full-time hours", () => {
    expect(normalizedMonthlyBase(195, "hourly", 165)).toBe(32175)
    expect(normalizedMonthlyBase(200, "hourly", 162.5)).toBe(32500)
  })

  it("throws on non-positive hours (the resolver guarantees a positive value)", () => {
    expect(() => normalizedMonthlyBase(195, "hourly", 0)).toThrow()
    expect(() => normalizedMonthlyBase(195, "hourly", -1)).toThrow()
  })
})

describe("fteTotalMonthlyComp with a basis", () => {
  it("still grosses a monthly row up by its FTE share", () => {
    expect(fteTotalMonthlyComp(40000, [], 80, "monthly")).toBe(50000)
  })

  it("never divides an hourly row by its FTE share (rate x hours is already full time)", () => {
    expect(fteTotalMonthlyComp(32175, [], 50, "hourly")).toBe(32175)
    expect(
      fteTotalMonthlyComp(32175, [{ monthlyAmount: 1000 }], 50, "hourly")
    ).toBe(33175)
  })
})

describe("plausibilityFor", () => {
  it("returns the krona bounds for SEK, NOK and DKK and the euro bounds for EUR", () => {
    expect(plausibilityFor("SEK")).toEqual({
      hourlyMax: 1500,
      monthlyMin: 3000,
    })
    expect(plausibilityFor("NOK")).toEqual({
      hourlyMax: 1500,
      monthlyMin: 3000,
    })
    expect(plausibilityFor("DKK")).toEqual({
      hourlyMax: 1500,
      monthlyMin: 3000,
    })
    expect(plausibilityFor("EUR")).toEqual({ hourlyMax: 150, monthlyMin: 300 })
  })

  it("returns undefined for a currency it has no bounds for", () => {
    expect(plausibilityFor("USD")).toBeUndefined()
    expect(plausibilityFor("")).toBeUndefined()
  })

  it("covers every CURRENCY_KEYS value", () => {
    expect(Object.keys(PAY_PLAUSIBILITY_BY_CURRENCY).sort()).toEqual([
      "DKK",
      "EUR",
      "NOK",
      "SEK",
    ])
  })
})
