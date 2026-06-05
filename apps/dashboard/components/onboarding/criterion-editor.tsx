"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { AddCriterionDialog } from "@/components/onboarding/add-criterion-dialog"
import { ChangeChoiceButton } from "@/components/onboarding/change-choice-button"
import { CriterionItem } from "@/components/onboarding/criterion-item"
import { ModelDraftPanel } from "@/components/onboarding/model-draft-panel"
import { importanceLabelKey } from "@/lib/importance"

// Step 5: scratch path. The criteria list is reactive from getModel; the
// add-criterion dialog posts a new criterion, the hover-trashcan removes one,
// the AI draft panel (Task 12) is slotted in, and "Finish" hands control to the
// gate. Finish is disabled until at least one criterion exists.
//
// Uses the shared CriterionItem component (always editable here: no importance
// select per row, but with the hover-trashcan and name+description layout).
//
// onBack is optional. When provided (resume path: the user landed here directly
// without having gone through the choice screen in this session), a back button
// is rendered to the left of the finish button so the user can return to the
// profile step.
export function CriterionEditor({
  orgId,
  onFinished,
  onBack,
  onChangeChoice,
}: {
  orgId: string
  onFinished: () => void
  onBack?: () => void
  onChangeChoice?: () => void | Promise<void>
}) {
  const t = useTranslations("dashboard.onboarding.model")
  const tOnboarding = useTranslations("dashboard.onboarding")
  const tEditor = useTranslations("dashboard.onboarding.model.editor")
  const tImportance = useTranslations("model.importance")
  // The fixed tracks/levels localize server-side in getModel; passing the
  // active UI locale re-runs the reactive query when the language changes.
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const removeCriterion = useMutation(
    api.evaluationModel.criteria.removeCriterion
  )
  const completeOnboarding = useMutation(
    api.accounts.organization.completeOnboarding
  )

  // removing: the criterionId currently being deleted (null = none in flight).
  const [removing, setRemoving] = useState<string | null>(null)
  // completing: the finish (completeOnboarding) call in flight.
  const [completing, setCompleting] = useState(false)
  const [failed, setFailed] = useState(false)

  const criteria = model?.criteria ?? []
  const finishDisabled =
    completing || model === null || model === undefined || criteria.length === 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-medium text-lg">{tEditor("heading")}</h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
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
                    {tImportance(importanceLabelKey(criterion.importanceLevel))}
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

      <ModelDraftPanel orgId={orgId} />

      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack}>
              {tOnboarding("back")}
            </Button>
          ) : (
            <span />
          )}
          {onChangeChoice && <ChangeChoiceButton onConfirm={onChangeChoice} />}
        </div>
        <Button
          disabled={finishDisabled}
          onClick={async () => {
            setCompleting(true)
            setFailed(false)
            try {
              await completeOnboarding({ orgId })
              onFinished()
            } catch {
              setFailed(true)
              setCompleting(false)
            }
          }}
        >
          {tEditor("doneCta")}
        </Button>
      </div>
    </div>
  )
}
