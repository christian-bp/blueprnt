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
import { Input } from "@workspace/ui/components/input"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "@/lib/toast"
import { SubmitButton } from "@/components/submit-button"
import {
  makeRunLabelSchema,
  type RunLabelValues,
} from "@/lib/pay-mapping-schemas"

// Renames a pay mapping from the list's row actions. Controlled by the caller
// so the row's dropdown owns the open state.
//
// A pre-filled edit form, so the save button gates on isDirty as well as
// isValid (CLAUDE.md): reopening and closing without typing must not fire a
// mutation, which would otherwise write an audit row for a no-op. The backend
// short-circuits an unchanged label too, but the gate keeps the round trip
// from happening at all.
export function RenamePayMappingDialog({
  orgId,
  runId,
  label,
  open,
  onOpenChange,
}: {
  orgId: string
  runId: Id<"payMappingRuns">
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("dashboard.payMapping.table")
  const tv = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const renameRun = useMutation(api.payMapping.runs.renamePayMappingRun)

  const form = useForm<RunLabelValues>({
    resolver: zodResolver(makeRunLabelSchema(tv)),
    mode: "onTouched",
    defaultValues: { label },
  })
  // Destructured once, never read inline in JSX: RHF's formState is a proxy
  // that only tracks the fields actually accessed, and a short-circuited
  // inline read can skip a field on the renders that matter, leaving the
  // save button's disabled state stale.
  const { isValid, isDirty, isSubmitting } = form.formState

  // The row keeps this component mounted between openings, so the field has to
  // be reset to the run's current name each time rather than keeping whatever
  // was last typed (or a name that has since changed elsewhere).
  useEffect(() => {
    if (open) form.reset({ label })
  }, [open, label, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await renameRun({ orgId, runId, label: values.label })
      toast.success(tToast("payMappingRenamed"))
      onOpenChange(false)
    } catch {
      toast.error(tToast("error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("renameDialogTitle")}</DialogTitle>
          <DialogDescription>{t("renameDialogDescription")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("renameNameLabel")}</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("renameCancel")}
              </Button>
              <SubmitButton
                disabled={!(isValid && isDirty)}
                isSubmitting={isSubmitting}
              >
                {t("renameSave")}
              </SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
