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
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { SubmitButton } from "@/components/submit-button"
import { isDuplicateFamilyError } from "@/lib/family-error"
import {
  type RenameFamilyValues,
  makeRenameFamilySchema,
} from "@/lib/role-schemas"

// Rename dialog for a role family. Pre-filled with the current name and gated
// on a dirty trimmed name so an unchanged name cannot fire a no-op rename
// (which would still write an audit row). The backend is the authority for
// length and case-insensitive uniqueness; this is a client-side convenience
// gate only.
export function RenameFamilyDialog({
  open,
  onOpenChange,
  orgId,
  familyId,
  currentName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  familyId: Id<"roleFamilies">
  currentName: string
}) {
  const tFamily = useTranslations("dashboard.roles.family")
  const tErrors = useTranslations("errors")
  const tv = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const renameFamily = useMutation(api.assessment.families.renameRoleFamily)

  const schema = useMemo(() => makeRenameFamilySchema(tv), [tv])
  const form = useForm<RenameFamilyValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: currentName },
  })

  // Read formState.isSubmitting on every render so the proxy subscription
  // stays active and updates are reflected.
  const { isSubmitting } = form.formState
  // INTENTIONAL deviation from the project's standard disabled={!isValid || !isDirty}
  // gate: formState.isValid only updates after validation runs (onTouched), so it
  // lags behind a programmatic reset or a synchronous change. watch() reads RHF's
  // internal store synchronously on every render, giving accurate no-op and
  // empty-name protection without that lag. The semantic is identical: the save
  // button is disabled when the trimmed value is unchanged or blank.
  const watchedName = form.watch("name")
  const isSaveDisabled =
    watchedName.trim() === "" ||
    watchedName.trim() === currentName.trim() ||
    isSubmitting

  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)

  // Reset to the current name each time the dialog opens.
  useEffect(() => {
    if (open) {
      form.reset({ name: currentName })
      setFailure(null)
    }
  }, [open, currentName, form])

  async function handleValid(values: RenameFamilyValues) {
    setFailure(null)
    try {
      await renameFamily({
        orgId,
        familyId,
        name: values.name,
      })
      toast.success(tToast("familyRenamed"))
      onOpenChange(false)
    } catch (error: unknown) {
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tFamily("renameDialogTitle")}</DialogTitle>
          <DialogDescription>
            {tFamily("renameDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleValid)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tFamily("nameLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {failure !== null && (
              <p role="alert" className="text-destructive text-sm">
                {failure === "duplicate"
                  ? tErrors("roleFamilyExists")
                  : tFamily("error")}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {tFamily("cancel")}
              </Button>
              <SubmitButton
                type="submit"
                isSubmitting={isSubmitting}
                disabled={isSaveDisabled}
              >
                {tFamily("saveCta")}
              </SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
