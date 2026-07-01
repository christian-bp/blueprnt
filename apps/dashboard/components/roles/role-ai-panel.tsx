"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useAction } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

// The job-profile assistant, rendered inside the MorphPopover (which owns the
// heading and the provenance line). It generates a draft from the role context
// and an optional free-text guidance, then fills the edit form via onFilled;
// nothing is persisted here (Save on the card does that). AI output is a
// suggestion the user reviews and edits before saving (ADR-0003).
export function RoleAiPanel({
  orgId,
  roleId,
  onFilled,
  onDone,
}: {
  orgId: string
  roleId: Id<"roles">
  // Receives the generated fields; the card writes them into its edit draft.
  onFilled: (values: { purpose: string; responsibilities: string }) => void
  // Called after a successful fill so the host (the popover) can morph back.
  onDone?: () => void
}) {
  const t = useTranslations("dashboard.roles.ai")
  const tAi = useTranslations("dashboard.ai")
  const locale = useLocale()
  const draftRoleProfile = useAction(api.ai.draft.draftRoleProfile)

  const [description, setDescription] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  // Guards against state updates after the popover has closed and unmounted us.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function onGenerate() {
    setPending(true)
    setFailed(false)
    try {
      const values = await draftRoleProfile({
        orgId,
        roleId,
        locale,
        ...(description.trim() !== ""
          ? { description: description.trim() }
          : {}),
      })
      if (!mounted.current) return
      onFilled(values)
      onDone?.()
    } catch {
      if (mounted.current) setFailed(true)
    } finally {
      if (mounted.current) setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="role-ai-description">{t("descriptionLabel")}</Label>
        <Textarea
          id="role-ai-description"
          value={description}
          rows={3}
          disabled={pending}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <Button variant="outline" disabled={pending} onClick={onGenerate}>
        {pending ? (
          <span className="flex items-center gap-2">
            <Spinner />
            {tAi("generating")}
          </span>
        ) : (
          t("draftCta")
        )}
      </Button>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
    </div>
  )
}
