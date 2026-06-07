"use client"

import { AiMagicIcon } from "@hugeicons/core-free-icons"
import { api } from "@workspace/backend/convex/_generated/api"
import { pointBudget } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import { AnimatePresence } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { MorphPopover } from "@/components/morph-popover"
import { AddCriterionDialog } from "@/components/onboarding/add-criterion-dialog"
import { CriterionItem } from "@/components/onboarding/criterion-item"
import { WeightReviewPanel } from "@/components/onboarding/weight-review-panel"
import { formatShare, WEIGHT_POINT_OPTIONS } from "@/lib/weighting"

// Error codes with their own translated message; everything else falls back
// to the generic one.
const KNOWN_ERROR_KEYS = ["weightsUnbalanced", "tooFewCriteria"] as const
type EditorErrorKey = (typeof KNOWN_ERROR_KEYS)[number] | "generic"

function errorKeyFor(error: unknown): EditorErrorKey {
  if (error instanceof ConvexError) {
    const code = (error.data as { code?: string } | null)?.code
    const known = KNOWN_ERROR_KEYS.find((key) => code === `errors.${key}`)
    if (known !== undefined) return known
  }
  return "generic"
}

// Shared criteria editor: read-only list (weight points + derived share) with
// an Edit toggle that unlocks the zero-sum reweighting flow (ADR-0004): the
// selects edit a LOCAL draft allocation, the header meter shows the live
// remaining points, and Save posts the whole allocation atomically
// (rebalanceWeights validates the exact point budget). Used by the onboarding
// model review step AND the /model page (E2's starting point). The optional
// AI weight review opens from a Review button next to Edit: the button morphs
// into a popover that requests balanced moves and shows its states.
export function ModelEditor({
  orgId,
  withAiReview,
  removalFloor,
}: {
  orgId: string
  withAiReview?: boolean
  // Hide the per-row remove affordance when the criteria count is at or
  // below this floor (the /model page passes MIN_CRITERIA). Omitted during
  // onboarding: a model under construction removes freely, and the wizard's
  // Next gates enforce the floor before completion instead.
  removalFloor?: number
}) {
  const t = useTranslations("dashboard.model.review")
  const tError = useTranslations("dashboard.model")
  const tErrors = useTranslations("errors")
  const tEditor = useTranslations("dashboard.model.editor")
  const tAi = useTranslations("dashboard.ai")
  const tHelp = useTranslations("dashboard.help")
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  // True right after a confirmed weight review, until the weighting changes
  // again: the Review button is hidden while it holds (no point re-reviewing
  // an allocation the AI just produced, and it blocks button spamming).
  const reviewLocked = useQuery(api.ai.suggest.getWeightReviewLock, { orgId })
  const rebalanceWeights = useMutation(
    api.evaluationModel.criteria.rebalanceWeights
  )
  const removeCriterion = useMutation(
    api.evaluationModel.criteria.removeCriterion
  )
  const [editing, setEditing] = useState(false)
  // Local draft allocation while editing (criterionId -> points); values
  // override the stored points. Criteria added or removed mid-edit reconcile
  // automatically: the allocation is always built from the live criteria
  // list, with the draft as an overlay.
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<EditorErrorKey | null>(null)

  if (model === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={tEditor("heading")} />
      </main>
    )
  }
  if (model === null) return null

  const pointsFor = (criterion: {
    criterionId: string
    weightPoints: number
  }) => draft[criterion.criterionId] ?? criterion.weightPoints
  const totalPoints = model.criteria.reduce(
    (sum, criterion) => sum + pointsFor(criterion),
    0
  )
  const storedTotal = model.criteria.reduce(
    (sum, criterion) => sum + criterion.weightPoints,
    0
  )
  const delta = totalPoints - pointBudget(model.criteria.length)
  const dirty = model.criteria.some(
    (criterion) => pointsFor(criterion) !== criterion.weightPoints
  )
  const removalAllowed =
    removalFloor === undefined || model.criteria.length > removalFloor

  function stopEditing() {
    setDraft({})
    setEditing(false)
    setErrorKey(null)
  }

  async function onSave() {
    if (model === undefined || model === null) return
    setSaving(true)
    setErrorKey(null)
    try {
      if (dirty) {
        await rebalanceWeights({
          orgId,
          allocations: model.criteria.map((criterion) => ({
            criterionId: criterion.criterionId,
            weightPoints: pointsFor(criterion),
          })),
        })
      }
      setDraft({})
      setEditing(false)
    } catch (error) {
      setErrorKey(errorKeyFor(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex shrink-0 items-center gap-1.5">
            <h3 className="font-medium text-base">{tEditor("heading")}</h3>
            <HelpMorphButton label={tHelp("criterionLabel")}>
              {tHelp("criterionBody")}
            </HelpMorphButton>
          </span>
          {/* Live budget meter: rendered inside the header row so toggling
              edit mode never adds vertical space (zero layout shift). */}
          {editing && (
            <span
              aria-live="polite"
              className={cn(
                "min-w-0 flex-1 truncate text-right text-sm",
                delta === 0
                  ? "text-muted-foreground"
                  : "text-amber-600 dark:text-amber-500"
              )}
            >
              {delta === 0
                ? tEditor("balanced")
                : delta < 0
                  ? tEditor("pointsLeft", { count: -delta })
                  : tEditor("pointsOver", { count: delta })}
            </span>
          )}
          {/* Two fixed sm buttons in both modes (Review/Edit vs Cancel/Save):
              the cluster swaps labels rather than count, so nothing reflows. */}
          <div className="flex shrink-0 items-center gap-2">
            {editing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={stopEditing}
                >
                  {tEditor("cancelCta")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || delta !== 0}
                  onClick={onSave}
                >
                  {tEditor("saveCta")}
                </Button>
              </>
            ) : (
              <>
                {withAiReview && reviewLocked === false && (
                  <MorphPopover
                    triggerLabel={tAi("openReviewCta")}
                    triggerIcon={AiMagicIcon}
                    title={tAi("heading")}
                    description={tAi("provenance")}
                    closeLabel={tAi("closeLabel")}
                  >
                    {(close) => (
                      <WeightReviewPanel
                        orgId={orgId}
                        model={model}
                        autoRequest
                        onDone={close}
                      />
                    )}
                  </MorphPopover>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraft({})
                    setErrorKey(null)
                    setEditing(true)
                  }}
                >
                  {t("editCta")}
                </Button>
              </>
            )}
          </div>
        </div>
        <ul>
          <AnimatePresence initial={false}>
            {model.criteria.map((criterion) => {
              const isRemoving = removing === criterion.criterionId
              const points = pointsFor(criterion)
              const weightNode = editing ? (
                <Select
                  value={String(points)}
                  disabled={saving}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      [criterion.criterionId]: Number(value),
                    }))
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full"
                    aria-label={tEditor("setWeightPoints", {
                      name: criterion.name,
                    })}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEIGHT_POINT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm tabular-nums">
                  {criterion.weightPoints}
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatShare(criterion.weightPoints, storedTotal, locale)}
                  </span>
                </span>
              )

              return (
                <CriterionItem
                  key={criterion.criterionId}
                  name={criterion.name}
                  description={criterion.description}
                  importanceNode={weightNode}
                  editable={editing}
                  onRemove={
                    editing && removalAllowed
                      ? async () => {
                          setRemoving(criterion.criterionId)
                          setErrorKey(null)
                          try {
                            await removeCriterion({
                              orgId,
                              criterionId: criterion.criterionId,
                            })
                          } catch (error) {
                            setErrorKey(errorKeyFor(error))
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
      {errorKey !== null && (
        <p role="alert" className="text-destructive text-sm">
          {errorKey === "generic" ? tError("error") : tErrors(errorKey)}
        </p>
      )}
    </div>
  )
}
