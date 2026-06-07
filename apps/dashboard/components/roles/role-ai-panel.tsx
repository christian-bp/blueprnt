"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
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
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { aiErrorSubKey } from "@/lib/error-label"

// A crashed action never reaches markFailed; rows older than this count as
// failed and offer a retry (same constant as the onboarding panels).
const STALE_AFTER_MS = 90_000

const PROFILE_FIELDS = [
  "purpose",
  "responsibilities",
  "decisionMandate",
  "stakeholders",
  "knowledge",
  "financial",
  "people",
  "risk",
  "deliverables",
] as const
type ProfileField = (typeof PROFILE_FIELDS)[number]

// Mirrors the getOpenSuggestions row shape for the fields this panel reads.
interface OpenSuggestionRow {
  suggestionId: Id<"suggestions">
  kind: string
  status: string
  suggestedValue: unknown
  errorCode: string | null
  createdAt: number
  roleId: Id<"roles"> | null
}

// The embedded job-profile assistant (ADR-0003): AI drafts field texts, HR
// accepts per field; nothing applies automatically and provenance is always
// stated. Hidden entirely on approved roles (the backend locks them anyway).
export function RoleAiPanel({
  orgId,
  roleId,
}: {
  orgId: string
  roleId: Id<"roles">
}) {
  const t = useTranslations("dashboard.roles.ai")
  // The AI responds in the requester's current UI language.
  const locale = useLocale()
  const tAi = useTranslations("dashboard.ai")
  const tRole = useTranslations("assessment.role")
  const tErrors = useTranslations("errors")

  const suggestions = useQuery(api.ai.suggest.getOpenSuggestions, { orgId })
  const requestDraft = useMutation(api.ai.suggest.requestRoleProfileDraft)
  const confirmDraft = useMutation(api.ai.suggest.confirmRoleProfileDraft)
  const rejectSuggestion = useMutation(api.ai.suggest.rejectSuggestion)

  const [description, setDescription] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [selection, setSelection] = useState<{
    seededFor: string | null
    accepted: Set<ProfileField>
  }>({ seededFor: null, accepted: new Set() })

  // Newest open suggestion for THIS role (the query returns all open rows).
  let draft: OpenSuggestionRow | undefined
  for (const row of suggestions ?? []) {
    if (row.kind !== "role.profile" || row.roleId !== roleId) continue
    if (draft === undefined || row.createdAt > draft.createdAt) draft = row
  }

  const isGenerating = draft?.status === "generating"
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isGenerating) return
    const id = setInterval(() => setTick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [isGenerating])
  const isStaleGenerating =
    draft?.status === "generating" &&
    Date.now() - draft.createdAt >= STALE_AFTER_MS

  const profile =
    draft?.status === "suggested"
      ? ((draft.suggestedValue as { profile?: Record<string, string> } | null)
          ?.profile ?? {})
      : {}
  const suggestedFields = PROFILE_FIELDS.filter(
    (field) => typeof profile[field] === "string"
  )

  // Seed the selection (all checked) when a new suggestion appears
  // (adjust-state-during-render, same as the onboarding panels).
  const draftId = draft?.status === "suggested" ? draft.suggestionId : null
  if (draftId !== null && selection.seededFor !== draftId) {
    setSelection({ seededFor: draftId, accepted: new Set(suggestedFields) })
  }
  const accepted = selection.accepted

  async function onRequest() {
    setPending(true)
    setFailed(false)
    try {
      await requestDraft({
        orgId,
        roleId,
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
    <Card>
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
        <CardDescription>{tAi("provenance")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft?.status === "suggested" ? (
          <div className="space-y-4">
            <ul className="space-y-2">
              {suggestedFields.map((field) => {
                const checkboxId = `role-ai-${field}`
                return (
                  <li
                    key={field}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={accepted.has(field)}
                      onCheckedChange={(value) =>
                        setSelection((current) => {
                          const next = new Set(current.accepted)
                          if (value === true) next.add(field)
                          else next.delete(field)
                          return {
                            seededFor: current.seededFor,
                            accepted: next,
                          }
                        })
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor={checkboxId}>{tRole(field)}</Label>
                      <p className="whitespace-pre-line text-muted-foreground text-sm">
                        {profile[field]}
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
                  if (draft === undefined) return
                  setFailed(false)
                  try {
                    await confirmDraft({
                      orgId,
                      suggestionId: draft.suggestionId,
                      acceptedFields: [...accepted],
                    })
                  } catch {
                    setFailed(true)
                  }
                }}
              >
                {tAi("applyCta")}
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (draft === undefined) return
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
              >
                {tAi("rejectCta")}
              </Button>
            </div>
          </div>
        ) : isGenerating && !isStaleGenerating ? (
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <Spinner />
            {tAi("generating")}
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
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="role-ai-description">
                {t("descriptionLabel")}
              </Label>
              <Textarea
                id="role-ai-description"
                value={description}
                rows={3}
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
            {t("error")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
