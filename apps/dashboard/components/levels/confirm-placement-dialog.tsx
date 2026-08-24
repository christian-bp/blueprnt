"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { SubmitButton } from "@/components/submit-button"
import {
  type CalibrationNoteValues,
  makeCalibrationNoteSchema,
} from "@/lib/calibration-schemas"
import { FORM_DIALOG_CONTENT } from "@/lib/dialog-style"
import { newGestureId } from "@/lib/gesture"
import { toast } from "@/lib/toast"

// Confirming a placement: the one ACT the calibration queue offers.
//
// It records that a person looked at a placement and stands behind it, which is
// the whole of it; the note is optional and exists for the confirmation that
// needs explaining. A dialog rather than an inline button because a
// confirmation with nowhere to say why is a click people learn to make without
// reading, and this is the act that ends a review.
function ConfirmPlacementForm({
  orgId,
  roleId,
  title,
  onClose,
}: {
  orgId: string
  roleId: Id<"roles">
  title: string
  onClose: () => void
}) {
  const t = useTranslations("dashboard.levels.calibration")
  const tToast = useTranslations("dashboard.toast")
  const tv = useTranslations("dashboard.validation")
  const calibrate = useMutation(api.assessment.locking.calibrateAssessment)

  const schema = useMemo(() => makeCalibrationNoteSchema(tv), [tv])
  const form = useForm<CalibrationNoteValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { note: "" },
  })
  const { isValid, isSubmitting } = form.formState

  async function handleValid(values: CalibrationNoteValues) {
    try {
      await calibrate({
        orgId,
        gestureId: newGestureId(),
        roleId,
        ...(values.note === "" ? {} : { note: values.note }),
      })
      toast.success(tToast("placementConfirmed"))
      onClose()
    } catch {
      toast.error(tToast("error"))
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("dialogTitle", { title })}</DialogTitle>
        <DialogDescription>{t("dialogDescription")}</DialogDescription>
      </DialogHeader>
      {/* No panel chrome of its own: the dialog is the panel. */}
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleValid)}>
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("noteLabel")}</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder={t("notePlaceholder")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            {/* No isDirty gate: an empty note is a complete confirmation, so
                the submit is live from the moment the dialog opens. That is the
                same rule the create forms follow, for the same reason. */}
            <SubmitButton
              type="submit"
              isSubmitting={isSubmitting}
              disabled={!isValid}
            >
              {t("confirmSubmit")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}

export function ConfirmPlacementDialog({
  orgId,
  target,
  onOpenChange,
}: {
  orgId: string
  // The role being confirmed, or null when the dialog is closed. Keyed on the
  // role id below so reopening for another role starts from an empty note
  // instead of the previous role's.
  target: { roleId: Id<"roles">; title: string } | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className={FORM_DIALOG_CONTENT}>
        {target !== null && (
          <ConfirmPlacementForm
            key={target.roleId}
            orgId={orgId}
            roleId={target.roleId}
            title={target.title}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
