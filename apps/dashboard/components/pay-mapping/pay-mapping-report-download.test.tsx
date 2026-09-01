import { readFileSync } from "node:fs"
import { join } from "node:path"
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
import type { PayMappingGapResult } from "./pay-mapping-gap-types"
import { makeGapResult, makeRunDetail } from "@/test/pay-mapping-fixtures"

const toBlob = vi.fn(async () => new Blob(["x"], { type: "application/pdf" }))
// The last element handed to pdf(): the capture test reads the chartImages
// prop off it to assert the rasterized charts reached the template.
let lastPdfElement: unknown
vi.mock("@react-pdf/renderer", () => ({
  pdf: (element: unknown) => {
    lastPdfElement = element
    return { toBlob }
  },
  Font: { registerHyphenationCallback: () => {} },
  StyleSheet: { create: (s: unknown) => s },
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
  Image: () => null,
}))

// jsdom has no canvas, so the component's rasterization branch would never
// run in this suite; the flag lets the capture test force it while the
// other tests keep the skip path. The capture itself is stubbed (its real
// pipeline is unit-tested in lib/chart-capture.test.ts): this exercises the
// orchestration around it (host mount, per-slot selection, teardown,
// plumbing into the template).
let rasterize = false
// vi.hoisted: the factory below evaluates this binding while the component
// module imports, which is before this file's own consts initialize.
const { captureSvgToPng } = vi.hoisted(() => ({
  captureSvgToPng: vi.fn(async () => ({
    src: "data:image/png;base64,x",
    width: 640,
    height: 160,
  })),
}))
vi.mock("@/lib/chart-capture", () => ({
  canRasterizeCharts: () => rasterize,
  captureSvgToPng,
  unthrottledDelay: () => Promise.resolve(),
}))

// The capture host's chart components, stubbed to the marker the selector
// looks for (recharts' own svg class) without pulling recharts into jsdom.
vi.mock("./pay-mapping-overview", () => ({
  WholeSurveyStat: () => (
    <svg aria-hidden="true" className="recharts-surface" />
  ),
  QuartileStat: () => <svg aria-hidden="true" className="recharts-surface" />,
}))

// One mock per boundary mutation, resolved by the string refs below: the
// union test must be able to assert WHICH event the export logged.
const logExport = vi.fn(async () => null)
const logUnionExport = vi.fn(async () => null)
const logMetricsExport = vi.fn(async () => null)
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    payMapping: {
      runs: { listPayMappingRuns: "runs.list" },
      actions: { listActions: "actions.list" },
      gap: { getPayMappingGap: "gap.get" },
      report: {
        logPayMappingReportExport: "report.log",
        logPayMappingUnionReportExport: "report.logUnion",
        logPayMappingMetricsExport: "report.logMetrics",
      },
    },
  },
}))
vi.mock("convex/react", () => ({
  // listPayMappingRuns resolves to an empty org history (no previous run);
  // the previous-actions query is then skipped and must answer undefined.
  useQuery: (_query: unknown, args: unknown) =>
    args === "skip" ? undefined : [],
  useMutation: (ref: unknown) =>
    ref === "report.logUnion"
      ? logUnionExport
      : ref === "report.logMetrics"
        ? logMetricsExport
        : logExport,
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1" }),
}))

// Mutable per test: the capture test needs quartile tallies so the host
// mounts its quartile slot.
let gapOverrides: Partial<PayMappingGapResult> = {}
vi.mock("./pay-mapping-run-context", () => ({
  usePayMappingRun: () => ({
    run: makeRunDetail({
      status: "completed",
      collaboration: { participants: "Union rep", description: "Monthly" },
      frozenCriteria: [{ name: "Knowledge", weightPoints: 3 }],
    }),
    gap: makeGapResult(gapOverrides),
    analyses: [],
    actions: [],
    notes: [],
    runsList: [],
    queue: null,
    locked: true,
  }),
}))

import { PayMappingReportDownload } from "./pay-mapping-report-download"
import { CAPTURE_LIGHT_TOKENS } from "./pay-mapping-report-export"

function renderDownload() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingReportDownload />
    </NextIntlClientProvider>
  )
}

