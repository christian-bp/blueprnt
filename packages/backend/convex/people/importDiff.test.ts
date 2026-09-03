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

  it("emits an employmentType change in the person patch", () => {
    const patch = personImportPatch(
      { displayName: "A", gender: "Kvinna" },
      { displayName: "A", gender: "Kvinna", employmentType: "permanent" }
    )
    expect(patch.employmentType).toBe("permanent")
  })
})

describe("sameSalaryValues", () => {
  const base = {
    payYear: 2026,
    basis: "monthly" as const,
    basicAmount: 50000,
    currency: "SEK",
    components: [{ kind: "variable", monthlyAmount: 2000 }],
  }

  it("matches identical values", () => {
    expect(sameSalaryValues(base, { ...base })).toBe(true)
  })

  it("differs on any scalar or component", () => {
    expect(sameSalaryValues(base, { ...base, basicAmount: 50001 })).toBe(false)
    expect(sameSalaryValues(base, { ...base, basis: "hourly" })).toBe(false)
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
    basicAmount: number,
    payYear: number
  ): NormalizedImportRow => ({
    externalRef,
    person: { displayName: `Person ${externalRef}`, gender: "Man" },
    salary: {
      payYear,
      basis: "monthly",
      basicAmount,
      currency: "SEK",
      components: [],
    },
  })

  const baseline = (
    displayName: string,
    latest: { payYear: number; basicAmount: number } | null
  ): BaselinePerson => ({
    stored: { displayName, gender: "Man" },
    latestSalary:
      latest !== null
        ? { ...latest, basis: "monthly", currency: "SEK", components: [] }
        : null,
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
      ["same", baseline("Person same", { payYear: 2026, basicAmount: 50000 })],
      [
        "raise",
        baseline("Person raise", { payYear: 2026, basicAmount: 50000 }),
      ],
      [
        "nextyear",
        baseline("Person nextyear", { payYear: 2025, basicAmount: 48000 }),
      ],
    ])

    const diff = diffImport(rows, byRef)
    expect(diff.people).toEqual({
      created: 1,
      updated: 0,
      unchanged: 4,
      returning: 0,
    })
    // new person + first salary + a new year all append as new entries.
    expect(diff.salary.newEntries).toBe(3)
    expect(diff.salary.identical).toBe(1)
    expect(diff.salary.changedSameYear).toBe(1)
    expect(diff.salary.changedDetails).toEqual([
      {
        externalRef: "raise",
        displayName: "Person raise",
        payYear: 2026,
        from: { basis: "monthly", amount: 50000 },
        to: { basis: "monthly", amount: 52000 },
      },
    ])
  })
})

describe("diffImport leavers and returners", () => {
  const row = (
    externalRef: string,
    displayName: string
  ): NormalizedImportRow => ({
    externalRef,
    person: { displayName, gender: "Kvinna" },
    salary: null,
  })
  const active = (displayName: string): BaselinePerson => ({
    stored: { displayName, gender: "Kvinna" },
    latestSalary: null,
  })
  const archived = (displayName: string): BaselinePerson => ({
    stored: { displayName, gender: "Kvinna" },
    latestSalary: null,
    archivedAt: 1_700_000_000_000,
  })

  it("counts and lists an archived baseline person present in the file as returning", () => {
    const diff = diffImport(
      [row("1", "Anna Svensson")],
      new Map([["1", archived("Anna Svensson")]])
    )
    expect(diff.people).toEqual({
      created: 0,
      updated: 0,
      unchanged: 1,
      returning: 1,
    })
    expect(diff.returningPeople).toEqual([
      { externalRef: "1", displayName: "Anna Svensson" },
    ])
    expect(diff.missingFromFile).toEqual([])
  })

  it("a returning person with changed fields is both returning and updated", () => {
    const diff = diffImport(
      [row("1", "Anna Berg")],
      new Map([["1", archived("Anna Svensson")]])
    )
    expect(diff.people).toEqual({
      created: 0,
      updated: 1,
      unchanged: 0,
      returning: 1,
    })
  })

  it("lists active baseline people absent from the file, in baseline order", () => {
    const diff = diffImport(
      [row("2", "Bo Karlsson")],
      new Map([
        ["1", active("Anna Svensson")],
        ["2", active("Bo Karlsson")],
        ["3", active("Cesar Lind")],
      ])
    )
    expect(diff.people).toEqual({
      created: 0,
      updated: 0,
      unchanged: 1,
      returning: 0,
    })
    expect(diff.missingFromFile).toEqual([
      { externalRef: "1", displayName: "Anna Svensson" },
      { externalRef: "3", displayName: "Cesar Lind" },
    ])
  })

  it("never lists an already-archived person as missing", () => {
    const diff = diffImport(
      [row("2", "Bo Karlsson")],
      new Map([
        ["1", archived("Anna Svensson")],
        ["2", active("Bo Karlsson")],
      ])
    )
    expect(diff.missingFromFile).toEqual([])
    expect(diff.people.returning).toBe(0)
  })

  it("keeps the existing counts when there are no leavers or returners", () => {
    const diff = diffImport(
      [row("1", "Anna Svensson"), row("9", "Ny Person")],
      new Map([["1", active("Anna Svensson")]])
    )
    expect(diff.people).toEqual({
      created: 1,
      updated: 0,
      unchanged: 1,
      returning: 0,
    })
    expect(diff.returningPeople).toEqual([])
    expect(diff.missingFromFile).toEqual([])
  })

  it("never lists a person named only by presentExternalRefs (e.g. a hard-skipped row) as missing", () => {
    const diff = diffImport(
      [row("2", "Bo Karlsson")],
      new Map([
        ["1", active("Anna Svensson")],
        ["2", active("Bo Karlsson")],
      ]),
      ["1"]
    )
    expect(diff.missingFromFile).toEqual([])
  })
})
