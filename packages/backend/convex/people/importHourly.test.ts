import { describe, expect, it } from "vitest"
import { plausibilityNotice, resolveRowBasis } from "./importHourly"

describe("resolveRowBasis", () => {
  it("rule 1: an hourly-rate cell alone wins as hourly, no notice", () => {
    const result = resolveRowBasis({
      parsedBase: null,
      parsedHourly: 190,
      employmentType: "permanent",
      interpretHourly: true,
      baseColumnBasis: "monthly",
    })
    expect(result).toEqual({
      basis: "hourly",
      basicAmount: 190,
      interpreted: false,
      notice: null,
    })
  })

  it("rule 1: both cells present on a permanent row, the base pay wins as monthly with bothBasesPresent", () => {
    const result = resolveRowBasis({
      parsedBase: 30000,
      parsedHourly: 180,
      employmentType: "permanent",
      interpretHourly: true,
      baseColumnBasis: "monthly",
    })
    expect(result).toEqual({
      basis: "monthly",
      basicAmount: 30000,
      interpreted: false,
      notice: "bothBasesPresent",
    })
  })

  it("rule 1: both cells present on an hourly-typed row, the hourly rate still wins but carries bothBasesPresent", () => {
    const result = resolveRowBasis({
      parsedBase: 30000,
      parsedHourly: 180,
      employmentType: "hourly",
      interpretHourly: true,
      baseColumnBasis: "monthly",
    })
    expect(result).toEqual({
      basis: "hourly",
      basicAmount: 180,
      interpreted: false,
      notice: "bothBasesPresent",
    })
  })

  it("rule 1: an annual base column is normalized to monthly when it wins over the hourly cell", () => {
    const result = resolveRowBasis({
      parsedBase: 360000,
      parsedHourly: 180,
      employmentType: "permanent",
      interpretHourly: true,
      baseColumnBasis: "annual",
    })
    expect(result).toEqual({
      basis: "monthly",
      basicAmount: 30000,
      interpreted: false,
      notice: "bothBasesPresent",
    })
  })

  it("rule 2: a base-pay cell on an hourly-typed row is read as an hourly rate when interpreted", () => {
    const result = resolveRowBasis({
      parsedBase: 195,
      parsedHourly: null,
      employmentType: "hourly",
      interpretHourly: true,
      baseColumnBasis: "monthly",
    })
    expect(result).toEqual({
      basis: "hourly",
      basicAmount: 195,
      interpreted: true,
      notice: null,
    })
  })

  it("rule 2: the base column's annual/monthly basis is ignored on an hourly-typed row (an hourly rate has no annual form)", () => {
    const result = resolveRowBasis({
      parsedBase: 195,
      parsedHourly: null,
      employmentType: "hourly",
      interpretHourly: true,
      baseColumnBasis: "annual",
    })
    expect(result).toEqual({
      basis: "hourly",
      basicAmount: 195,
      interpreted: true,
      notice: null,
    })
  })

  it("interpretHourly: false turns rule 2 into rule 3 for an hourly-typed row", () => {
    const result = resolveRowBasis({
      parsedBase: 195,
      parsedHourly: null,
      employmentType: "hourly",
      interpretHourly: false,
      baseColumnBasis: "monthly",
    })
    expect(result).toEqual({
      basis: "monthly",
      basicAmount: 195,
      interpreted: false,
      notice: null,
    })
  })

  it("rule 3: a base-pay cell on a non-hourly-typed row is a monthly figure via its column basis", () => {
    const result = resolveRowBasis({
      parsedBase: 40000,
      parsedHourly: null,
      employmentType: "permanent",
      interpretHourly: true,
      baseColumnBasis: "monthly",
    })
    expect(result).toEqual({
      basis: "monthly",
      basicAmount: 40000,
      interpreted: false,
      notice: null,
    })
  })

  it("rule 3: an annual base-pay column is divided by 12", () => {
    const result = resolveRowBasis({
      parsedBase: 480000,
      parsedHourly: null,
      employmentType: "permanent",
      interpretHourly: true,
      baseColumnBasis: "annual",
    })
    expect(result).toEqual({
      basis: "monthly",
      basicAmount: 40000,
      interpreted: false,
      notice: null,
    })
  })

  it("rule 3: an untyped row (no employmentType) also resolves via the base-pay column", () => {
    const result = resolveRowBasis({
      parsedBase: 40000,
      parsedHourly: null,
      employmentType: undefined,
      interpretHourly: true,
      baseColumnBasis: "monthly",
    })
    expect(result).toEqual({
      basis: "monthly",
      basicAmount: 40000,
      interpreted: false,
      notice: null,
    })
  })

  it("rule 4: no base pay at all resolves to null", () => {
    const result = resolveRowBasis({
      parsedBase: null,
      parsedHourly: null,
      employmentType: "hourly",
      interpretHourly: true,
      baseColumnBasis: "monthly",
    })
    expect(result).toBeNull()
  })
})

describe("plausibilityNotice", () => {
  const bounds = { hourlyMax: 1500, monthlyMin: 3000 }

  it("undefined bounds never raises a notice", () => {
    expect(
      plausibilityNotice(
        { basis: "hourly", basicAmount: 999_999 },
        "hourly",
        undefined
      )
    ).toBeNull()
  })

  it("hourly: at the bound (1500) is not flagged", () => {
    expect(
      plausibilityNotice(
        { basis: "hourly", basicAmount: 1500 },
        "hourly",
        bounds
      )
    ).toBeNull()
  })

  it("hourly: one past the bound (1501) is flagged as hourlyLooksMonthly", () => {
    expect(
      plausibilityNotice(
        { basis: "hourly", basicAmount: 1501 },
        "hourly",
        bounds
      )
    ).toBe("hourlyLooksMonthly")
  })

  it("monthly, hourly-typed: just under the bound (2999) is flagged as monthlyLooksHourly", () => {
    expect(
      plausibilityNotice(
        { basis: "monthly", basicAmount: 2999 },
        "hourly",
        bounds
      )
    ).toBe("monthlyLooksHourly")
  })

  it("monthly, permanent: the same low figure (2999) is not suspicious (a part-time salary)", () => {
    expect(
      plausibilityNotice(
        { basis: "monthly", basicAmount: 2999 },
        "permanent",
        bounds
      )
    ).toBeNull()
  })

  it("monthly, untyped: a low figure is still suspicious", () => {
    expect(
      plausibilityNotice(
        { basis: "monthly", basicAmount: 2999 },
        undefined,
        bounds
      )
    ).toBe("monthlyLooksHourly")
  })

  it("monthly, hourly-typed: at the bound (3000) is not flagged", () => {
    expect(
      plausibilityNotice(
        { basis: "monthly", basicAmount: 3000 },
        "hourly",
        bounds
      )
    ).toBeNull()
  })
})
