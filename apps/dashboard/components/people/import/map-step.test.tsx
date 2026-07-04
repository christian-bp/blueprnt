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
// MapStep — table rendering
// ---------------------------------------------------------------------------
describe("MapStep — table rendering", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders a row for each canonical field", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })

    const fields = m.fields
    // Use getAllByText because some field labels (e.g. "Gender") also appear
    // as the selected value in the Select trigger.
    expect(screen.getAllByText(fields.externalRef).length).toBeGreaterThan(0)
    expect(screen.getAllByText(fields.title).length).toBeGreaterThan(0)
    expect(screen.getAllByText(fields.gender).length).toBeGreaterThan(0)
    expect(screen.getAllByText(fields.basicMonthly).length).toBeGreaterThan(0)
    expect(screen.getAllByText(fields.isManager).length).toBeGreaterThan(0)
    expect(screen.getAllByText(fields.variable).length).toBeGreaterThan(0)
  })

  it("shows tier badges for required, recommended, and optional fields", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })

    const tier = m.tier
    const requiredBadges = screen.getAllByText(tier.required)
    expect(requiredBadges.length).toBeGreaterThanOrEqual(4)
    const recommendedBadges = screen.getAllByText(tier.recommended)
    expect(recommendedBadges.length).toBeGreaterThanOrEqual(1)
    const optionalBadges = screen.getAllByText(tier.optional)
    expect(optionalBadges.length).toBeGreaterThanOrEqual(1)
  })

  it("shows sample values from the first data row for mapped columns", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // First row values for mapped columns.
    expect(screen.getByText("E001")).toBeDefined()
    expect(screen.getByText("Software Engineer")).toBeDefined()
    expect(screen.getByText("Kvinna")).toBeDefined()
    expect(screen.getByText("55000")).toBeDefined()
  })

  it("shows column header names as select options (visible in the trigger)", () => {
    renderMapStep({
      mapping: { externalRef: 0, title: 1, gender: 2, basicMonthly: 3 },
    })
    // The selected column header for externalRef (index 0) should appear in the row.
    const row = screen.getByTestId("map-row-externalRef")
    expect(row.textContent).toContain("EmployeeID")
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
import { updateMapping } from "./map-step"

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
