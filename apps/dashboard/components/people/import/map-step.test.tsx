import { cleanup, render, screen, waitFor } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ParsedCsv } from "./import-wizard"
import {
  MapStep,
  buildInitialMapping,
  seedMappingFromProfile,
  syncBasisMap,
} from "./map-step"

// Default: no saved profile (query resolved, nothing saved).
// Overridden per-test for the profile-seeding test.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => null),
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({
    orgId: "org-test",
    name: "Test Org",
    role: "admin",
  }),
}))

// The real test CSV headers that match the synonym dictionary for the four
// required canonical fields:
//   "EmployeeID"    -> externalRef (synonym: employeeid)
//   "JobTitle"      -> title       (synonym: jobtitle)
//   "Gender"        -> gender      (synonym: gender)
//   "MonthlySalary" -> basicMonthly (synonym: monthlysalary)
const TEST_HEADERS = [
  "EmployeeID",
  "JobTitle",
  "Gender",
  "MonthlySalary",
  "Department",
]
const TEST_ROWS: string[][] = [
  ["E001", "Software Engineer", "Kvinna", "55000", "Engineering"],
  ["E002", "Product Manager", "Man", "70000", "Product"],
]

const PARSED: ParsedCsv = {
  headers: TEST_HEADERS,
  rows: TEST_ROWS,
  headerless: false,
}

const m = messages.dashboard.people.import

function renderMapStep({
  parsed = PARSED,
  mapping = null,
  onMappingChange = vi.fn(),
  basisMap = {},
  onBasisChange = vi.fn(),
}: {
  parsed?: ParsedCsv
  mapping?: Record<string, number> | null
  onMappingChange?: (mapping: Record<string, number>) => void
  basisMap?: Record<string, "monthly" | "annual">
  onBasisChange?: (basisMap: Record<string, "monthly" | "annual">) => void
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MapStep
        parsed={parsed}
        mapping={mapping}
        onMappingChange={onMappingChange}
        basisMap={basisMap}
        onBasisChange={onBasisChange}
      />
    </NextIntlClientProvider>
  )
}

