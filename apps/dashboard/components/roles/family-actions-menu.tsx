"use client"

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { RenameFamilyDialog } from "@/components/roles/rename-family-dialog"

// The family lifecycle menu: Rename (a dialog) and Delete (a confirmed hard
// delete that unfiles the family's roles into the "No family" group). The
// delete dialog lists the affected roles so the impact is explicit.
export function FamilyActionsMenu({
  orgId,
  familyId,
  name,
  roleTitles,
}: {
  orgId: string
  familyId: Id<"roleFamilies">
  name: string
  roleTitles: string[]
}) {
  const tFamily = useTranslations("dashboard.roles.family")
  const tToast = useTranslations("dashboard.toast")
  const removeFamily = useMutation(api.assessment.families.removeRoleFamily)
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={tFamily("actionsMenu")}
              className="shrink-0"
            />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            {tFamily("renameCta")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            {tFamily("removeCta")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameFamilyDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        orgId={orgId}
        familyId={familyId}
        currentName={name}
      />

      <ConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={tFamily("removeDialogTitle")}
        description={tFamily("removeHint")}
        confirmLabel={tFamily("removeConfirm")}
        cancelLabel={tFamily("cancel")}
        pending={pending}
        onConfirm={async () => {
          setPending(true)
          try {
            await removeFamily({ orgId, familyId })
            toast.success(tToast("familyDeleted"))
            router.push("/roles")
          } catch {
            toast.error(tToast("error"))
          } finally {
            setPending(false)
          }
        }}
      >
        {roleTitles.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-2 font-medium text-sm">
              {tFamily("removeListLabel")}
            </p>
            <ul className="max-h-[200px] space-y-1 overflow-y-auto">
              {roleTitles.map((title) => (
                <li
                  key={title}
                  className="flex items-center gap-2 text-muted-foreground text-sm"
                >
                  <span className="inline-block size-1 rounded-full bg-muted-foreground" />
                  {title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </ConfirmDeleteDialog>
    </>
  )
}
