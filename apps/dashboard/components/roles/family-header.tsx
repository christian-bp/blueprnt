"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { MorphConfirmButton } from "@/components/morph-confirm-button"
import { isDuplicateFamilyError } from "@/lib/family-error"

// Family page header: inline rename (member scope) and a confirmed removal
// that clears membership and navigates back to the register.
export function FamilyHeader({
  orgId,
  familyId,
  name,
}: {
  orgId: string
  familyId: string
  name: string
}) {
  const t = useTranslations("dashboard.roles.family")
  const tErrors = useTranslations("errors")
  const renameFamily = useMutation(api.assessment.families.renameRoleFamily)
  const removeFamily = useMutation(api.assessment.families.removeRoleFamily)
  const router = useRouter()
  const inputId = useId()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)

  async function handleSave() {
    const trimmed = draft.trim()
    if (trimmed === "" || pending) return
    setPending(true)
    setFailure(null)
    try {
      await renameFamily({
        orgId,
        familyId: familyId as never,
        name: trimmed,
      })
      setEditing(false)
    } catch (error) {
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <label className="sr-only" htmlFor={inputId}>
              {t("nameLabel")}
            </label>
            <Input
              className="max-w-xs"
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button
              disabled={draft.trim() === "" || pending}
              size="sm"
              type="button"
              onClick={handleSave}
            >
              {t("saveCta")}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setDraft(name)
                setFailure(null)
              }}
            >
              {t("cancel")}
            </Button>
          </>
        ) : (
          <>
            <h2 className="font-medium text-lg">{name}</h2>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(name)
                setEditing(true)
              }}
            >
              {t("renameCta")}
            </Button>
          </>
        )}
        <MorphConfirmButton
          cancelLabel={t("cancel")}
          className="ml-auto"
          confirmLabel={t("removeConfirm")}
          disabled={pending}
          triggerText={t("removeCta")}
          variant="label"
          onConfirm={async () => {
            await removeFamily({ orgId, familyId: familyId as never })
            router.push("/roles")
          }}
        />
      </div>
      <p className="text-muted-foreground text-sm">{t("removeHint")}</p>
      {failure !== null && (
        <p className="text-destructive text-sm" role="alert">
          {failure === "duplicate" ? tErrors("roleFamilyExists") : t("error")}
        </p>
      )}
    </div>
  )
}
