"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { AnimatePresence } from "motion/react"
import { AddCriterionDialog } from "@/components/onboarding/add-criterion-dialog"
import { ChangeChoiceButton } from "@/components/onboarding/change-choice-button"
import { CriterionItem } from "@/components/onboarding/criterion-item"
import { ImportanceReviewPanel } from "@/components/onboarding/importance-review-panel"
import { importanceLabelKey } from "@/lib/importance"

// Importance levels from highest (7) to lowest (1); weights are internal and
// never shown to the user.
const IMPORTANCE_OPTIONS = [7, 6, 5, 4, 3, 2, 1] as const

// Step 4: template path landing. Starts READ-ONLY: criteria show name,
// description, and the importance label as static text. An "Edit" button in
// the criteria header unlocks edit mode, which reveals importance selects,
// hover-trashcan removal, and the add-criterion dialog trigger. "Done" returns
// to read-only. The finish/back/change-choice footer is always present.
//
// onBack is optional. When provided (resume path: the user landed here directly
// without having gone through the choice screen in this session), a back button
// is rendered to the left of the finish button so the user can return to the
// profile step. Model creation is already done at this point, but re-choosing
// the model is not needed to reach the profile step, so back is safe.
export function ModelReview({
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
  const t = useTranslations("dashboard.onboarding.model.review")
  const tOnboarding = useTranslations("dashboard.onboarding")
  const tError = useTranslations("dashboard.onboarding.model")
  const tEditor = useTranslations("dashboard.onboarding.model.editor")
  const tImportance = useTranslations("model.importance")
  // Pristine template content localizes server-side in getModel; passing the
  // active UI locale re-runs the reactive query when the language changes, so
  // the model content re-localizes live (including the step 1 preview). The
  // subscription also keeps the criteria list fresh after add/remove.
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const completeOnboarding = useMutation(
    api.accounts.organization.completeOnboarding
  )
  const updateCriterionImportance = useMutation(
    api.evaluationModel.criteria.updateCriterionImportance
  )
  const removeCriterion = useMutation(
    api.evaluationModel.criteria.removeCriterion
  )
  const [completing, setCompleting] = useState(false)
  const [failed, setFailed] = useState(false)
  // editing: whether the user has clicked "Edit" to enter edit mode.
  const [editing, setEditing] = useState(false)
  // criterionId of the in-flight importance change; disables all selects while
  // a save is in progress so the user cannot queue conflicting updates.
  const [savingId, setSavingId] = useState<string | null>(null)
  // removing: the criterionId currently being deleted (null = none in flight).
  const [removing, setRemoving] = useState<string | null>(null)

  if (model === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
    )
  }
  // null is defensive: the model is created immediately before this component
  // mounts, so the query should never resolve to null in normal flow.
  if (model === null) return null

  function handleDoneEditing() {
    setEditing(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="font-medium text-lg">{t("heading")}</h2>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{tEditor("heading")}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={editing ? handleDoneEditing : () => setEditing(true)}
          >
            {editing ? t("doneEditing") : t("editCta")}
          </Button>
        </div>
        {/* AnimatePresence tracks keyed children so entering and exiting items
            animate. initial={false} skips the enter animation on first render
            (the list is already populated; we only animate reactive changes). */}
        <ul>
          <AnimatePresence initial={false}>
            {model.criteria.map((criterion) => {
              const isRemoving = removing === criterion.criterionId
              const importanceLabel = tImportance(
                importanceLabelKey(criterion.importanceLevel)
              )
              const importanceNode = editing ? (
                <Select
                  value={String(criterion.importanceLevel)}
                  disabled={savingId !== null}
                  onValueChange={async (value) => {
                    setSavingId(criterion.criterionId)
                    setFailed(false)
                    try {
                      await updateCriterionImportance({
                        orgId,
                        criterionId: criterion.criterionId,
                        importanceLevel: Number(value),
                      })
                    } catch {
                      setFailed(true)
                    } finally {
                      setSavingId(null)
                    }
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-label={t("setImportance", { name: criterion.name })}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPORTANCE_OPTIONS.map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        {tImportance(importanceLabelKey(level))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm">{importanceLabel}</span>
              )

              return (
                <CriterionItem
                  key={criterion.criterionId}
                  name={criterion.name}
                  description={criterion.description}
                  importanceNode={importanceNode}
                  editable={editing}
                  onRemove={
                    editing
                      ? async () => {
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
                        }
                      : undefined
                  }
                  removing={isRemoving}
                  removeLabel={`${tEditor("removeCta")} ${criterion.name}`}
                />
              )
            })}
          </AnimatePresence>
        </ul>
        {editing && (
          <div className="space-y-2">
            <AddCriterionDialog orgId={orgId} />
          </div>
        )}
      </div>
      <ImportanceReviewPanel orgId={orgId} model={model} />
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {tError("error")}
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
          disabled={completing}
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
          {t("cta")}
        </Button>
      </div>
    </div>
  )
}
