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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
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

// Inner component that owns the form state. Rendered with key={target.criterionId}
// so it remounts (and re-runs useForm with fresh defaultValues) each time a
// different criterion is opened, ensuring saved values are shown on reopen.
function CriterionComplianceForm({
  target,
  orgId,
  onClose,
}: {
  target: Row
  orgId: string
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
      purpose: target.purpose ?? "",
      whyRelevant: target.whyRelevant ?? "",
      overlapNotes: target.overlapNotes ?? "",
      biasRisk: target.biasRisk ?? undefined,
      biasComment: target.biasComment ?? "",
      biasAction: target.biasAction ?? "",
    },
  })
  const { isDirty, isSubmitting } = form.formState

  const locked = target.status === "approved"
  const canApprove = target.status === "documented"

  async function handleValid(values: CriterionComplianceValues) {
    setFailed(false)
    try {
      await save({ orgId, criterionId: target.criterionId, ...values })
      onClose()
    } catch {
      setFailed(true)
    }
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(handleValid)}>
        {/* Rationale section */}
        <p className="flex items-center gap-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          {t("rationaleSection")}
          <HelpMorphButton label={tHelp("criterionRationaleLabel")}>
            {tHelp("criterionRationaleBody")}
          </HelpMorphButton>
        </p>
        <FormField
          control={form.control}
          name="purpose"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("purpose")}</FormLabel>
              <FormDescription>{tHelp("methodPurposeBody")}</FormDescription>
              <FormControl>
                <Textarea {...field} disabled={locked} />
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
              <FormDescription>
                {tHelp("methodWhyRelevantBody")}
              </FormDescription>
              <FormControl>
                <Textarea {...field} disabled={locked} />
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
              <FormLabel>
                {t("overlapNotes")}
                {t("optionalSuffix")}
              </FormLabel>
              <FormDescription>{tHelp("methodOverlapBody")}</FormDescription>
              <FormControl>
                <Textarea {...field} disabled={locked} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Bias review section */}
        <p className="flex items-center gap-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          {t("biasSection")}
          <HelpMorphButton label={tHelp("biasReviewLabel")}>
            {tHelp("biasReviewBody")}
          </HelpMorphButton>
        </p>
        <FormField
          control={form.control}
          name="biasRisk"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("biasRisk")}</FormLabel>
              <FormDescription>{tHelp("methodBiasRiskBody")}</FormDescription>
              <FormControl>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  disabled={locked}
                  value={field.value ?? ""}
                  onValueChange={(v) =>
                    field.onChange(v === "" ? undefined : v)
                  }
                >
                  <ToggleGroupItem
                    value="low"
                    className="data-[state=on]:border-brand data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:hover:bg-brand"
                  >
                    {t("biasRiskOption.low")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="medium"
                    className="data-[state=on]:border-brand data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:hover:bg-brand"
                  >
                    {t("biasRiskOption.medium")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="high"
                    className="data-[state=on]:border-brand data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:hover:bg-brand"
                  >
                    {t("biasRiskOption.high")}
                  </ToggleGroupItem>
                </ToggleGroup>
              </FormControl>
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
              <FormDescription>
                {tHelp("methodBiasCommentBody")}
              </FormDescription>
              <FormControl>
                <Textarea {...field} disabled={locked} />
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
              <FormLabel>
                {t("biasAction")}
                {t("optionalSuffix")}
              </FormLabel>
              <FormDescription>{tHelp("methodBiasActionBody")}</FormDescription>
              <FormControl>
                <Textarea {...field} disabled={locked} />
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
        {locked &&
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
        {!locked && !canApprove && (
          <p className="text-muted-foreground text-sm">{t("approveHint")}</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancelCta")}
          </Button>
          {locked ? (
            // Reopen does NOT call onClose: the query updates, the derived
            // target.status becomes "documented", locked becomes false, and
            // the fields become editable in place without remounting.
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await setApproval({
                  orgId,
                  criterionId: target.criterionId,
                  approved: false,
                })
              }}
            >
              {t("reopenCta")}
            </Button>
          ) : (
            <>
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
              <SubmitButton
                type="submit"
                isSubmitting={isSubmitting}
                disabled={!isDirty}
              >
                {t("saveCta")}
              </SubmitButton>
            </>
          )}
        </DialogFooter>
      </form>
    </Form>
  )
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

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        {target !== null && (
          <CriterionComplianceForm
            key={target.criterionId}
            target={target}
            orgId={orgId}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
