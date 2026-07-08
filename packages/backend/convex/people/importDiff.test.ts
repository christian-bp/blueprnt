import { describe, expect, it } from "vitest"
import {
  type BaselinePerson,
  diffImport,
  type NormalizedImportRow,
  personImportPatch,
  sameSalaryValues,
} from "./importDiff"

describe("personImportPatch", () => {
  const stored = {
    displayName: "Anna Svensson",
    gender: "Kvinna" as const,
    department: "Ekonomi",
    title: "Controller",
  }

  it("patches only fields that are present AND different", () => {
    const patch = personImportPatch(stored, {
      displayName: "Anna Svensson",
      gender: "Kvinna",
      department: "HR",
    })
    expect(patch).toEqual({ department: "HR" })
  })

  it("never clears a stored field the file does not carry", () => {
    // No department/title in the incoming row (narrower file).
    const patch = personImportPatch(stored, {
      displayName: "Anna Svensson",
      gender: "Kvinna",
    })
    expect(patch).toEqual({})
  })

  it("always diffs the required fields (name, gender)", () => {
    const patch = personImportPatch(stored, {
      displayName: "Anna Berg",
      gender: "Kvinna",
    })
    expect(patch).toEqual({ displayName: "Anna Berg" })
  })
})

describe("sameSalaryValues", () => {
  const base = {
    payYear: 2026,
    basicMonthly: 50000,
    currency: "SEK",
    components: [{ kind: "variable", monthlyAmount: 2000 }],
  }

  it("matches identical values", () => {
    expect(sameSalaryValues(base, { ...base })).toBe(true)
  })

  it("differs on any scalar or component", () => {
    expect(sameSalaryValues(base, { ...base, basicMonthly: 50001 })).toBe(false)
    expect(sameSalaryValues(base, { ...base, payYear: 2025 })).toBe(false)
    expect(sameSalaryValues(base, { ...base, components: [] })).toBe(false)
    expect(
      sameSalaryValues(base, {
        ...base,
        components: [{ kind: "variable", monthlyAmount: 2001 }],
      })
    ).toBe(false)
  })
})

describe("diffImport salary categories", () => {
  const row = (
    externalRef: string,
    basicMonthly: number,
    payYear: number
  ): NormalizedImportRow => ({
    externalRef,
    person: { displayName: `Person ${externalRef}`, gender: "Man" },
    salary: { payYear, basicMonthly, currency: "SEK", components: [] },
  })

  const baseline = (
    displayName: string,
    latest: { payYear: number; basicMonthly: number } | null
  ): BaselinePerson => ({
    stored: { displayName, gender: "Man" },
    latestSalary:
      latest !== null ? { ...latest, currency: "SEK", components: [] } : null,
  })

  it("categorizes new person, first salary, identical, same-year change, and new year", () => {
    const rows = [
      row("new", 45000, 2026),
      row("first", 40000, 2026),
      row("same", 50000, 2026),
      row("raise", 52000, 2026),
      row("nextyear", 51000, 2026),
    ]
    const byRef = new Map<string, BaselinePerson>([
      ["first", baseline("Person first", null)],
      ["same", baseline("Person same", { payYear: 2026, basicMonthly: 50000 })],
      [
        "raise",
        baseline("Person raise", { payYear: 2026, basicMonthly: 50000 }),
      ],
      [
        "nextyear",
        baseline("Person nextyear", { payYear: 2025, basicMonthly: 48000 }),
      ],
    ])

    const diff = diffImport(rows, byRef)
    expect(diff.people).toEqual({ created: 1, updated: 0, unchanged: 4 })
    // new person + first salary + a new year all append as new entries.
    expect(diff.salary.newEntries).toBe(3)
    expect(diff.salary.identical).toBe(1)
    expect(diff.salary.changedSameYear).toBe(1)
    expect(diff.salary.changedDetails).toEqual([
      {
        externalRef: "raise",
        displayName: "Person raise",
        payYear: 2026,
        from: 50000,
        to: 52000,
      },
    ])
  })
})
