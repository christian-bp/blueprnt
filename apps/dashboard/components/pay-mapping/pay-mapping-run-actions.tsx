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
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

// Per-row actions for the pay-mappings list (the row-actions convention: one
// trailing "..." trigger, a destructive item confirmed via an AlertDialog).
// Today that is deleting the run: a hard delete of the run, its frozen
// snapshot, and its documentation (backend: deletePayMappingRun). Any run
// status is deletable pre-launch (CLAUDE.md "No legacy before launch"); the
// confirm dialog below carries the "cannot be undone" warning instead of a
// server-side status gate.
export function PayMappingRunActions({
  orgId,
  runId,
  label,
}: {
  orgId: string
  runId: Id<"payMappingRuns">
  label: string
}) {
  const t = useTranslations("dashboard.payMapping.table")
  const tToast = useTranslations("dashboard.toast")
  const deleteRun = useMutation(api.payMapping.runs.deletePayMappingRun)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

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
              className="shrink-0 text-muted-foreground hover:text-foreground"
            />
          }
        >
          <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            {t("deleteCta")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
