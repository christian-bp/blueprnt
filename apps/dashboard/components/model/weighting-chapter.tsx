"use client"

import { AiEditingIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { pointBudget } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence } from "motion/react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { WeightBudgetBar } from "@/components/model/weight-budget-bar"
import { PlacedCriterionCard } from "@/components/model/placed-criterion-card"
import { WeightReviewPanel } from "@/components/model/weight-review-panel"
import { MorphPopover } from "@/components/morph-popover"
import { chapterHref } from "@/lib/model-chapters"
import { modelErrorKey } from "@/lib/model-errors"
import { toast } from "@/lib/toast"
import { formatShare } from "@/lib/weighting"

// The grid's geometry, declared once and used by both states, so the loading
// state and the loaded one can never drift into two different grids.
const GRID_CLASS = "grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4"

// A figure standing inside a line of prose: it sits in the text flow rather
// than opening a block of its own, and is sized to the one or two digits it
// stands in for.
const NUMBER_BAR_CLASS = "inline-block h-3 w-5 align-middle"

// The Viktning chapter: how much each chosen criterion counts.
//
// The same four columns the Kriterier chapter draws, so a criterion stays
// where the reader last saw it, but the cards carry their 1-5 weight row and
// derived share here and nowhere else. The allocation is a SUM (ADR-0004: a
// fixed point budget of criteria count x 3), so a single criterion moving is
// never a valid allocation on its own: edits accumulate in a local draft and
// the budget bar posts the whole allocation at once.
export function WeightingChapter({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.weighting")
  const tErrors = useTranslations("errors")
  const tToast = useTranslations("dashboard.toast")
  const tAi = useTranslations("dashboard.ai")
  const locale = useLocale()

  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  // True right after a confirmed weight review, until the weighting changes
  // again: the review trigger is hidden while it holds.
  const reviewLocked = useQuery(api.ai.suggest.getWeightReviewLock, { orgId })

  const rebalanceWeights = useMutation(
    api.evaluationModel.criteria.rebalanceWeights
  )

  // Local draft allocation (criterionId -> points), overriding the stored
  // points until Save posts the whole allocation atomically.
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  if (model === undefined) return <WeightingChapterSkeleton />
  if (model === null) return null

  const criteria = model.criteria
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
  const balanced = delta === 0
  const dirty = criteria.some(
    (criterion) => pointsFor(criterion) !== criterion.weightPoints
  )
  const showReview =
    reviewLocked === false && !dirty && criteria.length > 0 && !saving

  function errorToast(error: unknown) {
    const known = modelErrorKey(error)
    toast.error(known === undefined ? tToast("error") : tErrors(known))
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

  return (
    <div className="space-y-4">
      {/* The budget and the one save, at the top: the allocation is a sum
          over every dimension, so the figure that says whether it adds up
          belongs where the reader starts rather than under a list they have to
          reach the end of. */}
      <WeightBudgetBar
        readout={
          // Both figures move while the reader watches (a weight click changes
          // the sum, removing a criterion changes the budget), so they roll
          // rather than swap. Tagged inside the message rather than
          // concatenated around it: the connective and the unit are the
          // translator's.
          t.rich("budgetAllocated", {
            allocated: () => <NumberFlow value={totalPoints} />,
            budget: () => <NumberFlow value={budget} />,
          })
        }
        balanced={balanced}
        status={
          criteria.length === 0
            ? t("budgetEmpty")
            : balanced
              ? t("balanced")
              : delta < 0
                ? t("pointsLeft", { count: -delta })
                : t("pointsOver", { count: delta })
        }
        reviewOffered={showReview}
        review={
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
        }
        action={
          <Button
            type="button"
            size="sm"
            disabled={saving || !balanced || !dirty}
            onClick={onSave}
          >
            {t("saveCta")}
          </Button>
        }
      />
      {criteria.length === 0 ? (
        // Never a bare page: the chapter has nothing to weight until the
        // previous one has been done, and it says so with the way back.
        <p className="text-muted-foreground text-sm">
          {t.rich("empty", {
            link: (chunks) => (
              <Link
                href={chapterHref("criteria")}
                className="text-brand underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : (
        <div className={GRID_CLASS}>
          {model.dimensions.map((dimension) => {
            const placed = criteria.filter(
              (criterion) => criterion.dimensionKey === dimension.key
            )
            if (placed.length === 0) return null
            return (
              <section key={dimension.key} className="space-y-2">
                <h3 className="truncate font-medium text-sm">
                  {dimension.name}
                </h3>
                {/* Nothing on this chapter adds or removes a criterion (that
                    is the Kriterier chapter's job), but the model is a live
                    query: a criterion removed there, or in another tab, still
                    leaves this list. popLayout takes it out of flow at once so
                    the cards under it close the gap in one pass rather than
                    waiting out the fade (ui-animation.md rules 3 and 6), and
                    initial={false} keeps arriving on the page from animating. */}
                <ul className="space-y-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {placed.map((criterion) => (
                      <PlacedCriterionCard
                        key={criterion.criterionId}
                        criterion={criterion}
                        weight={{
                          points: pointsFor(criterion),
                          share: formatShare(
                            pointsFor(criterion),
                            totalPoints,
                            locale
                          ),
                          onChange: (points) =>
                            setDraft((current) => ({
                              ...current,
                              [criterion.criterionId]: points,
                            })),
                        }}
                        disabled={saving}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

// The chapter's loading state: the real budget bar over a placeholder column,
// so the bar (which the columns scroll under) measures identically in both
// states. How many criteria there are and which dimensions hold them is
// entirely the data, so the list above is bars.
function WeightingChapterSkeleton() {
  const t = useTranslations("dashboard.model.weighting")
  const tAi = useTranslations("dashboard.ai")
  return (
    <div className="space-y-4">
      <WeightBudgetBar
        readout={
          // The sentence is static i18n text and renders for real; only the two
          // figures are unknown, so only they are bars, sized to the one or two
          // digits they stand in for.
          t.rich("budgetAllocated", {
            allocated: () => <Skeleton className={NUMBER_BAR_CLASS} />,
            budget: () => <Skeleton className={NUMBER_BAR_CLASS} />,
          })
        }
        // Nothing is out of balance until the data says so, so the block
        // opens in its neutral state rather than flashing a warning tint.
        balanced={true}
        status={
          // Which of the four sentences is true is entirely the data.
          <Skeleton className="h-3 w-52 max-w-full" />
        }
        // Whether the review is on offer needs the model and the review lock,
        // so the slot stays reserved and empty, exactly as it does whenever the
        // loaded bar has nothing to offer.
        reviewOffered={false}
        review={
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            className="pointer-events-none"
          >
            <HugeiconsIcon
              icon={AiEditingIcon}
              strokeWidth={2}
              aria-hidden="true"
            />
            {tAi("openReviewCta")}
          </Button>
        }
        action={
          // The real save button, disabled: that is the truthful state, not a
          // loading effect. The loaded bar opens clean (nothing edited), where
          // the save is disabled too.
          <Button type="button" size="sm" disabled>
            {t("saveCta")}
          </Button>
        }
      />
      <div className={GRID_CLASS}>
        {Array.from({ length: 2 }, (_, column) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
            key={column}
            className="space-y-2"
          >
            {/* The dimension's name is library content, but WHICH dimensions
                hold criteria is the data, so the heading is a bar here. */}
            <div className="flex h-5 items-center">
              <Skeleton className="h-4 w-32" />
            </div>
            <ul aria-hidden="true" className="space-y-2">
              {Array.from({ length: 2 }, (_, row) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
                  key={row}
                  className="rounded-md border bg-card p-3"
                >
                  {/* The name line, the weight row's own height, and the share
                      line, so a placeholder card measures like a real one. */}
                  <div className="flex h-9 items-center">
                    <Skeleton className="h-4 w-36 max-w-full" />
                  </div>
                  <Skeleton className="mt-2 h-8 w-full" />
                  <div className="mt-1.5 flex h-4 items-center">
                    <Skeleton className="h-3 w-28" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
