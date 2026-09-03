import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { HOURLY_NOTICE_CODES } from "@workspace/constants"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ParsedCsv } from "./import-wizard"
import { ReviewStep, buildColumnMap } from "./review-step"

// ---------------------------------------------------------------------------
// Module mocks (must be declared before any imports that reference them)
// ---------------------------------------------------------------------------

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const importPayrollMock = vi.fn()
const previewImportMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) =>
    ref === "people.import.previewImport"
      ? previewImportMock
      : importPayrollMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    people: {
      import: {
        importPayroll: "people.import.importPayroll",
        previewImport: "people.import.previewImport",
      },
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

import { toast } from "@/lib/toast"

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

const PARSED: ParsedCsv = { headers: HEADERS, rows: ROWS, headerless: false }

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

const EMPTY_VALIDATION = {
  readiness: [],
  blocking: [],
  warnings: [],
  issues: [],
}

// Default change preview: two new people, nothing else. Individual tests
// override with mockResolvedValueOnce BEFORE rendering (the fetch fires on
// mount).
const OK_PREVIEW = {
  ok: true,
  validation: EMPTY_VALIDATION,
  skippedRows: 0,
  diff: {
    people: { created: 2, updated: 0, unchanged: 0, returning: 0 },
    updatedPeople: [],
    returningPeople: [],
    missingFromFile: [],
    nameMismatches: [],
    salary: {
      newEntries: 2,
      changedSameYear: 0,
      identical: 0,
      changedDetails: [],
    },
  },
}
previewImportMock.mockResolvedValue(OK_PREVIEW)

// The confirm button waits for the change preview; click once it enables.
async function clickConfirm() {
  const button = screen.getByTestId("confirm-button") as HTMLButtonElement
  await waitFor(() => expect(button.disabled).toBe(false))
  fireEvent.click(button)
}

const OK_RESULT = {
  ok: true,
  peopleCreated: 2,
  peopleUpdated: 0,
  peopleUnchanged: 0,
  peopleArchived: 0,
  peopleReactivated: 0,
  salariesImported: 2,
  skippedRows: 0,
  validation: {
    readiness: [],
    blocking: [],
    warnings: [],
    issues: [],
  },
}

const BLOCKED_RESULT = {
  ok: false,
  peopleCreated: 0,
  peopleUpdated: 0,
  peopleUnchanged: 0,
  salariesImported: 0,
  skippedRows: 0,
  validation: {
    readiness: [],
    blocking: ["basicMonthly"],
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
  basisMap = {},
  genderOverrides = {},
  onBack = vi.fn(),
  onImportStart = vi.fn(),
  onImportEnd = vi.fn(),
  onImportSuccess = vi.fn(),
  blockingError = null,
}: {
  parsed?: ParsedCsv
  mapping?: Record<string, number>
  csvText?: string
  basisMap?: Record<string, "monthly" | "annual">
  genderOverrides?: Record<string, "Man" | "Kvinna">
  onBack?: () => void
  onImportStart?: (importId: string) => void
  onImportEnd?: (blocking?: string[]) => void
  onImportSuccess?: (result: {
    created: number
    updated: number
    unchanged: number
    skipped: number
    reactivated: number
    archived: number
  }) => void
  blockingError?: string[] | null
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewStep
        parsed={parsed}
        mapping={mapping}
        csvText={csvText}
        basisMap={basisMap}
        genderOverrides={genderOverrides}
        onBack={onBack}
        onImportStart={onImportStart}
        onImportEnd={onImportEnd}
        onImportSuccess={onImportSuccess}
        blockingError={blockingError}
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

  it("shows the summary line with the people count", async () => {
    renderReviewStep()
    const summary = await screen.findByTestId("summary")
    // Should contain the total row count
    expect(summary.textContent).toContain("2")
  })

  it("steps back via the footer back button", () => {
    const onBack = vi.fn()
    renderReviewStep({ onBack })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.people.import.back,
      })
    )
    expect(onBack).toHaveBeenCalledOnce()
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

    await clickConfirm()

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

    await clickConfirm()

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

    await clickConfirm()

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

  it("signals onImportSuccess with the result counts on ok:true (no toast, no navigation: the done screen is the feedback)", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    const onImportSuccess = vi.fn()
    renderReviewStep({ onImportSuccess })

    await clickConfirm()

    await waitFor(() => {
      expect(onImportSuccess).toHaveBeenCalledWith({
        created: 2,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        reactivated: 0,
        archived: 0,
      })
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("signals onImportStart when confirm is clicked (wizard shows the importing screen)", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    const onImportStart = vi.fn()
    const onImportSuccess = vi.fn()
    renderReviewStep({ onImportStart, onImportSuccess })

    await clickConfirm()

    expect(onImportStart).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(onImportSuccess).toHaveBeenCalledOnce()
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

    await clickConfirm()

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledOnce()
    })
  })

  it("signals onImportEnd with the blocking keys when ok:false", async () => {
    importPayrollMock.mockResolvedValueOnce(BLOCKED_RESULT)
    const onImportEnd = vi.fn()
    renderReviewStep({ onImportEnd })

    await clickConfirm()

    await waitFor(() => {
      expect(onImportEnd).toHaveBeenCalledWith(["basicMonthly"])
    })
  })

  it("renders the blocking error alert from the blockingError prop", () => {
    renderReviewStep({ blockingError: ["basicMonthly"] })
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

  it("does not call toast.error when ok:false (server-side blocking is not a thrown error)", async () => {
    importPayrollMock.mockResolvedValueOnce(BLOCKED_RESULT)
    const onImportEnd = vi.fn()
    renderReviewStep({ onImportEnd })

    await clickConfirm()

    await waitFor(() => {
      expect(onImportEnd).toHaveBeenCalledOnce()
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("does not navigate on ok:false", async () => {
    importPayrollMock.mockResolvedValueOnce(BLOCKED_RESULT)
    const onImportEnd = vi.fn()
    renderReviewStep({ onImportEnd })

    await clickConfirm()

    await waitFor(() => {
      expect(onImportEnd).toHaveBeenCalledOnce()
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("signals onImportEnd without blocking keys when the action throws", async () => {
    importPayrollMock.mockRejectedValueOnce(new Error("network error"))
    const onImportEnd = vi.fn()
    renderReviewStep({ onImportEnd })

    await clickConfirm()

    await waitFor(() => {
      expect(onImportEnd).toHaveBeenCalledWith()
    })
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
          basisMap={{}}
          onBack={vi.fn()}
          onImportStart={vi.fn()}
          onImportEnd={vi.fn()}
          onImportSuccess={vi.fn()}
          blockingError={null}
          genderOverrides={{ E001: "Kvinna" }}
        />
      </NextIntlClientProvider>
    )
    await clickConfirm()
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
    renderReviewStep()
    await clickConfirm()
    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })
    const call = importPayrollMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect("genderOverrides" in call).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Basis map
// ---------------------------------------------------------------------------

describe("ReviewStep — basis map", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("passes a non-empty basisMap to previewImport and importPayroll", async () => {
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    const basisMap = { basicMonthly: "monthly", bonus: "annual" } as const
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ReviewStep
          parsed={PARSED}
          mapping={MAPPING}
          csvText={CSV_TEXT}
          basisMap={basisMap}
          onBack={vi.fn()}
          onImportStart={vi.fn()}
          onImportEnd={vi.fn()}
          onImportSuccess={vi.fn()}
          blockingError={null}
          genderOverrides={{}}
        />
      </NextIntlClientProvider>
    )
    await clickConfirm()
    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })
    const previewCall = previewImportMock.mock.calls[0]?.[0] as {
      basisMap?: Record<string, string>
    }
    expect(previewCall.basisMap).toEqual(basisMap)
    const importCall = importPayrollMock.mock.calls[0]?.[0] as {
      basisMap?: Record<string, string>
    }
    expect(importCall.basisMap).toEqual(basisMap)
  })
})

// ---------------------------------------------------------------------------
// Change preview + name-mismatch guard
// ---------------------------------------------------------------------------

describe("ReviewStep — change preview", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const mChanges = messages.dashboard.people.import.review.changes

  it("renders the change counts and the per-person field diffs", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        people: { created: 1, updated: 1, unchanged: 3, returning: 0 },
        updatedPeople: [
          {
            externalRef: "E001",
            displayName: "Anna Svensson",
            changes: [{ field: "department", from: "Ekonomi", to: "HR" }],
          },
        ],
        returningPeople: [],
        missingFromFile: [],
        nameMismatches: [],
        salary: {
          newEntries: 1,
          changedSameYear: 2,
          identical: 3,
          changedDetails: [],
        },
      },
    })
    renderReviewStep()

    await waitFor(() => {
      expect(screen.getByText(mChanges.updatedPeople)).toBeDefined()
    })
    expect(screen.getByText(mChanges.newPeople)).toBeDefined()
    expect(screen.getByText(mChanges.salaryChanged)).toBeDefined()
    // The per-person diff names the person and the changed field's values.
    const updated = screen.getByTestId("updated-people")
    expect(updated.textContent).toContain("Anna Svensson")
    expect(updated.textContent).toContain("Ekonomi")
    expect(updated.textContent).toContain("HR")
  })

  it("caps the updated-people list and reveals the rest via Show all", async () => {
    const manyUpdated = Array.from({ length: 8 }, (_, i) => ({
      externalRef: `E${i + 1}`,
      displayName: `Person ${i + 1}`,
      changes: [{ field: "department", from: "A", to: "B" }],
    }))
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        ...OK_PREVIEW.diff,
        people: { created: 0, updated: 8, unchanged: 0 },
        updatedPeople: manyUpdated,
      },
    })
    renderReviewStep()

    const updated = await screen.findByTestId("updated-people")
    // Capped at 6: the 8th person is hidden behind Show all.
    expect(updated.textContent).toContain("Person 6")
    expect(updated.textContent).not.toContain("Person 8")

    fireEvent.click(screen.getByRole("button", { name: /8/ }))
    expect(screen.getByTestId("updated-people").textContent).toContain(
      "Person 8"
    )
    // The expander disappears once everything is shown.
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull()
  })

  it("skips name-mismatched rows by default and passes them to importPayroll", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        ...OK_PREVIEW.diff,
        nameMismatches: [
          {
            externalRef: "E001",
            storedName: "Anna Svensson",
            incomingName: "Greta Berg",
          },
        ],
      },
    })
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep()

    await waitFor(() => {
      expect(screen.getByTestId("name-mismatch")).toBeDefined()
    })
    expect(screen.getByTestId("name-mismatch").textContent).toContain(
      "Greta Berg"
    )

    await clickConfirm()
    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })
    const call = importPayrollMock.mock.calls[0]?.[0] as {
      skipExternalRefs?: string[]
    }
    expect(call.skipExternalRefs).toEqual(["E001"])
  })

  it("imports mismatched rows when HR opts in", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        ...OK_PREVIEW.diff,
        nameMismatches: [
          {
            externalRef: "E001",
            storedName: "Anna Svensson",
            incomingName: "Greta Berg",
          },
        ],
      },
    })
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep()

    await waitFor(() => {
      expect(screen.getByTestId("name-mismatch")).toBeDefined()
    })
    fireEvent.click(
      screen.getByRole("checkbox", { name: mChanges.mismatchImportAnyway })
    )

    await clickConfirm()
    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })
    const call = importPayrollMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect("skipExternalRefs" in call).toBe(false)
  })

  it("allows importing when the preview fails to load", async () => {
    previewImportMock.mockRejectedValueOnce(new Error("network"))
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep()

    await waitFor(() => {
      expect(screen.getByText(mChanges.previewFailed)).toBeDefined()
    })
    await clickConfirm()
    await waitFor(() => {
      expect(importPayrollMock).toHaveBeenCalledOnce()
    })
  })
})

