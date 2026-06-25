"use client"

import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { SUGGESTION_KINDS } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { ChangeArrow } from "@/components/change-arrow"
import { useSuggestionFlow } from "@/hooks/use-suggestion-flow"
import { useSuggestionSelection } from "@/hooks/use-suggestion-selection"
import { SPRING } from "@/lib/motion"
import { weightReviewValueSchema } from "@/lib/suggestion-schemas"

// The review panel only needs each criterion's id, name, and current weight
// points. ModelBuilder passes the full getModel result, which structurally
// satisfies this.
interface ReviewModel {
  criteria: {
    criterionId: Id<"criteria">
    name: string
    weightPoints: number
  }[]
}

// The weight-review assistant, rendered inside the MorphPopover (which owns
// the heading and the always-visible provenance line). AI suggests balanced
// moves with a motivation; the HR admin selects and applies (ADR-0003). With
// autoRequest the panel fires one review request when it mounts with no open
// suggestion, so opening the popover starts the review and shows the
// reviewing state immediately.
//
// Closing the popover does NOT dismiss: an open suggestion stays put and
// reopening shows it again, so the only ways out are an explicit apply or
// dismiss. After either, the popover closes (onDone) and the suggestion is
// settled, so the NEXT open auto-requests a fresh review.
export function WeightReviewPanel({
  orgId,
  model,
  autoRequest = false,
  onDone,
}: {
  orgId: string
  model: ReviewModel
  autoRequest?: boolean
  // Called after a successful apply or dismiss so the host (the popover)
  // can morph back to its button.
  onDone?: () => void
}) {
  const t = useTranslations("dashboard.ai")
  const tModel = useTranslations("dashboard.model")
  const tErrors = useTranslations("errors")
  // The AI responds in the requester's current UI language.
  const locale = useLocale()

  // The shared suggestion lifecycle: newest open review, Zod re-parse,
  // staleness, dismissal. Request/confirm stay here (kind-specific args).
  const flow = useSuggestionFlow({
    orgId,
    kind: SUGGESTION_KINDS.weightReview,
    schema: weightReviewValueSchema,
  })
  const requestWeightReview = useMutation(api.ai.suggest.requestWeightReview)
  const confirmWeightReview = useMutation(api.ai.suggest.confirmWeightReview)

  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  // Index the model's criteria so moves resolve to names and current points.
  // A move whose criteria are absent from the model is skipped as defense in
  // depth; the backend already neutralizes such moves.
  const byId = new Map<string, { name: string; weightPoints: number }>(
    model.criteria.map((criterion) => [
      criterion.criterionId as string,
      { name: criterion.name, weightPoints: criterion.weightPoints },
    ])
  )
  const allMoves = flow.value?.moves ?? []
  // Indexes must stay aligned with the STORED move list (the confirm payload
  // is index-based), so unresolvable moves are filtered as (move, index)
  // pairs rather than re-indexed.
  const moves = allMoves
    .map((move, index) => ({ move, index }))
    .filter(
      ({ move }) =>
        byId.has(move.fromCriterionId) && byId.has(move.toCriterionId)
    )

  // Moves default to checked when a fresh review arrives.
  const { accepted, toggle } = useSuggestionSelection(
    flow.status === "suggested" ? flow.suggestionId : null,
    () => moves.map(({ index }) => index)
  )

  async function onRequest() {
    setPending(true)
    setFailed(false)
    try {
      await requestWeightReview({ orgId, locale })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  // autoRequest: one request per mount, only once the suggestions query has
  // resolved and there is nothing open to show. A failed row is left for the
  // manual retry button.
  const requestedRef = useRef(false)
  const queryLoaded = flow.loaded
  const hasReview = flow.row !== undefined
  // biome-ignore lint/correctness/useExhaustiveDependencies: onRequest is recreated per render and intentionally not a dependency (one-shot guarded by requestedRef)
  useEffect(() => {
    if (!autoRequest || requestedRef.current) return
    if (!queryLoaded) return
    if (hasReview) {
      // A review already exists (reopened popover): this mount has had its
      // chance. Without this latch, applying or dismissing would flip
      // hasReview to false and silently fire a brand-new generation.
      requestedRef.current = true
      return
    }
    requestedRef.current = true
    void onRequest()
  }, [autoRequest, queryLoaded, hasReview])

  return (
    <div className="space-y-4">
      {flow.status === "suggested" ? (
        moves.length === 0 ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">{t("noMoves")}</p>
            <Button
              variant="ghost"
              onClick={async () => {
                setFailed(false)
                try {
                  await flow.reject()
                  onDone?.()
                } catch {
                  setFailed(true)
                }
              }}
            >
              {t("rejectCta")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {moves.map(({ move, index }) => {
                const from = byId.get(move.fromCriterionId)
                const to = byId.get(move.toCriterionId)
                if (from === undefined || to === undefined) return null
                return (
                  <MoveCard
                    key={`ai-move-${index}`}
                    index={index}
                    fromName={from.name}
                    toName={to.name}
                    fromBefore={from.weightPoints}
                    fromAfter={from.weightPoints - move.points}
                    toBefore={to.weightPoints}
                    toAfter={to.weightPoints + move.points}
                    points={move.points}
                    motivation={move.motivation}
                    checked={accepted.has(index)}
                    onToggle={toggle}
                    // The full sentence is the checkbox's accessible name; the
                    // visible card shows the compact transfer instead.
                    label={t("moveLabel", {
                      points: move.points,
                      from: from.name,
                      to: to.name,
                    })}
                    whyLabel={t("whyChange")}
                  />
                )
              })}
            </ul>
            <div className="flex gap-2">
              <Button
                disabled={accepted.size === 0}
                onClick={async () => {
                  const suggestionId = flow.suggestionId
                  if (suggestionId === null) return
                  setFailed(false)
                  try {
                    await confirmWeightReview({
                      orgId,
                      suggestionId,
                      acceptedMoveIndexes: [...accepted],
                    })
                    onDone?.()
                  } catch {
                    setFailed(true)
                  }
                }}
              >
                {t("applyCta")}
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  setFailed(false)
                  try {
                    await flow.reject()
                    onDone?.()
                  } catch {
                    setFailed(true)
                  }
                }}
              >
                {t("rejectCta")}
              </Button>
            </div>
          </div>
        )
      ) : flow.status === "generating" ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner />
          {t("reviewing")}
        </p>
      ) : flow.status === "failed" ? (
        <div className="space-y-3">
          <p role="alert" className="text-destructive text-sm">
            {tErrors(flow.errorSubKey ?? "aiGenerationFailed")}
          </p>
          <Button variant="outline" disabled={pending} onClick={onRequest}>
            {t("reviewCta")}
          </Button>
        </div>
      ) : (
        <Button variant="outline" disabled={pending} onClick={onRequest}>
          {t("reviewCta")}
        </Button>
      )}

      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {tModel("error")}
        </p>
      )}
    </div>
  )
}

