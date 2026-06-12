"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import {
  CriterionForm,
  type CriterionFormValues,
} from "@/components/model/criterion-form"

export interface EditCriterionTarget extends CriterionFormValues {
  criterionId: Id<"criteria">
}

// Edit dialog for an existing criterion's texts (the "start from the
// standard model, then adapt" path). The host owns which criterion is being
// edited; null renders the dialog closed. Prefill comes from getModel, so a
// template row starts from its localized texts; saving stores them as the
// organization's own (the backend clears templateKey). Weights are never
// edited here (the editor's zero-sum flow owns them, ADR-0004).
export function EditCriterionDialog({
  orgId,
  target,
  onClose,
}: {
  orgId: string
  target: EditCriterionTarget | null
  onClose: () => void
}) {
  const tEditor = useTranslations("dashboard.model.editor")
  const updateCriterion = useMutation(
    api.evaluationModel.criteria.updateCriterion
  )

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {/* Same shell as the add dialog: tall form, scroll inside. */}
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tEditor("editDialogTitle")}</DialogTitle>
          <DialogDescription>
            {tEditor("editDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        {target !== null && (
          <CriterionForm
            // Re-seed the form whenever another criterion is opened.
            key={target.criterionId}
            initialValues={target}
            submitLabel={tEditor("editSaveCta")}
            onCancel={onClose}
            onSubmit={async (values) => {
              await updateCriterion({
                orgId,
                criterionId: target.criterionId,
                ...values,
              })
              onClose()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
