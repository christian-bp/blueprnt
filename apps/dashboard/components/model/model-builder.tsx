"use client"

import {
  AiEditingIcon,
  InformationCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { pointBudget } from "@workspace/core"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import { AnimatePresence } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { MorphPopover } from "@/components/morph-popover"
import { CriterionItem } from "@/components/model/criterion-item"
import { CriterionListSkeleton } from "@/components/model/criterion-list-skeleton"
import {
  EditCriterionDialog,
  type EditCriterionTarget,
} from "@/components/model/edit-criterion-dialog"
import { WeightReviewPanel } from "@/components/model/weight-review-panel"
import { formatShare, WEIGHT_POINT_OPTIONS } from "@/lib/weighting"

// The two activities of building a model, kept on separate phases so the
// role-facing 0-5 evaluation scale and the model-facing 1-5 weighting are never
// shown at the same time (the source of the "is this scale the weight?"
// confusion). Define owns identity + the evaluation scale; Weight owns the
// 1-5 allocation. The two are never co-mounted.
export type ModelPhase = "define" | "weight"

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

type WeightMeaningKey = `weightMeaning${1 | 2 | 3 | 4 | 5}`

// The shared model builder for a single phase, hosted by the /model routes
// (the Criteria and Weighting pages, navigated by the header ModelTabs) and the
// onboarding model step (the wizard footer advances Define -> Weight). Phase
// navigation is owned by the host; this component renders the active phase: the
// criteria + evaluation scale + add dialog on Define, and the 1-5 allocation,
// budget meter, atomic save, and AI review on Weight.
export function ModelBuilder({
  orgId,
  phase,
  withAiReview,
  removalFloor,
}: {
  orgId: string
  phase: ModelPhase
  // Weight phase: offer the AI weighting review (a balanced suggestion HR
  // confirms).
  withAiReview?: boolean
  // Hide the per-row remove affordance when the criteria count is at or below
  // this floor (the /model page passes MIN_CRITERIA). Omitted during
  // onboarding, where a model under construction removes freely.
  removalFloor?: number
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
  const removeCriterion = useMutation(
    api.evaluationModel.criteria.removeCriterion
  )
  // Local draft allocation for the Weight phase (criterionId -> points);
  // overrides the stored points until Save posts the whole allocation
  // atomically. Persisting across a phase switch is intentional: switching to
  // Define and back keeps an in-progress reweighting.
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<EditCriterionTarget | null>(null)
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
        <CriterionListSkeleton variant={loadingWeight ? "weight" : "define"} />
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
  const removalAllowed =
    removalFloor === undefined || model.criteria.length > removalFloor

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

      {model.criteria.length === 0 ? (
        <p className="text-muted-foreground text-sm">{tEditor("empty")}</p>
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {model.criteria.map((criterion) => {
              if (onWeight) {
                const points = pointsFor(criterion)
                return (
                  <CriterionItem
                    key={criterion.criterionId}
                    name={criterion.name}
                    description={criterion.description || undefined}
                    extendedDescription={criterion.helpText || undefined}
                    editable={false}
                    importanceNode={
                      // Each weight button is its own hover trigger, so hovering
                      // (or focusing) a single level reveals ONLY that level's
                      // meaning. Because the per-criterion weighting texts are
                      // full sentences (not the short generic phrases), one
                      // popover per level reads far better than a single card
                      // listing all five. Root/Trigger(render) add no DOM and
                      // Content portals out, so the joined ButtonGroup styling
                      // (which targets direct children) is unaffected.
                      <ButtonGroup
                        aria-label={tEditor("setWeightPoints", {
                          name: criterion.name,
                        })}
                        className="w-full"
                      >
                        {WEIGHT_POINT_OPTIONS.map((option) => {
                          // The criterion's own weighting text for this level
                          // when it is a pristine template criterion (getModel
                          // localizes weightLevels[1..5]); the generic level
                          // meaning for custom or edited criteria (null).
                          const meaning =
                            criterion.weightLevels?.[option - 1] ??
                            tBuilder(
                              `weightMeaning${option}` as WeightMeaningKey
                            )
                          return (
                            <HoverCard
                              key={option}
                              // Keep the card open when you click to pick this
                              // level: the button is its own trigger, so
                              // without this the press dismisses the card and
                              // hover reopens it (a flicker). It still closes
                              // on pointer-leave.
                              onOpenChange={(nextOpen, eventDetails) => {
                                if (
                                  !nextOpen &&
                                  (eventDetails.reason === "trigger-press" ||
                                    eventDetails.reason === "outside-press")
                                ) {
                                  eventDetails.cancel()
                                }
                              }}
                            >
                              <HoverCardTrigger
                                delay={150}
                                closeDelay={100}
                                render={
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      points === option ? "default" : "outline"
                                    }
                                    disabled={saving}
                                    aria-pressed={points === option}
                                    className="flex-1 px-0 tabular-nums"
                                    onClick={() =>
                                      setDraft((current) => ({
                                        ...current,
                                        [criterion.criterionId]: option,
                                      }))
                                    }
                                  />
                                }
                              >
                                {option}
                              </HoverCardTrigger>
                              <HoverCardContent align="center" className="w-72">
                                <p className="text-muted-foreground text-sm">
                                  {meaning}
                                </p>
                              </HoverCardContent>
                            </HoverCard>
                          )
                        })}
                      </ButtonGroup>
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
              }
              const isRemoving = removing === criterion.criterionId
              return (
                <CriterionItem
                  key={criterion.criterionId}
                  name={criterion.name}
                  description={criterion.description || undefined}
                  extendedDescription={criterion.helpText || undefined}
                  anchors={criterion.anchors}
                  anchorsCaption={tEditor("anchorsCaption")}
                  editable
                  onEdit={() =>
                    setEditTarget({
                      criterionId: criterion.criterionId,
                      name: criterion.name,
                      description: criterion.description,
                      helpText: criterion.helpText,
                      anchors: criterion.anchors.map((anchor) => anchor.text),
                    })
                  }
                  onRemove={
                    removalAllowed
                      ? async () => {
                          setRemoving(criterion.criterionId)
                          setErrorKey(null)
                          try {
                            await removeCriterion({
                              orgId,
                              criterionId: criterion.criterionId,
                            })
                            toast.success(tToast("criterionRemoved"))
                          } catch (error) {
                            setErrorKey(errorKeyFor(error))
                          } finally {
                            setRemoving(null)
                          }
                        }
                      : undefined
                  }
                  removing={isRemoving}
                />
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      {!onWeight && removalFloor !== undefined && (
        // The floor hint toggles with opacity (not conditional mounting) so it
        // never shifts the list when removalAllowed flips mid-edit (removing
        // down to the floor). The Add action lives in the page header, the same
        // placement as "Add role" on the roles page.
        <p
          aria-hidden={removalAllowed}
          className={cn(
            "text-muted-foreground text-xs",
            removalAllowed && "opacity-0"
          )}
        >
          {tEditor("removalFloorHint", { min: removalFloor })}
        </p>
      )}

      {errorKey !== null && (
        <p role="alert" className="text-destructive text-sm">
          {errorKey === "generic" ? tError("error") : tErrors(errorKey)}
        </p>
      )}
      <EditCriterionDialog
        orgId={orgId}
        target={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  )
}
