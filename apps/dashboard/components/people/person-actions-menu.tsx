"use client"

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
  type AssignableRole,
  EditClassificationDialog,
} from "@/components/people/edit-classification-dialog"
import { ErasePersonControl } from "@/components/people/erase-person-control"

// The person page's unified actions menu: a single "..." trigger in the
// employee card's header (same anatomy as FamilyActionsMenu) holding the
// person actions: editing the role + level classification, and the GDPR
// erasure as a destructive item opening the type-to-confirm dialog.
export function PersonActionsMenu({
  personId,
  displayName,
  externalRef,
  roles,
  currentAssignment,
}: {
  personId: Id<"people">
  displayName: string
  externalRef: string | null
  roles: AssignableRole[]
  currentAssignment: { roleId: string; level: string } | null
}) {
  const t = useTranslations("dashboard.people")
  const [editOpen, setEditOpen] = useState(false)
  const [eraseOpen, setEraseOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("detail.actionsMenu")}
            className="shrink-0"
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        {/* w-auto: size to the item labels, not the icon trigger's width
            (see salary-row-actions.tsx). */}
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            {t("detail.editClassification.cta")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setEraseOpen(true)}
          >
            {t("erase.trigger")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditClassificationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        personId={personId}
        roles={roles}
        current={currentAssignment}
      />

      <ErasePersonControl
        open={eraseOpen}
        onOpenChange={setEraseOpen}
        personId={personId}
        displayName={displayName}
        externalRef={externalRef}
      />
    </>
  )
}
