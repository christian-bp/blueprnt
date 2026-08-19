"use client"

import { DndContext, DragOverlay } from "@dnd-kit/core"
import {
  AiEditingIcon,
  InformationCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  CRITERIA_LIBRARY_KEYS,
  type CriteriaLibraryKey,
  criteriaLibraryContent,
  LIBRARY_DIMENSION,
  LIBRARY_INDUSTRY_HINTS,
  LIBRARY_OVERLAP_PAIRS,
} from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import { clampIndustry } from "@workspace/constants"
import {
  DIMENSION_MAX_ACTIVE,
  type DimensionKey,
  MODEL_MAX_CRITERIA,
  pointBudget,
} from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import { LayoutGroup } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import {
  BUILD_GRID_CLASS,
  BuildGridSkeleton,
} from "@/components/model/criterion-list-skeleton"
import { DimensionDropZone } from "@/components/model/dimension-drop-zone"
import { LibraryCriterionCard } from "@/components/model/library-criterion-card"
import { PlacedCriterionCard } from "@/components/model/placed-criterion-card"
import { WeightReviewPanel } from "@/components/model/weight-review-panel"
import { MorphPopover } from "@/components/morph-popover"
import { type BuildDragCard, useBuildDnd } from "@/hooks/use-build-dnd"
import { toast } from "@/lib/toast"
import { formatShare } from "@/lib/weighting"

// Error codes this surface can actually provoke, each with its own translated
// message; anything else falls back to the generic toast. The backend is the
// authority on every cap even though the view closes the routes in first: a
// second tab, a stale render, or a race can still reach a mutation the view
// believed was open.
const KNOWN_ERROR_KEYS = [
  "dimensionCapExceeded",
  "tooManyCriteria",
  "criterionAlreadySelected",
  "weightsUnbalanced",
] as const

// One criterion morphs between two cards: the library card it is dragged from
// and the placed card it becomes. A shared layoutId is what makes that one
// object moving rather than two objects appearing and vanishing, in both
// directions (removing a criterion morphs it back into its list).
function morphIdFor(libraryKey: string): string {
  return `model-criterion-${libraryKey}`
}

