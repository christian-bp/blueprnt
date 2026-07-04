import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ParsedCsv } from "./import-wizard"
import { MapStep, buildInitialMapping } from "./map-step"

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

const PARSED: ParsedCsv = { headers: TEST_HEADERS, rows: TEST_ROWS }

const m = messages.dashboard.people.import

function renderMapStep({
  parsed = PARSED,
  mapping = null,
  onMappingChange = vi.fn(),
}: {
  parsed?: ParsedCsv
  mapping?: Record<string, number> | null
  onMappingChange?: (mapping: Record<string, number>) => void
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MapStep
        parsed={parsed}
        mapping={mapping}
        onMappingChange={onMappingChange}
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
    })
    // "EmployeeID" matches externalRef's synonym "employeeid".
    expect(result.externalRef).toBe(0)
    // Fields with no matching column should not be in the result.
    expect("basicMonthly" in result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// MapStep — auto-detection seeding
// ---------------------------------------------------------------------------
describe("MapStep — auto-detection", () => {
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
// MapStep — column-first rendering
// ---------------------------------------------------------------------------
describe("MapStep — column-first rendering", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders a row for each CSV column header", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // Each CSV column header should appear as a row header in the table.
    for (const header of TEST_HEADERS) {
      expect(screen.getByTestId(`map-col-${header}`)).toBeDefined()
    }
  })

  it("shows sample values from the first data rows", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // Sample values are joined across multiple rows per column.
    // EmployeeID column shows both row samples.
    const externalRefRow = screen.getByTestId("map-col-EmployeeID")
    expect(externalRefRow.textContent).toContain("E001")
    const genderRow = screen.getByTestId("map-col-Gender")
    expect(genderRow.textContent).toContain("Kvinna")
    const salaryRow = screen.getByTestId("map-col-MonthlySalary")
    expect(salaryRow.textContent).toContain("55000")
  })

  it("shows the detected canonical field label for auto-mapped columns", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // The row for EmployeeID (col 0) should reference the externalRef field label.
    const row = screen.getByTestId("map-col-EmployeeID")
    expect(row.textContent).toContain(m.fields.externalRef)
  })

  it("shows Ignore option label in each select", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // The map.ignore key should appear somewhere in the rendered output.
    // (Rendered inside each Select's content but visible in DOM via jsdom)
    expect(screen.getAllByText(m.map.ignore).length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// MapStep — unmapped required count
// ---------------------------------------------------------------------------
describe("MapStep — unmapped required count", () => {
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
// MapStep — Select interaction (controlled state)
// MapStep exposes onColumnChange on each row's data-testid for testability.
// We use the exported updateMapping helper to verify pure mapping logic.
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
