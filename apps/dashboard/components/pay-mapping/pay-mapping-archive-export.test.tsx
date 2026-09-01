import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { makeGapResult, makeRunDetail } from "@/test/pay-mapping-fixtures"
import type { ReportExportData } from "./pay-mapping-report-export"

const logArchiveExport = vi.fn(async () => null)
vi.mock("convex/react", () => ({
  useMutation: () => logArchiveExport,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    payMapping: {
      report: {
        logPayMappingReportExport: "report.log",
        logPayMappingUnionReportExport: "report.logUnion",
        logPayMappingMetricsExport: "report.logMetrics",
        logPayMappingArchiveExport: "report.logArchive",
      },
    },
  },
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1" }),
}))

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// The two render seams are the other hooks' business (each has its own
// suite); here they hand over known bytes so the zip and the manifest can
// be verified against them.
const PDF_BYTES = new TextEncoder().encode("pdf-bytes").buffer as ArrayBuffer
const XLSX_BYTES = new TextEncoder().encode("xlsx-bytes").buffer as ArrayBuffer
vi.mock("./pay-mapping-report-export", async () => {
  const actual = await vi.importActual<
    typeof import("./pay-mapping-report-export")
  >("./pay-mapping-report-export")
  return {
    ...actual,
    usePayMappingReportExport: () => ({
      busy: false,
      exportReport: vi.fn(),
      renderReport: async () => new Blob([PDF_BYTES]),
      captureHost: null,
    }),
  }
})
vi.mock("./pay-mapping-metrics-export", async () => {
  const actual = await vi.importActual<
    typeof import("./pay-mapping-metrics-export")
  >("./pay-mapping-metrics-export")
  return {
    ...actual,
    usePayMappingMetricsExport: () => ({
      busy: false,
      exportMetrics: vi.fn(),
      renderWorkbookBuffer: async () => XLSX_BYTES,
    }),
  }
})

import {
  ARCHIVE_SCHEMA_VERSION,
  assembleArchiveManifest,
  usePayMappingArchiveExport,
} from "./pay-mapping-archive-export"

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function makeData(): ReportExportData {
  return {
    run: makeRunDetail({
      label: "Mapping 2026",
      status: "completed",
      rows: [
        {
          personPublicId: "p1",
          displayName: "Anna",
          erased: false,
          gender: "Kvinna",
          roleTitle: "SWE",
          trackKey: "ic",
          seniority: "Senior",
          level: 3,
          basicMonthly: 45000,
          components: [],
        },
      ],
    }),
    gap: makeGapResult({}),
    analyses: [],
    actions: [],
    notes: [],
    previous: null,
  }
}

describe("assembleArchiveManifest", () => {
  it("carries run metadata, the notice and the file manifest, and NOTHING person-level", () => {
    const files = [{ name: "a.pdf", bytes: 3, sha256: "abc" }]
    const manifest = assembleArchiveManifest({
      run: makeData().run,
      notice: "NOTICE",
      exportedAt: "2026-09-01T10:00:00.000Z",
      files,
    })
    expect(manifest.notice).toBe("NOTICE")
    expect(manifest.schemaVersion).toBe(ARCHIVE_SCHEMA_VERSION)
    expect(manifest.exportedAt).toBe("2026-09-01T10:00:00.000Z")
    expect(manifest.run).toEqual({
      label: "Mapping 2026",
      status: "completed",
      referenceDate: makeData().run.referenceDate,
      populationCount: makeData().run.populationCount,
    })
    expect(manifest.files).toEqual(files)
    // The register deliberately does not leave the system (owner decision
    // 2026-09-01): no rows, no free text, no names anywhere in the file.
    const text = JSON.stringify(manifest)
    expect(Object.keys(manifest).sort()).toEqual([
      "exportedAt",
      "files",
      "notice",
      "run",
      "schemaVersion",
    ])
    expect(text).not.toContain("Anna")
  })
})

describe("usePayMappingArchiveExport", () => {
  afterEach(() => {
    cleanup()
    logArchiveExport.mockClear()
  })

  it("keeps the archive flat when the label carries a path separator", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    )
    const { result } = renderHook(() => usePayMappingArchiveExport(), {
      wrapper,
    })

    // A fiscal-year label: ordinary input, and jszip would treat its "/" as
    // a folder boundary. The names fold it to a hyphen instead, so the
    // package keeps its documented flat three-file layout.
    const data = makeData()
    await result.current.exportArchive({
      ...data,
      run: { ...data.run, label: "2026/2027" },
    })

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    const blob = createObjectURL.mock.calls[0]?.[0]
    if (blob === undefined) throw new Error("unreachable")
    const { default: JSZip } = await import("jszip")
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual([
      "2026-2027-lonekartlaggning.pdf",
      "2026-2027-nyckeltal.xlsx",
      "manifest.json",
    ])
  })

  it("zips the three files, logs ONE boundary row before the download, and manifests real checksums", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:x")
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    )
    const { result } = renderHook(() => usePayMappingArchiveExport(), {
      wrapper,
    })

    await result.current.exportArchive(makeData())

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    // ONE row for the package, written before the handover.
    expect(logArchiveExport).toHaveBeenCalledTimes(1)
    expect(logArchiveExport).toHaveBeenCalledWith({
      orgId: "org1",
      runId: "run-1",
    })
    const logOrder = logArchiveExport.mock.invocationCallOrder[0] ?? 0
    const downloadOrder = createObjectURL.mock.invocationCallOrder[0] ?? 0
    expect(logOrder).toBeLessThan(downloadOrder)

    // Read the real zip back: the three files, the documents byte-identical
    // to what the render seams handed over, and the manifest's checksums
    // matching the actual contents.
    const blob = createObjectURL.mock.calls[0]?.[0]
    if (blob === undefined) throw new Error("unreachable")
    const { default: JSZip } = await import("jszip")
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual([
      "Mapping 2026-lonekartlaggning.pdf",
      "Mapping 2026-nyckeltal.xlsx",
      "manifest.json",
    ])
    const pdfOut = await zip
      .file("Mapping 2026-lonekartlaggning.pdf")
      ?.async("arraybuffer")
    const xlsxOut = await zip
      .file("Mapping 2026-nyckeltal.xlsx")
      ?.async("arraybuffer")
    if (pdfOut === undefined || xlsxOut === undefined)
      throw new Error("unreachable")
    expect(new Uint8Array(pdfOut)).toEqual(new Uint8Array(PDF_BYTES))
    expect(new Uint8Array(xlsxOut)).toEqual(new Uint8Array(XLSX_BYTES))

    const manifestText = await zip.file("manifest.json")?.async("string")
    if (manifestText === undefined) throw new Error("unreachable")
    const manifest = JSON.parse(manifestText)
    expect(manifest.schemaVersion).toBe(ARCHIVE_SCHEMA_VERSION)
    expect(manifest.notice).toBe(
      messages.dashboard.payMapping.report.archiveNotice
    )
    expect(manifest.files).toEqual([
      {
        name: "Mapping 2026-lonekartlaggning.pdf",
        bytes: PDF_BYTES.byteLength,
        sha256: await sha256Hex(PDF_BYTES),
      },
      {
        name: "Mapping 2026-nyckeltal.xlsx",
        bytes: XLSX_BYTES.byteLength,
        sha256: await sha256Hex(XLSX_BYTES),
      },
    ])
  })
})
