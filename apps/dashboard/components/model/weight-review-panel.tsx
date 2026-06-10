"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { SUGGESTION_KINDS } from "@workspace/constants"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { useSuggestionFlow } from "@/hooks/use-suggestion-flow"
import { useSuggestionSelection } from "@/hooks/use-suggestion-selection"
import { weightReviewValueSchema } from "@/lib/suggestion-schemas"

// The review panel only needs each criterion's id, name, and current weight
// points. ModelEditor passes the full getModel result, which structurally
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
                const checkboxId = `ai-move-${index}`
                return (
                  <li
                    key={checkboxId}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={accepted.has(index)}
                      onCheckedChange={(value) => toggle(index, value === true)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      {/* One suggestion = one sentence: the zero-sum transfer.
                          The numbers line below details both sides. */}
                      <Label htmlFor={checkboxId}>
                        {t("moveLabel", {
                          points: move.points,
                          from: from.name,
                          to: to.name,
                        })}
                      </Label>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
                        <MovedPoints
                          name={from.name}
                          from={from.weightPoints}
                          to={from.weightPoints - move.points}
                        />
                        <MovedPoints
                          name={to.name}
                          from={to.weightPoints}
                          to={to.weightPoints + move.points}
                        />
                      </p>
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">{t("motivation")}: </span>
                        {move.motivation}
                      </p>
                    </div>
                  </li>
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

// One side of a balanced move: "Name 4 -> 5" with the shared arrow glyph.
// Inherits the muted detail styling from its parent line.
function MovedPoints({
  name,
  from,
  to,
}: {
  name: string
  from: number
  to: number
}) {
  return (
    <span className="flex items-center gap-1">
      <span>{name}</span>
      <span className="flex items-center gap-1 tabular-nums">
        {from}
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={14}
          strokeWidth={2}
          aria-hidden="true"
          className="shrink-0"
        />
        {to}
      </span>
    </span>
  )
}
