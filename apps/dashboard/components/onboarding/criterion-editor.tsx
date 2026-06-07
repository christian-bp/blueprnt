"use client"

import { AiMagicIcon } from "@hugeicons/core-free-icons"
import { api } from "@workspace/backend/convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { MorphPopover } from "@/components/morph-popover"
import { AddCriterionDialog } from "@/components/onboarding/add-criterion-dialog"
import { ChangeChoiceButton } from "@/components/onboarding/change-choice-button"
import { CriterionItem } from "@/components/onboarding/criterion-item"
import { NextButton } from "@/components/onboarding/next-button"
import { ModelDraftPanel } from "@/components/onboarding/model-draft-panel"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { importanceLabelKey } from "@/lib/importance"

// Screen 5 (scratch path). The criteria list is reactive from getModel; the
// add-criterion dialog posts a new criterion, the hover-trashcan removes one,
// the AI draft panel (Task 12) is slotted in, and "Next" hands control back
// to the wizard (onContinue), which advances to the families screen; completion
// happens there, not here. Next is disabled until at least one criterion
// exists.
//
// Uses the shared CriterionItem component (always editable here: no importance
// select per row, but with the hover-trashcan and name+description layout).
export function CriterionEditor({
  orgId,
  onContinue,
  onChangeChoice,
}: {
  orgId: string
  onContinue: () => void
  onChangeChoice?: () => void | Promise<void>
}) {
  const t = useTranslations("dashboard.model")
  const tReview = useTranslations("dashboard.model.review")
  const tAi = useTranslations("dashboard.ai")
  const tEditor = useTranslations("dashboard.model.editor")
  const tImportance = useTranslations("model.importance")
  // The fixed tracks/levels localize server-side in getModel; passing the
  // active UI locale re-runs the reactive query when the language changes.
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const removeCriterion = useMutation(
    api.evaluationModel.criteria.removeCriterion
  )

  // removing: the criterionId currently being deleted (null = none in flight).
  const [removing, setRemoving] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const criteria = model?.criteria ?? []
  const finishDisabled =
    model === null || model === undefined || criteria.length === 0

  return (
    <ScreenShell heading={tReview("heading")} description={t("description")}>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-base">{tEditor("heading")}</h3>
          <MorphPopover
            triggerLabel={tAi("openDraftCta")}
            triggerIcon={AiMagicIcon}
            title={tAi("heading")}
            description={tAi("provenance")}
            closeLabel={tAi("closeLabel")}
          >
            {(close) => (
              <ModelDraftPanel orgId={orgId} onDone={close} dismissOnUnmount />
            )}
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
                  // The scratch editor shows the importance as a static label (no
                  // per-row select here; importance is set in the add form).
                  importanceNode={
                    <span className="text-muted-foreground text-sm">
                      {tImportance(
                        importanceLabelKey(criterion.importanceLevel)
                      )}
                    </span>
                  }
                  editable={true}
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

        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onChangeChoice && (
              <ChangeChoiceButton onConfirm={onChangeChoice} />
            )}
          </div>
          <NextButton disabled={finishDisabled} onClick={onContinue} />
        </div>
      </div>
    </ScreenShell>
  )
}
