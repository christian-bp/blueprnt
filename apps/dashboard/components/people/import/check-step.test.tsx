import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ParsedCsv } from "./import-wizard"
import { CheckStep } from "./check-step"

// Mock motion/react to keep tests free of animation complexity.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: new Proxy(
    {},
    {
      get(_target, tag: string) {
        return function MockEl({
          children,
          ...rest
        }: Record<string, unknown> & { children?: React.ReactNode }) {
          return React.createElement(String(tag), rest, children)
        }
      },
    }
  ),
  useReducedMotion: () => false,
  MotionConfig: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

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
  onValidated = vi.fn(),
}: {
  parsed?: ParsedCsv
  mapping?: Record<string, number>
  onValidated?: (isBlocking: boolean) => void
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CheckStep parsed={parsed} mapping={mapping} onValidated={onValidated} />
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