// One balanced move as a scannable card: a checkbox, the two-line transfer
// (each affected criterion with its before -> after points and signed delta),
// and the motivation tucked behind a "Why this change?" disclosure so the list
// stays scannable and the reasoning is one click away.
function MoveCard({
  index,
  fromName,
  toName,
  fromBefore,
  fromAfter,
  toBefore,
  toAfter,
  points,
  motivation,
  checked,
  onToggle,
  label,
  whyLabel,
}: {
  index: number
  fromName: string
  toName: string
  fromBefore: number
  fromAfter: number
  toBefore: number
  toAfter: number
  points: number
  motivation: string
  checked: boolean
  onToggle: (index: number, checked: boolean) => void
  label: string
  whyLabel: string
}) {
  const [showWhy, setShowWhy] = useState(false)
  const checkboxId = `ai-move-${index}`
  return (
    <li className="flex items-start gap-3 rounded-md border p-3">
      <Checkbox
        id={checkboxId}
        aria-label={label}
        checked={checked}
        onCheckedChange={(value) => onToggle(index, value === true)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 space-y-2">
        {/* The transfer is wrapped in a label so the whole block toggles the
            checkbox; the screen-reader name stays the full sentence via the
            checkbox aria-label. */}
        <label htmlFor={checkboxId} className="block cursor-pointer space-y-1">
          <TransferRow
            name={fromName}
            before={fromBefore}
            after={fromAfter}
            delta={-points}
          />
          <TransferRow
            name={toName}
            before={toBefore}
            after={toAfter}
            delta={points}
          />
        </label>
        <div>
          <button
            type="button"
            aria-expanded={showWhy}
            onClick={() => setShowWhy((open) => !open)}
            className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={14}
              strokeWidth={2}
              aria-hidden="true"
              className={cn("transition-transform", showWhy && "rotate-180")}
            />
            {whyLabel}
          </button>
          {/* The reveal carries ONLY geometry (height/opacity) and no box
              styles, so height:0 truly collapses (docs/ui-animation.md rule
              2); the inner padding lives on the clipped paragraph. Reduced
              motion is honored globally via MotionConfig. */}
          <AnimatePresence initial={false}>
            {showWhy && (
              <motion.div
                key="why"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={SPRING}
                className="overflow-hidden"
              >
                <p className="pt-1 text-muted-foreground text-sm">
                  {motivation}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </li>
  )
}

// One side of a balanced move: the criterion name, its before -> after points
// with the shared arrow glyph, and a neutral signed delta (no good/bad color:
// a transfer is not a judgement). The name takes the remaining width and may
// wrap; the numbers stay aligned on the right.
function TransferRow({
  name,
  before,
  after,
  delta,
}: {
  name: string
  before: number
  after: number
  delta: number
}) {
  return (
    <span className="flex items-start justify-between gap-3 text-sm">
      <span className="min-w-0 flex-1">{name}</span>
      <span className="flex shrink-0 items-center gap-2 tabular-nums">
        <span className="flex items-center gap-1 text-muted-foreground">
          {before}
          {/* mx-0: the flex row's gap-1 already spaces the arrow. */}
          <ChangeArrow className="mx-0" />
          <span className="font-medium text-foreground">{after}</span>
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground text-xs">
          {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
        </span>
      </span>
    </span>
  )
}
