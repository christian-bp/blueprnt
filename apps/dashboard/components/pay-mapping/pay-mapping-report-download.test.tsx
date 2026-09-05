import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { makeGapResult, makeRunDetail } from "@/test/pay-mapping-fixtures"
import type { ReportWomenDominatedGroup } from "./pay-mapping-report-data"

const toBlob = vi.fn(async () => new Blob(["x"], { type: "application/pdf" }))
// The last element handed to pdf(): the assertions read the labels and the
// doc off it to tell WHICH document was rendered.
let lastPdfElement: unknown
vi.mock("@react-pdf/renderer", () => ({
  pdf: (element: unknown) => {
    lastPdfElement = element
    return { toBlob }
  },
  Font: { registerHyphenationCallback: () => {}, register: () => {} },
  StyleSheet: { create: (s: unknown) => s },
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
  Image: () => null,
  Svg: ({ children }: { children: unknown }) => children,
  G: ({ children }: { children: unknown }) => children,
  Rect: () => null,
  Line: () => null,
  Path: () => null,
  Defs: ({ children }: { children: unknown }) => children,
  Pattern: ({ children }: { children: unknown }) => children,
}))

// One mock per boundary mutation, resolved by the string refs below: the
// tests must be able to assert WHICH event the export logged.
const logSigning = vi.fn(async () => null)
const logDetail = vi.fn(async () => null)
const logMetricsExport = vi.fn(async () => null)
const logArchiveExport = vi.fn(async () => null)
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  // The export hook reaches the criteria library through lib/audit-constants,
  // whose backend closure builds the audit aggregates off `components`: the
  // mock has to carry the export even though nothing here reads it.
  components: {},
  api: {
    payMapping: {
      runs: { listPayMappingRuns: "runs.list" },
      actions: { listActions: "actions.list" },
      gap: { getPayMappingGap: "gap.get" },
      report: {
        logPayMappingSigningReportExport: "report.logSigning",
        logPayMappingDetailAppendixExport: "report.logDetail",
        logPayMappingMetricsExport: "report.logMetrics",
        logPayMappingArchiveExport: "report.logArchive",
      },
    },
  },
}))
vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) =>
    args === "skip" ? undefined : [],
  useMutation: (ref: unknown) =>
    ref === "report.logDetail"
      ? logDetail
      : ref === "report.logMetrics"
        ? logMetricsExport
        : ref === "report.logArchive"
          ? logArchiveExport
          : logSigning,
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme AB", role: "admin" }),
}))

vi.mock("./pay-mapping-run-context", () => ({
  usePayMappingRun: () => ({
    run: makeRunDetail({
      status: "completed",
      collaboration: {
        participants: "Union rep",
        description: "Monthly",
        date: null,
        remarks: null,
      },
    }),
    gap: makeGapResult({}),
    analyses: [],
    actions: [],
    notes: [],
    runsList: [],
    queue: null,
    locked: true,
  }),
}))

import { PayMappingReportDownload } from "./pay-mapping-report-download"

function renderDownload() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingReportDownload />
    </NextIntlClientProvider>
  )
}

type RenderedProps = {
  props?: {
    labels?: {
      identity?: { coverTitle?: string; footLabel?: string }
      classification?: string
      wdGroupLine?: (group: ReportWomenDominatedGroup) => string
    }
    doc?: { equalWork?: unknown[]; checklist?: unknown }
  }
}

describe("PayMappingReportDownload", () => {
  afterEach(() => {
    cleanup()
    toBlob.mockClear()
    logSigning.mockClear()
    logDetail.mockClear()
    logMetricsExport.mockClear()
    logArchiveExport.mockClear()
    lastPdfElement = undefined
  })

  it("renders the signing report, logs its own export event, then downloads", async () => {
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadSigning,
      })
    )
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(logSigning).toHaveBeenCalledWith({ orgId: "org1", runId: "run-1" })
    expect(logDetail).not.toHaveBeenCalled()
    // The export-boundary audit row is written BEFORE the file is handed
    // over (ADR-0011 p.3): a download the trail missed must not happen.
    const logOrder = logSigning.mock.invocationCallOrder[0] ?? 0
    const downloadOrder = createObjectURL.mock.invocationCallOrder[0] ?? 0
    expect(logOrder).toBeLessThan(downloadOrder)
    const element = lastPdfElement as RenderedProps
    // The cover's big line names the SUBJECT both documents share; the kind
    // of document rides the foot label under it.
    expect(element?.props?.labels?.identity?.coverTitle).toBe(
      messages.dashboard.payMapping.report.coverTitle
    )
    expect(element?.props?.labels?.identity?.footLabel).toBe(
      messages.dashboard.payMapping.signingReport.docTitle
    )
    expect(element?.props?.doc?.checklist).toBeDefined()
    // The signing projection reduces equal work to counts: a per-group list
    // cannot reach this document.
    expect(element?.props?.doc?.equalWork).not.toBeInstanceOf(Array)
  })

  it("renders the detail appendix as a multi-pass PDF with its own event and the classification line", async () => {
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadDetail,
      })
    )
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(logDetail).toHaveBeenCalledWith({ orgId: "org1", runId: "run-1" })
    expect(logSigning).not.toHaveBeenCalled()
    // At least the page-ref pass and the final render.
    expect(toBlob.mock.calls.length).toBeGreaterThanOrEqual(2)
    const element = lastPdfElement as RenderedProps
    expect(element?.props?.labels?.identity?.coverTitle).toBe(
      messages.dashboard.payMapping.report.coverTitle
    )
    expect(element?.props?.labels?.identity?.footLabel).toBe(
      messages.dashboard.payMapping.detailAppendix.docTitle
    )
    expect(element?.props?.labels?.classification).toBe(
      messages.dashboard.payMapping.detailAppendix.classification
    )
    expect(Array.isArray(element?.props?.doc?.equalWork)).toBe(true)
    // The women-dominated block's own line carries the group's P10-P90
    // spread, not only the comparison rows'.
    const line = element?.props?.labels?.wdGroupLine?.({
      key: "Nurse|2",
      label: "Nurse",
      level: 2,
      headcount: 5,
      womenSharePct: "80%",
      meanComp: "40 000 kr",
      spread: "38 000-44 000 kr",
      masked: false,
      status: "furtherAnalysis",
      reasons: [],
      note: null,
      done: false,
      actions: [],
      comparisons: [],
    })
    expect(line).toContain("spread 38 000-44 000 kr")
  })

  it("aborts the download when the export log fails", async () => {
    logSigning.mockRejectedValueOnce(new Error("offline"))
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadSigning,
      })
    )
    await waitFor(() => expect(logSigning).toHaveBeenCalled())
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
