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
import { AiMagicIcon } from "@hugeicons/core-free-icons"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { MorphPopover } from "@/components/morph-popover"
import { AddCriterionDialog } from "@/components/onboarding/add-criterion-dialog"
import { CriterionItem } from "@/components/onboarding/criterion-item"
import { ImportanceReviewPanel } from "@/components/onboarding/importance-review-panel"
import { importanceLabelKey } from "@/lib/importance"

// Importance levels from highest (7) to lowest (1); weights are internal and
// never shown to the user.
const IMPORTANCE_OPTIONS = [7, 6, 5, 4, 3, 2, 1] as const

// Shared criteria editor: read-only list with an Edit toggle that unlocks
// importance selects, removal, and the add dialog. Used by the onboarding
// model review step AND the /model page (E2's starting point). The optional
// AI importance review opens from a Review button next to Edit: the button
// morphs into a popover that requests the review and shows its states.
export function ModelEditor({
  orgId,
  withAiReview,
}: {
  orgId: string
  withAiReview?: boolean
}) {
  const t = useTranslations("dashboard.model.review")
  const tError = useTranslations("dashboard.model")
  const tEditor = useTranslations("dashboard.model.editor")
  const tImportance = useTranslations("model.importance")
  const tAi = useTranslations("dashboard.ai")
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const updateCriterionImportance = useMutation(
    api.evaluationModel.criteria.updateCriterionImportance
  )
  const removeCriterion = useMutation(
    api.evaluationModel.criteria.removeCriterion
  )
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  if (model === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={tEditor("heading")} />
      </main>
    )
  }
  if (model === null) return null

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-base">{tEditor("heading")}</h3>
          <div className="flex items-center gap-2">
            {withAiReview && (
              <MorphPopover
                triggerLabel={tAi("openReviewCta")}
                triggerIcon={AiMagicIcon}
                title={tAi("heading")}
                description={tAi("provenance")}
                closeLabel={tAi("closeLabel")}
              >
                {(close) => (
                  <ImportanceReviewPanel
                    orgId={orgId}
                    model={model}
                    autoRequest
                    dismissOnUnmount
                    onDone={close}
                  />
                )}
              </MorphPopover>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(!editing)}
            >
              {editing ? t("doneEditing") : t("editCta")}
            </Button>
          </div>
        </div>
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
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {tError("error")}
        </p>
      )}
    </div>
  )
}
