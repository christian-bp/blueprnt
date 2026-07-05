import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ParsedCsv } from "./import-wizard"
import { CheckStep } from "./check-step"

// Mock motion/react to keep tests free of animation complexity. Components
// are cached per tag: a fresh function per `motion.div` access would change
// the element type every render and force React to remount the subtree
// (which turns any mount-time setState into an infinite loop).
vi.mock("motion/react", () => {
  const cache = new Map<string, React.ComponentType<Record<string, unknown>>>()
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: new Proxy(
      {},
      {
        get(_target, tag: string) {
          let el = cache.get(tag)
          if (el === undefined) {
            el = function MockEl({
              children,
              ...rest
            }: Record<string, unknown> & { children?: React.ReactNode }) {
              return React.createElement(String(tag), rest, children)
            }
            cache.set(tag, el)
          }
          return el
        },
      }
    ),
    useReducedMotion: () => false,
    MotionConfig: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Headers that match the four required fields plus ftePercent (recommended).
const FULL_HEADERS = [
  "EmployeeID",
  "JobTitle",
  "Gender",
  "MonthlySalary",
  "FTE",
]
const FULL_ROWS: string[][] = [
  ["E001", "Software Engineer", "Kvinna", "55000", "100"],
  ["E002", "Product Manager", "Man", "70000", "80"],
]
const FULL_PARSED: ParsedCsv = { headers: FULL_HEADERS, rows: FULL_ROWS }

// Mapping that covers all four required fields AND ftePercent.
// Column indices: EmployeeID=0, JobTitle=1, Gender=2, MonthlySalary=3, FTE=4
const FULL_MAPPING: Record<string, number> = {
  externalRef: 0,
  title: 1,
  gender: 2,
  basicMonthly: 3,
  ftePercent: 4,
}

// Mapping missing basicMonthly (required) — should be blocking.
const MISSING_BASIC_MONTHLY: Record<string, number> = {
  externalRef: 0,
  title: 1,
  gender: 2,
}

// Mapping with all four required fields but missing ftePercent (recommended) — warning only.
const MISSING_FTE: Record<string, number> = {
  externalRef: 0,
  title: 1,
  gender: 2,
  basicMonthly: 3,
}

// Rows with a duplicate externalRef value.
const DUPLICATE_ROWS: string[][] = [
  ["E001", "Software Engineer", "Kvinna", "55000"],
  ["E001", "Product Manager", "Man", "70000"],
]
const DUPLICATE_PARSED: ParsedCsv = {
  headers: ["EmployeeID", "JobTitle", "Gender", "MonthlySalary"],
  rows: DUPLICATE_ROWS,
}
const DUPLICATE_MAPPING: Record<string, number> = {
  externalRef: 0,
  title: 1,
  gender: 2,
  basicMonthly: 3,
}

const m = messages.dashboard.people.import

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderCheckStep({
  parsed = FULL_PARSED,
  mapping = FULL_MAPPING,
  csvText,
  genderOverrides = {},
  onGenderOverridesChange = vi.fn(),
  onValidated = vi.fn(),
  onReupload = vi.fn(),
}: {
  parsed?: ParsedCsv
  mapping?: Record<string, number>
  csvText?: string
  genderOverrides?: Record<string, "Man" | "Kvinna">
  onGenderOverridesChange?: (next: Record<string, "Man" | "Kvinna">) => void
  onValidated?: (isBlocking: boolean, issueCount: number) => void
  onReupload?: () => void
} = {}) {
  const text =
    csvText ??
    `${parsed.headers.join(",")}\n${parsed.rows.map((r) => r.join(",")).join("\n")}`
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CheckStep
        parsed={parsed}
        mapping={mapping}
        csvText={text}
        genderOverrides={genderOverrides}
        onGenderOverridesChange={onGenderOverridesChange}
        onValidated={onValidated}
        onReupload={onReupload}
      />
    </NextIntlClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Tests: blocking scenario (missing required field basicMonthly)
// ---------------------------------------------------------------------------

describe("CheckStep — blocking (required field missing)", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows a blocking alert when a required field is not mapped", () => {
    renderCheckStep({ mapping: MISSING_BASIC_MONTHLY })
    const alert = screen.getByTestId("blocking-alert")
    expect(alert).toBeDefined()
  })

  it("lists the missing required field label in the blocking alert", () => {
    renderCheckStep({ mapping: MISSING_BASIC_MONTHLY })
    const alert = screen.getByTestId("blocking-alert")
    expect(alert.textContent).toContain(m.fields.basicMonthly)
  })

  it("calls onValidated(true, 0) when blocking with no per-row issues", () => {
    const onValidated = vi.fn()
    renderCheckStep({ mapping: MISSING_BASIC_MONTHLY, onValidated })
    expect(onValidated).toHaveBeenCalledWith(true, 0)
  })

  it("does not show the ready indicator when there are blocking fields", () => {
    renderCheckStep({ mapping: MISSING_BASIC_MONTHLY })
    expect(screen.queryByTestId("ready-indicator")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests: warning scenario (missing recommended field ftePercent)
// ---------------------------------------------------------------------------

describe("CheckStep — warning only (recommended field missing)", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows a warnings section when a recommended field is not mapped", () => {
    renderCheckStep({ mapping: MISSING_FTE })
    const warn = screen.getByTestId("warnings-section")
    expect(warn).toBeDefined()
  })

  it("lists the missing recommended field label in the warnings section", () => {
    renderCheckStep({ mapping: MISSING_FTE })
    const warn = screen.getByTestId("warnings-section")
    expect(warn.textContent).toContain(m.fields.ftePercent)
  })

  it("calls onValidated(false, 0) when only warnings (not blocking)", () => {
    const onValidated = vi.fn()
    renderCheckStep({ mapping: MISSING_FTE, onValidated })
    expect(onValidated).toHaveBeenCalledWith(false, 0)
  })

  it("does not show a blocking alert when there are only warnings", () => {
    renderCheckStep({ mapping: MISSING_FTE })
    expect(screen.queryByTestId("blocking-alert")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests: data-quality issues (duplicate externalRef)
// ---------------------------------------------------------------------------

describe("CheckStep — data quality issues", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows the issues heading when there are data-quality issues", () => {
    renderCheckStep({ parsed: DUPLICATE_PARSED, mapping: DUPLICATE_MAPPING })
    expect(screen.getByTestId("issues-section")).toBeDefined()
  })

  it("lists the duplicateId issue group", () => {
    renderCheckStep({ parsed: DUPLICATE_PARSED, mapping: DUPLICATE_MAPPING })
    const issuesSection = screen.getByTestId("issues-section")
    // The issue label for duplicateId must appear.
    expect(issuesSection.textContent).toContain(m.check.issue.duplicateId)
  })

  it("shows the count of affected rows for the duplicateId issue", () => {
    renderCheckStep({ parsed: DUPLICATE_PARSED, mapping: DUPLICATE_MAPPING })
    const issuesSection = screen.getByTestId("issues-section")
    // Both rows are affected (2 rows).
    expect(issuesSection.textContent).toContain("2")
  })

  it("lists affected rows as file row numbers (header on row 1)", () => {
    renderCheckStep({ parsed: DUPLICATE_PARSED, mapping: DUPLICATE_MAPPING })
    const group = screen.getByTestId("issue-group-duplicateId")
    // Data rows 0 and 1 sit on file rows 2 and 3 (row 1 is the header).
    expect(group.textContent).toContain("2, 3")
  })

  it("offers a re-upload shortcut that jumps back to the upload step", () => {
    const onReupload = vi.fn()
    renderCheckStep({
      parsed: DUPLICATE_PARSED,
      mapping: DUPLICATE_MAPPING,
      onReupload,
    })
    fireEvent.click(screen.getByTestId("reupload-button"))
    expect(onReupload).toHaveBeenCalledOnce()
  })

  it("does not show the issues section when the only issues are unresolved genders", () => {
    // Gender issues are fixed in-app via the assign-gender section, not by
    // re-uploading a corrected file.
    renderCheckStep({
      parsed: {
        headers: ["EmployeeID", "JobTitle", "Gender", "MonthlySalary"],
        rows: [["E001", "Engineer", "", "55000"]],
      },
      mapping: DUPLICATE_MAPPING,
    })
    expect(screen.queryByTestId("issues-section")).toBeNull()
    expect(screen.getByTestId("assign-gender")).toBeDefined()
  })

  it("blocks continuing while hard data-quality issues remain", () => {
    const onValidated = vi.fn()
    renderCheckStep({
      parsed: DUPLICATE_PARSED,
      mapping: DUPLICATE_MAPPING,
      onValidated,
    })
    // Both duplicate rows are flagged; the file must be fixed to continue.
    expect(onValidated).toHaveBeenCalledWith(true, 2)
  })
})

// ---------------------------------------------------------------------------
// Tests: interpretation notices (non-blocking)
// ---------------------------------------------------------------------------

// "03/04/2020" parses as DD/MM while MM/DD would also be valid -> ambiguousDate.
const AMBIGUOUS_DATE_PARSED: ParsedCsv = {
  headers: ["EmployeeID", "JobTitle", "Gender", "MonthlySalary", "StartDate"],
  rows: [["E001", "Engineer", "Kvinna", "55000", "03/04/2020"]],
}
const AMBIGUOUS_DATE_MAPPING: Record<string, number> = {
  externalRef: 0,
  title: 1,
  gender: 2,
  basicMonthly: 3,
  employmentStartDate: 4,
}

describe("CheckStep — interpretation notices", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows an ambiguous date as a non-blocking notice", () => {
    const onValidated = vi.fn()
    renderCheckStep({
      parsed: AMBIGUOUS_DATE_PARSED,
      mapping: AMBIGUOUS_DATE_MAPPING,
      onValidated,
    })
    expect(screen.getByTestId("notices-section")).toBeDefined()
    expect(screen.getByTestId("notice-group-ambiguousDate")).toBeDefined()
    // Notices are not hard errors: no fix-and-reupload section, no block.
    expect(screen.queryByTestId("issues-section")).toBeNull()
    expect(onValidated).toHaveBeenCalledWith(false, 1)
  })
})

// ---------------------------------------------------------------------------
// Tests: field coverage statuses
// ---------------------------------------------------------------------------

describe("CheckStep — field coverage statuses", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows the source column name on a mapped field row", () => {
    renderCheckStep({ mapping: FULL_MAPPING })
    const row = screen.getByTestId("readiness-row-title")
    expect(row.textContent).toContain("JobTitle")
  })

  it("marks an unmapped required field as missing", () => {
    renderCheckStep({ mapping: MISSING_BASIC_MONTHLY })
    const row = screen.getByTestId("readiness-row-basicMonthly")
    expect(row.textContent).toContain(m.check.status.missing)
  })

  it("marks an unmapped recommended field as not included", () => {
    renderCheckStep({ mapping: MISSING_FTE })
    const row = screen.getByTestId("readiness-row-ftePercent")
    expect(row.textContent).toContain(m.check.status.notIncluded)
  })
})

