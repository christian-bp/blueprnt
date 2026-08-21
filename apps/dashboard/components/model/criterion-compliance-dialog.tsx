"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AiEditingIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Textarea } from "@workspace/ui/components/textarea"
import { useAction, useMutation } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { toast } from "@/lib/toast"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { Spinner } from "@workspace/ui/components/spinner"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SubmitButton } from "@/components/submit-button"
import { FORM_DIALOG_CONTENT } from "@/lib/dialog-style"
import {
  type CriterionComplianceValues,
  makeCriterionComplianceSchema,
} from "@/lib/criterion-compliance-schemas"

type Row = {
  criterionId: Id<"criteria">
  name: string
  // The library's full definition of the criterion: what it covers and what it
  // does not. The chapter's cards carry the one-liner, so this is where the
  // long text lives, beside the fields it is the reference for.
  description: string
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
  const tAi = useTranslations("dashboard.ai")
  const tToast = useTranslations("dashboard.toast")
  const tv = useTranslations("dashboard.validation")
  const format = useFormatter()
  const locale = useLocale()
  const save = useMutation(api.evaluationModel.method.saveCriterionCompliance)
  const setApproval = useMutation(
    api.evaluationModel.method.setCriterionApproval
  )
  const draftCompliance = useAction(api.ai.draft.draftCriterionCompliance)
  const [failed, setFailed] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [aiDrafted, setAiDrafted] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [aiAcknowledged, setAiAcknowledged] = useState(false)
  // The sign-off, as a field of this form rather than an act of its own. It
  // opens on the criterion's stored answer, so a dialog reopened on an
  // approved criterion shows it checked.
  const wasApproved = target.status === "approved"
  const [approved, setApproved] = useState(wasApproved)

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
  const values = form.watch()

  // A standing sign-off locks the text: an approved criterion's documentation
  // is evidence, and the backend refuses to write over it
  // (saveCriterionCompliance throws criterionLocked). Clearing the checkbox
  // lifts the lock HERE, before anything is saved, so a correction is one act
  // (uncheck, edit, save) instead of a separate reopen trip.
  //
  // Re-checking it mid-edit locks the edited text again, and that is the
  // intended reading rather than a state to escape: declaring the
  // documentation approved freezes what you are declaring, exactly as it does
  // on a criterion that was already signed off. The edit is not lost (it is in
  // the form, and the save carries it), and clearing the box hands it back.
  const locked = wasApproved && approved

  // Whether the documentation is complete as it stands in the FORM, which is
  // what the sign-off needs: the two are saved in one act, so gating on the
  // stored status would refuse a criterion the reader has just finished
  // filling in. The rule mirrors the backend's isDocumented
  // (evaluationModel/method.ts), which stays the authority and re-validates.
  const filled = (value: string | undefined) => (value?.trim().length ?? 0) > 0
  const documented =
    filled(values.purpose) &&
    filled(values.whyRelevant) &&
    values.biasRisk !== undefined &&
    filled(values.biasComment)
  // Nothing to post: the text is untouched and the sign-off stands where it
  // stood.
  const unchanged = !isDirty && approved === wasApproved

  async function onDraft() {
    setDrafting(true)
    setDraftError(null)
    try {
      const values = await draftCompliance({
        orgId,
        criterionId: target.criterionId,
        locale,
      })
      form.setValue("purpose", values.purpose, { shouldDirty: true })
      form.setValue("whyRelevant", values.whyRelevant, { shouldDirty: true })
      form.setValue("overlapNotes", values.overlapNotes, { shouldDirty: true })
      form.setValue("biasRisk", values.biasRisk, { shouldDirty: true })
      form.setValue("biasComment", values.biasComment, { shouldDirty: true })
      form.setValue("biasAction", values.biasAction, { shouldDirty: true })
      setAiDrafted(true)
    } catch {
      setDraftError(t("draftError"))
    } finally {
      setDrafting(false)
    }
  }

  // One act, up to three calls, in the order the backend's own guards demand:
  // a standing approval is lifted BEFORE the text is written (it refuses a
  // write while approved) and a new one is set AFTER (it refuses an approval
  // the stored row does not yet support). The remove-offer on the
  // working-conditions decision sequences its two mutations the same way.
  //
  // Each call is skipped when it would change nothing. The backend owns that
  // rule now (both mutations short-circuit an unchanged submission, like their
  // siblings), so these skips are a round trip saved rather than the thing
  // keeping the log clean.
  async function handleValid(formValues: CriterionComplianceValues) {
    setFailed(false)
    try {
      if (wasApproved && (!approved || isDirty)) {
        await setApproval({
          orgId,
          criterionId: target.criterionId,
          approved: false,
        })
      }
      if (isDirty) {
        await save({ orgId, criterionId: target.criterionId, ...formValues })
      }
      if (approved && (!wasApproved || isDirty)) {
        await setApproval({
          orgId,
          criterionId: target.criterionId,
          approved: true,
        })
      }
      // What actually happened, in the reader's terms: the sign-off is the
      // headline whenever it moved, and the text is the headline otherwise.
      toast.success(
        tToast(
          approved !== wasApproved
            ? approved
              ? "criterionApproved"
              : "criterionReopened"
            : "complianceSaved"
        )
      )
      onClose()
    } catch {
      setFailed(true)
    }
  }

  return (
    <>
      <DialogHeader>
        {/* pr-8 keeps the AI button clear of the dialog's absolutely-positioned
            close (X) button, which sits at top-4 right-4 (size-8). */}
        <div className="flex items-center justify-between gap-2 pr-8">
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          {!locked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={drafting}
              onClick={onDraft}
            >
              {drafting ? (
                <Spinner />
              ) : (
                <HugeiconsIcon
                  icon={AiEditingIcon}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              )}
              {drafting ? tAi("generating") : tAi("fillCta")}
            </Button>
          )}
        </div>
        <DialogDescription>{t("dialogDescription")}</DialogDescription>
      </DialogHeader>
      {/* WHICH criterion this is, and the library's own definition of it. The
          chapter's cards are compact (a name, a one-liner, a status and this
          action), so the long definition lives where the documentation is
          actually written, beside the fields it is the reference for. The same
          Item the library picker presents a criterion in, so a criterion and
          its definition read the same wherever the two appear together. */}
      <Item variant="muted">
        <ItemContent>
          <ItemTitle className="line-clamp-none">{target.name}</ItemTitle>
          <ItemDescription className="line-clamp-none">
            {target.description}
          </ItemDescription>
        </ItemContent>
      </Item>
      {draftError !== null && (
        <p role="alert" className="text-destructive text-sm">
          {draftError}
        </p>
      )}
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
                  {/* One span keeps the label a single flex item so the muted
                      suffix sits inline, not gap-2 separated from the name. */}
                  <span>
                    {t("overlapNotes")}
                    <span className="font-normal text-muted-foreground">
                      {t("optionalSuffix")}
                    </span>
                  </span>
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
                    variant="outline"
                    disabled={locked}
                    // Single-select is the Base UI default; the group value is
                    // an array holding the pressed value (empty when cleared).
                    value={field.value ? [field.value] : []}
                    onValueChange={(groupValue) =>
                      field.onChange(groupValue[0])
                    }
                  >
                    <ToggleGroupItem
                      value="low"
                      className="data-pressed:border-brand data-pressed:bg-brand data-pressed:text-brand-foreground data-pressed:hover:bg-brand"
                    >
                      {t("biasRiskOption.low")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="medium"
                      className="data-pressed:border-brand data-pressed:bg-brand data-pressed:text-brand-foreground data-pressed:hover:bg-brand"
                    >
                      {t("biasRiskOption.medium")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="high"
                      className="data-pressed:border-brand data-pressed:bg-brand data-pressed:text-brand-foreground data-pressed:hover:bg-brand"
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
                  <span>
                    {t("biasAction")}
                    <span className="font-normal text-muted-foreground">
                      {t("optionalSuffix")}
                    </span>
                  </span>
                </FormLabel>
                <FormDescription>
                  {tHelp("methodBiasActionBody")}
                </FormDescription>
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
          {wasApproved &&
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
          {/* When the fields were AI-drafted, saving requires an explicit human
              acknowledgement of review (ADR-0003: HR confirms AI output). */}
          {aiDrafted && !locked && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="ai-ack"
                checked={aiAcknowledged}
                onCheckedChange={(v) => setAiAcknowledged(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="ai-ack" className="text-sm">
                {t("aiAckLabel")}
              </label>
            </div>
          )}
          {/* The sign-off, as the last field of the form rather than a second
              act after it. Approving used to be its own button, reachable only
              once the documentation was saved, so finishing a criterion took
              two trips through this dialog; it is a checkbox the save carries
              now. Leaving it clear is a legitimate answer: a documented draft
              nobody has signed off is a real state of the model, and the
              approval gate counts it as outstanding until someone does.
              Unchecking a standing sign-off is how a correction begins, and it
              reopens the MODEL's approval on save (the engine's blocker rule),
              which is exactly what it should do. */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="approve"
              checked={approved}
              // Only ever offered against complete documentation: the backend
              // refuses an approval the stored row does not support, and a
              // checkbox that threw on submit would be a trap.
              disabled={!documented}
              onCheckedChange={(v) => setApproved(v === true)}
              className="mt-0.5"
            />
            <label htmlFor="approve" className="text-sm">
              {t("approveLabel")}
            </label>
          </div>
          {/* Why the box is not offered yet, next to the box. A disabled
              control with no reason beside it is the reader's dead end. */}
          {!documented && (
            <p className="text-muted-foreground text-sm">{t("approveHint")}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancelCta")}
            </Button>
            {/* One way out of this dialog now, and it carries both halves of
                the act. Disabled while there is nothing to post, so a reader
                who opens a finished criterion and changes nothing cannot write
                an audit row by pressing it. */}
            <SubmitButton
              type="submit"
              isSubmitting={isSubmitting}
              disabled={unchanged || (aiDrafted && !aiAcknowledged)}
            >
              {t("saveCta")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </Form>
    </>
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
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={FORM_DIALOG_CONTENT}>
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
