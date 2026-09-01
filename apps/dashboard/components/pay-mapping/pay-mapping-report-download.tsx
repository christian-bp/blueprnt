"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import { usePayMappingArchiveExport } from "./pay-mapping-archive-export"
import { usePayMappingMetricsExport } from "./pay-mapping-metrics-export"
import {
  ArchiveDocumentPanel,
  ArchiveDownloadButton,
  MetricsDocumentPanel,
  MetricsDownloadButton,
  ReportDocumentPanel,
  ReportDownloadButton,
  ReportsFrame,
  UnionDocumentPanel,
  UnionDownloadButton,
} from "./pay-mapping-report"
import type { ReportVariant } from "./pay-mapping-report-doc"
import {
  type ReportExportData,
  usePayMappingReportExport,
} from "./pay-mapping-report-export"
import { usePayMappingRun } from "./pay-mapping-run-context"

// The report page's export frame: gathers the run context and the
// previous-run subscriptions, and hands them to the shared export hook
// (pay-mapping-report-export.tsx, also behind the runs list's row menu).
// The frame is the documents' surface: a panel per downloadable document,
// each with its identity on the left and its export on the right, and the
// run's draft status in the frame header.
export function PayMappingReportDownload() {
  const t = useTranslations("dashboard.payMapping.report")
  const { orgId } = useOrganization()
  const { run, gap, analyses, actions, notes } = usePayMappingRun()
  // The org's runs with their ids: the evaluation section reads the most
  // recent EARLIER completed run's actions (with their live statuses). The
  // shell subscribes to the same query, so this adds no server work.
  const runsList = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  const previousRun =
    run === undefined || runsList === undefined
      ? undefined
      : (runsList
          .filter(
            (candidate) =>
              candidate.status === "completed" &&
              candidate.referenceDate < run.referenceDate
          )
          .sort((a, b) => b.referenceDate - a.referenceDate)[0] ?? null)
  const previousActions = useQuery(
    api.payMapping.actions.listActions,
    previousRun === undefined || previousRun === null
      ? "skip"
      : { orgId, runId: previousRun.runId }
  )
  // The previous run's gap aggregate feeds the year-over-year figures (org
  // line + per-group previous gap), the published-document convention.
  const previousGap = useQuery(
    api.payMapping.gap.getPayMappingGap,
    previousRun === undefined || previousRun === null
      ? "skip"
      : { orgId, runId: previousRun.runId }
  )
  const { busy, exportReport, captureHost } = usePayMappingReportExport()
  const { busy: metricsBusy, exportMetrics } = usePayMappingMetricsExport()
  const {
    busy: archiveBusy,
    exportArchive,
    captureHost: archiveCaptureHost,
  } = usePayMappingArchiveExport()

  const ready =
    run !== undefined &&
    gap !== undefined &&
    analyses !== undefined &&
    actions !== undefined &&
    notes !== undefined &&
    previousRun !== undefined &&
    (previousRun === null ||
      (previousActions !== undefined && previousGap !== undefined))

  const final = run !== undefined && run.status === "completed"
  // Which PDF variant is mid-export: the hook's busy covers both, so the
  // spinner needs its own record of whose button was pressed.
  const [activeVariant, setActiveVariant] = useState<ReportVariant | null>(null)
  // One export at a time: the renders are heavy and each button shows its
  // own spinner, so every other action waits.
  const anyBusy = busy || metricsBusy || archiveBusy

  function collectExportData(): ReportExportData | null {
    if (
      run === undefined ||
      gap === undefined ||
      analyses === undefined ||
      actions === undefined ||
      notes === undefined ||
      previousRun === undefined
    ) {
      return null
    }
    return {
      run,
      gap,
      analyses,
      actions,
      notes,
      previous:
        previousRun === null
          ? null
          : {
              runLabel: previousRun.label,
              referenceDate: previousRun.referenceDate,
              actions: previousActions ?? [],
              gap: previousGap ?? null,
            },
    }
  }

  async function onExport(variant: ReportVariant) {
    const data = collectExportData()
    if (data === null) return
    setActiveVariant(variant)
    try {
      await exportReport(data, variant)
    } finally {
      setActiveVariant(null)
    }
  }

  async function onExportArchive() {
    const data = collectExportData()
    if (data === null) return
    await exportArchive(data)
  }

  return (
    <>
      {/* The DRAFT caveat is the frame's only status word, worn as the
          header's chip (the runs list's status-badge convention). */}
      <ReportsFrame
        status={
          run !== undefined && !final ? (
            <Badge variant="outline">{t("cardDraft")}</Badge>
          ) : undefined
        }
      >
        <ReportDocumentPanel
          action={
            <ReportDownloadButton
              busy={busy && activeVariant === "statutory"}
              disabled={!ready || anyBusy}
              onClick={() => void onExport("statutory")}
            />
          }
        />
        <UnionDocumentPanel
          action={
            <UnionDownloadButton
              busy={busy && activeVariant === "union"}
              disabled={!ready || anyBusy}
              onClick={() => void onExport("union")}
            />
          }
        />
        <MetricsDocumentPanel
          action={
            <MetricsDownloadButton
              busy={metricsBusy}
              disabled={run === undefined || gap === undefined || anyBusy}
              onClick={() => {
                if (run !== undefined && gap !== undefined) {
                  void exportMetrics({ run, gap })
                }
              }}
            />
          }
        />
        <ArchiveDocumentPanel
          action={
            <ArchiveDownloadButton
              busy={archiveBusy}
              disabled={!ready || anyBusy}
              onClick={() => void onExportArchive()}
            />
          }
        />
      </ReportsFrame>
      {captureHost}
      {archiveCaptureHost}
    </>
  )
}
