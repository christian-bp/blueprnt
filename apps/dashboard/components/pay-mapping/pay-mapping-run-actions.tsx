"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import { useConvex, useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "@/lib/toast"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { RenamePayMappingDialog } from "@/components/pay-mapping/rename-pay-mapping-dialog"
import { usePayMappingMetricsExport } from "./pay-mapping-metrics-export"
import { usePayMappingReportExport } from "./pay-mapping-report-export"

// Per-row actions for the pay-mappings list (the row-actions convention: one
// trailing "..." trigger, a destructive item confirmed via an AlertDialog).
// Downloading the statutory PDF (the run page's export, reachable from the
// list: the data is fetched one-shot on click, never subscribed per row),
// renaming (any status: the label is the document's title, not part of the
// frozen evidence) and deleting: a hard delete of the run, its frozen
// snapshot, and its documentation (backend: deletePayMappingRun). Any run
// status is deletable pre-launch (CLAUDE.md "No legacy before launch"); the
// confirm dialog below carries the "cannot be undone" warning instead of a
// server-side status gate.
export function PayMappingRunActions({
  orgId,
  runId,
  slug,
  label,
}: {
  orgId: string
  runId: Id<"payMappingRuns">
  slug: string
  label: string
}) {
  const t = useTranslations("dashboard.payMapping.table")
  const tReport = useTranslations("dashboard.payMapping.report")
  const tToast = useTranslations("dashboard.toast")
  const convex = useConvex()
  const deleteRun = useMutation(api.payMapping.runs.deletePayMappingRun)
  const {
    busy: reportBusy,
    exportReport,
    captureHost,
  } = usePayMappingReportExport()
  const { busy: metricsBusy, exportMetrics } = usePayMappingMetricsExport()
  const busy = reportBusy || metricsBusy
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [pending, setPending] = useState(false)

  // The same export the report page runs, fed by one-shot queries instead
  // of the run workspace's subscriptions: the menu is closed by the time
  // the work runs, so the row's trigger carries the busy spinner.
  async function onDownload() {
    try {
      const run = await convex.query(
        api.payMapping.runs.getPayMappingRunBySlug,
        {
          orgId,
          slug,
        }
      )
      const [gap, analyses, actions, notes, runsList] = await Promise.all([
        convex.query(api.payMapping.gap.getPayMappingGap, { orgId, runId }),
        convex.query(api.payMapping.analyses.listGroupAnalyses, {
          orgId,
          runId,
        }),
        convex.query(api.payMapping.actions.listActions, { orgId, runId }),
        convex.query(api.payMapping.notes.listNotes, { orgId, runId }),
        convex.query(api.payMapping.runs.listPayMappingRuns, { orgId }),
      ])
      if (run === null || gap === null) {
        toast.error(tToast("error"))
        return
      }
      const previousRun =
        runsList
          .filter(
            (candidate) =>
              candidate.status === "completed" &&
              candidate.referenceDate < run.referenceDate
          )
          .sort((a, b) => b.referenceDate - a.referenceDate)[0] ?? null
      const previous =
        previousRun === null
          ? null
          : {
              runLabel: previousRun.label,
              referenceDate: previousRun.referenceDate,
              actions: await convex.query(api.payMapping.actions.listActions, {
                orgId,
                runId: previousRun.runId,
              }),
              gap: await convex.query(api.payMapping.gap.getPayMappingGap, {
                orgId,
                runId: previousRun.runId,
              }),
            }
      await exportReport({ run, gap, analyses, actions, notes, previous })
    } catch {
      toast.error(tToast("error"))
    }
  }

  // The key-figures export needs only the frozen run and its gap aggregate.
  async function onDownloadMetrics() {
    try {
      const run = await convex.query(
        api.payMapping.runs.getPayMappingRunBySlug,
        { orgId, slug }
      )
      const gap = await convex.query(api.payMapping.gap.getPayMappingGap, {
        orgId,
        runId,
      })
      if (run === null || gap === null) {
        toast.error(tToast("error"))
        return
      }
      await exportMetrics({ run, gap })
    } catch {
      toast.error(tToast("error"))
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("rowActionsLabel", { label })}
              disabled={busy}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            />
          }
        >
          {busy ? (
            <Spinner />
          ) : (
            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDownload}>
            {tReport("downloadReport")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDownloadMetrics}>
            {tReport("downloadMetrics")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            {t("renameCta")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            {t("deleteCta")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {captureHost}

      <RenamePayMappingDialog
        orgId={orgId}
        runId={runId}
        label={label}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deleteDialogTitle", { label })}
        description={t("deleteDialogDescription")}
        confirmLabel={t("deleteConfirm")}
        cancelLabel={t("deleteCancel")}
        pending={pending}
        onConfirm={async () => {
          setPending(true)
          try {
            await deleteRun({ orgId, runId })
            toast.success(tToast("payMappingDeleted"))
          } catch (error) {
            toast.error(tToast("error"))
            throw error
          } finally {
            setPending(false)
          }
        }}
      />
    </>
  )
}
