import { INDUSTRY_KEYS } from "@workspace/constants"
import {
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  MODEL_MAX_CRITERIA,
  MODEL_MIN_CRITERIA,
  PEOPLE_LEADERSHIP_LIBRARY_KEY,
} from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  CRITERIA_LIBRARY_KEYS,
  criteriaLibraryContent,
  LIBRARY_DIMENSION,
  LIBRARY_INDUSTRY_HINTS,
  LIBRARY_OVERLAP_PAIRS,
  REGISTERED_LIBRARY_LOCALES,
} from "./criteriaLibrary"

const PRESENT_LOCALES = ["en", "sv", "nb", "da", "fi"] as const

describe("library structure", () => {
  it("has 21 criteria distributed 5/5/7/4 across the dimensions", () => {
    expect(CRITERIA_LIBRARY_KEYS).toHaveLength(21)
    const counts = {
      competence: 0,
      effort: 0,
      responsibility: 0,
      workingConditions: 0,
    }
    for (const key of CRITERIA_LIBRARY_KEYS) {
      counts[LIBRARY_DIMENSION[key]] += 1
    }
    expect(counts).toEqual({
      competence: 5,
      effort: 5,
      responsibility: 7,
      workingConditions: 4,
    })
  })

  it("keeps overlap pairs unique, non-reflexive, and resolvable", () => {
    const seen = new Set<string>()
    for (const [left, right] of LIBRARY_OVERLAP_PAIRS) {
      expect(CRITERIA_LIBRARY_KEYS).toContain(left)
      expect(CRITERIA_LIBRARY_KEYS).toContain(right)
      expect(left).not.toBe(right)
      const id = [left, right].sort().join("|")
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
  })

  it("covers every industry with resolvable hints inside the model bounds and dimension caps", () => {
    for (const industry of INDUSTRY_KEYS) {
      const hints = LIBRARY_INDUSTRY_HINTS[industry]
      expect(hints.length).toBeGreaterThanOrEqual(MODEL_MIN_CRITERIA)
      expect(hints.length).toBeLessThanOrEqual(MODEL_MAX_CRITERIA)
      const counts: Record<string, number> = {}
      for (const key of hints) {
        expect(CRITERIA_LIBRARY_KEYS).toContain(key)
        const dimension = LIBRARY_DIMENSION[key]
        counts[dimension] = (counts[dimension] ?? 0) + 1
      }
      for (const dimension of DIMENSION_KEYS) {
        expect(counts[dimension] ?? 0).toBeLessThanOrEqual(
          DIMENSION_MAX_ACTIVE[dimension]
        )
      }
    }
  })

  it("pins the engine's people-leadership coupling to responsibility", () => {
    // A rename of the library key fails compilation here before it can ever
    // desync from the engine's own PEOPLE_LEADERSHIP_LIBRARY_KEY constant.
    expect(LIBRARY_DIMENSION[PEOPLE_LEADERSHIP_LIBRARY_KEY]).toBe(
      "responsibility"
    )
  })
})

describe("library content", () => {
  it.each(PRESENT_LOCALES)("locale %s is complete", (locale) => {
    // The en fallback would mask a missing locale, so registration is
    // asserted explicitly: completeness of a fallback is not parity.
    expect(REGISTERED_LIBRARY_LOCALES).toContain(locale)
    const content = criteriaLibraryContent(locale)
    for (const dimension of DIMENSION_KEYS) {
      const entry = content.dimensions[dimension]
      expect(entry.name.length).toBeGreaterThan(0)
      expect(entry.question.length).toBeGreaterThan(0)
      expect(entry.why.length).toBeGreaterThan(0)
    }
    expect(content.workingConditionsTest.question.length).toBeGreaterThan(0)
    expect(
      content.workingConditionsTest.notMaterialLabel.length
    ).toBeGreaterThan(0)
    for (const step of ["1", "2", "3", "4", "5"] as const) {
      expect(content.sharedScale[step].name.length).toBeGreaterThan(0)
      expect(content.sharedScale[step].meaning.length).toBeGreaterThan(0)
    }
    expect(content.midpoints.step2.length).toBeGreaterThan(0)
    expect(content.midpoints.step4.length).toBeGreaterThan(0)
    for (const key of CRITERIA_LIBRARY_KEYS) {
      const entry = content.criteria[key]
      for (const field of [
        "name",
        "shortUiText",
        "fullDefinition",
        "measures",
        "notMeasures",
        "whenSuitable",
        "whenNotSuitable",
        "controlQuestion",
        "assessmentQuestion",
        "anchor1",
        "anchor3",
        "anchor5",
      ] as const) {
        expect(
          entry[field].length,
          `${locale}.${key}.${field}`
        ).toBeGreaterThan(0)
      }
    }
  })

  it("falls back to en for unknown locales", () => {
    expect(criteriaLibraryContent("xx")).toEqual(criteriaLibraryContent("en"))
  })
})
