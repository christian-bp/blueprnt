import { describe, expect, it } from "vitest"
import { resolveFullTimeHours } from "./fullTimeHours"

describe("resolveFullTimeHours", () => {
  it("prefers the person's own value", () => {
    expect(
      resolveFullTimeHours(
        { fullTimeHoursPerMonth: 150 },
        { fullTimeHoursPerMonth: 160, country: "se" }
      )
    ).toEqual({ hoursPerMonth: 150 })
  })

  it("falls back to the organization's default", () => {
    expect(
      resolveFullTimeHours({}, { fullTimeHoursPerMonth: 160, country: "se" })
    ).toEqual({ hoursPerMonth: 160 })
  })

  it("falls back to the country default, and to 'other' for an unknown country", () => {
    expect(resolveFullTimeHours({}, { country: "se" })).toEqual({
      hoursPerMonth: 165,
    })
    expect(resolveFullTimeHours({}, {})).toEqual({
      hoursPerMonth: 173.33,
    })
  })

  it("treats a non-positive stored value as absent", () => {
    expect(
      resolveFullTimeHours({ fullTimeHoursPerMonth: 0 }, { country: "no" })
    ).toEqual({ hoursPerMonth: 162.5 })
  })
})