// ---------------------------------------------------------------------------
// buildInitialMapping (pure helper, no render needed)
// ---------------------------------------------------------------------------
describe("buildInitialMapping", () => {
  it("maps externalRef, title, gender, and basicMonthly to the correct column indices", () => {
    const result = buildInitialMapping(PARSED)
    expect(result.externalRef).toBe(0)
    expect(result.title).toBe(1)
    expect(result.gender).toBe(2)
    expect(result.basicMonthly).toBe(3)
  })

  it("only includes detected fields in the result (not every canonical field)", () => {
    // With unrelated headers, only a subset of canonical fields can be detected.
    // The result should not contain fields that were not auto-detected.
    const result = buildInitialMapping({
      headers: ["EmployeeID"],
      rows: [["E001"]],
      headerless: false,
    })
    // "EmployeeID" matches externalRef's synonym "employeeid".
    expect(result.externalRef).toBe(0)
    // Fields with no matching column should not be in the result.
    expect("basicMonthly" in result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// seedMappingFromProfile (pure helper, no render needed)
// ---------------------------------------------------------------------------
describe("seedMappingFromProfile", () => {
  const parsed = {
    headers: ["Anstnr", "Namn", "Befattning", "Lon"],
    rows: [["1", "Alex", "Engineer", "50000"]],
    headerless: false,
  }

  it("maps saved canonical->header onto the current file's column indices", () => {
    const result = seedMappingFromProfile(parsed, {
      externalRef: "Anstnr",
      displayName: "Namn",
      title: "Befattning",
      basicMonthly: "Lon",
    })
    expect(result).toEqual({
      externalRef: 0,
      displayName: 1,
      title: 2,
      basicMonthly: 3,
    })
  })

  it("matches headers case-insensitively and trimmed", () => {
    const result = seedMappingFromProfile(parsed, { title: " befattning " })
    expect(result).toEqual({ title: 2 })
  })

  it("drops saved fields whose header is absent from the current file", () => {
    const result = seedMappingFromProfile(parsed, {
      title: "Befattning",
      country: "Land",
    })
    expect(result).toEqual({ title: 2 })
  })
})

// ---------------------------------------------------------------------------
// syncBasisMap (pure helper, no render needed)
// ---------------------------------------------------------------------------
describe("syncBasisMap", () => {
  it("seeds a basis for each mapped money field and drops non-money fields", () => {
    const headers = ["Årslön", "Bonus", "Anstnr"]
    const mapping = { basicMonthly: 0, bonus: 1, externalRef: 2 }
    const result = syncBasisMap(mapping, headers, {})
    expect(result.basicMonthly).toBe("annual") // "Årslön" annual hint
    expect(result.bonus).toBe("annual") // field default
    expect(result.externalRef).toBeUndefined() // not a money field
  })
  it("preserves an existing user override", () => {
    const headers = ["Bonus"]
    const result = syncBasisMap({ bonus: 0 }, headers, { bonus: "monthly" })
    expect(result.bonus).toBe("monthly")
  })
})

// ---------------------------------------------------------------------------
// MapStep: auto-detection seeding
// ---------------------------------------------------------------------------
describe("MapStep: auto-detection", () => {
  afterEach(() => {
    cleanup()
  })

  it("calls onMappingChange once to seed the mapping on first render when mapping is null", () => {
    const onMappingChange = vi.fn()
    renderMapStep({ mapping: null, onMappingChange })

    expect(onMappingChange).toHaveBeenCalledOnce()
    const seeded = onMappingChange.mock.calls[0]?.[0] as Record<string, number>
    expect(seeded.externalRef).toBe(0)
    expect(seeded.title).toBe(1)
    expect(seeded.gender).toBe(2)
    expect(seeded.basicMonthly).toBe(3)
  })

  it("does not re-seed when mapping is already set (persists across navigation)", () => {
    const onMappingChange = vi.fn()
    const existingMapping = {
      externalRef: 0,
      title: 1,
      gender: 2,
      basicMonthly: 3,
    }
    renderMapStep({ mapping: existingMapping, onMappingChange })

    expect(onMappingChange).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// MapStep: profile-seeding render test
// ---------------------------------------------------------------------------
describe("MapStep: profile seeding", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("pre-seeds the mapping from the org's saved profile", async () => {
    // Override useQuery for this test to return a saved profile.
    const { useQuery } = await import("convex/react")
    vi.mocked(useQuery).mockReturnValue({
      profileId: "prof_1" as unknown as never,
      columnMap: { title: "Befattning" },
      parseRules: null,
      updatedAt: 1,
    } as unknown as never)

    const onMappingChange = vi.fn()
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <MapStep
          parsed={{
            headers: ["Anstnr", "Befattning"],
            rows: [["1", "Engineer"]],
            headerless: false,
          }}
          mapping={null}
          onMappingChange={onMappingChange}
          basisMap={{}}
          onBasisChange={vi.fn()}
        />
      </NextIntlClientProvider>
    )

    // The effect seeds via onMappingChange once the profile query resolves.
    await waitFor(() =>
      expect(onMappingChange).toHaveBeenCalledWith(
        expect.objectContaining({ title: 1 })
      )
    )
  })
})

// ---------------------------------------------------------------------------
// MapStep: column-first rendering
// ---------------------------------------------------------------------------
describe("MapStep: column-first rendering", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders one row per CSV column, identified by column index", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // TEST_HEADERS has 5 entries: indices 0-4.
    for (let i = 0; i < TEST_HEADERS.length; i++) {
      expect(screen.getByTestId(`map-column-${i}`)).toBeDefined()
    }
  })

  it("shows sample values from the first data rows", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // EmployeeID is column 0; Gender is column 2; MonthlySalary is column 3.
    const externalRefRow = screen.getByTestId("map-column-0")
    expect(externalRefRow.textContent).toContain("E001")
    const genderRow = screen.getByTestId("map-column-2")
    expect(genderRow.textContent).toContain("Kvinna")
    const salaryRow = screen.getByTestId("map-column-3")
    expect(salaryRow.textContent).toContain("55000")
  })

  it("shows the CSV header text in the corresponding column row", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // Column 0 is "EmployeeID"; column 4 is "Department".
    const col0Row = screen.getByTestId("map-column-0")
    expect(col0Row.textContent).toContain("EmployeeID")
    const col4Row = screen.getByTestId("map-column-4")
    expect(col4Row.textContent).toContain("Department")
  })

  it("shows the detected canonical field label for auto-mapped columns", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // Column 0 (EmployeeID) is mapped to externalRef; its label appears in the row.
    const row = screen.getByTestId("map-column-0")
    expect(row.textContent).toContain(m.fields.externalRef)
  })

  it("shows the Select trigger for each column", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // Each column row exposes a trigger with the index-based testid.
    for (let i = 0; i < TEST_HEADERS.length; i++) {
      expect(screen.getByTestId(`map-column-${i}-trigger`)).toBeDefined()
    }
  })

  it("shows Ignore option label in each select", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // The map.ignore key should appear somewhere in the rendered output.
    // (Rendered inside each Select's content but visible in DOM via jsdom)
    expect(screen.getAllByText(m.map.ignore).length).toBeGreaterThan(0)
  })

  it("assignColumnToField correctly re-assigns column 4 to department (pure helper)", () => {
    // Verify the pure mapping helper used by handleColumnFieldChange.
    const prev = { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 }
    const next = assignColumnToField(prev, 4, "department")
    expect(next.department).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// MapStep: unmapped required count
// ---------------------------------------------------------------------------
describe("MapStep: unmapped required count", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows no warning when all required fields are mapped", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    expect(screen.queryByTestId("unmapped-required-warning")).toBeNull()
  })

  it("shows the warning with count 1 when one required field is not mapped", () => {
    // Leave basicMonthly out of the mapping.
    renderMapStep({ mapping: { externalRef: 0, title: 1, gender: 2 } })
    const warning = screen.getByTestId("unmapped-required-warning")
    expect(warning.textContent).toContain("1")
  })

  it("shows the warning with count 3 when three required fields are unmapped", () => {
    renderMapStep({ mapping: { externalRef: 0 } })
    const warning = screen.getByTestId("unmapped-required-warning")
    expect(warning.textContent).toContain("3")
  })

  it("shows the warning with count 4 when mapping is empty", () => {
    renderMapStep({ mapping: {} })
    const warning = screen.getByTestId("unmapped-required-warning")
    expect(warning.textContent).toContain("4")
  })
})

