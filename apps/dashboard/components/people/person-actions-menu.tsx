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
  EditClassificationDialog,
} from "@/components/people/edit-classification-dialog"
import {
  type EditablePerson,
  EditPersonDialog,
} from "@/components/people/edit-person-dialog"
import { ErasePersonControl } from "@/components/people/erase-person-control"

// The person page's unified actions menu: a single "..." trigger in the
// employee card's header (same anatomy as FamilyActionsMenu) holding the
// person actions: editing the identity details, editing the role + level
// classification, and the GDPR erasure as a destructive item opening the
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
  const [editOpen, setEditOpen] = useState(false)
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
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            {t("detail.editClassification.cta")}
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
      />

      <EditClassificationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        personId={person.personId}
        roles={roles}
        current={currentAssignment}
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
