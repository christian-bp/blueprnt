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
import { SubmitButton } from "@/components/submit-button"
import {
  makeRenameConversationSchema,
  type RenameConversationValues,
} from "@/lib/assistant-schemas"
import { toast } from "@/lib/toast"

// Renames a conversation from the history panel's row menu. Controlled by
// the caller (the row owns `open`), the same shape as
// RenamePayMappingDialog/RenameFamilyDialog.
//
// A pre-filled edit form, so the save button gates on isDirty as well as
// isValid (CLAUDE.md): reopening and closing without typing must not fire a
// no-op mutation. The backend re-validates independently (trim, empty, over
// 60 chars); this is the client's gate only.
export function RenameConversationDialog({
  orgId,
  threadId,
  currentTitle,
  open,
  onOpenChange,
}: {
  orgId: string
  threadId: Id<"assistantThreads">
  currentTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("dashboard.assistant")
  const tv = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const renameConversation = useMutation(api.assistant.chat.renameConversation)

  const form = useForm<RenameConversationValues>({
    resolver: zodResolver(makeRenameConversationSchema(tv)),
    mode: "onTouched",
    defaultValues: { title: currentTitle },
  })
  // Destructured so isValid, isDirty, and isSubmitting are all READ every
  // render (RHF's formState proxy only tracks accessed fields).
  const { isValid, isDirty, isSubmitting } = form.formState

  // The row keeps this component mounted between openings, so the field has
  // to be reset to the thread's current title each time rather than keeping
  // whatever was last typed.
  useEffect(() => {
    if (open) form.reset({ title: currentTitle })
  }, [open, currentTitle, form])

  // Never rethrows: this runs as a plain <form onSubmit>, which nothing
  // awaits, so a rethrow would only surface as an unhandled rejection
  // instead of protecting anything. On failure the toast is the feedback
  // and the dialog simply stays open (onOpenChange(false) never runs).
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await renameConversation({ orgId, threadId, title: values.title })
      toast.success(tToast("conversationRenamed"))
      onOpenChange(false)
    } catch {
      toast.error(tToast("error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("renameConversation")}</DialogTitle>
          <DialogDescription>
            {t("renameConversationDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("renameConversationLabel")}</FormLabel>
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
                {t("renameConversationCancel")}
              </Button>
              <SubmitButton
                type="submit"
                disabled={!isValid || !isDirty}
                isSubmitting={isSubmitting}
              >
                {t("renameConversationSave")}
              </SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
