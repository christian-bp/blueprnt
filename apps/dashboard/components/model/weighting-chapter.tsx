"use client"

import { AiEditingIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  type DimensionKey,
  DIMENSION_WEIGHT_WARNING_SHARE,
  PEOPLE_LEADERSHIP_LIBRARY_KEY,
  pointBudget,
  PROFILE_WEIGHT_FLOOR,
} from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence } from "motion/react"
import Link from "next/link"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { CHAPTER_GRID_CLASS } from "@/components/model/chapter-grid"
import { WeightBudgetBar } from "@/components/model/weight-budget-bar"
import { PlacedCriterionCard } from "@/components/model/placed-criterion-card"
import {
  WeightMotivationDialog,
  type WeightMotivationTarget,
} from "@/components/model/weight-motivation-dialog"
import { WeightReviewPanel } from "@/components/model/weight-review-panel"
import { MorphPopover } from "@/components/morph-popover"
import { useOrganization } from "@/components/org-context"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import { chapterHref } from "@/lib/model-chapters"
import { modelErrorKey } from "@/lib/model-errors"
import { toast } from "@/lib/toast"
import {
  DIMENSION_SHARE_FORMAT,
  shareFraction,
  weightMotivationTarget,
} from "@/lib/weighting"

// One weight warning as the column renders it: which of the chapter's two the
// note is, whether it is still unanswered (the amber), the sentence it states,
// and what the dialog behind it writes.
interface MotivationNote {
  id: string
  flagged: boolean
  text: string
  target: WeightMotivationTarget
}

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
  const format = useFormatter()
  // Writing a motivation is an adminMutation, like saving the weighting itself.
  // An editor reads the dominance note (it explains the balance they are
  // looking at) and is offered neither control.
  const { role } = useOrganization()
  const isAdmin = role === "admin"

  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  // True right after a confirmed weight review, until the weighting changes
  // again: the review trigger is hidden while it holds.
  const reviewLocked = useQuery(api.ai.suggest.getWeightReviewLock, { orgId })
  // The ENGINE's verdict on the weighting, not a second derivation of it: the
  // same query (and the same live subscription) the section's spine and the
  // Godkännande checklist read, so the note here and the checklist row there
  // can never disagree about whether a dimension dominates.
  const checks = useQuery(api.evaluationModel.approval.getMethodChecks, {
    orgId,
  })

  const rebalanceWeights = useMutation(
    api.evaluationModel.criteria.rebalanceWeights
  )

  // Local draft allocation (criterionId -> points), overriding the stored
  // points until Save posts the whole allocation atomically.
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [motivating, setMotivating] = useState<WeightMotivationTarget | null>(
    null
  )

  if (model === undefined) return <WeightingChapterSkeleton />
  if (model === null) return null

  const criteria = model.criteria

  // The stored share per dimension (a fraction), as the engine computed it.
  // Deliberately NOT the draft-aware share the headings show: the warning is
  // about the allocation that is saved, and a note that appeared mid-drag would
  // be scolding the reader for an edit they have not made yet.
  const storedShare = (key: DimensionKey) =>
    checks?.dimensionShares.find((entry) => entry.key === key)?.share ?? 0
  // Which dimensions the engine's own dimensionWeightBalance check names, i.e.
  // over the threshold AND with no motivation recorded anywhere in them.
  const unmotivated = new Set<DimensionKey>(
    checks?.checks.find((check) => check.key === "dimensionWeightBalance")
      ?.dimensions ?? []
  )
  // The engine's second weight warning: a people-leadership criterion in the
  // high-impact weight class needs its own recorded reason. It names no
  // criterion in its result (there is only ever one), so the column finds it by
  // library key.
  const leadershipOk =
    checks?.checks.find((check) => check.key === "peopleLeadershipWeight")
      ?.ok !== false
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
        <div className={CHAPTER_GRID_CLASS}>
          {model.dimensions.map((dimension) => {
            const placed = criteria.filter(
              (criterion) => criterion.dimensionKey === dimension.key
            )
            if (placed.length === 0) return null
            // The same comparison the engine makes, against the same exported
            // constant and the same unrounded fraction, so the note and the
            // checklist row cannot land on opposite sides of the threshold.
            const share = storedShare(dimension.key)
            // The criterion a DIMENSION-level motivation is written on. An
            // existing one wins over the heaviest: a motivation written when a
            // different criterion was the heaviest must be EDITED where it
            // lives, not shadowed by a second copy on a criterion that has
            // since overtaken it (which would leave two for one dimension).
            const dimensionTarget =
              placed.find(
                (criterion) => (criterion.weightMotivation ?? "").length > 0
              ) ?? weightMotivationTarget(placed)
            // The people-leadership criterion, when this column holds it and it
            // sits in the model's high-impact weight class. Its warning asks
            // about the CRITERION, not the dimension, and clears only on its
            // own motivation, so it gets its own note even where the dimension
            // is already answered. Collapsed into one when the dimension's own
            // target IS this criterion: one motivation clears both there, and
            // two notes offering the same field would be a bug in disguise.
            const leadership = placed.find(
              (criterion) =>
                criterion.libraryKey === PEOPLE_LEADERSHIP_LIBRARY_KEY &&
                criterion.weightPoints >= PROFILE_WEIGHT_FLOOR
            )
            const notes: MotivationNote[] = []
            if (
              share > DIMENSION_WEIGHT_WARNING_SHARE &&
              dimensionTarget !== undefined
            ) {
              const flagged = unmotivated.has(dimension.key)
              notes.push({
                id: `dimension:${dimension.key}`,
                flagged,
                text: t(flagged ? "dominanceNote" : "dominanceMotivatedNote", {
                  dimension: dimension.name,
                  share: format.number(share, DIMENSION_SHARE_FORMAT),
                }),
                target: {
                  subject: dimension.name,
                  criterionId: dimensionTarget.criterionId,
                  criterionName: dimensionTarget.name,
                  savedOnSubject: false,
                  motivation: dimensionTarget.weightMotivation,
                },
              })
            }
            if (
              leadership !== undefined &&
              // Collapse only against a note that was actually pushed: the
              // dimension's target exists even when the dimension is under the
              // threshold and draws nothing, and testing it directly hid the
              // leadership note in exactly the case that needs it (a
              // people-leadership criterion alone in its column).
              !notes.some(
                (note) => note.target.criterionId === leadership.criterionId
              )
            ) {
              notes.push({
                id: `criterion:${leadership.criterionId}`,
                flagged: !leadershipOk,
                text: t(
                  leadershipOk ? "leadershipMotivatedNote" : "leadershipNote",
                  {
                    criterion: leadership.name,
                    points: leadership.weightPoints,
                  }
                ),
                target: {
                  subject: leadership.name,
                  criterionId: leadership.criterionId,
                  criterionName: leadership.name,
                  savedOnSubject: true,
                  motivation: leadership.weightMotivation,
                },
              })
            }
            return (
              <section key={dimension.key} className="space-y-2">
                {/* The dimension's own share of the weighting, beside its
                    name: the balance between dimensions is the thing this
                    chapter can get wrong, and it was only visible on the
                    Godkännande checklist after the fact. Derived from the
                    LOCAL allocation, so it moves with an unsaved edit the way
                    the cards' own shares do, and rounded to whole points
                    because a heading is a balance reading rather than a figure
                    anyone reconciles. */}
                <h3 className="truncate font-medium text-sm">
                  {t.rich("dimensionShare", {
                    dimension: dimension.name,
                    share: () => (
                      <NumberFlow
                        value={shareFraction(
                          placed.reduce(
                            (sum, criterion) => sum + pointsFor(criterion),
                            0
                          ),
                          totalPoints
                        )}
                        format={DIMENSION_SHARE_FORMAT}
                      />
                    ),
                  })}
                </h3>
                {/* The weight warnings WHERE THE DECISION IS MADE, not only as
                    a verdict two chapters later. Each sits under the heading it
                    is about, so the fact, the figure and both ways out (record
                    why, or move points) are one thing to read; the Godkännande
                    checklist reports the same findings and links back here.

                    Answered and unanswered render the same box, so recording a
                    motivation changes the tone and the wording without moving
                    the cards under it. */}
                {notes.map((note) => (
                  // Not a live region: it describes the SAVED allocation, so it
                  // never changes under the reader's own hands the way the
                  // budget bar above does, and more polite regions on one
                  // chapter only make the first one harder to hear.
                  <div
                    key={note.id}
                    className={cn(
                      "space-y-2 rounded-md border p-3 text-sm",
                      note.flagged
                        ? WARNING_ALERT_CLASS
                        : "text-muted-foreground"
                    )}
                  >
                    <p>{note.text}</p>
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMotivating(note.target)}
                      >
                        {t(note.flagged ? "motivateCta" : "editMotivationCta")}
                      </Button>
                    )}
                  </div>
                ))}
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
                          share: shareFraction(
                            pointsFor(criterion),
                            totalPoints
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
      {/* Not mounted at all for an editor: with no way to open it there is
          nothing for it to do. */}
      {isAdmin && (
        <WeightMotivationDialog
          orgId={orgId}
          target={motivating}
          onClose={() => setMotivating(null)}
        />
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
      <div className={CHAPTER_GRID_CLASS}>
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
