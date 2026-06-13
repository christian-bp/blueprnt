"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { SUGGESTION_KINDS } from "@workspace/constants"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useSuggestionFlow } from "@/hooks/use-suggestion-flow"
import { useSuggestionSelection } from "@/hooks/use-suggestion-selection"
import { roleProfileValueSchema } from "@/lib/suggestion-schemas"

const PROFILE_FIELDS = ["purpose", "responsibilities"] as const
type ProfileField = (typeof PROFILE_FIELDS)[number]

// The job-profile assistant, rendered inside the MorphPopover (which owns
// the heading and the always-visible provenance line). AI drafts field
// texts, HR accepts per field; nothing applies automatically (ADR-0003).
// Closing the popover does NOT dismiss: an open draft stays put and
// reopening shows it again, so the only ways out are an explicit apply or
// dismiss.
export function RoleAiPanel({
  orgId,
  roleId,
  onDone,
}: {
  orgId: string
  roleId: Id<"roles">
  // Called after a successful apply or dismiss so the host (the popover)
  // can morph back to its button.
  onDone?: () => void
}) {
  const t = useTranslations("dashboard.roles.ai")
  // The AI responds in the requester's current UI language.
  const locale = useLocale()
  const tAi = useTranslations("dashboard.ai")
  const tRole = useTranslations("assessment.role")
  const tErrors = useTranslations("errors")

  // The shared suggestion lifecycle, scoped to THIS role. Request/confirm
  // stay here (kind-specific args).
  const flow = useSuggestionFlow({
    orgId,
    kind: SUGGESTION_KINDS.roleProfile,
    schema: roleProfileValueSchema,
    roleId,
  })
  const requestDraft = useMutation(api.ai.suggest.requestRoleProfileDraft)
  const confirmDraft = useMutation(api.ai.suggest.confirmRoleProfileDraft)

  const [description, setDescription] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const profile: Record<string, string> = flow.value?.profile ?? {}
  const suggestedFields = PROFILE_FIELDS.filter(
    (field) => typeof profile[field] === "string"
  )

  // Fields default to checked when a fresh suggestion arrives.
  const { accepted, toggle } = useSuggestionSelection<ProfileField>(
    flow.status === "suggested" ? flow.suggestionId : null,
    () => suggestedFields
  )

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
    <div className="space-y-4">
      {flow.status === "suggested" ? (
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
                    onCheckedChange={(value) => toggle(field, value === true)}
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
                const suggestionId = flow.suggestionId
                if (suggestionId === null) return
                setFailed(false)
                try {
                  await confirmDraft({
                    orgId,
                    suggestionId,
                    acceptedFields: [...accepted],
                  })
                  onDone?.()
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
                setFailed(false)
                try {
                  await flow.reject()
                  onDone?.()
                } catch {
                  setFailed(true)
                }
              }}
            >
              {tAi("rejectCta")}
            </Button>
          </div>
        </div>
      ) : flow.status === "generating" ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner />
          {tAi("generating")}
        </p>
      ) : flow.status === "failed" ? (
        <div className="space-y-3">
          <p role="alert" className="text-destructive text-sm">
            {tErrors(flow.errorSubKey ?? "aiGenerationFailed")}
          </p>
          <Button variant="outline" disabled={pending} onClick={onRequest}>
            {t("draftCta")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="role-ai-description">{t("descriptionLabel")}</Label>
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
    </div>
  )
}
