"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { exportFileLabel } from "@/lib/export-file-name"
import { toast } from "@/lib/toast"
import {
  metricsFileName,
  usePayMappingMetricsExport,
} from "./pay-mapping-metrics-export"
import {
  type ReportExportData,
  reportFileName,
  usePayMappingReportExport,
} from "./pay-mapping-report-export"

// The archive package (ADR-0011 p.4; kravbild docs/
// lonekartlaggning-arkivpaket-kravbild.md): one ZIP per kartläggning holding
// the statutory PDF, the key-figures workbook and a metadata manifest with
// SHA-256 checksums over the binary files (the E-ARK CSIP checksum
// convention, borrowed as verifiability, not law). The two documents are
// rendered through the SAME seams as the standalone downloads, so the
// bundled artifacts can never diverge from them.

// Bumped when data.json's shape changes, so a later reader can tell what it
// holds without guessing.
export const ARCHIVE_SCHEMA_VERSION = 1

export interface ArchiveManifestEntry {
  name: string
  bytes: number
  sha256: string
}

// manifest.json: package metadata only, ADR-0011 p.4's own wording
// ("JSON-metadata") taken literally. The register itself deliberately does
// NOT leave the system (owner decision 2026-09-01: no requirement exists,
// so no person data rides in the package; the frozen snapshot in the app
// stays the full-fidelity record, with its erasure hook). What the file
// carries is what a later reader needs: which kartläggning this is, when
// the package was produced, and SHA-256 checksums to verify the two
// documents against.
export interface ArchiveManifest {
  notice: string
  schemaVersion: number
  exportedAt: string
  run: {
    label: string
    status: ReportExportData["run"]["status"]
    referenceDate: number
    populationCount: number
  }
  files: ArchiveManifestEntry[]
}

export function assembleArchiveManifest(input: {
  run: ReportExportData["run"]
  notice: string
  exportedAt: string
  files: ArchiveManifestEntry[]
}): ArchiveManifest {
  return {
    notice: input.notice,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    run: {
      label: input.run.label,
      status: input.run.status,
      referenceDate: input.run.referenceDate,
      populationCount: input.run.populationCount,
    },
    files: input.files,
  }
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function archiveFileName(label: string): string {
  return `${exportFileLabel(label)}-arkiv.zip`
}

// The archive export, shared by the report page's panel and the runs list's
// row menu. It instantiates its own report/metrics hooks for their render
// seams; the caller must mount `captureHost` (this hook's own) so the
// bundled PDF gets the rasterized charts like the standalone one.
export function usePayMappingArchiveExport(): {
  busy: boolean
  exportArchive: (data: ReportExportData) => Promise<void>
  captureHost: ReactNode
} {
  const t = useTranslations("dashboard.payMapping.report")
  const { orgId } = useOrganization()
  const logExport = useMutation(
    api.payMapping.report.logPayMappingArchiveExport
  )
  const { renderReport, captureHost } = usePayMappingReportExport()
  const { renderWorkbookBuffer } = usePayMappingMetricsExport()
  const [busy, setBusy] = useState(false)

  async function exportArchive(data: ReportExportData): Promise<void> {
    setBusy(true)
    try {
      const pdfBuffer = await (
        await renderReport(data, "statutory")
      ).arrayBuffer()
      const workbookBuffer = await renderWorkbookBuffer({
        run: data.run,
        gap: data.gap,
      })
      const pdfName = reportFileName(data.run.label, "statutory")
      const workbookName = metricsFileName(data.run.label)
      const files: ArchiveManifestEntry[] = [
        {
          name: pdfName,
          bytes: pdfBuffer.byteLength,
          sha256: await sha256Hex(pdfBuffer),
        },
        {
          name: workbookName,
          bytes: workbookBuffer.byteLength,
          sha256: await sha256Hex(workbookBuffer),
        },
      ]
      const manifest = assembleArchiveManifest({
        run: data.run,
        notice: t("archiveNotice"),
        exportedAt: new Date().toISOString(),
        files,
      })
      // jszip rides in on demand like exceljs: the packaging engine has no
      // business in the page bundle.
      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()
      zip.file(pdfName, pdfBuffer)
      zip.file(workbookName, workbookBuffer)
      zip.file("manifest.json", JSON.stringify(manifest, null, 2))
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
      })

      // One boundary row for the whole package (the package is one
      // handling), written BEFORE the file is handed over.
      try {
        await logExport({ orgId, runId: data.run.runId })
      } catch {
        toast.error(t("logFailed"))
        return
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = archiveFileName(data.run.label)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return { busy, exportArchive, captureHost }
}