// ---------------------------------------------------------------------------
// Returning and missing people, the archive-leavers checkbox
// ---------------------------------------------------------------------------

describe("ReviewStep: leavers and returners", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    previewImportMock.mockResolvedValue(OK_PREVIEW)
  })

  const c = messages.dashboard.people.import.review.changes

  it("renders the returning and missing rows with their counts and lists", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        ...OK_PREVIEW.diff,
        people: { created: 2, updated: 0, unchanged: 0, returning: 1 },
        returningPeople: [{ externalRef: "E009", displayName: "Rita Return" }],
        missingFromFile: [
          { externalRef: "E100", displayName: "Lars Leaver" },
          { externalRef: "E101", displayName: "Mia Missing" },
        ],
      },
    })
    renderReviewStep()
    await screen.findByText("Rita Return")
    expect(screen.getByTestId("returning-people").textContent).toContain("E009")
    const missing = screen.getByTestId("missing-people")
    expect(missing.textContent).toContain(c.missingTitle)
    expect(missing.textContent).toContain("Lars Leaver")
    expect(missing.textContent).toContain("Mia Missing")
    const checkbox = screen.getByRole("checkbox", {
      name: "Archive these 2 employees",
    })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
  })

  it("renders neither list when there is nothing returning or missing", async () => {
    renderReviewStep()
    await waitFor(() => expect(previewImportMock).toHaveBeenCalled())
    expect(screen.queryByTestId("returning-people")).toBeNull()
    expect(screen.queryByTestId("missing-people")).toBeNull()
  })

  it("omits archiveMissing unless the checkbox is ticked", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        ...OK_PREVIEW.diff,
        missingFromFile: [{ externalRef: "E100", displayName: "Lars Leaver" }],
      },
    })
    importPayrollMock.mockResolvedValue(OK_RESULT)
    renderReviewStep()
    await screen.findByText("Lars Leaver")
    await clickConfirm()
    await waitFor(() => expect(importPayrollMock).toHaveBeenCalled())
    expect(importPayrollMock.mock.calls[0]?.[0]).not.toHaveProperty(
      "archiveMissing"
    )
  })

  it("passes archiveMissing: true when the checkbox is ticked", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        ...OK_PREVIEW.diff,
        missingFromFile: [{ externalRef: "E100", displayName: "Lars Leaver" }],
      },
    })
    importPayrollMock.mockResolvedValue(OK_RESULT)
    renderReviewStep()
    await screen.findByText("Lars Leaver")
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Archive this employee" })
    )
    await clickConfirm()
    await waitFor(() => expect(importPayrollMock).toHaveBeenCalled())
    expect(importPayrollMock.mock.calls[0]?.[0]).toMatchObject({
      archiveMissing: true,
    })
  })

  it("passes the reactivated and archived counts to onImportSuccess", async () => {
    importPayrollMock.mockResolvedValue({
      ...OK_RESULT,
      peopleArchived: 3,
      peopleReactivated: 1,
    })
    const onImportSuccess = vi.fn()
    renderReviewStep({ onImportSuccess })
    await clickConfirm()
    await waitFor(() => expect(onImportSuccess).toHaveBeenCalled())
    expect(onImportSuccess.mock.calls[0]?.[0]).toMatchObject({
      archived: 3,
      reactivated: 1,
    })
  })
})