// The model build view: the whole model, assembled on one page.
//
// Four columns, one per dimension (ADR-0021: fixed method law). Each column is
// its dimension's drop zone with that dimension's own library list directly
// underneath, so choosing a criterion is a short vertical move and which
// dimension a criterion belongs to needs no explaining. Everything the model
// decides about a criterion (whether it is in, and how much it counts) is
// therefore on one surface, and the role-facing 1-5 evaluation scale is on
// none of it: the weighting is also 1-5, and the two side by side is the
// confusion this layout exists to end. The anchors belong to rating a role.
//
// Two equal routes in: drag a card into the zone above it, or press its Add
// button. Both call the same mutation. The drag is not the feature and the
// button is not a fallback.
export function ModelBuilder({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.build")
  const tHelp = useTranslations("dashboard.help")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const tAi = useTranslations("dashboard.ai")
  const locale = useLocale()

  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  // The org's industry drives the "recommended" chips: a hint from the
  // library's own combination tables, never a selection (the company still
  // chooses and documents its own criteria).
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })
  // True right after a confirmed weight review, until the weighting changes
  // again: the review trigger is hidden while it holds.
  const reviewLocked = useQuery(api.ai.suggest.getWeightReviewLock, { orgId })

  const activateCriterion = useMutation(
    api.evaluationModel.criteria.activateCriterion
  )
  const deactivateCriterion = useMutation(
    api.evaluationModel.criteria.deactivateCriterion
  )
  const rebalanceWeights = useMutation(
    api.evaluationModel.criteria.rebalanceWeights
  )

  // Local draft allocation (criterionId -> points), overriding the stored
  // points until Save posts the whole allocation atomically. Weight edits
  // accumulate here rather than writing per click, because the budget is a
  // sum: a single criterion moving is never a valid allocation on its own.
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const content = criteriaLibraryContent(locale)
  // Everything below reads through these, so the derivations are written once
  // for the loading state and the loaded one; the early returns come after the
  // hooks (a drag controller cannot be conditional).
  const criteria = model?.criteria ?? []
  const dimensions = model?.dimensions ?? []
  const selectedKeys = new Set(
    criteria.map((criterion) => criterion.libraryKey)
  )
  const selectedNames = new Map(
    criteria.map((criterion) => [criterion.libraryKey, criterion.name])
  )
  const industry = settings?.industry ?? null
  const recommendedKeys: readonly string[] =
    industry === null ? [] : LIBRARY_INDUSTRY_HINTS[clampIndustry(industry)]

  // The already-selected criteria this one overlaps, by name. Named rather
  // than counted: "overlaps something" is a warning nobody can act on.
  function overlapsSelected(libraryKey: string): string[] {
    const names: string[] = []
    for (const [first, second] of LIBRARY_OVERLAP_PAIRS) {
      const partner =
        first === libraryKey ? second : second === libraryKey ? first : null
      if (partner === null) continue
      const name = selectedNames.get(partner)
      if (name !== undefined) names.push(name)
    }
    return names
  }

  const libraryFor = (dimensionKey: DimensionKey) =>
    CRITERIA_LIBRARY_KEYS.filter(
      (key) => LIBRARY_DIMENSION[key] === dimensionKey && !selectedKeys.has(key)
    )
  const countIn = (dimensionKey: DimensionKey) =>
    criteria.filter((criterion) => criterion.dimensionKey === dimensionKey)
      .length
  const modelFull = criteria.length >= MODEL_MAX_CRITERIA
  const isFull = (dimensionKey: DimensionKey) =>
    modelFull || countIn(dimensionKey) >= DIMENSION_MAX_ACTIVE[dimensionKey]
  // Why this dimension's remaining cards are closed, in words. A flow states
  // its preconditions rather than silently refusing (the backend enforces the
  // same two caps); which bound is binding decides which sentence is true.
  function capReason(dimensionKey: DimensionKey): string | undefined {
    if (countIn(dimensionKey) >= DIMENSION_MAX_ACTIVE[dimensionKey]) {
      return t("capDimension", { max: DIMENSION_MAX_ACTIVE[dimensionKey] })
    }
    if (modelFull) return t("capModel", { max: MODEL_MAX_CRITERIA })
    return undefined
  }

  const pointsFor = (criterion: {
    criterionId: string
    weightPoints: number
  }) => draft[criterion.criterionId] ?? criterion.weightPoints
  const totalPoints = criteria.reduce(
    (sum, criterion) => sum + pointsFor(criterion),
    0
  )
  const budget = pointBudget(criteria.length)
  const delta = totalPoints - budget
  const dirty = criteria.some(
    (criterion) => pointsFor(criterion) !== criterion.weightPoints
  )

  function errorToast(error: unknown) {
    if (error instanceof ConvexError) {
      const code = (error.data as { code?: string } | null)?.code
      const known = KNOWN_ERROR_KEYS.find((key) => code === `errors.${key}`)
      if (known !== undefined) {
        toast.error(tErrors(known))
        return
      }
    }
    toast.error(tToast("error"))
  }

  async function onAdd(libraryKey: CriteriaLibraryKey) {
    // One at a time: both routes in land on the same mutation, and a second
    // press before the first lands would only earn an already-selected error.
    if (adding !== null) return
    setAdding(libraryKey)
    try {
      await activateCriterion({ orgId, libraryKey })
      toast.success(tToast("criterionActivated"))
    } catch (error) {
      errorToast(error)
    } finally {
      setAdding(null)
    }
  }

  async function onRemove(criterionId: Id<"criteria">) {
    setRemoving(criterionId)
    try {
      await deactivateCriterion({ orgId, criterionId })
      // Only this criterion's draft entry goes: deactivation redistributes its
      // points across the survivors, so the edits still in flight for the rest
      // stay on screen (now against a budget three points smaller, which the
      // bar says out loud).
      setDraft((current) => {
        const { [criterionId]: _removed, ...rest } = current
        return rest
      })
      toast.success(tToast("criterionRemoved"))
    } catch (error) {
      errorToast(error)
    } finally {
      setRemoving(null)
    }
  }

  async function onSave() {
    if (!dirty || delta !== 0) return
    setSaving(true)
    try {
      await rebalanceWeights({
        orgId,
        allocations: criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          weightPoints: pointsFor(criterion),
        })),
      })
      setDraft({})
      toast.success(tToast("weightsSaved"))
    } catch (error) {
      errorToast(error)
    } finally {
      setSaving(false)
    }
  }

  // Every unselected library card, whether or not a cap has closed it: a card
  // that stopped being draggable mid-drag must still have a name to narrate.
  const dragCards: BuildDragCard[] = dimensions.flatMap((dimension) =>
    libraryFor(dimension.key).map((key) => ({
      libraryKey: key,
      dimensionKey: dimension.key,
      name: content.criteria[key].name,
    }))
  )
  const dimensionName = (key: DimensionKey) =>
    dimensions.find((dimension) => dimension.key === key)?.name ?? key
  const { dndContextProps, activeCard } = useBuildDnd({
    cards: dragCards,
    dimensionName,
    onDrop: (libraryKey) => {
      void onAdd(libraryKey as CriteriaLibraryKey)
    },
  })

  if (model === undefined) return <BuildGridSkeleton />
  if (model === null) return null

  const balanced = delta === 0
  const showReview =
    reviewLocked === false && !dirty && criteria.length > 0 && !saving

  return (
    <DndContext {...dndContextProps}>
      <div className="space-y-4">
        {/* One layout group around the whole grid: a criterion leaving a
            library list and arriving in a zone is the SAME card, and the two
            only find each other through their shared morph id. */}
        <LayoutGroup id="model-build">
          <div className={BUILD_GRID_CLASS}>
            {model.dimensions.map((dimension) => {
              const placed = model.criteria.filter(
                (criterion) => criterion.dimensionKey === dimension.key
              )
              const entries = libraryFor(dimension.key)
              const dimmedReason = capReason(dimension.key)
              return (
                <div key={dimension.key} className="space-y-3">
                  <DimensionDropZone
                    dimensionKey={dimension.key}
                    title={dimension.name}
                    helpBody={dimension.question}
                    count={placed.length}
                    max={DIMENSION_MAX_ACTIVE[dimension.key]}
                    full={isFull(dimension.key)}
                  >
                    {placed.length === 0
                      ? undefined
                      : placed.map((criterion) => (
                          <PlacedCriterionCard
                            key={criterion.criterionId}
                            layoutId={morphIdFor(criterion.libraryKey)}
                            criterion={criterion}
                            weight={pointsFor(criterion)}
                            share={formatShare(
                              pointsFor(criterion),
                              totalPoints,
                              locale
                            )}
                            removing={removing === criterion.criterionId}
                            disabled={saving}
                            onWeightChange={(points) =>
                              setDraft((current) => ({
                                ...current,
                                [criterion.criterionId]: points,
                              }))
                            }
                            onRemove={() => onRemove(criterion.criterionId)}
                          />
                        ))}
                  </DimensionDropZone>
                  {entries.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      {t("libraryEmpty")}
                    </p>
                  ) : (
                    // Named for assistive tech rather than headed on screen:
                    // four identical headings down a four-column grid say
                    // nothing the zone directly above each list has not
                    // already said.
                    <ul
                      aria-label={t("libraryLabel", {
                        dimension: dimension.name,
                      })}
                      className="space-y-2"
                    >
                      {entries.map((key) => (
                        <LibraryCriterionCard
                          key={key}
                          layoutId={morphIdFor(key)}
                          entry={{
                            libraryKey: key,
                            dimensionKey: dimension.key,
                            name: content.criteria[key].name,
                            shortUiText: content.criteria[key].shortUiText,
                          }}
                          recommended={recommendedKeys.includes(key)}
                          overlapsSelected={overlapsSelected(key)}
                          dimmedReason={dimmedReason}
                          onAdd={() => onAdd(key)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </LayoutGroup>

        {/* The budget and the one save, in a bar that stays on screen while
            the columns scroll past it: the allocation is a sum over all four
            dimensions, so the figure that says whether it adds up cannot live
            at the bottom of a page taller than the viewport. */}
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-sm">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sm tabular-nums">
                {/* Both figures move while the reader watches (a weight click
                    changes the sum, adding a criterion changes the budget),
                    so they roll rather than swap. Tagged inside the message
                    rather than concatenated around it: the connective and the
                    unit are the translator's. */}
                {t.rich("budgetAllocated", {
                  allocated: () => <NumberFlow value={totalPoints} />,
                  budget: () => <NumberFlow value={budget} />,
                })}
              </p>
              <HelpMorphButton label={tHelp("weightingLabel")}>
                {tHelp("weightingBody")}
              </HelpMorphButton>
              {/* Last in the LEFT group on purpose: it comes and goes with the
                  lock and with the first unsaved edit, and there it grows into
                  free space instead of shifting the save button out from under
                  the pointer. */}
              {showReview && (
                <MorphPopover
                  triggerLabel={tAi("openReviewCta")}
                  triggerIcon={AiEditingIcon}
                  anchor="left"
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
            </div>
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm",
                balanced
                  ? "text-muted-foreground"
                  : // Alert has no warning variant, so the amber is a
                    // call-site override, as everywhere else in this section.
                    "text-amber-700 dark:text-amber-400"
              )}
            >
              <HugeiconsIcon
                icon={balanced ? Tick02Icon : InformationCircleIcon}
                size={16}
                strokeWidth={2}
                aria-hidden="true"
              />
              {criteria.length === 0
                ? t("budgetEmpty")
                : balanced
                  ? t("balanced")
                  : delta < 0
                    ? t("pointsLeft", { count: -delta })
                    : t("pointsOver", { count: delta })}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={saving || !balanced || !dirty}
            onClick={onSave}
          >
            {t("saveCta")}
          </Button>
        </div>
      </div>
      {/* What the hand is carrying. The card itself stays in its list at
          reduced opacity, so the list never reflows under the pointer. */}
      <DragOverlay>
        {activeCard !== null && (
          <div className="rounded-md border bg-card px-3 py-2 font-medium text-sm shadow-md">
            {activeCard.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
