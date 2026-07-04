import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ParsedCsv } from "./import-wizard"
import { ReviewStep, buildColumnMap } from "./review-step"

// ---------------------------------------------------------------------------
// Module mocks (must be declared before any imports that reference them)
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const importPayrollMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useAction: (_ref: unknown) => importPayrollMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    people: {
      import: { importPayroll: "people.import.importPayroll" },
    },
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({
    orgId: "org-test",
    name: "Test Org",
    role: "admin",
  }),
}))

import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Four required fields + ftePercent (recommended) + currency (optional).
const HEADERS = [
  "EmployeeID",
  "JobTitle",
  "Gender",
  "MonthlySalary",
  "FTE",
  "Currency",
]

// Two rows: salaries expressed as space-grouped Swedish strings.
const ROWS: string[][] = [
  ["E001", "Software Engineer", "Kvinna", "52 000", "100", "SEK"],
  ["E002", "Product Manager", "Man", "70000", "80", "EUR"],
]

const PARSED: ParsedCsv = { headers: HEADERS, rows: ROWS }

// Mapping: canonical field key -> column index.
const MAPPING: Record<string, number> = {
  externalRef: 0,
  title: 1,
  gender: 2,
  basicMonthly: 3,
  ftePercent: 4,
  currency: 5,
}

const CSV_TEXT = `${HEADERS.join(",")}\n${ROWS.map((r) => r.join(",")).join("\n")}`

const OK_RESULT = {
  ok: true,
  peopleImported: 2,
  salariesImported: 2,
  skippedRows: 0,
  validation: {
    readiness: [],
    blocking: [],
    warnings: [],
    issues: [],
  },
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderReviewStep({
  parsed = PARSED,
  mapping = MAPPING,
  csvText = CSV_TEXT,
  flaggedCount = 0,
  genderOverrides = {},
}: {
  parsed?: ParsedCsv
  mapping?: Record<string, number>
  csvText?: string
  flaggedCount?: number
  genderOverrides?: Record<string, "Man" | "Kvinna">
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewStep
        parsed={parsed}
        mapping={mapping}
        csvText={csvText}
        flaggedCount={flaggedCount}
        genderOverrides={genderOverrides}
      />
    </NextIntlClientProvider>
  )
}

// ---------------------------------------------------------------------------
// buildColumnMap (pure helper, no render)
// ---------------------------------------------------------------------------

describe("buildColumnMap", () => {
  it("builds [header, canonicalKey] pairs for each mapped column", () => {
    const result = buildColumnMap(MAPPING, HEADERS)
    // Should contain salary pair
    const salaryPair = result.find(([, key]) => key === "basicMonthly")
    expect(salaryPair).toBeDefined()
    expect(salaryPair?.[0]).toBe("MonthlySalary")
    // Should contain gender pair
    const genderPair = result.find(([, key]) => key === "gender")
    expect(genderPair).toBeDefined()
    expect(genderPair?.[0]).toBe("Gender")
  })

  it("produces pairs in [sourceHeader, canonicalKey] order", () => {
    const result = buildColumnMap(MAPPING, HEADERS)
    for (const [sourceHeader, canonicalKey] of result) {
      // sourceHeader must be a real header
      expect(HEADERS).toContain(sourceHeader)
      // canonicalKey must be a key in the mapping
      expect(Object.keys(MAPPING)).toContain(canonicalKey)
    }
  })

  it("skips entries whose column index is out of range", () => {
    const badMapping: Record<string, number> = {
      externalRef: 0,
      basicMonthly: 99, // out of range
    }
    const result = buildColumnMap(badMapping, HEADERS)
    expect(result.find(([, key]) => key === "basicMonthly")).toBeUndefined()
    expect(result.find(([, key]) => key === "externalRef")).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Preview rendering
// ---------------------------------------------------------------------------

describe("ReviewStep — preview", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the preview table", () => {
    renderReviewStep()
    expect(screen.getByTestId("preview-table")).toBeDefined()
  })

  it("renders a row for each data row (up to 10)", () => {
    renderReviewStep()
    expect(screen.getByTestId("preview-row-0")).toBeDefined()
    expect(screen.getByTestId("preview-row-1")).toBeDefined()
  })

  it("shows the parsed basicMonthly value (space-grouped '52 000' becomes 52000)", () => {
    renderReviewStep()
    // parseMoney("52 000") = 52000; displayed as locale string (sv-SE: "52 000")
    const row0 = screen.getByTestId("preview-row-0")
    // The cell should contain the numeric value. toLocaleString('sv-SE') produces
    // "52 000" with a thin non-breaking space — just check the digits are there.
    expect(row0.textContent).toMatch(/52/)
    expect(row0.textContent).toMatch(/000/)
  })

  it("shows the currency value for each row", () => {
    renderReviewStep()
    expect(screen.getByTestId("preview-row-0").textContent).toContain("SEK")
    expect(screen.getByTestId("preview-row-1").textContent).toContain("EUR")
  })

  it("shows the parsed gender value", () => {
    renderReviewStep()
    const row0 = screen.getByTestId("preview-row-0")
    // parseGender("Kvinna") = "Kvinna"
    expect(row0.textContent).toContain("Kvinna")
  })

  it("shows the summary line with people count and flagged count", () => {
    renderReviewStep({ flaggedCount: 3 })
    const summary = screen.getByTestId("summary")
    expect(summary.textContent).toBeDefined()
    // Should contain the total row count
    expect(summary.textContent).toContain("2")
  })
})

// ---------------------------------------------------------------------------
// Confirm action: success path
// ---------------------------------------------------------------------------

describe("ReviewStep — confirm (success)", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("calls importPayroll with csvText and orgId", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })

    const call = importPayrollMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call.orgId).toBe("org-test")
    expect(call.csvText).toBe(CSV_TEXT)
  })

  it("calls importPayroll with a columnMap containing the salary header pair", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })

    const call = importPayrollMock.mock.calls[0]?.[0] as {
      columnMap: Array<[string, string]>
    }
    const salaryPair = call.columnMap.find(([, key]) => key === "basicMonthly")
    expect(salaryPair).toBeDefined()
    expect(salaryPair?.[0]).toBe("MonthlySalary")
  })

  it("calls importPayroll with a columnMap containing the gender header pair", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })

    const call = importPayrollMock.mock.calls[0]?.[0] as {
      columnMap: Array<[string, string]>
    }
    const genderPair = call.columnMap.find(([, key]) => key === "gender")
    expect(genderPair).toBeDefined()
    expect(genderPair?.[0]).toBe("Gender")
  })

  it("fires toast.success on ok:true", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledOnce()
    })
  })

  it("navigates to /people on ok:true", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/people")
    })
  })
})

