"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "@/lib/toast"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

// Unlock is explicit and audited (spec 2.4/6): behind an AlertDialog confirm
// like every other significant state change, since it reopens a revealed
// result for editing (the row/actions-menu convention). Shared by the role
// page's evaluation card menu and the rate flow's already-locked entry.
export function UnlockAssessmentDialog({
  orgId,
  roleId,
  open,
  onOpenChange,
}: {
  orgId: string
  roleId: Id<"roles">
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("dashboard.rating")
  const tToast = useTranslations("dashboard.toast")
  const unlockAssessment = useMutation(api.assessment.locking.unlockAssessment)
  const [pending, setPending] = useState(false)

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("unlockDialogTitle")}
      description={t("unlockDialogDescription")}
      confirmLabel={t("unlockConfirm")}
      cancelLabel={t("unlockCancel")}
      pending={pending}
      onConfirm={async () => {
        setPending(true)
        try {
          await unlockAssessment({ orgId, roleId })
          toast.success(tToast("assessmentUnlocked"))
        } catch (error) {
          toast.error(tToast("error"))
          throw error
        } finally {
          setPending(false)
        }
      }}
    />
  )
}
