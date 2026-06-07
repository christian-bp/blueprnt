"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { aiErrorSubKey } from "@/lib/error-label"
import { importanceLabelKey } from "@/lib/importance"
import { newestByKind } from "@/lib/open-suggestions"

// A crashed action never reaches markFailed, so a "generating" row can linger
// forever. The panel treats one older than this as a failure and offers a retry.
const STALE_AFTER_MS = 90_000

interface Adjustment {
  criterionId: string
  suggestedImportanceLevel: number
  motivation: string
}

// The review panel only needs each criterion's id, name, and current importance.
// ModelReview passes the full getModel result, which structurally satisfies
// this. criterionId keeps its branded Id type so it flows into the mutation.
interface ReviewModel {
  criteria: {
    criterionId: Id<"criteria">
    name: string
    importanceLevel: number
  }[]
}

// The importance-review assistant, rendered inside the MorphPopover (which
// owns the heading and the always-visible provenance line). AI suggests new
// importance levels with a motivation; the HR admin selects and applies
// (ADR-0003). With autoRequest the panel fires one review request when it
// mounts with no open suggestion, so opening the popover starts the review
// and shows the generating state immediately.
export function ImportanceReviewPanel({
  orgId,
  model,
  autoRequest = false,
  onDone,
  dismissOnUnmount = false,
}: {
  orgId: string
  model: ReviewModel
  autoRequest?: boolean
  // Called after a successful apply or dismiss so the host (the popover)
  // can morph back to its button; reopening then starts a fresh review.
  onDone?: () => void
  // Closing the popover (any path) counts as a dismiss: an open suggested
  // or failed review is rejected when the panel unmounts, so the next open
  // always starts fresh. A generating row is left to finish (rejecting it
  // would race the action's final write).
  dismissOnUnmount?: boolean
}) {
  const t = useTranslations("dashboard.ai")
  const tModel = useTranslations("dashboard.model")
  const tErrors = useTranslations("errors")
  const tImportance = useTranslations("model.importance")
  // The AI responds in the requester's current UI language.
  const locale = useLocale()

  const suggestions = useQuery(api.ai.suggest.getOpenSuggestions, { orgId })
  const requestImportanceReview = useMutation(
    api.ai.suggest.requestImportanceReview
  )
  const confirmImportanceReview = useMutation(
    api.ai.suggest.confirmImportanceReview
  )
  const rejectSuggestion = useMutation(api.ai.suggest.rejectSuggestion)

  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  // Selected criterionIds (branded, resolved from the model), paired with the
  // suggestion id they were seeded for. Adjustments default to checked.
  const [selection, setSelection] = useState<{
    seededFor: string | null
    accepted: Set<Id<"criteria">>
  }>({ seededFor: null, accepted: new Set() })

  const review = newestByKind(suggestions, "model.importanceReview")

  // Tick every 10s while a generating row exists so the staleness check is
  // re-evaluated without busy-waiting. No interval runs otherwise.
  const [, setTick] = useState(0)
  const isGenerating = review?.status === "generating"
  useEffect(() => {
    if (!isGenerating) return
    const id = setInterval(() => setTick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [isGenerating])

  // Index the model's criteria (by plain string id) so adjustments resolve to a
  // criterion. An adjustment whose criterion is absent from the model is skipped
  // as defense in depth; the backend already neutralizes such adjustments.
  const byId = new Map<
    string,
    { criterionId: Id<"criteria">; name: string; importanceLevel: number }
  >(model.criteria.map((c) => [c.criterionId, c]))
  const adjustments = (
    (review?.status === "suggested"
      ? (review.suggestedValue as { adjustments?: Adjustment[] } | null)
          ?.adjustments
      : undefined) ?? []
  ).filter((adjustment) => byId.has(adjustment.criterionId))

  // Seed the selection (all checked) the first render a new review appears,
  // adjusting state during render rather than in an effect. Keys are the branded
  // ids resolved from the model, not the raw AI strings.
  const reviewId = review?.status === "suggested" ? review.suggestionId : null
  if (reviewId !== null && selection.seededFor !== reviewId) {
    const ids = adjustments.flatMap((a) => {
      const criterion = byId.get(a.criterionId)
      return criterion === undefined ? [] : [criterion.criterionId]
    })
    setSelection({ seededFor: reviewId, accepted: new Set(ids) })
  }
  const accepted = selection.accepted

  function setAccepted(
    next: (current: Set<Id<"criteria">>) => Set<Id<"criteria">>
  ) {
    setSelection((current) => ({
      seededFor: current.seededFor,
      accepted: next(current.accepted),
    }))
  }

  async function onRequest() {
    setPending(true)
    setFailed(false)
    try {
      await requestImportanceReview({ orgId, locale })
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
  const queryLoaded = suggestions !== undefined
  const hasReview = review !== undefined && review !== null
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

  // See the dismissOnUnmount prop doc; the ref keeps the cleanup closure on
  // the CURRENT review row.
  const reviewRef = useRef(review)
  reviewRef.current = review
  // biome-ignore lint/correctness/useExhaustiveDependencies: unmount-only cleanup reading refs
  useEffect(() => {
    if (!dismissOnUnmount) return
    return () => {
      const open = reviewRef.current
      if (open?.status === "suggested" || open?.status === "failed") {
        void rejectSuggestion({ orgId, suggestionId: open.suggestionId })
      }
    }
  }, [dismissOnUnmount])

  const isStaleGenerating =
    review?.status === "generating" &&
    Date.now() - review.createdAt >= STALE_AFTER_MS

  return (
    <div className="space-y-4">
      {review?.status === "suggested" ? (
        adjustments.length === 0 ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {t("noAdjustments")}
            </p>
            <Button
              variant="ghost"
              onClick={async () => {
                setFailed(false)
                try {
                  await rejectSuggestion({
                    orgId,
                    suggestionId: review.suggestionId,
                  })
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
              {adjustments.map((adjustment) => {
                const criterion = byId.get(adjustment.criterionId)
                if (criterion === undefined) return null
                const checkboxId = `ai-review-${adjustment.criterionId}`
                return (
                  <li
                    key={adjustment.criterionId}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={accepted.has(criterion.criterionId)}
                      onCheckedChange={(value) =>
                        setAccepted((current) => {
                          const next = new Set(current)
                          if (value === true) next.add(criterion.criterionId)
                          else next.delete(criterion.criterionId)
                          return next
                        })
                      }
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor={checkboxId}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span>{criterion.name}</span>
                        <span className="flex items-center gap-1 text-muted-foreground text-sm">
                          {tImportance(
                            importanceLabelKey(criterion.importanceLevel)
                          )}
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            size={14}
                            strokeWidth={2}
                            aria-hidden="true"
                            className="shrink-0"
                          />
                          {tImportance(
                            importanceLabelKey(
                              adjustment.suggestedImportanceLevel
                            )
                          )}
                        </span>
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">{t("motivation")}: </span>
                        {adjustment.motivation}
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
                  setFailed(false)
                  try {
                    await confirmImportanceReview({
                      orgId,
                      suggestionId: review.suggestionId,
                      acceptedCriterionIds: [...accepted],
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
                    await rejectSuggestion({
                      orgId,
                      suggestionId: review.suggestionId,
                    })
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
      ) : isGenerating && !isStaleGenerating ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner />
          {t("generating")}
        </p>
      ) : review?.status === "failed" || isStaleGenerating ? (
        <div className="space-y-3">
          <p role="alert" className="text-destructive text-sm">
            {tErrors(
              aiErrorSubKey(
                review?.status === "failed" ? (review.errorCode ?? "") : ""
              )
            )}
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
