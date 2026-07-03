import { describe, expect, it } from "vitest"
import { CANONICAL_FIELDS, fold } from "./fields.js"

describe("fold", () => {
  it("lowercases, strips accents, strips non-alphanumerics", () => {
    expect(fold("Sysselssättningsgrad")).toBe("sysselssattningsgrad")
    expect(fold("Kön")).toBe("kon")
  })

  it("handles plain ASCII unchanged", () => {
    expect(fold("employeeId")).toBe("employeeid")
  })

  it("strips spaces and hyphens", () => {
    expect(fold("first name")).toBe("firstname")
    expect(fold("last-name")).toBe("lastname")
  })
})

describe("CANONICAL_FIELDS", () => {
  it("has exactly four required fields", () => {
    const required = CANONICAL_FIELDS.filter((f) => f.tier === "required").map(
      (f) => f.key
    )
    expect(required.sort()).toEqual(
      ["basicMonthly", "externalRef", "gender", "title"].sort()
    )
  })

  it("has unique keys", () => {
    const keys = CANONICAL_FIELDS.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("every field has at least one synonym", () => {
    for (const field of CANONICAL_FIELDS) {
      expect(
        field.synonyms.length,
        `${field.key} has no synonyms`
      ).toBeGreaterThan(0)
    }
  })

  it("synonyms are already folded (lowercased, accent-stripped, alphanum only)", () => {
    const nonAlphanum = /[^a-z0-9]/
    for (const field of CANONICAL_FIELDS) {
      for (const syn of field.synonyms) {
        expect(
          nonAlphanum.test(syn),
          `synonym "${syn}" on ${field.key} is not folded`
        ).toBe(false)
        expect(syn, `synonym "${syn}" on ${field.key} is not lowercase`).toBe(
          syn.toLowerCase()
        )
      }
    }
  })

  it("synonym lists contain expected candidates", () => {
    const byKey = Object.fromEntries(
      CANONICAL_FIELDS.map((f) => [f.key, f.synonyms])
    )
    expect(byKey.externalRef).toContain("anstnr")
    expect(byKey.externalRef).toContain("employeeid")
    expect(byKey.gender).toContain("kon")
    expect(byKey.gender).toContain("sukupuoli")
    expect(byKey.basicMonthly).toContain("manadslon")
    expect(byKey.basicMonthly).toContain("monthlysalary")
    expect(byKey.title).toContain("befattning")
    expect(byKey.ftePercent).toContain("sysselsattningsgrad")
    expect(byKey.ftePercent).toContain("sysselssattningsgrad")
  })
})
