"use client"

import { zodResolver } from "@hookform/resolvers/zod"
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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"

// The register's batch erasure gate. The per-person dialog asks for the
// employee number, which cannot address several people at once, so the batch
// asks for the literal token that dialog already falls back to when a person
// has no employee number.
const ERASE_TOKEN = "DELETE"

// No message on the refine: the gate shows no inline field error, it only
// arms the destructive action (same shape as ErasePersonControl).
const schema = z.object({
  confirmText: z.string().refine((v) => v.trim() === ERASE_TOKEN),
})

// Deletes every selected person, one erasePersonAsOrg call at a time.
//
// One person per transaction is the honest bound: erasing a person already
// deletes their whole salary history and assignments, pseudonymizes them
// inside every frozen pay-mapping snapshot, and rewrites every audit row
// carrying them as subject, so the work per person is itself unbounded. A
// client-driven loop with visible progress is the pattern the scalability rule
// asks for, and it needs no new backend surface: each iteration writes its own
// person.erased audit row, exactly as deleting them one by one would.
//
// Controlled: the trigger lives in the register's bulk toolbar, not here.
export function BulkDeletePeopleDialog({
  open,
  onOpenChange,
  personIds,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The register's EFFECTIVE selection (already pruned to rows it is showing).
  personIds: readonly string[]
  // Called once the whole selection landed, so the register can clear it.
  onDeleted: () => void
}) {
  const t = useTranslations("dashboard.people.bulk")
  const tErase = useTranslations("dashboard.people.erase")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const erasePerson = useMutation(api.people.erase.erasePersonAsOrg)
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [failed, setFailed] = useState(false)

  const form = useForm<{ confirmText: string }>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { confirmText: "" },
  })
  const confirmed = form.formState.isValid
  const busy = progress !== null

  // While the loop runs, people erased so far leave the register's reactive
  // query and prune out of `personIds`. The dialog's own copy must not tick
  // down under the user mid-delete, so the frozen total wins while busy.
  const count = progress?.total ?? personIds.length

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset({ confirmText: "" })
      setFailed(false)
    }
    onOpenChange(next)
  }

  async function handleDelete() {
    if (!confirmed || busy) return
    // Snapshot the ids: the prop prunes reactively as the loop lands.
    const ids = [...personIds]
    // The selection pruned to nothing while the dialog was open (everyone was
    // erased or filtered away elsewhere). Nothing to write, so close without
    // claiming a success that did not happen.
    if (ids.length === 0) {
      handleOpenChange(false)
      return
    }
    setProgress({ done: 0, total: ids.length })
    setFailed(false)
    try {
      let done = 0
      for (const personId of ids) {
        await erasePerson({ orgId, personId: personId as Id<"people"> })
        done += 1
        setProgress({ done, total: ids.length })
      }
      toast.success(tToast("peopleErased", { count: ids.length }))
      onDeleted()
      handleOpenChange(false)
    } catch {
      // Partial completion is honest and resumable: whoever landed is already
      // gone from the register and pruned out of the selection, so confirming
      // again finishes the remainder.
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
        <div className="space-y-2">
          <Label htmlFor="confirm-bulk-erase">{t("confirmLabel")}</Label>
          <Input
            id="confirm-bulk-erase"
            autoComplete="off"
            disabled={busy}
            {...form.register("confirmText")}
          />
        </div>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}
        <AlertDialogFooter>
          {/* Cancel reuses the per-person dialog's already-translated label
              rather than adding a second "Cancel" key to this surface. */}
          <AlertDialogCancel disabled={busy}>
            {tErase("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!confirmed || busy}
            onClick={(event) => {
              // Keep the dialog mounted; we close it ourselves on success.
              event.preventDefault()
              void handleDelete()
            }}
          >
            {progress !== null ? (
              <>
                <Spinner />
                {/* The progress numbers render through NumberFlow (the
                    message's tags carry the layout) so the done count rolls
                    as each person lands instead of swapping. */}
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
