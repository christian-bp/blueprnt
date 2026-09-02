"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"

// One dialog for both directions of the person lifecycle: archive an active
// person, reactivate an archived one. Reversible, so a plain confirm with the
// consequence in one sentence, no type-to-confirm. The archive direction
// carries the concept help on its title; reactivation needs none. Stays on
// the page after either action (the page shows the new state), unlike
// erasure. Controlled: the trigger lives in PersonActionsMenu.
export function ArchivePersonDialog({
  open,
  onOpenChange,
  personId,
  displayName,
  archived,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: Id<"people">
  displayName: string
  archived: boolean
}) {
  const t = useTranslations("dashboard.people.archive")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const archivePerson = useMutation(api.people.people.archivePerson)
  const unarchivePerson = useMutation(api.people.people.unarchivePerson)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next) setFailed(false)
    onOpenChange(next)
  }

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      if (archived) {
        await unarchivePerson({ orgId, personId })
        toast.success(tToast("personReactivated"))
      } else {
        await archivePerson({ orgId, personId })
        toast.success(tToast("personArchived"))
      }
      handleOpenChange(false)
    } catch {
      setFailed(true)
      toast.error(tToast("error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-1.5">
            <AlertDialogTitle>
              {archived
                ? t("reactivateTitle", { name: displayName })
                : t("title", { name: displayName })}
            </AlertDialogTitle>
            {!archived && (
              <HelpMorphButton label={tHelp("archivedPersonLabel")}>
                {tHelp("archivedPersonBody")}
              </HelpMorphButton>
            )}
          </div>
          <AlertDialogDescription>
            {archived ? t("reactivateDescription") : t("description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault()
              void handleConfirm()
            }}
          >
            {busy && <Spinner />}
            {archived ? t("reactivateConfirm") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