// ---------------------------------------------------------------------------
// Tests: ready state (all required fields mapped, no warnings)
// ---------------------------------------------------------------------------

describe("CheckStep — fully ready", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows the ready indicator when all required fields are mapped", () => {
    renderCheckStep({ mapping: FULL_MAPPING })
    expect(screen.getByTestId("ready-indicator")).toBeDefined()
  })

  it("calls onValidated(false, 0) when no blocking issues and no data-quality issues", () => {
    const onValidated = vi.fn()
    renderCheckStep({ mapping: FULL_MAPPING, onValidated })
    expect(onValidated).toHaveBeenCalledWith(false, 0)
  })

  it("does not show a blocking alert when all required fields are mapped", () => {
    renderCheckStep({ mapping: FULL_MAPPING })
    expect(screen.queryByTestId("blocking-alert")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests: file warnings (noDelimiter, mojibake)
// ---------------------------------------------------------------------------

describe("CheckStep — file warnings", () => {
  afterEach(() => {
    cleanup()
  })

  it("surfaces the no-delimiter file warning for single-column input", () => {
    // A file where columns are separated by colons (not a papaparse-recognized
    // delimiter) tokenizes as a single column: signals.noDelimiter === true.
    // This mirrors a real export where the delimiter is unrecognized (e.g., the
    // file uses a colon or space as a separator instead of comma, tab, pipe, or
    // semicolon).
    const singleCol: ParsedCsv = {
      headers: ["EmployeeID:JobTitle:Gender:MonthlySalary"],
      rows: [["E001:Engineer:Kvinna:55000"]],
    }
    renderCheckStep({
      parsed: singleCol,
      mapping: { externalRef: 0 },
      csvText:
        "EmployeeID:JobTitle:Gender:MonthlySalary\nE001:Engineer:Kvinna:55000",
    })
    const section = screen.getByTestId("file-warnings-section")
    expect(section.textContent).toContain(m.check.fileWarning.noDelimiter)
  })

  it("surfaces the mojibake file warning when 2+ headers are double-encoded", () => {
    // Two headers carry double-encoded UTF-8 sequences (Ã¥, Ã¶).
    const garbled: ParsedCsv = {
      headers: ["Anstnr", "MÃ¥nadslÃ¶n", "KÃ¶n", "Titel"],
      rows: [["E001", "55000", "Kvinna", "Engineer"]],
    }
    renderCheckStep({
      parsed: garbled,
      mapping: { externalRef: 0, basicMonthly: 1, gender: 2, title: 3 },
      csvText: "Anstnr,MÃ¥nadslÃ¶n,KÃ¶n,Titel\nE001,55000,Kvinna,Engineer",
    })
    const section = screen.getByTestId("file-warnings-section")
    expect(section.textContent).toContain(m.check.fileWarning.mojibake)
  })

  it("shows no file-warnings section for a clean CSV", () => {
    renderCheckStep({ mapping: FULL_MAPPING })
    expect(screen.queryByTestId("file-warnings-section")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Rows with a blank gender cell -> unresolvedGender flag -> assign UI
// ---------------------------------------------------------------------------

const BLANK_GENDER_PARSED: ParsedCsv = {
  headers: ["EmployeeID", "JobTitle", "Gender", "MonthlySalary"],
  rows: [
    ["E001", "Engineer", "", "55000"],
    ["E002", "Manager", "Man", "70000"],
  ],
}
const BLANK_GENDER_MAPPING: Record<string, number> = {
  externalRef: 0,
  title: 1,
  gender: 2,
  basicMonthly: 3,
}

describe("CheckStep — assign gender", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the assign-gender UI for a row with a blank gender cell", () => {
    renderCheckStep({
      parsed: BLANK_GENDER_PARSED,
      mapping: BLANK_GENDER_MAPPING,
    })
    expect(screen.getByTestId("assign-gender")).toBeDefined()
    // The flagged row is identified by its externalRef E001.
    expect(screen.getByTestId("assign-gender-E001")).toBeDefined()
  })

  it("blocks continuing until every flagged gender is assigned", () => {
    const onValidated = vi.fn()
    renderCheckStep({
      parsed: BLANK_GENDER_PARSED,
      mapping: BLANK_GENDER_MAPPING,
      onValidated,
    })
    expect(onValidated).toHaveBeenCalledWith(true, 1)
  })

  it("unblocks once all flagged genders are assigned", () => {
    const onValidated = vi.fn()
    renderCheckStep({
      parsed: BLANK_GENDER_PARSED,
      mapping: BLANK_GENDER_MAPPING,
      genderOverrides: { E001: "Kvinna" },
      onValidated,
    })
    expect(onValidated).toHaveBeenCalledWith(false, 1)
  })

  it("lifts the chosen gender via onGenderOverridesChange", () => {
    const onGenderOverridesChange = vi.fn()
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CheckStep
          parsed={BLANK_GENDER_PARSED}
          mapping={BLANK_GENDER_MAPPING}
          csvText={
            "EmployeeID,JobTitle,Gender,MonthlySalary\nE001,Engineer,,55000\nE002,Manager,Man,70000"
          }
          genderOverrides={{}}
          onGenderOverridesChange={onGenderOverridesChange}
          onValidated={vi.fn()}
          onReupload={vi.fn()}
        />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByTestId("assign-gender-E001-Kvinna"))
    expect(onGenderOverridesChange).toHaveBeenCalledWith({ E001: "Kvinna" })
  })
})
