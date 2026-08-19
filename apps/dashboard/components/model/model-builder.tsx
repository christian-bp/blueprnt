"use client"

import {
  AiEditingIcon,
  InformationCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { pointBudget } from "@workspace/core"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import { AnimatePresence } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "@/lib/toast"
import { HelpMorphButton } from "@/components/help-morph-button"
import { MorphPopover } from "@/components/morph-popover"
import { CriterionItem } from "@/components/model/criterion-item"
import {
  CriterionListSkeleton,
  DefineCriterionListSkeleton,
} from "@/components/model/criterion-list-skeleton"
import { LibraryPickerDialog } from "@/components/model/library-picker-dialog"
import { WeightPointRow } from "@/components/model/weight-point-row"
import { WeightReviewPanel } from "@/components/model/weight-review-panel"
import { formatShare } from "@/lib/weighting"

// The two activities of building a model, kept on separate phases so the
// role-facing 1-5 evaluation scale (0 only for a working-conditions criterion)
// and the model-facing 1-5 weighting are never shown at the same time (the
// source of the "is this scale the weight?" confusion). Define owns identity +
// the evaluation scale; Weight owns the 1-5 allocation. The two are never
// co-mounted.
export type ModelPhase = "define" | "weight"

// Error codes with their own translated message; everything else falls back
// to the generic one.
const KNOWN_ERROR_KEYS = ["weightsUnbalanced"] as const
type EditorErrorKey = (typeof KNOWN_ERROR_KEYS)[number] | "generic"

function errorKeyFor(error: unknown): EditorErrorKey {
  if (error instanceof ConvexError) {
    const code = (error.data as { code?: string } | null)?.code
    const known = KNOWN_ERROR_KEYS.find((key) => code === `errors.${key}`)
    if (known !== undefined) return known
  }
  return "generic"
}

// The shared model builder for a single phase, hosted by the /model routes
// (the Criteria and Weighting pages, navigated by the header ModelTabs) and the
// onboarding model step (the wizard footer advances Define -> Weight). Phase
// navigation is owned by the host; this component renders the active phase:
// the library-selected criteria grouped by the four dimensions on Define, and
// the 1-5 allocation, budget meter, atomic save, and AI review on Weight.
export function ModelBuilder({
  orgId,
  phase,
  withAiReview,
}: {
  orgId: string
  phase: ModelPhase
  // Weight phase: offer the AI weighting review (a balanced suggestion HR
  // confirms).
  withAiReview?: boolean
}) {
  const tError = useTranslations("dashboard.model")
  const tErrors = useTranslations("errors")
  const tEditor = useTranslations("dashboard.model.editor")
  const tBuilder = useTranslations("dashboard.model.builder")
  const tAi = useTranslations("dashboard.ai")
  const tToast = useTranslations("dashboard.toast")
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  // True right after a confirmed weight review, until the weighting changes
  // again: the Review button is hidden while it holds.
  const reviewLocked = useQuery(api.ai.suggest.getWeightReviewLock, { orgId })
  const rebalanceWeights = useMutation(
    api.evaluationModel.criteria.rebalanceWeights
  )
  const deactivateCriterion = useMutation(
    api.evaluationModel.criteria.deactivateCriterion
  )
  // Local draft allocation for the Weight phase (criterionId -> points);
  // overrides the stored points until Save posts the whole allocation
  // atomically. Persisting across a phase switch is intentional: switching to
  // Define and back keeps an in-progress reweighting.
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<EditorErrorKey | null>(null)

  if (model === undefined) {
    // Content-shaped loading state (never a bare spinner): mirror the phase's
    // real layout so the page appears instantly and the rows drop in without
    // reflow. The Weight phase also reserves its budget/actions toolbar.
    const loadingWeight = phase === "weight"
    return (
      <div className="space-y-4">
        {loadingWeight && (
          <div className="flex items-center justify-between gap-3">
            {/* Reuse the real budget Alert (with its icon) and skeleton only the
                not-yet-known status text, so the toolbar height is identical to
                the loaded state and the list below does not shift. */}
            <Alert className="w-auto">
              <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
              <AlertTitle>
                <Skeleton className="h-5 w-40" />
              </AlertTitle>
            </Alert>
            {/* The real Save button (static chrome). Disabled is the truthful
                state, not a loading effect: the loaded editor opens clean
                (not dirty), where Save is disabled too. */}
            <Button type="button" size="sm" disabled>
              {tEditor("saveCta")}
            </Button>
          </div>
        )}
        {loadingWeight ? (
          <CriterionListSkeleton variant="weight" />
        ) : (
          <DefineCriterionListSkeleton orgId={orgId} />
        )}
      </div>
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
  const delta = totalPoints - pointBudget(model.criteria.length)
  const dirty = model.criteria.some(
    (criterion) => pointsFor(criterion) !== criterion.weightPoints
  )
  const selectedKeys = model.criteria.map((criterion) => criterion.libraryKey)

  async function onSave() {
    if (model === undefined || model === null || !dirty) return
    setSaving(true)
    setErrorKey(null)
    try {
      await rebalanceWeights({
        orgId,
        allocations: model.criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          weightPoints: pointsFor(criterion),
        })),
      })
      setDraft({})
      toast.success(tToast("weightsSaved"))
    } catch (error) {
      setErrorKey(errorKeyFor(error))
    } finally {
      setSaving(false)
    }
  }

  async function onRemove(criterionId: Id<"criteria">) {
    setRemoving(criterionId)
    setErrorKey(null)
    try {
      await deactivateCriterion({ orgId, criterionId })
      toast.success(tToast("criterionRemoved"))
    } catch (error) {
      setErrorKey(errorKeyFor(error))
    } finally {
      setRemoving(null)
    }
  }

  const onWeight = phase === "weight"

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {/* Weight-only toolbar: the budget status (a check when balanced, an
            amber heads-up with the remaining/over count otherwise) sits inline
            on the left, the actions (AI review + atomic save) on the right. The
            description lives in the page header; the amber tint is a call-site
            override (Alert has no warning variant). */}
        {onWeight && (
          <div className="flex items-center justify-between gap-3">
            <Alert
              className={cn(
                "w-auto",
                delta !== 0 &&
                  "border-amber-500/50 text-amber-700 dark:text-amber-400"
              )}
            >
              <HugeiconsIcon
                icon={delta === 0 ? Tick02Icon : InformationCircleIcon}
                strokeWidth={2}
              />
              <AlertTitle>
                {delta === 0
                  ? tEditor("balanced")
                  : delta < 0
                    ? tEditor("pointsLeft", { count: -delta })
                    : tEditor("pointsOver", { count: delta })}
              </AlertTitle>
            </Alert>
            <div className="flex shrink-0 items-center gap-2">
              {withAiReview && reviewLocked === false && !dirty && (
                <MorphPopover
                  triggerLabel={tAi("openReviewCta")}
                  triggerIcon={AiEditingIcon}
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
                size="sm"
                disabled={saving || delta !== 0 || !dirty}
                onClick={onSave}
              >
                {tEditor("saveCta")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {onWeight ? (
        model.criteria.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tEditor("empty")}</p>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {model.criteria.map((criterion) => {
                const points = pointsFor(criterion)
                return (
                  <CriterionItem
                    key={criterion.criterionId}
                    name={criterion.name}
                    description={criterion.shortUiText || undefined}
                    extendedDescription={criterion.fullDefinition || undefined}
                    editable={false}
                    importanceNode={
                      <WeightPointRow
                        name={criterion.name}
                        value={points}
                        disabled={saving}
                        onChange={(option) =>
                          setDraft((current) => ({
                            ...current,
                            [criterion.criterionId]: option,
                          }))
                        }
                      />
                    }
                    note={
                      <span>
                        <span className="font-medium text-foreground tabular-nums">
                          {formatShare(points, totalPoints, locale)}
                        </span>{" "}
                        {tBuilder("shareOfTotal")}
                      </span>
                    }
                  />
                )
              })}
            </AnimatePresence>
          </ul>
        )
      ) : (
        // Define phase: four fixed dimension sections (ADR-0021), headers and
        // help text from the wire's localized `dimensions` block. Each section
        // lists only ITS OWN criteria (grouped by dimensionKey) and offers a
        // library picker scoped to that dimension.
        <div className="space-y-6">
          {model.dimensions.map((dimension) => {
            const dimensionCriteria = model.criteria.filter(
              (criterion) => criterion.dimensionKey === dimension.key
            )
            return (
              <section key={dimension.key} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-1 font-medium text-sm">
                    {dimension.name}
                    <HelpMorphButton label={dimension.name}>
                      {dimension.why}
                    </HelpMorphButton>
                  </h3>
                  <LibraryPickerDialog
                    orgId={orgId}
                    dimensionKey={dimension.key}
                    dimensionName={dimension.name}
                    selectedKeys={selectedKeys}
                  />
                </div>
                {dimensionCriteria.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {tEditor("emptyDimension")}
                  </p>
                ) : (
                  <ul>
                    <AnimatePresence initial={false}>
                      {dimensionCriteria.map((criterion) => (
                        <CriterionItem
                          key={criterion.criterionId}
                          name={criterion.name}
                          description={criterion.shortUiText || undefined}
                          extendedDescription={
                            criterion.fullDefinition || undefined
                          }
                          anchors={criterion.anchors}
                          anchorsCaption={tEditor("anchorsCaption")}
                          editable
                          onRemove={() => onRemove(criterion.criterionId)}
                          removing={removing === criterion.criterionId}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {errorKey !== null && (
        <p role="alert" className="text-destructive text-sm">
          {errorKey === "generic" ? tError("error") : tErrors(errorKey)}
        </p>
      )}
    </div>
  )
}
