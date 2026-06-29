"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
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
}: {
  orgId: string
  roleId: Id<"roles">
  archived: boolean
  isAdmin: boolean
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tArchive = useTranslations("dashboard.roles.archive")
  const archiveRole = useMutation(api.assessment.roles.archiveRole)
  const router = useRouter()
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [pending, setPending] = useState(false)

  if (!isAdmin || archived) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actionsMenu")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmArchive(true)}
          >
            {tArchive("cta")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
    </>
  )
}
