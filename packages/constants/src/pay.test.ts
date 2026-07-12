import { describe, expect, it } from "vitest"
import {
  DEFAULT_BASIS_BY_FIELD,
  PAY_BASIS,
  PAY_COMPONENT_KINDS,
  fteTotalMonthlyComp,
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
    expect(fteTotalMonthlyComp(50_000, [], 100)).toBe(50_000)
    expect(fteTotalMonthlyComp(40_000, [{ monthlyAmount: 8_000 }], 100)).toBe(
      48_000
    )
  })

  it("grosses up part-time comp to a full-time equivalent at 80% FTE", () => {
    // 40_000 earned on an 80% contract -> full-time equivalent 50_000.
    expect(fteTotalMonthlyComp(40_000, [], 80)).toBe(50_000)
  })

  it("treats a zero FTE as 100% (no division by zero)", () => {
    expect(fteTotalMonthlyComp(30_000, [], 0)).toBe(30_000)
  })

  it("treats an undefined FTE as 100%", () => {
    expect(fteTotalMonthlyComp(30_000, [], undefined)).toBe(30_000)
  })

  it("includes components in the FTE-adjusted total", () => {
    // total 44_000 at 80% -> 55_000.
    expect(fteTotalMonthlyComp(40_000, [{ monthlyAmount: 4_000 }], 80)).toBe(
      55_000
    )
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
