"use client"

import { AiEditingIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
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
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { CHAPTER_GRID_CLASS } from "@/components/model/chapter-grid"
import {
  CHAPTER_ACTION_BUTTON_SIZE,
  ChapterFraming,
} from "@/components/model/chapter-framing"
import { FloatingPill, FloatingPillText } from "@/components/floating-pill"
import { DimensionFrame } from "@/components/model/dimension-frame"
import { PlacedCriterionCard } from "@/components/model/placed-criterion-card"
import {
  WeightMotivationDialog,
  type WeightMotivationTarget,
} from "@/components/model/weight-motivation-dialog"
import { WeightReviewPanel } from "@/components/model/weight-review-panel"
import {
  WorkingConditionsColumnSkeleton,
  WorkingConditionsEmptyColumn,
} from "@/components/model/working-conditions-empty-column"
import { HelpMorphButton } from "@/components/help-morph-button"
import { MorphPopover } from "@/components/morph-popover"
import { WARNING_ALERT_CLASS } from "@/lib/alert-tone"
import { chapterHref } from "@/lib/model-chapters"
import { modelErrorKey } from "@/lib/model-errors"
import { toast } from "@/lib/toast"
import {
  SHARE_FORMAT,
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

// How many placeholder cards a dimension's column stands up while the model
// loads: two, or the dimension's own cap where that is lower, so the fourth
// column never promises a second criterion the model may not hold one of.
const SKELETON_CARDS: Record<DimensionKey, number> = Object.fromEntries(
  DIMENSION_KEYS.map((key) => [key, Math.min(2, DIMENSION_MAX_ACTIVE[key])])
) as Record<DimensionKey, number>

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
  const tHelp = useTranslations("dashboard.help")
  const locale = useLocale()
  const format = useFormatter()
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
      {/* The chapter's only chrome above the grid, so its columns begin at the
          same height as every other chapter's and switching tabs holds them
          still. The weighting concept's help rides it, next to the sentence
          that frames the chapter, because the block it used to sit on is gone
          and help never floats. */}
      <ChapterFraming
        chapter="weighting"
        help={
          <HelpMorphButton label={tHelp("weightingLabel")}>
            {tHelp("weightingBody")}
          </HelpMorphButton>
        }
        action={
          // The trigger's slot is reserved whether or not the review is on
          // offer, and only its CONTENT hides: mounting it would change the
          // row's width, and at a width where the row wraps, its height.
          // `invisible` is what hides it: visibility:hidden keeps the box
          // while taking the trigger out of the tab order and out of the
          // accessibility tree, so a hidden control can be neither reached nor
          // announced.
          <span
            className={cn("flex", !showReview && "invisible")}
            aria-hidden={!showReview}
          >
            <MorphPopover
              triggerLabel={tAi("openReviewCta")}
              triggerIcon={AiEditingIcon}
              triggerSize={CHAPTER_ACTION_BUTTON_SIZE}
              anchor="right"
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
          </span>
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
            const isWorkingConditions = dimension.key === "workingConditions"
            // An empty column draws nothing, EXCEPT the fourth: the other
            // three are incomplete on their way to being filled, while
            // working conditions can be empty as a finished answer, and the
            // column says which (WorkingConditionsEmptyColumn).
            if (placed.length === 0 && !isWorkingConditions) return null
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
                  share: format.number(share, SHARE_FORMAT),
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
              // The same dashed frame every chapter draws its dimensions in;
              // this chapter's lens is the share opposite the name. The
              // balance between dimensions is the thing this chapter can get
              // wrong, and it was only visible on the Godkännande checklist
              // after the fact. Derived from the LOCAL allocation, so it moves
              // with an unsaved edit the way the cards' own shares do, and
              // rounded to whole points because a heading is a balance reading
              // rather than a figure anyone reconciles.
              <DimensionFrame
                key={dimension.key}
                heading={
                  <>
                    <h3 className="truncate font-medium text-sm">
                      {dimension.name}
                    </h3>
                    {/* The share sits OPPOSITE the name, in the same slot the
                        Kriterier column puts its count chip in, so the two
                        chapters' heading rows read as one anatomy rather than
                        as a name-and-a-figure here and a name-and-a-chip
                        there. Its own element rather than a clause spliced
                        into the title: a concatenated heading truncates the
                        figure away first at column width, which is the half a
                        reader came to this chapter for. */}
                    <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
                      {t.rich("shareOfWeight", {
                        share: () => (
                          <NumberFlow
                            value={shareFraction(
                              placed.reduce(
                                (sum, criterion) => sum + pointsFor(criterion),
                                0
                              ),
                              totalPoints
                            )}
                            format={SHARE_FORMAT}
                          />
                        ),
                      })}
                    </span>
                  </>
                }
              >
                {/* The frame's body carries no spacing of its own (the
                    Kriterier column's blocks space themselves), so this
                    chapter's notes and cards get theirs here. */}
                <div className="space-y-2">
                  {/* The weight warnings WHERE THE DECISION IS MADE, not only as
                    a verdict two chapters later. Each sits under the heading it
                    is about, so the fact, the figure and both ways out (record
                    why, or move points) are one thing to read; the Godkännande
                    checklist reports the same findings and links back here.

                    Answered and unanswered render the same box, so recording a
                    motivation changes the tone and the wording without moving
                    the cards under it. */}
                  {notes.map((note) => (
                    // Not a live region: it describes the SAVED allocation, so
                    // it never changes under the reader's own hands the way the
                    // budget pill does, and more polite regions on one chapter
                    // only make the first one harder to hear.
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMotivating(note.target)}
                      >
                        {t(note.flagged ? "motivateCta" : "editMotivationCta")}
                      </Button>
                    </div>
                  ))}
                  {/* Nothing on this chapter adds or removes a criterion (that
                    is the Kriterier chapter's job), but the model is a live
                    query: a criterion removed there, or in another tab, still
                    leaves this list. popLayout takes it out of flow at once so
                    the cards under it close the gap in one pass rather than
                    waiting out the fade (ui-animation.md rules 3 and 6), and
                    initial={false} keeps arriving on the page from animating. */}
                  {placed.length === 0 ? (
                    // Only ever the fourth column: the heading above it carries
                    // its honest 0%, and the line says why there is nothing
                    // under it to weight.
                    <WorkingConditionsEmptyColumn
                      decision={model.workingConditions}
                    />
                  ) : (
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
                  )}
                </div>
              </DimensionFrame>
            )
          })}
        </div>
      )}
      <WeightMotivationDialog
        orgId={orgId}
        target={motivating}
        onClose={() => setMotivating(null)}
      />
      {/* The budget, floating clear of the grid. It renders only with
          something to say (the allocation does not add up) or something to do
          (it adds up and is unsaved); an allocation that adds up and is saved
          is this chapter's steady state, and it says nothing. */}
      <FloatingPill
        // Under budget is the ordinary way through this chapter, over budget
        // is a state the model cannot be saved from, and an allocation that
        // adds up is done: three different things to say, in the status
        // block's own three tones.
        tone={balanced ? "ready" : delta < 0 ? "info" : "warning"}
      >
        {!balanced ? (
          // The sentence stays whole: its figure is inside an ICU plural, and
          // splitting a plural around a component to roll one digit is exactly
          // the i18n boundary the house rules draw. The readout below, whose
          // figures ARE tagged, is where the numbers roll.
          <FloatingPillText alone>
            {delta < 0
              ? t("pointsLeft", { count: -delta })
              : t("pointsOver", { count: delta })}
          </FloatingPillText>
        ) : dirty ? (
          <>
            <FloatingPillText>
              {/* Both figures move while the reader watches (a weight click
                  changes the sum, removing a criterion changes the budget), so
                  they roll rather than swap. Tagged inside the message rather
                  than concatenated around it: the connective and the unit are
                  the translator's. */}
              {t.rich("budgetAllocated", {
                allocated: () => <NumberFlow value={totalPoints} />,
                budget: () => <NumberFlow value={budget} />,
              })}
            </FloatingPillText>
            {/* A direct child of the pill's layout animation, so Motion
                counter-transforms its label instead of stretching it while
                the box springs to the new width (ui-animation.md rule 1).
                The primary variant is the action colour: it is the one thing
                in the pill the reader is meant to press.

                sm and rounded-full are a deliberate call-site deviation from
                CHAPTER_ACTION_BUTTON_SIZE, which governs the chapter framing
                row's actions and not this. A floating capsule has its own
                density: a default-height block inside it stands taller than
                the readout it serves and dominates the sentence it belongs
                to. At sm it sits with an even inset inside the pill's own
                padding, a capsule inside a capsule, and the pill's right end
                is the button's height rather than a control bulging out of
                it. */}
            <motion.span layout="position" className="flex shrink-0">
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={saving || !balanced || !dirty}
                onClick={onSave}
              >
                {t("saveCta")}
              </Button>
            </motion.span>
          </>
        ) : null}
      </FloatingPill>
    </div>
  )
}

