"use client"

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ArchivePersonDialog } from "@/components/people/archive-person-dialog"
import {
  type AssignableRole,
  type EditablePerson,
  EditPersonDialog,
} from "@/components/people/edit-person-dialog"
import { ErasePersonControl } from "@/components/people/erase-person-control"
import { useOrganization } from "@/components/org-context"
import { ActionsMenuTrigger } from "@/components/actions-menu-trigger"

// The person page's unified actions menu: a single "..." trigger in the
// employee card's header (same anatomy as FamilyActionsMenu) holding the
// person actions: one Edit dialog covering the identity details AND the
// role + seniority pair, the Archive/Reactivate toggle (member-level,
// reversible), and the GDPR erasure as a destructive item opening the
// type-to-confirm dialog (admin-only). Erasure is offered only on an
// archived person, so an active record is never erased without first
// passing through the archive.
export function PersonActionsMenu({
  person,
  roles,
  currentAssignment,
  archivedAt,
}: {
  person: EditablePerson
  roles: AssignableRole[]
  currentAssignment: { roleId: string; seniority: string } | null
  archivedAt: number | null
}) {
  const t = useTranslations("dashboard.people")
  const tArchive = useTranslations("dashboard.people.archive")
  const { role } = useOrganization()
  // Erasing a person is irreversible and admin-only (people/erase.ts). Hidden
  // rather than shown disabled: absence is how this app treats an admin-only
  // thing everywhere else (the nav hides /organization and /audit-log from an
  // editor outright), and a destructive item standing permanently dead in
  // every person's menu would be noise on the common case. An editor who
  // needs an erasure asks an administrator, which is what the organization
  // page already explains about the two roles. Both the item and its dialog
  // below also require archivedAt !== null: erasure is offered only on an
  // archived person, so it never appears next to Archive on an active one.
  const canErase = role === "admin"
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [eraseOpen, setEraseOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<ActionsMenuTrigger aria-label={t("detail.actionsMenu")} />}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
            {t("editPerson.title")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
            {archivedAt !== null
              ? tArchive("reactivateTrigger")
              : tArchive("trigger")}
          </DropdownMenuItem>
          {canErase && archivedAt !== null && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setEraseOpen(true)}
            >
              {t("erase.trigger")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPersonDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        person={person}
        roles={roles}
        currentAssignment={currentAssignment}
      />

      <ArchivePersonDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        personId={person.personId}
        displayName={person.displayName}
        archived={archivedAt !== null}
      />

      {canErase && archivedAt !== null && (
        <ErasePersonControl
          open={eraseOpen}
          onOpenChange={setEraseOpen}
          personId={person.personId}
          displayName={person.displayName}
          externalRef={person.externalRef}
        />
      )}
    </>
  )
}
