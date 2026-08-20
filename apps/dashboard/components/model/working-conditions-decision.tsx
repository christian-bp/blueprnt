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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import { toast } from "@/lib/toast"
import {
  makeWorkingConditionsSchema,
  type WorkingConditionsValues,
} from "@/lib/working-conditions-schema"

// The two answers to the materiality question, in the engine's own words.
type MaterialityStatus = "active" | "testedNotMaterial"

// The recorded materiality decision, as the Kriterier chapter's own model
// query already serves it. decidedBy is deliberately not part of this shape:
// getModel carries the raw auth id, and a surface never shows one.
export interface MaterialityDecision {
  status: MaterialityStatus
  motivation: string
  decidedAt: number
}

// The working-conditions criterion the model holds, if any. The dimension caps
// at one, so this is a single criterion rather than a list.
export interface WorkingConditionsCriterion {
  criterionId: Id<"criteria">
  name: string
}

const KNOWN_ERROR_KEYS = ["invalidTransition"] as const

function errorMessage(
  error: unknown,
  tErrors: (key: (typeof KNOWN_ERROR_KEYS)[number]) => string,
  fallback: string
): string {
  if (error instanceof ConvexError) {
    const code = (error.data as { code?: string } | null)?.code
    const known = KNOWN_ERROR_KEYS.find((key) => code === `errors.${key}`)
    if (known !== undefined) return tErrors(known)
  }
  return fallback
}

// The decision form, mounted INSIDE the dialog's popup rather than beside it:
// its default status is the answer the column was just given, and react-hook-
// form reads defaults once at mount. A form living outside the popup would
// keep the first answer it ever saw, which is a defect no rendering shows.
function DecisionForm({
  orgId,
  decision,
  criterion,
  status,
  onDone,
}: {
  orgId: string
  decision: MaterialityDecision | null
  // The working-conditions criterion currently in the model, if any. The
  // not-material answer cannot stand beside one, so this is what turns the
  // save into an offer to remove it.
  criterion: WorkingConditionsCriterion | null
  // The answer the column was just given: the two choice buttons are the
  // decision, and this form is only where it gets its motivation. Reopening a
  // recorded decision passes that decision's own status.
  status: MaterialityStatus
  onDone: () => void
}) {
  const t = useTranslations("dashboard.model.criteria.workingConditions")
  const tChange = useTranslations("dashboard.model.change")
  const tv = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const save = useMutation(
    api.evaluationModel.approval.setWorkingConditionsDecision
  )
  const deactivate = useMutation(
    api.evaluationModel.criteria.deactivateCriterion
  )

  const schema = useMemo(() => makeWorkingConditionsSchema(tv), [tv])
  const form = useForm<WorkingConditionsValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { status, motivation: decision?.motivation ?? "" },
  })
  // A recorded decision opens the form valid, so the save gates on dirty as
  // well: an unchanged form must not fire a mutation that would still write an
  // audit row and reopen the model's approval.
  const { isDirty, isSubmitting, isValid } = form.formState
  // The answer as it stands right now, which the offer and the save's own
  // label both depend on; the `status` prop is only what the form opened on.
  const chosen = form.watch("status")
  const removesCriterion = chosen === "testedNotMaterial" && criterion !== null

  async function onValid(values: WorkingConditionsValues) {
    try {
      // Removal FIRST, then the decision. The backend refuses
      // testedNotMaterial while a working-conditions criterion is active, so
      // the other order always fails; and if the second call is the one that
      // fails, the reader lands in a state the column already draws (the
      // question again, or the material-with-an-empty-slot state), with an
      // error toast, rather than in one no surface can explain.
      if (removesCriterion && criterion !== null) {
        await deactivate({ orgId, criterionId: criterion.criterionId })
      }
      await save({ orgId, ...values })
      toast.success(tToast("workingConditionsDecided"))
      onDone()
    } catch (error) {
      toast.error(errorMessage(error, tErrors, tToast("error")))
    }
  }

  return (
    // No panel chrome of its own: the dialog is the panel, and the save lives
    // in the footer with the way out beside it.
    <Form {...form}>
      <form className="space-y-3" onSubmit={form.handleSubmit(onValid)}>
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("statusLabel")}</FormLabel>
              <FormControl>
                <ToggleGroup
                  variant="outline"
                  value={field.value ? [field.value] : []}
                  onValueChange={(groupValue) => {
                    const next = groupValue[0]
                    if (next !== undefined) field.onChange(next)
                  }}
                >
                  <ToggleGroupItem
                    value="active"
                    className="data-pressed:border-brand data-pressed:bg-brand data-pressed:text-brand-foreground data-pressed:hover:bg-brand"
                  >
                    {t("activeOption")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="testedNotMaterial"
                    className="data-pressed:border-brand data-pressed:bg-brand data-pressed:text-brand-foreground data-pressed:hover:bg-brand"
                  >
                    {t("testedNotMaterialOption")}
                  </ToggleGroupItem>
                </ToggleGroup>
              </FormControl>
              {removesCriterion && criterion !== null && (
                // An OFFER, not an errand. The old copy told the reader to go
                // and deactivate the criterion themselves and come back, which
                // is a round trip the system can make for them. It names the
                // criterion and the consequence, so the save below it is an
                // informed one and needs no second confirm dialog on top.
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("removeOffer", { name: criterion.name })}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="motivation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("motivationLabel")}</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tChange("cancel")}
          </Button>
          <SubmitButton
            type="submit"
            isSubmitting={isSubmitting}
            disabled={!isValid || !isDirty}
          >
            {/* The button says both things it does. The gravity that would
                otherwise call for a confirm dialog is carried by the offer
                above it plus this label, so the press is already the second
                look. */}
            {removesCriterion ? t("removeAndSaveCta") : t("saveCta")}
          </SubmitButton>
        </DialogFooter>
      </form>
    </Form>
  )
}