// The chapter's loading state: the real framing row over placeholder columns,
// so the row the grid begins under measures identically in both states. How
// many criteria there are and which dimensions hold them is entirely the data,
// so the columns are bars. No budget pill: what it would say is exactly what
// is still loading, and it says nothing until it has something to say.
function WeightingChapterSkeleton() {
  const tAi = useTranslations("dashboard.ai")
  const tHelp = useTranslations("dashboard.help")
  return (
    <div className="space-y-4">
      <ChapterFraming
        chapter="weighting"
        help={
          <HelpMorphButton label={tHelp("weightingLabel")}>
            {tHelp("weightingBody")}
          </HelpMorphButton>
        }
        action={
          // Whether the review is on offer needs the model and the review
          // lock, so the slot stays reserved and its content hidden, exactly
          // as it does whenever the loaded row has nothing to offer.
          <span className="invisible flex" aria-hidden="true">
            <Button
              type="button"
              variant="outline"
              size={CHAPTER_ACTION_BUTTON_SIZE}
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
          </span>
        }
      />
      {/* Four columns, one per dimension: the fourth always draws (it explains
          its own emptiness rather than vanishing), and the other three draw
          here because the common model fills every one of them. */}
      <div className={CHAPTER_GRID_CLASS}>
        {DIMENSION_KEYS.map((key) => (
          <DimensionFrame
            key={key}
            heading={
              /* The dimension's name is library content, but the SHARE beside
                 it in the loaded heading is the data, so the whole heading
                 waits as one bar rather than half a sentence. */
              <div className="flex h-5 items-center">
                <Skeleton className="h-4 w-32" />
              </div>
            }
          >
            {key === "workingConditions" ? (
              // The fourth dimension is as likely to resolve to a sentence
              // over a hatch as to a weighted card, so it waits as a neutral
              // bar rather than as a card that would have to become a
              // paragraph.
              <WorkingConditionsColumnSkeleton />
            ) : (
              <ul aria-hidden="true" className="space-y-2">
                {Array.from({ length: SKELETON_CARDS[key] }, (_, row) => (
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
            )}
          </DimensionFrame>
        ))}
      </div>
    </div>
  )
}
