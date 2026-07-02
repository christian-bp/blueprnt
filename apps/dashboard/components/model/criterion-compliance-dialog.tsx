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
import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SubmitButton } from "@/components/submit-button"
import {
  type CriterionComplianceValues,
  makeCriterionComplianceSchema,
} from "@/lib/criterion-compliance-schemas"

type Row = {
  criterionId: Id<"criteria">
  name: string
  purpose: string | null
  whyRelevant: string | null
  overlapNotes: string | null
  biasRisk: "low" | "medium" | "high" | null
  biasComment: string | null
  biasAction: string | null
  status: "notStarted" | "inProgress" | "documented" | "approved"
  decidedByName: string | null
  decidedAt: number | null
}

export function CriterionComplianceDialog({
  orgId,
  target,
  onClose,
}: {
  orgId: string
  target: Row | null
  onClose: () => void
}) {
  const t = useTranslations("dashboard.model.method")
  const tHelp = useTranslations("dashboard.help")
  const tv = useTranslations("dashboard.validation")
  const format = useFormatter()
  const save = useMutation(api.evaluationModel.method.saveCriterionCompliance)
  const setApproval = useMutation(
    api.evaluationModel.method.setCriterionApproval
  )
  const [failed, setFailed] = useState(false)

  const schema = useMemo(() => makeCriterionComplianceSchema(tv), [tv])
  const form = useForm<CriterionComplianceValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      purpose: target?.purpose ?? "",
      whyRelevant: target?.whyRelevant ?? "",
      overlapNotes: target?.overlapNotes ?? "",
      biasRisk: target?.biasRisk ?? undefined,
      biasComment: target?.biasComment ?? "",
      biasAction: target?.biasAction ?? "",
    },
  })
  const { isDirty, isSubmitting } = form.formState

  async function handleValid(values: CriterionComplianceValues) {
    if (target === null) return
    setFailed(false)
    try {
      await save({ orgId, criterionId: target.criterionId, ...values })
      onClose()
    } catch {
      setFailed(true)
    }
  }

  const canApprove = target?.status === "documented"
  const isApproved = target?.status === "approved"

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            {t("dialogTitle")}
            <HelpMorphButton label={tHelp("biasReviewLabel")}>
              {tHelp("biasReviewBody")}
            </HelpMorphButton>
          </DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        {target !== null && (
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(handleValid)}
            >
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("purpose")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whyRelevant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("whyRelevant")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="overlapNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("overlapNotes")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="biasRisk"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("biasRisk")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">
                          {t("biasRiskOption.low")}
                        </SelectItem>
                        <SelectItem value="medium">
                          {t("biasRiskOption.medium")}
                        </SelectItem>
                        <SelectItem value="high">
                          {t("biasRiskOption.high")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="biasComment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("biasComment")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="biasAction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("biasAction")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {failed && (
                <p role="alert" className="text-destructive text-sm">
                  {t("error")}
                </p>
              )}
              <div className="space-y-2">
                {isApproved &&
                  target.decidedByName !== null &&
                  target.decidedAt !== null && (
                    <p className="text-muted-foreground text-sm">
                      {t("decidedBy", {
                        name: target.decidedByName,
                        date: format.dateTime(new Date(target.decidedAt), {
                          dateStyle: "medium",
                        }),
                      })}
                    </p>
                  )}
                {!isApproved && !canApprove && (
                  <p className="text-muted-foreground text-sm">
                    {t("approveHint")}
                  </p>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    {t("cancelCta")}
                  </Button>
                  {isApproved ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await setApproval({
                          orgId,
                          criterionId: target.criterionId,
                          approved: false,
                        })
                        onClose()
                      }}
                    >
                      {t("reopenCta")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={!canApprove}
                      onClick={async () => {
                        await setApproval({
                          orgId,
                          criterionId: target.criterionId,
                          approved: true,
                        })
                        onClose()
                      }}
                    >
                      {t("approveCta")}
                    </Button>
                  )}
                  <SubmitButton
                    type="submit"
                    isSubmitting={isSubmitting}
                    disabled={!isDirty}
                  >
                    {t("saveCta")}
                  </SubmitButton>
                </DialogFooter>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