// The motivation step. A dialog rather than an inline disclosure because the
// column is one quarter of the grid: a status toggle, a motivation textarea
// and a save do not fit a 272px box without becoming a form nobody can read.
function DecisionDialog({
  orgId,
  decision,
  criterion,
  status,
  open,
  onOpenChange,
}: {
  orgId: string
  decision: MaterialityDecision | null
  criterion: WorkingConditionsCriterion | null
  status: MaterialityStatus
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("dashboard.model.criteria.workingConditions")
  const tHelp = useTranslations("dashboard.help")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          {/* The concept's help lives HERE, after a title, which is the only
              place help belongs: this is where the decision is made, and the
              one fact the sentences in the column do not carry (an active
              criterion applies to every role, where 0 means the role is not
              covered) is the fact this step needs. The dimension's own help,
              on the column title, says what the dimension covers and does not
              repeat it. */}
          <DialogTitle className="flex items-center gap-1">
            {t("testHeading")}
            <HelpMorphButton label={tHelp("workingConditionsDecisionLabel")}>
              {tHelp("workingConditionsDecisionBody")}
            </HelpMorphButton>
          </DialogTitle>
          {/* Both answers, in the order the column asks them and with neither
              named as the expected one. */}
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DecisionForm
          orgId={orgId}
          decision={decision}
          criterion={criterion}
          status={status}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

// The working-conditions materiality decision (ADR-0022 section 6.1), in the
// working-conditions column of the Kriterier chapter: either a
// workingConditions criterion is active, or the dimension was tested and found
// not material, with a motivation either way.
//
// It lives here because this is the surface the decision is ABOUT: the column
// is the one place a reader sees that this dimension holds nothing, and asking
// the question anywhere else left the fourth column silently waiting for a
// criterion that was never coming.
//
// QUESTION FIRST. With nothing recorded the column leads with the materiality
// question itself and two equal answers, and the criterion slot does not
// exist yet: the coupling between "material" and "a criterion is needed" is
// the structure of the surface rather than a sentence about it. Answering
// opens the dialog on that answer, where the motivation makes it a decision.
//
// Once answered the block is compact: "Material" over an open slot or under
// the criterion that fills it, and the full documented state when the answer
// was not material, which is the one case where the motivation IS the
// dimension's whole evidence.
//
// A recorded ACTIVE decision over an empty dimension is a real state, not an
// error: under the one-criterion cap, swapping the working-conditions
// criterion means removing the old one first, and the decision must survive
// that (flipping it the other way would need a new motivation no system can
// author). There the column is a slot with a prompt, which is the answer to
// "what now" without a sentence.
export function WorkingConditionsDecision({
  orgId,
  decision,
  criterion,
}: {
  orgId: string
  decision: MaterialityDecision | null
  // The working-conditions criterion the model holds, if any: it decides
  // whether the material states read as a filled slot or an open one, and it
  // is what the not-material answer offers to remove.
  criterion: WorkingConditionsCriterion | null
}) {
  const hasCriterion = criterion !== null
  const t = useTranslations("dashboard.model.criteria.workingConditions")
  const format = useFormatter()
  // Recording the decision is an adminMutation, so an editor is never offered
  // an answer button or the form: the same split the approval card draws. An
  // editor still READS both the question and a recorded decision, which is the
  // state of their own model.
  const { role } = useOrganization()
  const canDecide = role === "admin"
  // Which answer the dialog is open on, or null while it is closed. The
  // answer is chosen in the column; the dialog only takes its motivation.
  const [pending, setPending] = useState<MaterialityStatus | null>(null)

  // The change affordance, inline at the END of the state's own sentence
  // rather than on a row of its own: a grey control alone under a paragraph
  // reads as debris. Link variant for the app's link ink, with the button's
  // own height and padding taken off at the call site because a 32px control
  // in the middle of a line of text is a block, not a word.
  const change = canDecide && (
    <Button
      type="button"
      variant="link"
      className="h-auto p-0 align-baseline text-sm"
      onClick={() => setPending(decision?.status ?? "active")}
    >
      {t("changeCta")}
    </Button>
  )

  const dialog = canDecide && (
    <DecisionDialog
      orgId={orgId}
      decision={decision}
      criterion={criterion}
      // Kept while the dialog closes so the exit animation does not re-render
      // the form on a different answer; the popup unmounts, so the next
      // opening builds a fresh form on the answer chosen then.
      status={pending ?? decision?.status ?? "active"}
      open={pending !== null}
      onOpenChange={(next) => {
        if (!next) setPending(null)
      }}
    />
  )

  if (decision === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm">{t("materialityQuestion")}</p>
        {/* Only where the dimension is genuinely empty: with a criterion
            already chosen, "no criterion is needed" is not the fact the
            reader needs. */}
        {!hasCriterion && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("noCriterionHint")}
          </p>
        )}
        {canDecide && (
          // Two equal answers, stacked so both read at the column's width and
          // neither can be the wider one. Same variant, same size: nothing on
          // this surface says which answer is expected.
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPending("active")}
            >
              {t("yesCta")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPending("testedNotMaterial")}
            >
              {t("noCta")}
            </Button>
          </div>
        )}
        {dialog}
      </div>
    )
  }

  if (decision.status === "testedNotMaterial") {
    return (
      <div className="space-y-1.5">
        {/* The state in a sentence, not a status word over a paragraph: this
            block is read cold by someone who did not make the decision, and
            "Tested, not material" over an unlabelled motivation leaves them to
            infer who tested what. The sentence is also what gives the
            motivation under it something to be the reason FOR. */}
        <p className="font-medium text-sm">
          {t("notMaterialLine")} {change}
        </p>
        {/* Unclamped: with no criterion to point at, this motivation is the
            dimension's whole evidence, and a column showing half of it shows
            nothing worth reading. */}
        <p className="text-muted-foreground text-sm">{decision.motivation}</p>
        <p className="text-muted-foreground text-xs">
          {t("decidedOn", {
            date: format.dateTime(new Date(decision.decidedAt), {
              dateStyle: "medium",
            }),
          })}
        </p>
        {dialog}
      </div>
    )
  }

  // Material. Two lengths of the same statement, because the two states give
  // the reader different amounts of context.
  //
  // Over an EMPTY slot the block is on its own: it says what was decided AND
  // what that means for the column under it, in one sentence, because a status
  // word above a dashed box is not something a first-time reader or a
  // colleague who did not make the decision can decode. No separate prompt
  // sentence beyond it: this line sits directly over the slot with the add row
  // directly under it, so the column already reads decision, place, action.
  //
  // UNDER A CRITERION the card carries the context, so the same statement
  // shrinks to a fragment that still means something cold.
  return (
    <div className="space-y-1.5">
      <p className={hasCriterion ? "text-muted-foreground text-sm" : "text-sm"}>
        {hasCriterion ? t("materialFootnote") : t("materialSlotLine")} {change}
      </p>
      {dialog}
    </div>
  )
}
