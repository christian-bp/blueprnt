import { describe, expect, it } from "vitest"
import { PAY_COMPONENT_KINDS, totalMonthlyComp } from "./pay"

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