// ---------------------------------------------------------------------------
// Hourly pay group
// ---------------------------------------------------------------------------

describe("ReviewStep: hourly pay", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    previewImportMock.mockResolvedValue(OK_PREVIEW)
  })

  const mHourly = messages.dashboard.people.import.review.hourly

  // A promise whose resolution is controlled from the test, so a mocked
  // previewImport call can be left pending (simulating a rerun in flight),
  // resolved out of order relative to another pending call, or rejected (a
  // failed rerun).
  function createDeferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  const HOURLY_PREVIEW = {
    ...OK_PREVIEW,
    hourlyPay: {
      interpreted: [{ externalRef: "H1", displayName: "Maria Karlsson" }],
      total: 2,
      notices: [
        {
          code: "hourlyLooksMonthly" as const,
          ref: { externalRef: "H9", displayName: "X" },
        },
      ],
    },
    ownHoursCount: 1,
  }

  it("has a review.hourly.notice label for every HOURLY_NOTICE_CODES entry, and no other", () => {
    const noticeLabels = mHourly.notice as Record<string, string>
    for (const code of HOURLY_NOTICE_CODES) {
      expect(typeof noticeLabels[code]).toBe("string")
    }
    expect(Object.keys(noticeLabels).sort()).toEqual(
      [...HOURLY_NOTICE_CODES].sort()
    )
  })

  it("renders the hourly pay group with the interpreted count row, Maria's name, the own-hours row, and the notice's person", async () => {
    previewImportMock.mockResolvedValueOnce(HOURLY_PREVIEW)
    renderReviewStep()

    const group = await screen.findByTestId("hourly-pay")
    expect(group.textContent).toContain(mHourly.heading)
    expect(group.textContent).toContain("Maria Karlsson")
    expect(group.textContent).toContain("1")

    const notices = screen.getByTestId("hourly-notices")
    expect(notices.textContent).toContain("X")
  })

  it("checks the interpret-hourly checkbox by default", async () => {
    previewImportMock.mockResolvedValueOnce(HOURLY_PREVIEW)
    renderReviewStep()
    await screen.findByTestId("hourly-pay")
    const checkbox = screen.getByRole("checkbox", {
      name: mHourly.interpretToggle,
    })
    expect(checkbox.getAttribute("aria-checked")).toBe("true")
  })

  it("omits interpretHourly from the mount preview call (default on, like every other default arg)", async () => {
    previewImportMock.mockResolvedValueOnce(HOURLY_PREVIEW)
    renderReviewStep()
    await screen.findByTestId("hourly-pay")
    const call = previewImportMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect("interpretHourly" in call).toBe(false)
  })

  it("unchecking re-runs the preview with interpretHourly: false", async () => {
    previewImportMock.mockResolvedValueOnce(HOURLY_PREVIEW)
    renderReviewStep()
    await screen.findByTestId("hourly-pay")

    previewImportMock.mockResolvedValueOnce({
      ...HOURLY_PREVIEW,
      hourlyPay: { ...HOURLY_PREVIEW.hourlyPay, total: 0, notices: [] },
      ownHoursCount: 0,
    })
    fireEvent.click(
      screen.getByRole("checkbox", { name: mHourly.interpretToggle })
    )

    await waitFor(() => {
      expect(previewImportMock).toHaveBeenCalledTimes(2)
    })
    const secondCall = previewImportMock.mock.calls[1]?.[0] as Record<
      string,
      unknown
    >
    expect(secondCall.interpretHourly).toBe(false)
  })

  it("confirming with the box unchecked calls importPayroll with interpretHourly: false", async () => {
    previewImportMock.mockResolvedValueOnce(HOURLY_PREVIEW)
    renderReviewStep()
    await screen.findByTestId("hourly-pay")

    previewImportMock.mockResolvedValueOnce({
      ...HOURLY_PREVIEW,
      hourlyPay: { ...HOURLY_PREVIEW.hourlyPay, total: 0, notices: [] },
      ownHoursCount: 0,
    })
    fireEvent.click(
      screen.getByRole("checkbox", { name: mHourly.interpretToggle })
    )
    await waitFor(() => expect(previewImportMock).toHaveBeenCalledTimes(2))

    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    await clickConfirm()
    await waitFor(() => expect(importPayrollMock).toHaveBeenCalledOnce())
    const call = importPayrollMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call.interpretHourly).toBe(false)
  })

  it("confirming with the box checked omits interpretHourly from importPayroll", async () => {
    previewImportMock.mockResolvedValueOnce(HOURLY_PREVIEW)
    importPayrollMock.mockResolvedValueOnce(OK_RESULT)
    renderReviewStep()
    await screen.findByTestId("hourly-pay")

    await clickConfirm()
    await waitFor(() => expect(importPayrollMock).toHaveBeenCalledOnce())
    const call = importPayrollMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect("interpretHourly" in call).toBe(false)
  })

  it("renders no group when hourlyPay.total is 0, there are no notices, and ownHoursCount is 0", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      hourlyPay: { interpreted: [], total: 0, notices: [] },
      ownHoursCount: 0,
    })
    renderReviewStep()
    await waitFor(() => expect(previewImportMock).toHaveBeenCalled())
    expect(screen.queryByTestId("hourly-pay")).toBeNull()
  })

  it("passes hourlyPay to onImportSuccess", async () => {
    importPayrollMock.mockResolvedValueOnce({ ...OK_RESULT, hourlyPay: 2 })
    const onImportSuccess = vi.fn()
    renderReviewStep({ onImportSuccess })
    await clickConfirm()
    await waitFor(() => expect(onImportSuccess).toHaveBeenCalled())
    expect(onImportSuccess.mock.calls[0]?.[0]).toMatchObject({ hourlyPay: 2 })
  })

  it("keeps the hourly-pay group and its checkbox mounted while a toggle-triggered rerun is in flight", async () => {
    previewImportMock.mockResolvedValueOnce(HOURLY_PREVIEW)
    renderReviewStep()
    await screen.findByTestId("hourly-pay")

    const { promise, resolve } = createDeferred<typeof HOURLY_PREVIEW>()
    previewImportMock.mockReturnValueOnce(promise)

    fireEvent.click(
      screen.getByRole("checkbox", { name: mHourly.interpretToggle })
    )
    await waitFor(() => expect(previewImportMock).toHaveBeenCalledTimes(2))

    // The rerun is in flight: the group and its checkbox never leave the
    // DOM, and the previous preview's rows stay visible (no reflow, no
    // focus loss for the checkbox HR just clicked). Confirm cannot be
    // clicked against a preview that is mid-replacement, and the group's
    // count cells revert to a skeleton.
    const group = screen.getByTestId("hourly-pay")
    expect(group).toBeDefined()
    expect(
      screen.getByRole("checkbox", { name: mHourly.interpretToggle })
    ).toBeDefined()
    expect(group.textContent).toContain("Maria Karlsson")
    expect(
      (screen.getByTestId("confirm-button") as HTMLButtonElement).disabled
    ).toBe(true)
    expect(group.querySelector('[data-slot="skeleton"]')).not.toBeNull()

    resolve({
      ...HOURLY_PREVIEW,
      hourlyPay: { interpreted: [], total: 0, notices: [] },
      ownHoursCount: 0,
    })
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: mHourly.interpretToggle })
      ).toBeDefined()
    )
    await waitFor(() =>
      expect(
        (screen.getByTestId("confirm-button") as HTMLButtonElement).disabled
      ).toBe(false)
    )
    const groupAfter = screen.getByTestId("hourly-pay")
    expect(groupAfter.querySelector('[data-slot="skeleton"]')).toBeNull()
    expect(groupAfter.textContent).not.toContain("Maria Karlsson")
    expect(groupAfter.textContent).toContain("0 amounts are read as hourly pay")
  })

  it("applies only the latest request's response when an earlier request's response arrives later (out-of-order)", async () => {
    previewImportMock.mockResolvedValueOnce(HOURLY_PREVIEW)
    renderReviewStep()
    await screen.findByTestId("hourly-pay")

    const earlier = createDeferred<typeof HOURLY_PREVIEW>()
    const later = createDeferred<typeof HOURLY_PREVIEW>()
    previewImportMock.mockReturnValueOnce(earlier.promise)
    previewImportMock.mockReturnValueOnce(later.promise)

    const checkbox = screen.getByRole("checkbox", {
      name: mHourly.interpretToggle,
    })
    // Two toggles in quick succession fire two overlapping preview requests.
    fireEvent.click(checkbox)
    fireEvent.click(checkbox)
    await waitFor(() => expect(previewImportMock).toHaveBeenCalledTimes(3))

    const staleResult = {
      ...HOURLY_PREVIEW,
      hourlyPay: {
        interpreted: [{ externalRef: "STALE", displayName: "Stale Person" }],
        total: 9,
        notices: [],
      },
      ownHoursCount: 9,
    }
    const latestResult = {
      ...HOURLY_PREVIEW,
      hourlyPay: {
        interpreted: [{ externalRef: "LATEST", displayName: "Latest Person" }],
        total: 3,
        notices: [],
      },
      ownHoursCount: 3,
    }

    // Resolve the LATER request first, then the EARLIER (now stale) request:
    // an out-of-order arrival. The stale response must be dropped so the
    // later request's result is what stays on screen.
    later.resolve(latestResult)
    await waitFor(() =>
      expect(screen.getByTestId("hourly-pay").textContent).toContain(
        "Latest Person"
      )
    )
    earlier.resolve(staleResult)

    // Give the dropped response's microtask a turn, then assert it changed
    // nothing.
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId("hourly-pay").textContent).toContain(
      "Latest Person"
    )
    expect(screen.getByTestId("hourly-pay").textContent).not.toContain(
      "Stale Person"
    )
  })

  it("keeps the group and checkbox mounted, reverts the checkbox, and toasts when a rerun's request fails", async () => {
    previewImportMock.mockResolvedValueOnce(HOURLY_PREVIEW)
    renderReviewStep()
    await screen.findByTestId("hourly-pay")

    const { promise, reject } = createDeferred<typeof HOURLY_PREVIEW>()
    previewImportMock.mockReturnValueOnce(promise)

    const checkbox = screen.getByRole("checkbox", {
      name: mHourly.interpretToggle,
    })
    fireEvent.click(checkbox)
    await waitFor(() => expect(previewImportMock).toHaveBeenCalledTimes(2))
    // Optimistically unchecked while the rerun is in flight.
    expect(checkbox.getAttribute("aria-checked")).toBe("false")

    reject(new Error("network"))
    await waitFor(() => expect(toast.error).toHaveBeenCalledOnce())

    // A failed rerun never swaps the group for the previewFailed message: the
    // group, its checkbox, and the previous preview's rows and counts all
    // stay on screen, and the checkbox reverts to match what is shown.
    const group = screen.getByTestId("hourly-pay")
    expect(group).toBeDefined()
    expect(group.textContent).toContain("Maria Karlsson")
    expect(group.querySelector('[data-slot="skeleton"]')).toBeNull()
    // The previewFailed message never replaces the group on a failed rerun
    // (only a failed MOUNT preview, with no previous preview, shows it).
    expect(
      screen.queryByText(
        messages.dashboard.people.import.review.changes.previewFailed
      )
    ).toBeNull()
    const checkboxAfter = screen.getByRole("checkbox", {
      name: mHourly.interpretToggle,
    })
    expect(checkboxAfter.getAttribute("aria-checked")).toBe("true")
  })
})
