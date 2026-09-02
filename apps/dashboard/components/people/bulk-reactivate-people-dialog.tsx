"use client"

import NumberFlow from "@number-flow/react"
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
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"

// The register's batch reactivate, offered only from the archived view.
// Reactivating is reversible (it is itself the undo of archiving), so there
// is no type-to-confirm gate: one sentence states the consequence and the
// primary action reactivates. There is no batch mutation for this direction,
// so the ids are looped one at a time with visible progress, the same
// client-driven pattern as bulk delete. A failure mid-loop leaves the
// reactivated people reactivated; they leave the archived register on their
// own, and confirming again finishes the rest. Controlled: the trigger lives
// in the register's toolbar.
export function BulkReactivatePeopleDialog({
  open,
  onOpenChange,
  personIds,
  onReactivated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The register's effective selection under the archived view.
  personIds: readonly string[]
  // Called once the whole selection landed, so the register can clear it.
  onReactivated: () => void
}) {
  const t = useTranslations("dashboard.people.bulkReactivate")
  const tArchive = useTranslations("dashboard.people.archive")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const unarchivePerson = useMutation(api.people.people.unarchivePerson)
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [failed, setFailed] = useState(false)
  const busy = progress !== null
  // The frozen total wins while busy: the prop prunes as people land.
  const count = progress?.total ?? personIds.length

  function handleOpenChange(next: boolean) {
    if (!next) setFailed(false)
    onOpenChange(next)
  }

  async function handleReactivate() {
    if (busy) return
    const ids = [...personIds]
    if (ids.length === 0) {
      handleOpenChange(false)
      return
    }
    setProgress({ done: 0, total: ids.length })
    setFailed(false)
    try {
      let done = 0
      for (const personId of ids) {
        await unarchivePerson({ orgId, personId: personId as Id<"people"> })
        done += 1
        setProgress({ done, total: ids.length })
      }
      toast.success(tToast("peopleReactivated", { count: ids.length }))
      onReactivated()
      handleOpenChange(false)
    } catch {
      // Partial completion is honest and resumable: whoever landed already
      // left the archived register and pruned out of the selection, so
      // confirming again finishes the remainder.
      setFailed(true)
      toast.error(tToast("error"))
    } finally {
      setProgress(null)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("dialogDescription", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            {tArchive("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              // Keep the dialog mounted; it closes itself on success.
              event.preventDefault()
              void handleReactivate()
            }}
          >
            {progress !== null ? (
              <>
                <Spinner />
                {t.rich("progress", {
                  done: () => <NumberFlow value={progress.done} />,
                  total: () => <NumberFlow value={progress.total} />,
                })}
              </>
            ) : (
              t("confirm")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
