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
import { useOrganization } from "@/components/org-context"

// Per-row actions for the salary history table (the row-actions convention:
// one trailing "..." trigger, destructive item confirms via AlertDialog).
// Today that is deleting the record, the correction path for a wrong year or
// a bad import row.
export function SalaryRowActions({
  payRecordId,
  payYear,
}: {
  payRecordId: Id<"payRecords">
  payYear: number
}) {
  const t = useTranslations("dashboard.people.detail")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const deleteSalary = useMutation(api.people.pay.deleteSalary)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("salaryRowActions")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        {/* w-auto: the vendored content pins itself to the trigger's width,
            which for an icon trigger is the 128px min floor and wraps the
            item label; sizing to content keeps it on one line. */}
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            {t("deleteSalaryCta")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deleteSalaryTitle", { year: payYear })}
        description={t("deleteSalaryDescription")}
        confirmLabel={t("deleteSalaryConfirm")}
        cancelLabel={t("deleteSalaryCancel")}
        pending={pending}
        onConfirm={async () => {
          setPending(true)
          try {
            await deleteSalary({ orgId, payRecordId })
            toast.success(tToast("salaryDeleted"))
          } catch {
            toast.error(tToast("error"))
          } finally {
            setPending(false)
          }
        }}
      />
    </>
  )
}
