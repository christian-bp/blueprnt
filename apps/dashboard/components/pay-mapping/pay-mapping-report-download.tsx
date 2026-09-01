"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { usePayMappingMetricsExport } from "./pay-mapping-metrics-export"
import {
  MetricsDocumentPanel,
  MetricsDownloadButton,
  ReportDocumentPanel,
  ReportDownloadButton,
  ReportsFrame,
} from "./pay-mapping-report"
import { usePayMappingReportExport } from "./pay-mapping-report-export"
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

  async function onExport() {
    if (
      run === undefined ||
      gap === undefined ||
      analyses === undefined ||
      actions === undefined ||
      notes === undefined ||
      previousRun === undefined
    ) {
      return
    }
    await exportReport({
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
    })
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
              busy={busy}
              disabled={!ready}
              onClick={onExport}
            />
          }
        />
        <MetricsDocumentPanel
          action={
            <MetricsDownloadButton
              busy={metricsBusy}
              disabled={run === undefined || gap === undefined}
              onClick={() => {
                if (run !== undefined && gap !== undefined) {
                  void exportMetrics({ run, gap })
                }
              }}
            />
          }
        />
      </ReportsFrame>
      {captureHost}
    </>
  )
}
