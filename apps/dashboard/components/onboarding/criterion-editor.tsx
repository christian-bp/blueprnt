"use client"

import { AiMagicIcon } from "@hugeicons/core-free-icons"
import { api } from "@workspace/backend/convex/_generated/api"
import { MIN_CRITERIA } from "@workspace/core"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpPopover } from "@/components/help-popover"
import { MorphPopover } from "@/components/morph-popover"
import { AddCriterionDialog } from "@/components/model/add-criterion-dialog"
import {
  EditCriterionDialog,
  type EditCriterionTarget,
} from "@/components/model/edit-criterion-dialog"
import { ChangeChoiceButton } from "@/components/onboarding/change-choice-button"
import { CriterionItem } from "@/components/model/criterion-item"
import { NextButton } from "@/components/onboarding/next-button"
import { ModelDraftPanel } from "@/components/model/model-draft-panel"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import { capitalizeFirst } from "@/lib/capitalize"
import { formatShare } from "@/lib/weighting"

// Screen 5 (scratch path). The criteria list is reactive from getModel; the
// add-criterion dialog posts a new criterion, the hover-trashcan removes one,
// the AI draft panel (Task 12) is slotted in, and "Next" hands control back
// to the wizard (onContinue), which advances to the families screen; completion
// happens there, not here. Next is disabled until at least one criterion
// exists.
//
// Uses the shared CriterionItem component (always editable here: no weight
// select per row, but with the hover-trashcan and name+description layout).
// Criteria enter at the neutral 3 weight points (ADR-0004); reweighting
// happens on the review screen's zero-sum editor.
export function CriterionEditor({
  orgId,
  organizationName,
  onContinue,
  onChangeChoice,
}: {
  orgId: string
  organizationName: string
  onContinue: () => void
  onChangeChoice?: () => void | Promise<void>
}) {
  const t = useTranslations("dashboard.model")
  const tReview = useTranslations("dashboard.model.review")
  const tAi = useTranslations("dashboard.ai")
  const tEditor = useTranslations("dashboard.model.editor")
  const tHelp = useTranslations("dashboard.help")
  // Template content localizes server-side in getModel; passing the active
  // UI locale re-runs the reactive query when the language changes.
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const removeCriterion = useMutation(
    api.evaluationModel.criteria.removeCriterion
  )

  // removing: the criterionId currently being deleted (null = none in flight).
  const [removing, setRemoving] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<EditCriterionTarget | null>(null)
  const [failed, setFailed] = useState(false)

  const criteria = model?.criteria ?? []
  const totalPoints = criteria.reduce(
    (sum, criterion) => sum + criterion.weightPoints,
    0
  )
  // The composition floor (ADR-0004): a model cannot be finished with fewer
  // than MIN_CRITERIA criteria. Building below the floor is fine; finishing
  // is not.
  const finishDisabled =
    model === null || model === undefined || criteria.length < MIN_CRITERIA

  return (
    <ScreenShell
      // A name-first heading starts with the name as typed; heading
      // typography still wants a capital ("acme's model" -> "Acme's model").
      heading={capitalizeFirst(
        tReview("heading", { name: organizationName }),
        locale
      )}
      description={t("description")}
    >
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between gap-2">
          <span className="flex shrink-0 items-center gap-1.5">
            <h3 className="font-medium text-base">{tEditor("heading")}</h3>
            <HelpPopover label={tHelp("criterionLabel")}>
              {tHelp("criterionBody")}
            </HelpPopover>
          </span>
          <MorphPopover
            triggerLabel={tAi("openDraftCta")}
            triggerIcon={AiMagicIcon}
            title={tAi("heading")}
            description={tAi("provenance")}
            closeLabel={tAi("closeLabel")}
          >
            {(close) => <ModelDraftPanel orgId={orgId} onDone={close} />}
          </MorphPopover>
        </div>

        {criteria.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tEditor("empty")}</p>
        ) : (
          // AnimatePresence tracks keyed CriterionItem children so entering and
          // exiting items animate. initial={false} skips the enter animation on
          // first render (the list is already populated; we only animate reactive
          // changes driven by the Convex subscription).
          <ul>
            <AnimatePresence initial={false}>
              {criteria.map((criterion) => (
                <CriterionItem
                  key={criterion.criterionId}
                  name={criterion.name}
                  description={criterion.description || undefined}
                  anchors={criterion.anchors}
                  // The scratch editor shows the weight points and derived
                  // share as static text (no per-row select here; reweighting
                  // happens on the review screen).
                  importanceNode={
                    <span className="text-sm tabular-nums">
                      {criterion.weightPoints}
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatShare(
                          criterion.weightPoints,
                          totalPoints,
                          locale
                        )}
                      </span>
                    </span>
                  }
                  editable={true}
                  onEdit={() =>
                    setEditTarget({
                      criterionId: criterion.criterionId,
                      name: criterion.name,
                      description: criterion.description,
                      helpText: criterion.helpText,
                      anchors: criterion.anchors.map((anchor) => anchor.text),
                    })
                  }
                  editLabel={`${tEditor("editCta")} ${criterion.name}`}
                  onRemove={async () => {
                    setRemoving(criterion.criterionId)
                    setFailed(false)
                    try {
                      await removeCriterion({
                        orgId,
                        criterionId: criterion.criterionId,
                      })
                    } catch {
                      setFailed(true)
                    } finally {
                      setRemoving(null)
                    }
                  }}
                  removing={removing === criterion.criterionId}
                  removeLabel={`${tEditor("removeCta")} ${criterion.name}`}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}

        <AddCriterionDialog orgId={orgId} />
        <EditCriterionDialog
          orgId={orgId}
          target={editTarget}
          onClose={() => setEditTarget(null)}
        />

        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}

        <WizardFooter
          hint={
            model != null && criteria.length < MIN_CRITERIA
              ? tEditor("minCriteriaHint", { min: MIN_CRITERIA })
              : undefined
          }
        >
          {onChangeChoice && <ChangeChoiceButton onConfirm={onChangeChoice} />}
          <NextButton disabled={finishDisabled} onClick={onContinue} />
        </WizardFooter>
      </div>
    </ScreenShell>
  )
}
