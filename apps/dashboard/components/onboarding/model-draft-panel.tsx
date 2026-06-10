"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { SUGGESTION_KINDS } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useGeneratingStaleness } from "@/hooks/use-generating-staleness"
import { aiErrorSubKey } from "@/lib/error-label"
import { newestByKind } from "@/lib/open-suggestions"
import {
  type ModelDraftValue,
  modelDraftValueSchema,
} from "@/lib/suggestion-schemas"

type DraftCriterion = ModelDraftValue["criteria"][number]

// The draft assistant, rendered inside the MorphPopover (which owns the
// heading and the always-visible provenance line). AI never auto-applies
// (ADR-0003): it proposes criteria the HR admin selects and confirms.
//
// Closing the popover does NOT dismiss: an open draft stays put and reopening
// shows it again, so the only ways out are an explicit confirm or dismiss.
export function ModelDraftPanel({
  orgId,
  onDone,
}: {
  orgId: string
  // Called after a successful confirm or dismiss so the host (the popover)
  // can morph back to its button.
  onDone?: () => void
}) {
  const t = useTranslations("dashboard.ai")
  const tModel = useTranslations("dashboard.model")
  const tErrors = useTranslations("errors")
  const tWeightPoints = useTranslations("model")
  // The AI responds in the requester's current UI language.
  const locale = useLocale()

  const suggestions = useQuery(api.ai.suggest.getOpenSuggestions, {
    orgId,
    kind: SUGGESTION_KINDS.modelDraft,
  })
  const requestModelDraft = useMutation(api.ai.suggest.requestModelDraft)
  const confirmModelDraft = useMutation(api.ai.suggest.confirmModelDraft)
  const rejectSuggestion = useMutation(api.ai.suggest.rejectSuggestion)

  const [description, setDescription] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  // Selected draft indexes, paired with the suggestion id they were seeded for.
  // Criteria default to checked when a fresh suggestion arrives.
  const [selection, setSelection] = useState<{
    seededFor: string | null
    accepted: Set<number>
  }>({ seededFor: null, accepted: new Set() })

  // The newest draft row drives the UI; rows are capped at 20 per status.
  // The stored payload is re-parsed with Zod before anything renders; a
  // malformed value reads as an empty draft (see suggestion-schemas).
  const draft = newestByKind(suggestions, SUGGESTION_KINDS.modelDraft)
  const parsedValue =
    draft?.status === "suggested"
      ? modelDraftValueSchema.safeParse(draft.suggestedValue)
      : null
  const criteria = parsedValue?.success ? parsedValue.data.criteria : []

  const isGenerating = draft?.status === "generating"
  const isStaleGenerating = useGeneratingStaleness(draft)

  // Seed the selection (all checked) the first render a new suggestion appears,
  // adjusting state during render rather than in an effect. Re-runs only when
  // the suggestion id changes, never on each user toggle.
  const draftId = draft?.status === "suggested" ? draft.suggestionId : null
  if (draftId !== null && selection.seededFor !== draftId) {
    setSelection({
      seededFor: draftId,
      accepted: new Set(criteria.map((_, index) => index)),
    })
  }
  const accepted = selection.accepted

  function setAccepted(next: (current: Set<number>) => Set<number>) {
    setSelection((current) => ({
      seededFor: current.seededFor,
      accepted: next(current.accepted),
    }))
  }

  async function onRequest() {
    setPending(true)
    setFailed(false)
    try {
      await requestModelDraft({
        orgId,
        locale,
        ...(description.trim() !== ""
          ? { description: description.trim() }
          : {}),
      })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {draft?.status === "suggested" ? (
        <SuggestedDraft
          criteria={criteria}
          accepted={accepted}
          onToggle={(index, checked) =>
            setAccepted((current) => {
              const next = new Set(current)
              if (checked) next.add(index)
              else next.delete(index)
              return next
            })
          }
          labels={{
            confirmCta: t("confirmCta"),
            rejectCta: t("rejectCta"),
            weightPoints: (points) =>
              `${tWeightPoints("weightPoints")}: ${points}`,
          }}
          onConfirm={async () => {
            setFailed(false)
            try {
              await confirmModelDraft({
                orgId,
                suggestionId: draft.suggestionId,
                acceptedIndexes: [...accepted],
              })
              onDone?.()
            } catch {
              setFailed(true)
            }
          }}
          onReject={async () => {
            setFailed(false)
            try {
              await rejectSuggestion({
                orgId,
                suggestionId: draft.suggestionId,
              })
              onDone?.()
            } catch {
              setFailed(true)
            }
          }}
        />
      ) : isGenerating && !isStaleGenerating ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner />
          {t("generating")}
        </p>
      ) : draft?.status === "failed" || isStaleGenerating ? (
        <div className="space-y-3">
          <p role="alert" className="text-destructive text-sm">
            {tErrors(
              aiErrorSubKey(
                draft?.status === "failed" ? (draft.errorCode ?? "") : ""
              )
            )}
          </p>
          <Button variant="outline" disabled={pending} onClick={onRequest}>
            {t("draftCta")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-draft-description">
              {t("draftDescriptionLabel")}
            </Label>
            <Textarea
              id="ai-draft-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <Button variant="outline" disabled={pending} onClick={onRequest}>
            {t("draftCta")}
          </Button>
        </div>
      )}

      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {tModel("error")}
        </p>
      )}
    </div>
  )
}

function SuggestedDraft({
  criteria,
  accepted,
  onToggle,
  onConfirm,
  onReject,
  labels,
}: {
  criteria: DraftCriterion[]
  accepted: Set<number>
  onToggle: (index: number, checked: boolean) => void
  onConfirm: () => void
  onReject: () => void
  labels: {
    confirmCta: string
    rejectCta: string
    weightPoints: (points: number) => string
  }
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {criteria.map((criterion, index) => {
          const checkboxId = `ai-draft-criterion-${index}`
          return (
            <li
              // The draft list is positional and read-only between renders, so
              // the index is a stable key here.
              // biome-ignore lint/suspicious/noArrayIndexKey: positional draft list
              key={index}
              className="flex items-start gap-3 rounded-md border p-3"
            >
              <Checkbox
                id={checkboxId}
                checked={accepted.has(index)}
                onCheckedChange={(value) => onToggle(index, value === true)}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label htmlFor={checkboxId} className="flex items-center gap-2">
                  <span>{criterion.name}</span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {labels.weightPoints(criterion.weightPoints)}
                  </span>
                </Label>
                <p className="text-muted-foreground text-sm">
                  {criterion.description}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex gap-2">
        <Button disabled={accepted.size === 0} onClick={onConfirm}>
          {labels.confirmCta}
        </Button>
        <Button variant="ghost" onClick={onReject}>
          {labels.rejectCta}
        </Button>
      </div>
    </div>
  )
}
