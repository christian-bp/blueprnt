"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { aiErrorSubKey } from "@/lib/error-label"
import { importanceLabelKey } from "@/lib/importance"
import { newestByKind } from "@/lib/open-suggestions"

// A crashed action never reaches markFailed, so a "generating" row can linger
// forever. The panel treats one older than this as a failure and offers a retry.
const STALE_AFTER_MS = 90_000

interface DraftCriterion {
  name: string
  description: string
  helpText: string
  importanceLevel: number
  anchors: string[]
}

// Step 12: the embedded draft assistant. AI never auto-applies (ADR-0003): it
// proposes criteria the HR admin selects and confirms. The provenance line is
// always visible on a suggestion.
export function ModelDraftPanel({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.onboarding.ai")
  const tModel = useTranslations("dashboard.onboarding.model")
  const tErrors = useTranslations("errors")
  const tImportance = useTranslations("model.importance")

  const suggestions = useQuery(api.ai.suggest.getOpenSuggestions, { orgId })
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
  const draft = newestByKind(suggestions, "model.draft")
  const criteria =
    (draft?.suggestedValue as { criteria?: DraftCriterion[] } | null)
      ?.criteria ?? []

  // Tick every 10s while a generating row exists so the staleness check is
  // re-evaluated without busy-waiting. No interval runs otherwise.
  const [, setTick] = useState(0)
  const isGenerating = draft?.status === "generating"
  useEffect(() => {
    if (!isGenerating) return
    const id = setInterval(() => setTick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [isGenerating])

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

  const isStaleGenerating =
    draft?.status === "generating" &&
    Date.now() - draft.createdAt >= STALE_AFTER_MS

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
        <CardDescription>{t("provenance")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              importance: (level) => tImportance(importanceLabelKey(level)),
            }}
            onConfirm={async () => {
              setFailed(false)
              try {
                await confirmModelDraft({
                  orgId,
                  suggestionId: draft.suggestionId,
                  acceptedIndexes: [...accepted],
                })
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
      </CardContent>
    </Card>
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
    importance: (level: number) => string
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
                  <span className="text-muted-foreground text-sm">
                    {labels.importance(criterion.importanceLevel)}
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
