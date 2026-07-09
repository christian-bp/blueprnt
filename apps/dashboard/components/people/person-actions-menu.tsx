"use client"

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
  type EditablePerson,
  EditPersonDialog,
} from "@/components/people/edit-person-dialog"
import { ErasePersonControl } from "@/components/people/erase-person-control"

// The person page's unified actions menu: a single "..." trigger in the
// employee card's header (same anatomy as FamilyActionsMenu) holding the
// person actions: one Edit dialog covering the identity details AND the
// role + level pair, and the GDPR erasure as a destructive item opening the
// type-to-confirm dialog.
export function PersonActionsMenu({
  person,
  roles,
  currentAssignment,
}: {
  person: EditablePerson
  roles: AssignableRole[]
  currentAssignment: { roleId: string; level: string } | null
}) {
  const t = useTranslations("dashboard.people")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [eraseOpen, setEraseOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("detail.actionsMenu")}
              className="shrink-0"
            />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
            {t("editPerson.title")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setEraseOpen(true)}
          >
            {t("erase.trigger")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPersonDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        person={person}
        roles={roles}
        currentAssignment={currentAssignment}
      />

      <ErasePersonControl
        open={eraseOpen}
        onOpenChange={setEraseOpen}
        personId={person.personId}
        displayName={person.displayName}
        externalRef={person.externalRef}
      />
    </>
  )
}
