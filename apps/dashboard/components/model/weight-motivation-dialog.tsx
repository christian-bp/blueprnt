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
import { HelpMorphButton } from "@/components/help-morph-button"
import { SubmitButton } from "@/components/submit-button"
import { FORM_DIALOG_CONTENT } from "@/lib/dialog-style"
import { modelErrorKey } from "@/lib/model-errors"
import { toast } from "@/lib/toast"
import {
  makeWeightMotivationSchema,
  type WeightMotivationValues,
} from "@/lib/weight-motivation-schemas"

// What the dialog is being opened ABOUT, and where the answer is stored.
//
// The two are not always the same thing, which is why they are separate fields.
// The model's two weight warnings both clear on a weightMotivation, but they ask
// about different subjects: dimensionWeightBalance asks about a DIMENSION and
// clears as soon as any criterion in it carries a motivation, while
// peopleLeadershipWeight asks about one CRITERION and clears only on that one.
// Choosing the criterion therefore belongs to the surface that offers the dialog
// (weightMotivationTarget in lib/weighting.ts for the dimension case), and the
// dialog only has to name both honestly.
export interface WeightMotivationTarget {
  // What is being motivated, as the reader sees it named on the chapter.
  subject: string
  criterionId: Id<"criteria">
  criterionName: string
  // Whether the subject IS the criterion the text lands on, so the description
  // does not name the same thing twice.
  savedOnSubject: boolean
  // What is stored today, so reopening edits rather than starting over.
  motivation: string | null
}

function WeightMotivationForm({
  orgId,
  target,
  onClose,
}: {
  orgId: string
  target: WeightMotivationTarget
  onClose: () => void
}) {
  const t = useTranslations("dashboard.model.weighting")
  const tHelp = useTranslations("dashboard.help")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const tv = useTranslations("dashboard.validation")
  const save = useMutation(
    api.evaluationModel.criteria.setCriterionWeightMotivation
  )

  const schema = useMemo(() => makeWeightMotivationSchema(tv), [tv])
  const form = useForm<WeightMotivationValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { motivation: target.motivation ?? "" },
  })
  const { isDirty, isValid, isSubmitting } = form.formState

  async function handleValid(values: WeightMotivationValues) {
    try {
      await save({
        orgId,
        criterionId: target.criterionId,
        motivation: values.motivation,
      })
      toast.success(tToast("weightMotivationSaved"))
      onClose()
    } catch (error) {
      const known = modelErrorKey(error)
      toast.error(known === undefined ? tToast("error") : tErrors(known))
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t("motivationDialogTitle", { subject: target.subject })}
        </DialogTitle>
        {/* Names the criterion the text lands on rather than storing it
            somewhere the reader cannot see: the motivation is method evidence
            and turns up in the appendix under that criterion's name. */}
        <DialogDescription>
          {target.savedOnSubject
            ? t("motivationDialogDescriptionSelf", { subject: target.subject })
            : t("motivationDialogDescription", {
                subject: target.subject,
                criterion: target.criterionName,
              })}
        </DialogDescription>
      </DialogHeader>
      {/* No panel chrome of its own: the dialog is the panel. */}
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleValid)}>
          <FormField
            control={form.control}
            name="motivation"
            render={({ field }) => (
              <FormItem>
                {/* The term's one explanation, where the term is used. Not
                    also a FormDescription: two copies of the same sentence on
                    one field is not twice the guidance. */}
                <FormLabel>
                  <span className="flex items-center gap-1.5">
                    {t("motivationLabel")}
                    <HelpMorphButton label={tHelp("weightMotivationLabel")}>
                      {tHelp("weightMotivationBody")}
                    </HelpMorphButton>
                  </span>
                </FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancelCta")}
            </Button>
            {/* A pre-filled edit form once a motivation exists, so isDirty
                joins isValid: reopening and saving unchanged would be a no-op
                the backend already refuses, and offering it reads as a change
                that did not happen. */}
            <SubmitButton
              type="submit"
              isSubmitting={isSubmitting}
              disabled={!isValid || !isDirty}
            >
              {t("motivationSaveCta")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}

// The one place a weight motivation is written. Keyed by criterion so the form
// remounts with fresh defaults whenever a different dimension's dialog opens.
export function WeightMotivationDialog({
  orgId,
  target,
  onClose,
}: {
  orgId: string
  target: WeightMotivationTarget | null
  onClose: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={FORM_DIALOG_CONTENT}>
        {target !== null && (
          <WeightMotivationForm
            key={target.criterionId}
            orgId={orgId}
            target={target}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
