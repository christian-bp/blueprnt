"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useAction } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { draftErrorKey } from "@/lib/error-label"
import type { CreateRoleValues } from "@/lib/role-schemas"

// The role identity a draft is generated from when the role does not exist
// yet. Mirrors the create form's fields; trackKey is sourced from the form
// schema so the panel and the create mutation share one track union.
export interface RoleDraftIdentity {
  title: string
  roleFunction: string
  team: string
  trackKey: CreateRoleValues["trackKey"]
  familyId: string | null
}

// Which role the draft is for. A saved role is addressed by id (the backend
// reads its context); an unsaved one carries the identity the user has typed
// into the create form.
export type RoleAiSource =
  | { kind: "saved"; roleId: Id<"roles"> }
  | { kind: "draft"; identity: RoleDraftIdentity }

// The job-profile assistant, rendered inside the MorphPopover (which owns the
// heading and the provenance line). It generates a draft from the role context
// and an optional free-text guidance, then fills the form via onFilled;
// nothing is persisted here (Save on the card, or Create in the dialog, does
// that). AI output is a suggestion the user reviews and edits before saving
// (ADR-0003).
export function RoleAiPanel({
  orgId,
  source,
  onFilled,
  onDone,
}: {
  orgId: string
  source: RoleAiSource
  // Receives the generated fields; the host writes them into its form.
  onFilled: (values: { purpose: string; responsibilities: string }) => void
  // Called after a successful fill so the host (the popover) can morph back.
  onDone?: () => void
}) {
  const t = useTranslations("dashboard.roles.ai")
  const tAi = useTranslations("dashboard.ai")
  const tErrors = useTranslations("errors")
  const locale = useLocale()
  const draftRoleProfile = useAction(api.ai.draft.draftRoleProfile)
  const draftNewRoleProfile = useAction(api.ai.draft.draftNewRoleProfile)
  const descriptionId = useId()

  const [description, setDescription] = useState("")
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Guards against state updates after the popover has closed and unmounted us.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // An unsaved role is drafted from its title, so there is nothing to generate
  // from until one is typed. Stated in words rather than silently disabled.
  const missingTitle =
    source.kind === "draft" && source.identity.title.trim() === ""

  async function onGenerate() {
    setPending(true)
    setErrorMessage(null)
    const guidance =
      description.trim() !== "" ? { description: description.trim() } : {}
    try {
      const values =
        source.kind === "saved"
          ? await draftRoleProfile({
              orgId,
              roleId: source.roleId,
              locale,
              ...guidance,
            })
          : await draftNewRoleProfile({
              orgId,
              locale,
              title: source.identity.title.trim(),
              function: source.identity.roleFunction,
              team: source.identity.team,
              trackKey: source.identity.trackKey,
              ...(source.identity.familyId !== null
                ? {
                    familyId: source.identity.familyId as Id<"roleFamilies">,
                  }
                : {}),
              ...guidance,
            })
      if (!mounted.current) return
      onFilled(values)
      onDone?.()
    } catch (err) {
      if (!mounted.current) return
      // A recognized appError code gets its own message; anything else gets
      // the panel's generic copy.
      const key = draftErrorKey(err)
      setErrorMessage(key === null ? t("error") : tErrors(key))
    } finally {
      if (mounted.current) setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={descriptionId}>{t("descriptionLabel")}</Label>
        <Textarea
          id={descriptionId}
          value={description}
          rows={3}
          disabled={pending}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      {missingTitle && (
        <p className="text-muted-foreground text-sm">{t("titleFirst")}</p>
      )}
      {/* Explicitly type="button": the panel now also renders inside the
          create dialog's <form>, where a default submit button would create
          the role instead of drafting its profile. */}
      <Button
        type="button"
        variant="outline"
        disabled={pending || missingTitle}
        onClick={onGenerate}
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <Spinner />
            {tAi("generating")}
          </span>
        ) : (
          t("draftCta")
        )}
      </Button>
      {errorMessage !== null && (
        <p role="alert" className="text-destructive text-sm">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
