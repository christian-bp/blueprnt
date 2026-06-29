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
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

// The role lifecycle menu. Archive is the only action today and it is admin
// only; an archived role has no further lifecycle action (there is no
// unarchive). When no action is available the menu renders nothing, so the
// header is just the breadcrumb (empty-menu rule).
export function RoleActionsMenu({
  orgId,
  roleId,
  archived,
  isAdmin,
  editing,
  onEdit,
}: {
  orgId: string
  roleId: Id<"roles">
  archived: boolean
  isAdmin: boolean
  editing: boolean
  onEdit: () => void
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tArchive = useTranslations("dashboard.roles.archive")
  const archiveRole = useMutation(api.assessment.roles.archiveRole)
  const router = useRouter()
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [pending, setPending] = useState(false)

  // Edit is offered to every member (the profile is member-editable) while the
  // role is live and not already being edited; Archive is admin-only. When
  // neither applies, the menu is not rendered (empty-menu rule).
  const showEdit = !archived && !editing
  const showArchive = !archived && isAdmin
  if (!showEdit && !showArchive) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("actionsMenu")}
            className="shrink-0"
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showEdit && (
            <DropdownMenuItem onSelect={onEdit}>
              {t("editCta")}
            </DropdownMenuItem>
          )}
          {showArchive && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmArchive(true)}
            >
              {tArchive("cta")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showArchive && (
        <ConfirmDeleteDialog
          open={confirmArchive}
          onOpenChange={setConfirmArchive}
          title={tArchive("dialogTitle")}
          description={tArchive("dialogBody")}
          confirmLabel={tArchive("confirm")}
          cancelLabel={tArchive("cancel")}
          pending={pending}
          onConfirm={async () => {
            setPending(true)
            try {
              await archiveRole({ orgId, roleId })
              router.push("/roles")
            } finally {
              setPending(false)
            }
          }}
        />
      )}
    </>
  )
}