// ---------------------------------------------------------------------------
// Confirm action: failure path
// ---------------------------------------------------------------------------

describe("ReviewStep — confirm (failure)", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("fires toast.error when the action throws", async () => {
    importPayrollMock.mockRejectedValueOnce(new Error("network error"))
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledOnce()
    })
  })

  it("shows a blocking error alert when ok:false", async () => {
    importPayrollMock.mockResolvedValueOnce({
      ok: false,
      peopleImported: 0,
      salariesImported: 0,
      skippedRows: 0,
      validation: {
        readiness: [],
        blocking: ["basicMonthly"],
        warnings: [],
        issues: [],
      },
    })
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      expect(screen.getByTestId("blocking-error")).toBeDefined()
    })
  })

  it("shows the generic blockingTitle heading (not a raw field key) when ok:false", async () => {
    importPayrollMock.mockResolvedValueOnce({
      ok: false,
      peopleImported: 0,
      salariesImported: 0,
      skippedRows: 0,
      validation: {
        readiness: [],
        blocking: ["basicMonthly"],
        warnings: [],
        issues: [],
      },
    })
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      const alert = screen.getByTestId("blocking-error")
      // Title must be the generic blockingTitle, not a raw field key.
      expect(alert.textContent).toContain(
        messages.dashboard.people.import.review.blockingTitle
      )
      // The blocking field must render as a localized label, not the raw key.
      expect(alert.textContent).toContain(
        messages.dashboard.people.import.fields.basicMonthly
      )
      expect(alert.textContent).not.toContain("basicMonthly")
    })
  })

  it("does not call toast.error when ok:false (server-side blocking is not a thrown error)", async () => {
    importPayrollMock.mockResolvedValueOnce({
      ok: false,
      peopleImported: 0,
      salariesImported: 0,
      skippedRows: 0,
      validation: {
        readiness: [],
        blocking: ["basicMonthly"],
        warnings: [],
        issues: [],
      },
    })
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      expect(screen.getByTestId("blocking-error")).toBeDefined()
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("does not navigate on ok:false", async () => {
    importPayrollMock.mockResolvedValueOnce({
      ok: false,
      peopleImported: 0,
      salariesImported: 0,
      skippedRows: 0,
      validation: {
        readiness: [],
        blocking: ["basicMonthly"],
        warnings: [],
        issues: [],
      },
    })
    renderReviewStep()

    fireEvent.click(screen.getByTestId("confirm-button"))

    await waitFor(() => {
      expect(screen.getByTestId("blocking-error")).toBeDefined()
    })
    expect(pushMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Gender overrides
// ---------------------------------------------------------------------------

describe("ReviewStep — gender overrides", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("passes genderOverrides as [ref, choice] pairs to importPayroll", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ReviewStep
          parsed={PARSED}
          mapping={MAPPING}
          csvText={CSV_TEXT}
          flaggedCount={1}
          genderOverrides={{ E001: "Kvinna" }}
        />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByTestId("confirm-button"))
    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })
    const call = importPayrollMock.mock.calls[0]?.[0] as {
      genderOverrides: Array<[string, string]>
    }
    expect(call.genderOverrides).toEqual([["E001", "Kvinna"]])
  })

  it("omits genderOverrides when the record is empty", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep({ flaggedCount: 0 })
    fireEvent.click(screen.getByTestId("confirm-button"))
    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })
    const call = importPayrollMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect("genderOverrides" in call).toBe(false)
  })
})
