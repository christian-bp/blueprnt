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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import { toast } from "@/lib/toast"
import type { ValidationT } from "@/lib/validation"
import type {
  ActionTargetWire,
  NoteType,
  PayMappingNoteWire,
} from "./pay-mapping-gap-types"

const NOTE_TYPES: NoteType[] = [
  "objectiveReason",
  "discussionNeeded",
  "noActionNeeded",
]

function makeNoteSchema(t: ValidationT) {
  return z.object({
    text: z.string().trim().min(1, t("required")),
    noteType: z.enum(["objectiveReason", "discussionNeeded", "noActionNeeded"]),
  })
}

export type NoteFormValues = z.infer<ReturnType<typeof makeNoteSchema>>

interface NoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runId: Id<"payMappingRuns">
  target: ActionTargetWire
  targetLabel: string
  note?: PayMappingNoteWire
}

// The notering form (Iteration 2 note 5): informal context that is NOT a
// formal action, so it carries no owner, date, or cost. Same dialog anatomy,
// target-prefill contract, and mount-per-open form as ActionDialog (see its
// note on why this is keyed rather than reset in an effect).
export function NoteDialog(props: NoteDialogProps) {
  const { open, onOpenChange, note } = props
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <NoteDialogForm key={note?.noteId ?? "new"} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function NoteDialogForm({
  onOpenChange,
  runId,
  target,
  targetLabel,
  note,
}: NoteDialogProps) {
  const t = useTranslations("dashboard.payMapping.actions")
  const tValidation = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const createNote = useMutation(api.payMapping.notes.createNote)
  const updateNote = useMutation(api.payMapping.notes.updateNote)

  const schema = useMemo(() => makeNoteSchema(tValidation), [tValidation])
  const defaults: NoteFormValues = useMemo(
    () => ({
      text: note?.text ?? "",
      noteType: note?.noteType ?? "discussionNeeded",
    }),
    [note]
  )
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: defaults,
  })

  async function onSubmit(values: NoteFormValues) {
    try {
      if (note === undefined) {
        await createNote({
          orgId,
          runId,
          target,
          text: values.text.trim(),
          noteType: values.noteType,
        })
        toast.success(tToast("payMappingNoteCreated"))
      } else {
        await updateNote({
          orgId,
          noteId: note.noteId,
          text: values.text.trim(),
          noteType: values.noteType,
        })
        toast.success(tToast("payMappingNoteUpdated"))
      }
      onOpenChange(false)
    } catch {
      toast.error(tToast("error"))
    }
  }

  const isEdit = note !== undefined

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? t("editNoteTitle") : t("createNoteTitle")}
        </DialogTitle>
        <DialogDescription>
          {t("linkedTo", { target: targetLabel })}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("noteText")}</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="noteType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("noteTypeLabel")}</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={Object.fromEntries(
                    NOTE_TYPES.map((n) => [n, t(`noteType.${n}`)])
                  )}
                >
                  <FormControl>
                    <SelectTrigger
                      aria-label={t("noteTypeLabel")}
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {NOTE_TYPES.map((n) => (
                      <SelectItem key={n} value={n}>
                        {t(`noteType.${n}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {t("cancel")}
            </Button>
            <SubmitButton
              type="submit"
              isSubmitting={form.formState.isSubmitting}
              disabled={
                !form.formState.isValid ||
                form.formState.isSubmitting ||
                (isEdit && !form.formState.isDirty)
              }
            >
              {t("save")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
