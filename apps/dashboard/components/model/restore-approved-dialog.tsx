"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMutation, useQuery } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { ChangeEntryRow } from "@/components/audit/change-entry-row"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { resolveCodedValue } from "@/lib/audit-constants"
import { changeEntries, orderEntries } from "@/lib/audit-detail"
import { methodErrorMessage } from "@/lib/method-error"
import { toast } from "@/lib/toast"

// The restore confirm (ADR-0023 decision 11). Honesty both ways: the dialog
// does not ask the user to trust the word "restore", it lists every change the
// restore will undo, computed by the SAME diff builder that writes the
// model.restored audit payload, so the preview and the trail can never
// disagree about what happened.
//
// The change rows render through the audit log's own formatting language
// (changeEntries + ChangeEntryRow, and the audit log's field and coded-value
// labels), because this IS the same diff the log will show: labeled rows with
// before-to-after arrows, never a raw payload key.
//
// A criterion the restore adds or removes shows its consequence as a sentence
// rather than a "Selected: Yes to No" row: the sentence is what actually needs
// saying (its ratings go with it, or every role has to be evaluated on it
// again), and the row would state the same fact twice.
export function RestoreApprovedDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("dashboard.model.method")
  const tAudit = useTranslations("dashboard.auditLog")
  const tDashboard = useTranslations("dashboard")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const format = useFormatter()
  const locale = useLocale()
  const [pending, setPending] = useState(false)

  // Only while the dialog is open: the change list costs a read per criterion
  // the restore would remove (its ratings), which the chapter should not pay
  // for a dialog nobody opened. The criteria are named in the VIEWER's own
  // display language, not the org's default.
  const preview = useQuery(
    api.evaluationModel.approval.getModelRestorePreview,
    open ? { orgId, locale } : "skip"
  )
  const restore = useMutation(api.evaluationModel.approval.restoreApprovedModel)

  function fieldLabel(field: string): string {
    const key = `fields.${field}` as Parameters<typeof tAudit.has>[0]
    return tAudit.has(key) ? tAudit(key) : field
  }

  function boolLabel(value: boolean): string {
    return tAudit(value ? "values.yes" : "values.no")
  }

  // The same coded-value resolution the audit log uses, so a bias risk or a
  // materiality status reads as its label here and in the trail alike.
  function valueLabel(field: string, value: string): string | undefined {
    return resolveCodedValue(field, value, (key) =>
      tDashboard.has(key as Parameters<typeof tDashboard.has>[0])
        ? tDashboard(key as Parameters<typeof tDashboard>[0])
        : undefined
    )
  }

  function rows(changes: Record<string, { from: unknown; to: unknown }>) {
    return orderEntries(
      changeEntries(changes, fieldLabel, undefined, boolLabel, valueLabel)
    )
  }

  const approvedDate =
    preview?.approvedAt != null
      ? format.dateTime(new Date(preview.approvedAt), { dateStyle: "medium" })
      : ""
  const modelRows = preview ? rows(preview.diff.changes) : []
  const hasChanges =
    preview !== undefined &&
    preview !== null &&
    (preview.diff.criteria.length > 0 || modelRows.length > 0)

  async function onConfirm() {
    setPending(true)
    try {
      await restore({ orgId })
      toast.success(tToast("modelRestored"))
    } catch (error) {
      toast.error(methodErrorMessage(error, tErrors, tToast("error")))
      // Rethrown so the dialog stays open for a retry (ConfirmDeleteDialog
      // closes only on a resolved confirm).
      throw error
    } finally {
      setPending(false)
    }
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("restoreDialogTitle")}
      description={t("restoreDialogDescription", { date: approvedDate })}
      confirmLabel={t("restoreConfirmCta")}
      cancelLabel={t("cancelCta")}
      onConfirm={onConfirm}
      pending={pending}
      // Never confirmable before the change list has been shown, or when there
      // is nothing to undo.
      confirmDisabled={!hasChanges}
    >
      {/* Scrolls on its own so a long change list never grows the dialog past
          the viewport; the header and the footer actions stay in place. */}
      <div className="max-h-[45vh] space-y-4 overflow-y-auto">
        {preview === undefined ? (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border">
            {[0, 1, 2].map((row) => (
              <li key={row} className="space-y-1.5 px-3 py-2.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-48 max-w-full" />
              </li>
            ))}
          </ul>
        ) : preview === null || !hasChanges ? (
          <p className="text-muted-foreground text-sm">
            {t("restoreNoChanges")}
          </p>
        ) : (
          <>
            {preview.diff.criteria.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-medium text-sm">
                  {t("restoreCriteriaHeading")}
                </h3>
                <ul className="space-y-3">
                  {preview.diff.criteria.map((criterion) => (
                    <li key={criterion.libraryKey} className="space-y-1.5">
                      <div className="font-medium text-sm">
                        {criterion.name}
                      </div>
                      {criterion.kind === "changed" ? (
                        <ul className="divide-y divide-border overflow-hidden rounded-lg border">
                          {rows(criterion.changes).map((entry) => (
                            <ChangeEntryRow
                              key={entry.field}
                              entry={entry}
                              emptyLabel={tAudit("detail.emptyValue")}
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          {criterion.kind === "restored"
                            ? t("restoreCriterionReturns")
                            : criterion.changes.deletedRatingCount === undefined
                              ? t("restoreCriterionRemoved")
                              : t("restoreCriterionRemovedWithRatings", {
                                  count: Number(
                                    criterion.changes.deletedRatingCount.to ?? 0
                                  ),
                                })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {modelRows.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-medium text-sm">
                  {t("restoreModelHeading")}
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border">
                  {modelRows.map((entry) => (
                    <ChangeEntryRow
                      key={entry.field}
                      entry={entry}
                      emptyLabel={tAudit("detail.emptyValue")}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </ConfirmDeleteDialog>
  )
}
