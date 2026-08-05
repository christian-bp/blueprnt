import { isValidSeniorityForTrack } from "@workspace/constants"
import { describe, expect, it } from "vitest"
import {
  type SeniorityInput,
  suggestSeniorityForPerson,
} from "./senioritySuggester"

// Fixed reference date: 2026-07-04 as epoch ms (UTC).
const TODAY = Date.parse("2026-07-04T00:00:00Z")

const input = (
  extra: Partial<SeniorityInput> & Pick<SeniorityInput, "trackKey">
): SeniorityInput => ({
  today: TODAY,
  ...extra,
})

describe("suggestSeniorityForPerson", () => {
  it("maps a junior keyword to the low IC seniority (IC1)", () => {
    const out = suggestSeniorityForPerson(
      input({ trackKey: "IC", title: "Junior Developer" })
    )
    expect(out.suggestedSeniority).toBe("IC1")
  })

  it("maps a senior keyword to the high IC seniority (IC5)", () => {
    const out = suggestSeniorityForPerson(
      input({ trackKey: "IC", title: "Senior Developer" })
    )
    expect(out.suggestedSeniority).toBe("IC5")
  })

  it("defaults to the mid seniority when no keyword and no tenure", () => {
    const out = suggestSeniorityForPerson(input({ trackKey: "IC" }))
    expect(out.suggestedSeniority).toBe("IC3")
  })

  it("uses the tenure tier alone when there is no keyword (short tenure -> low)", () => {
    // Started 2025-07-04, i.e. 1 year before TODAY -> < 2 years -> low.
    const out = suggestSeniorityForPerson(
      input({ trackKey: "IC", employmentStartDate: "2025-07-04" })
    )
    expect(out.suggestedSeniority).toBe("IC1")
  })

  it("uses the tenure tier alone (long tenure -> high)", () => {
    // Started 2018-01-01 -> > 5 years -> high.
    const out = suggestSeniorityForPerson(
      input({ trackKey: "IC", employmentStartDate: "2018-01-01" })
    )
    expect(out.suggestedSeniority).toBe("IC5")
  })

  it("takes the lower tier when keyword and tenure disagree", () => {
    // Senior (high) keyword + 1-year tenure (low) -> conservative -> low -> IC1.
    const out = suggestSeniorityForPerson(
      input({
        trackKey: "IC",
        title: "Senior Developer",
        employmentStartDate: "2025-07-04",
      })
    )
    expect(out.suggestedSeniority).toBe("IC1")
  })

  it("uses the tier when keyword and tenure agree", () => {
    // Senior (high) + 6-year tenure (high) -> high -> IC5.
    const out = suggestSeniorityForPerson(
      input({
        trackKey: "IC",
        title: "Senior Engineer",
        employmentStartDate: "2020-01-01",
      })
    )
    expect(out.suggestedSeniority).toBe("IC5")
  })

  it("maps tiers into the Lead ladder", () => {
    expect(
      suggestSeniorityForPerson(input({ trackKey: "Lead", title: "Junior" }))
        .suggestedSeniority
    ).toBe("Lead-1")
    expect(
      suggestSeniorityForPerson(input({ trackKey: "Lead" })).suggestedSeniority
    ).toBe("Lead-2")
    expect(
      suggestSeniorityForPerson(input({ trackKey: "Lead", title: "Senior" }))
        .suggestedSeniority
    ).toBe("Lead-3")
  })

  it("maps tiers into the M ladder", () => {
    expect(
      suggestSeniorityForPerson(input({ trackKey: "M", title: "Associate" }))
        .suggestedSeniority
    ).toBe("M1")
    expect(
      suggestSeniorityForPerson(input({ trackKey: "M" })).suggestedSeniority
    ).toBe("M2")
    expect(
      suggestSeniorityForPerson(input({ trackKey: "M", title: "Principal" }))
        .suggestedSeniority
    ).toBe("M3")
  })

  it("always returns a seniority valid for the track", () => {
    for (const trackKey of ["IC", "Lead", "M"] as const) {
      for (const title of ["Junior", "Senior", "Chef", "Manager", undefined]) {
        const out = suggestSeniorityForPerson(input({ trackKey, title }))
        expect(isValidSeniorityForTrack(trackKey, out.suggestedSeniority)).toBe(
          true
        )
      }
    }
  })

  it("is deterministic for the same fixed today", () => {
    const args = input({
      trackKey: "IC",
      title: "Senior",
      employmentStartDate: "2019-01-01",
    })
    expect(suggestSeniorityForPerson(args)).toEqual(
      suggestSeniorityForPerson(args)
    )
  })
})
