"use client"

import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { PEOPLE_ARCHIVE_CHUNK_SIZE } from "@workspace/constants"
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

// The register's batch archive. Archiving is reversible, so there is no
// type-to-confirm gate: one sentence states the consequence and the primary
// action archives. The ids arrive in chunks of PEOPLE_ARCHIVE_CHUNK_SIZE (the
// backend refuses more per call), driven from here with visible progress,
// like bulk delete. A failure mid-loop leaves the archived chunks archived;
// they drop out of an "Active" register on their own, and confirming again
// finishes the rest. Controlled: the trigger lives in the register's toolbar.
export function BulkArchivePeopleDialog({
  open,
  onOpenChange,
  personIds,
  onArchived,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The register's effective selection (the active view is the only one
  // that offers archiving).
  personIds: readonly string[]
  onArchived: () => void
}) {
  const t = useTranslations("dashboard.people.bulkArchive")
  const tArchive = useTranslations("dashboard.people.archive")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const archivePeople = useMutation(api.people.people.archivePeople)
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [failed, setFailed] = useState(false)
  const busy = progress !== null
  // The frozen total wins while busy: the prop prunes as chunks land.
  const count = progress?.total ?? personIds.length

  function handleOpenChange(next: boolean) {
    if (!next) setFailed(false)
    onOpenChange(next)
  }

  async function handleArchive() {
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
      for (
        let start = 0;
        start < ids.length;
        start += PEOPLE_ARCHIVE_CHUNK_SIZE
      ) {
        const chunk = ids.slice(start, start + PEOPLE_ARCHIVE_CHUNK_SIZE)
        await archivePeople({
          orgId,
          personIds: chunk as Id<"people">[],
        })
        done += chunk.length
        setProgress({ done, total: ids.length })
      }
      toast.success(tToast("peopleArchived", { count: ids.length }))
      onArchived()
      handleOpenChange(false)
    } catch {
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
          <div className="flex items-center gap-1.5">
            <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
            <HelpMorphButton label={tHelp("archivedPersonLabel")}>
              {tHelp("archivedPersonBody")}
            </HelpMorphButton>
          </div>
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
              void handleArchive()
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
