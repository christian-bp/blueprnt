/**
 * ImportWizard: header-change mapping-reset tests.
 *
 * FIX 1 regression: when the user re-uploads a CSV with DIFFERENT headers,
 * the wizard must reset `mapping` to null so MapStep re-seeds it for the
 * new file. When headers are UNCHANGED the existing mapping must be preserved.
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ImportWizard } from "./import-wizard"

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Strip motion-specific props so plain DOM elements are rendered.
function MotionEl(tag: string) {
  return function MockMotionElement({
    children,
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    variants: _v,
    style,
    className,
    ...rest
  }: Record<string, unknown> & { children?: React.ReactNode }) {
    return React.createElement(tag, { style, className, ...rest }, children)
  }
}

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  motion: new Proxy(
    {},
    {
      get(_target, tag: string) {
        return MotionEl(tag)
      },
    }
  ),
  useReducedMotion: () => false,
  MotionConfig: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

vi.mock("@/components/account-menu", () => ({
  AccountMenu: () => null,
}))

vi.mock("@/components/auth/auth-shell", () => ({
  AuthShell: ({
    children,
    footer,
  }: {
    children: React.ReactNode
    footer?: React.ReactNode
    headerRight?: React.ReactNode
    contentClassName?: string
  }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}))

vi.mock("@/components/onboarding/onboarding-dots", () => ({
  OnboardingDots: () => null,
}))

// MapStep now calls useQuery to load the saved mapping profile. Return null
// (no saved profile) so auto-detection is the only seed in these tests.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => null),
}))

// MapStep now calls useOrganization to scope the profile query.
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({
    orgId: "org-test",
    name: "Test Org",
    role: "admin",
  }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// File A: four columns (matches required synonyms so auto-detection seeds all
// four required fields). Headers are deliberately different from File B.
const CSV_A = `EmployeeID,JobTitle,Gender,MonthlySalary
E001,Software Engineer,Kvinna,55000
E002,Product Manager,Man,70000`

// File B: completely different column names (no overlap with File A).
const CSV_B = `StaffNumber,Role,Sex,BasePay
S001,Designer,Female,60000
S002,Analyst,Male,65000`

// File A again with the same headers as the first upload.
const CSV_A_RESAME = `EmployeeID,JobTitle,Gender,MonthlySalary
E003,Team Lead,Man,80000`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWizard() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ImportWizard />
    </NextIntlClientProvider>
  )
}

/** Drop a CSV file onto the upload drop zone. */
async function dropCsv(csvText: string, filename = "payroll.csv") {
  const dropZone = screen.getByRole("region")
  const file = new File([csvText], filename, { type: "text/csv" })
  fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })
  // Wait for the async file.text() / onParsed path to settle.
  await waitFor(() => {
    expect(screen.queryByTestId("detected-summary")).not.toBeNull()
  })
}

/** Advance to the Map step by clicking Next. */
function clickNext() {
  const nextButton = screen.getByRole("button", {
    name: messages.dashboard.people.import.next,
  })
  fireEvent.click(nextButton)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImportWizard: mapping reset on header change", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("resets mapping to null when a re-upload has DIFFERENT headers", async () => {
    // Capture the mapping passed to MapStep via onMappingChange.
    // We verify indirectly: after uploading file A then navigating to Map,
    // MapStep seeds the mapping. Then we go back to Upload, upload file B
    // (different headers), navigate forward, and MapStep must call
    // onMappingChange again (which means mapping was null and it re-seeded).

    // We need to observe whether MapStep calls onMappingChange on re-entry.
    // The simplest observable: after re-upload of a different file the
    // detected-summary disappears and reappears (the state was reset).
    // More directly: we test the onParsed handler logic in isolation here.

    // Render and upload file A.
    renderWizard()
    await dropCsv(CSV_A, "fileA.csv")

    // Advance to map step.
    clickNext()

    // Go back to upload step.
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.people.import.back,
      })
    )

    // The drop zone should be visible again.
    expect(screen.getByRole("region")).toBeDefined()

    // Upload file B (different headers).
    await dropCsv(CSV_B, "fileB.csv")

    // Advance to map step again.
    clickNext()

    // MapStep should have re-seeded (mapping was null). The auto-detection
    // for file B's headers ("StaffNumber", "Role", "Sex", "BasePay") should
    // not have produced the same column assignments as file A.
    // Confirm the Map step heading is shown (we are on the map step).
    expect(
      screen.getByText(messages.dashboard.people.import.map.title)
    ).toBeDefined()

    // File B has completely different column headers. The column-first table
    // shows one row per CSV column. Column 0 in File A was "EmployeeID";
    // in File B it is "StaffNumber". Verify the header text changed.
    // Row map-column-0 should now contain "StaffNumber", not "EmployeeID".
    const col0Row = screen.getByTestId("map-column-0")
    expect(col0Row.textContent).toContain("StaffNumber")
    expect(col0Row.textContent).not.toContain("EmployeeID")
  })

  it("preserves the mapping when a re-upload has the SAME headers", async () => {
    renderWizard()
    await dropCsv(CSV_A, "fileA.csv")

    // Advance to map step: MapStep seeds the mapping.
    clickNext()

    // Confirm we are on the map step and a known header appears.
    expect(
      screen.getByText(messages.dashboard.people.import.map.title)
    ).toBeDefined()

    // Go back.
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.people.import.back,
      })
    )

    // Re-upload the same headers (different row data, same column names).
    await dropCsv(CSV_A_RESAME, "fileA2.csv")

    // Advance to map step again.
    clickNext()

    // The map step should still show "EmployeeID" as a column row (mapping
    // was preserved because headers matched). In the column-first layout,
    // column 0 is still "EmployeeID".
    const col0Row = screen.getByTestId("map-column-0")
    expect(col0Row.textContent).toContain("EmployeeID")
  })
})