// ---------------------------------------------------------------------------
// MapStep: Select interaction (controlled state, pure helpers)
// We use the exported helpers to verify mapping logic without jsdom pointer events.
// ---------------------------------------------------------------------------
import { assignColumnToField, columnToField, updateMapping } from "./map-step"

describe("updateMapping", () => {
  it("sets the canonical field to the new column index", () => {
    const prev = { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 }
    const next = updateMapping(prev, "externalRef", 4)
    expect(next.externalRef).toBe(4)
    // Other entries unchanged.
    expect(next.title).toBe(1)
  })

  it("removes the field when mapped to UNMAPPED_VALUE (-1)", () => {
    const prev = { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 }
    const next = updateMapping(prev, "externalRef", -1)
    expect("externalRef" in next).toBe(false)
    expect(next.title).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// columnToField
// ---------------------------------------------------------------------------
describe("columnToField", () => {
  it("returns the field key pointing at the given column index", () => {
    const mapping = { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 }
    expect(columnToField(mapping, 0)).toBe("externalRef")
    expect(columnToField(mapping, 1)).toBe("title")
    expect(columnToField(mapping, 2)).toBe("gender")
    expect(columnToField(mapping, 3)).toBe("basicMonthly")
  })

  it("returns null when no field points at the given column index", () => {
    const mapping = { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 }
    expect(columnToField(mapping, 4)).toBeNull()
    expect(columnToField(mapping, 99)).toBeNull()
  })

  it("returns null for an empty mapping", () => {
    expect(columnToField({}, 0)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// assignColumnToField
// ---------------------------------------------------------------------------
describe("assignColumnToField", () => {
  it("assigns a column to a field", () => {
    const prev = { externalRef: 0, title: 1 }
    const next = assignColumnToField(prev, 2, "gender")
    expect(next.gender).toBe(2)
    expect(next.externalRef).toBe(0)
    expect(next.title).toBe(1)
  })

  it("frees the old field when reassigning a column (last-wins collision on field)", () => {
    // col 0 is externalRef; reassign col 0 to title -> externalRef freed
    const prev = { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 }
    const next = assignColumnToField(prev, 0, "title")
    expect(next.title).toBe(0)
    expect("externalRef" in next).toBe(false)
    // original title col 1 is freed (col 1 is no longer held by title)
    expect(Object.values(next)).not.toContain(1)
  })

  it("frees the previous field mapping for this column when assigning to a new field", () => {
    // col 4 is unassigned; col 3 is basicMonthly
    // assign col 3 to variable -> basicMonthly freed
    const prev = { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 }
    const next = assignColumnToField(prev, 3, "variable")
    expect(next.variable).toBe(3)
    expect("basicMonthly" in next).toBe(false)
  })

  it("ignores the column (removes it from mapping) when fieldKey is null", () => {
    const prev = { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 }
    const next = assignColumnToField(prev, 0, null)
    expect("externalRef" in next).toBe(false)
    // Other entries unchanged.
    expect(next.title).toBe(1)
  })

  it("handles assigning an already-ignored column to a field", () => {
    const prev = { title: 1, gender: 2, basicMonthly: 3 }
    // col 0 is not in mapping; assign to externalRef
    const next = assignColumnToField(prev, 0, "externalRef")
    expect(next.externalRef).toBe(0)
    expect(next.title).toBe(1)
  })
})

describe("headerless files (HL)", () => {
  afterEach(() => {
    cleanup()
  })

  // A headerless file as tokenizeCsv emits it: synthesized column names,
  // every row kept as data.
  const HEADERLESS_PARSED: ParsedCsv = {
    headers: ["column_1", "column_2", "column_3", "column_4", "column_5"],
    rows: [
      ["1001", "Anna Svensson", "Kvinna", "2020-01-15", "100"],
      ["1002", "Erik Johansson", "Man", "2018-03-01", "80"],
    ],
    headerless: true,
  }

  it("seeds content-only suggestions from the column shapes", () => {
    const mapping = buildInitialMapping(HEADERLESS_PARSED)
    expect(mapping.gender).toBe(2)
    expect(mapping.employmentStartDate).toBe(3)
    expect(mapping.ftePercent).toBe(4)
    expect(mapping.externalRef).toBe(0)
    // The name column is text: no shape signal, left for the user.
    expect(mapping.displayName).toBeUndefined()
  })

  it("shows the headerless notice and numbered column labels", () => {
    renderMapStep({ parsed: HEADERLESS_PARSED })
    expect(screen.getByTestId("headerless-notice").textContent).toBe(
      m.map.headerlessNotice
    )
    // The synthesized technical names never render; the localized positional
    // label does.
    expect(screen.queryByText("column_1")).toBeNull()
    expect(screen.getByText("Column 1")).toBeDefined()
    expect(screen.getByText("Column 5")).toBeDefined()
  })

  it("keeps real header names and no notice for headered files", () => {
    renderMapStep()
    expect(screen.queryByTestId("headerless-notice")).toBeNull()
    expect(screen.getByText("EmployeeID")).toBeDefined()
  })
})