describe("PayMappingReportDownload", () => {
  afterEach(() => {
    cleanup()
    toBlob.mockClear()
    logExport.mockClear()
    logUnionExport.mockClear()
    logMetricsExport.mockClear()
    captureSvgToPng.mockClear()
    rasterize = false
    gapOverrides = {}
    lastPdfElement = undefined
  })

  it("renders the report as two-pass PDF, logs the export, then downloads", async () => {
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadReport,
      })
    )
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    // Two passes: page-ref capture, then the final document.
    expect(toBlob).toHaveBeenCalledTimes(2)
    expect(logExport).toHaveBeenCalledWith({ orgId: "org1", runId: "run-1" })
    // The export-boundary audit row is written BEFORE the file is handed
    // over (ADR-0011 p.3): a download the trail missed must not happen.
    const logOrder = logExport.mock.invocationCallOrder[0] ?? 0
    const downloadOrder = createObjectURL.mock.invocationCallOrder[0] ?? 0
    expect(logOrder).toBeLessThan(downloadOrder)
  })

  it("exports the union variant with its own boundary event, doc transform and cover", async () => {
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadUnion,
      })
    )
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    // The union export writes the UNION boundary event, never the
    // statutory one: the trail must say which document left.
    expect(logUnionExport).toHaveBeenCalledWith({
      orgId: "org1",
      runId: "run-1",
    })
    expect(logExport).not.toHaveBeenCalled()
    // The template renders the union variant of the transformed doc: the
    // internal notes are gone at the data level and the cover carries the
    // union identity and purpose.
    const element = lastPdfElement as {
      props?: {
        variant?: string
        doc?: { notes: unknown[] }
        labels?: { docTitle?: string; coverPurpose?: string }
      }
    }
    expect(element?.props?.variant).toBe("union")
    expect(element?.props?.doc?.notes).toEqual([])
    expect(element?.props?.labels?.docTitle).toBe(
      messages.dashboard.payMapping.report.unionTitle
    )
    expect(element?.props?.labels?.coverPurpose).toContain("21, 22 and 56")
  })

  it("rasterizes the app charts off-screen and hands them to the template", async () => {
    rasterize = true
    gapOverrides = {
      quartiles: [
        { women: 2, men: 1 },
        { women: 1, men: 2 },
        { women: 1, men: 1 },
        { women: 0, men: 2 },
      ],
    }
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadReport,
      })
    )
    // The settle wait is real time, so this export takes over half a second.
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled(), {
      timeout: 5000,
    })
    // One capture per mounted slot (population and quartiles).
    expect(captureSvgToPng).toHaveBeenCalledTimes(2)
    const element = lastPdfElement as {
      props?: { chartImages?: Record<string, unknown> }
    }
    expect(element?.props?.chartImages).toEqual({
      population: { src: "data:image/png;base64,x", width: 640, height: 160 },
      quartiles: { src: "data:image/png;base64,x", width: 640, height: 160 },
    })
    // The off-screen host is gone again after the export.
    expect(document.querySelector("[data-chart]")).toBeNull()
  })

  it("pins the capture host's neutral tokens to the light theme's values", () => {
    // The host's oklch literals are copies of globals.css's :root values; a
    // neutral-scale retune must reach both, so this reads the stylesheet
    // the same way gender-mark.test.tsx guards the gender tokens.
    const css = readFileSync(
      join(process.cwd(), "../../packages/ui/src/styles/globals.css"),
      "utf8"
    )
    // Anchored to line starts: ".dark" also occurs earlier in the file
    // (the Tailwind custom-variant line), which would end the slice before
    // it begins.
    const root = css.slice(css.indexOf("\n:root"), css.indexOf("\n.dark"))
    for (const [token, value] of Object.entries(CAPTURE_LIGHT_TOKENS)) {
      if (typeof value !== "string" || !value.startsWith("oklch")) continue
      expect(root, `${token} drifted from globals.css`).toContain(
        `${token}: ${value};`
      )
    }
  })

  it("aborts the download when the export log fails", async () => {
    logExport.mockRejectedValueOnce(new Error("offline"))
    const createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    renderDownload()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.report.downloadReport,
      })
    )
    await waitFor(() => expect(logExport).toHaveBeenCalled())
    await waitFor(() => expect(toBlob).toHaveBeenCalledTimes(2))
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
