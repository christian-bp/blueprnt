import { isValidLevelForTrack } from "@workspace/constants"
import { describe, expect, it } from "vitest"
import { type LevelInput, suggestLevelForPerson } from "./levelSuggester"

// Fixed reference date: 2026-07-04 as epoch ms (UTC).
const TODAY = Date.parse("2026-07-04T00:00:00Z")

const input = (
  extra: Partial<LevelInput> & Pick<LevelInput, "trackKey">
): LevelInput => ({
  today: TODAY,
  ...extra,
})

describe("suggestLevelForPerson", () => {
  it("maps a junior keyword to the low IC level (IC1)", () => {
    const out = suggestLevelForPerson(
      input({ trackKey: "IC", title: "Junior Developer" })
    )
    expect(out.suggestedLevel).toBe("IC1")
  })

  it("maps a senior keyword to the high IC level (IC5)", () => {
    const out = suggestLevelForPerson(
      input({ trackKey: "IC", title: "Senior Developer" })
    )
    expect(out.suggestedLevel).toBe("IC5")
  })

  it("defaults to the mid level when no keyword and no tenure", () => {
    const out = suggestLevelForPerson(input({ trackKey: "IC" }))
    expect(out.suggestedLevel).toBe("IC3")
  })

  it("uses the tenure band alone when there is no keyword (short tenure -> low)", () => {
    // Started 2025-07-04, i.e. 1 year before TODAY -> < 2 years -> low.
    const out = suggestLevelForPerson(
      input({ trackKey: "IC", employmentStartDate: "2025-07-04" })
    )
    expect(out.suggestedLevel).toBe("IC1")
  })

  it("uses the tenure band alone (long tenure -> high)", () => {
    // Started 2018-01-01 -> > 5 years -> high.
    const out = suggestLevelForPerson(
      input({ trackKey: "IC", employmentStartDate: "2018-01-01" })
    )
    expect(out.suggestedLevel).toBe("IC5")
  })

  it("takes the lower band when keyword and tenure disagree", () => {
    // Senior (high) keyword + 1-year tenure (low) -> conservative -> low -> IC1.
    const out = suggestLevelForPerson(
      input({
        trackKey: "IC",
        title: "Senior Developer",
        employmentStartDate: "2025-07-04",
      })
    )
    expect(out.suggestedLevel).toBe("IC1")
  })

  it("uses the band when keyword and tenure agree", () => {
    // Senior (high) + 6-year tenure (high) -> high -> IC5.
    const out = suggestLevelForPerson(
      input({
        trackKey: "IC",
        title: "Senior Engineer",
        employmentStartDate: "2020-01-01",
      })
    )
    expect(out.suggestedLevel).toBe("IC5")
  })

  it("maps bands into the Lead ladder", () => {
    expect(
      suggestLevelForPerson(input({ trackKey: "Lead", title: "Junior" }))
        .suggestedLevel
    ).toBe("Lead-1")
    expect(
      suggestLevelForPerson(input({ trackKey: "Lead" })).suggestedLevel
    ).toBe("Lead-2")
    expect(
      suggestLevelForPerson(input({ trackKey: "Lead", title: "Senior" }))
        .suggestedLevel
    ).toBe("Lead-3")
  })

  it("maps bands into the M ladder", () => {
    expect(
      suggestLevelForPerson(input({ trackKey: "M", title: "Associate" }))
        .suggestedLevel
    ).toBe("M1")
    expect(suggestLevelForPerson(input({ trackKey: "M" })).suggestedLevel).toBe(
      "M2"
    )
    expect(
      suggestLevelForPerson(input({ trackKey: "M", title: "Principal" }))
        .suggestedLevel
    ).toBe("M3")
  })

  it("always returns a level valid for the track", () => {
    for (const trackKey of ["IC", "Lead", "M"] as const) {
      for (const title of ["Junior", "Senior", "Chef", "Manager", undefined]) {
        const out = suggestLevelForPerson(input({ trackKey, title }))
        expect(isValidLevelForTrack(trackKey, out.suggestedLevel)).toBe(true)
      }
    }
  })

  it("is deterministic for the same fixed today", () => {
    const args = input({
      trackKey: "IC",
      title: "Senior",
      employmentStartDate: "2019-01-01",
    })
    expect(suggestLevelForPerson(args)).toEqual(suggestLevelForPerson(args))
  })
})
