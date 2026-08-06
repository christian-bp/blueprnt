"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"
import { ActionDialog } from "./action-dialog"
import { NoteDialog } from "./note-dialog"
import {
  type ActionStatus,
  type ActionTargetWire,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  targetMatches,
} from "./pay-mapping-gap-types"

// The action-status chip's tint, following PayGapFlagBadge's precedent (the
// same dedicated flag-* tokens rather than the shared Badge text tokens,
// which fail AA on their own pale tint in light mode). The label always
// renders, so color is never the only carrier.
const STATUS_CLASSNAME: Record<ActionStatus, string> = {
  notStarted:
    "border-transparent bg-flag-elevated/10 text-flag-elevated dark:bg-flag-elevated/20",
  inProgress: "border-transparent bg-brand/10 text-brand dark:bg-brand/20",
  done: "border-transparent bg-success/10 text-flag-ok dark:bg-success/20",
}

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const t = useTranslations("dashboard.payMapping.actions")
  return (
    <Badge data-status={status} className={cn(STATUS_CLASSNAME[status])}>
      {t(`status.${status}`)}
    </Badge>
  )
}

// The documentation summary for one target: an action's status chip (the
// most advanced one when several exist) and a plain note chip. Rendered in a
// FIXED-SIZE slot by its callers, so a target gaining documentation never
// reflows the row (layout-shift rule).
export function DocumentationBadges({
  actions,
  notes,
}: {
  actions: PayMappingActionWire[]
  notes: PayMappingNoteWire[]
}) {
  const t = useTranslations("dashboard.payMapping.actions")
  if (actions.length === 0 && notes.length === 0) return null
  // "Worst first" is not the reading here: the row answers "is this handled
  // yet?", so the LEAST advanced status leads.
  const rank: Record<ActionStatus, number> = {
    notStarted: 0,
    inProgress: 1,
    done: 2,
  }
  const leading = [...actions].sort(
    (a, b) => rank[a.status] - rank[b.status]
  )[0]
  return (
    <span className="flex items-center gap-1">
      {leading !== undefined && <ActionStatusBadge status={leading.status} />}
      {notes.length > 0 && (
        <Badge variant="secondary">
          {t("noteBadge", { count: notes.length })}
        </Badge>
      )}
    </span>
  )
}

// The per-target documentation control (Iteration 2 note 5): a single
// trailing "..." trigger opening create/edit items for this target's action
// and note, per the row-actions convention (never inline buttons). Used at
// group level, on a member row, and on a tvärnivå pair; `locked` mirrors the
// run's completed state, where the work layer no longer accepts edits.
export function DocumentationMenu({
  runId,
  target,
  targetLabel,
  actions,
  notes,
  currency,
  locked,
}: {
  runId: Id<"payMappingRuns">
  target: ActionTargetWire
  targetLabel: string
  actions: PayMappingActionWire[]
  notes: PayMappingNoteWire[]
  currency: string
  locked: boolean
}) {
  const t = useTranslations("dashboard.payMapping.actions")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const deleteAction = useMutation(api.payMapping.actions.deleteAction)
  const deleteNote = useMutation(api.payMapping.notes.deleteNote)
  const [actionOpen, setActionOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const existingAction = actions[0]
  const existingNote = notes[0]

  async function handleDelete() {
    setPending(true)
    try {
      if (existingAction !== undefined) {
        await deleteAction({ orgId, actionId: existingAction.actionId })
        toast.success(tToast("payMappingActionDeleted"))
      } else if (existingNote !== undefined) {
        await deleteNote({ orgId, noteId: existingNote.noteId })
        toast.success(tToast("payMappingNoteDeleted"))
      }
      setConfirmOpen(false)
    } catch {
      toast.error(tToast("error"))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("menuLabel", { target: targetLabel })}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            />
          }
        >
          <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={locked}
            onClick={() => setActionOpen(true)}
          >
            {existingAction === undefined ? t("createTitle") : t("editTitle")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={locked} onClick={() => setNoteOpen(true)}>
            {existingNote === undefined
              ? t("createNoteTitle")
              : t("editNoteTitle")}
          </DropdownMenuItem>
          {(existingAction !== undefined || existingNote !== undefined) && (
            <DropdownMenuItem
              variant="destructive"
              disabled={locked}
              onClick={() => setConfirmOpen(true)}
            >
              {existingAction !== undefined
                ? t("deleteAction")
                : t("deleteNote")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mounted only while open: every member row and every cross-level
          pair carries one of these menus, so keeping three dialog trees
          alive per row made a page with dozens of rows visibly slow. */}
      {actionOpen && (
        <ActionDialog
          open
          onOpenChange={setActionOpen}
          runId={runId}
          target={target}
          targetLabel={targetLabel}
          action={existingAction}
          currency={currency}
        />
      )}
      {noteOpen && (
        <NoteDialog
          open
          onOpenChange={setNoteOpen}
          runId={runId}
          target={target}
          targetLabel={targetLabel}
          note={existingNote}
        />
      )}
      {confirmOpen && (
        <ConfirmDeleteDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={
            existingAction !== undefined
              ? t("deleteActionTitle")
              : t("deleteNoteTitle")
          }
          description={t("deleteDescription")}
          confirmLabel={t("deleteConfirm")}
          cancelLabel={t("cancel")}
          onConfirm={handleDelete}
          pending={pending}
        />
      )}
    </>
  )
}

// The records anchored to exactly one target, split by kind: the one place
// the detail views filter the run's whole work layer down to a row.
export function documentationFor(
  target: ActionTargetWire,
  actions: PayMappingActionWire[] | undefined,
  notes: PayMappingNoteWire[] | undefined
): { actions: PayMappingActionWire[]; notes: PayMappingNoteWire[] } {
  return {
    actions: (actions ?? []).filter((a) => targetMatches(a.target, target)),
    notes: (notes ?? []).filter((n) => targetMatches(n.target, target)),
  }
}
