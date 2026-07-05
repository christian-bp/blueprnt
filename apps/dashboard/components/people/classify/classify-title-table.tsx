"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { TRACK_LEVELS, isValidLevelForTrack } from "@workspace/constants"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { Fragment, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { SPRING } from "@/lib/motion"
import { ClassifyPersonRows } from "./classify-person-rows"
import { UnmatchedTitleActions } from "./unmatched-title-actions"

// ---------------------------------------------------------------------------
// Types (structural subsets of the Convex return shapes; Convex ids are
// strings at the JS layer so we use string throughout to keep this component
// fixture-testable without importing generated Convex types).
// ---------------------------------------------------------------------------

export interface ClassifyPersonRow {
  personId: string
  displayName: string
  externalRef: string | null
  employmentStartDate: string | null
  isManager: boolean | null
  suggestedLevel: string | null
  currentAssignment: {
    roleId: string
    level: string
    levelSource: "suggested" | "confirmed"
  } | null
}

export interface ClassifyTitleGroup {
  title: string | null
  personCount: number
  suggestedRoleId: string | null
  confidence: "high" | "medium" | "unmatched"
  people: ClassifyPersonRow[]
}

export interface ClassifyRole {
  roleId: string
  title: string
  trackKey: string
}

export interface ClassifyTrack {
  key: string
  name: string
  order: number
}

// ---------------------------------------------------------------------------
// Pure helper: exported so tests can exercise it without DOM.
// ---------------------------------------------------------------------------

// Derives the classification state for a group of people from their current
// assignments. Confirmed iff every person has a confirmed assignment; unclassified
// iff no person has any assignment; pending otherwise (mixed or all suggested).
export function classificationStateForPeople(
  people: Array<{
    currentAssignment: { levelSource: "suggested" | "confirmed" } | null
  }>
): "confirmed" | "pending" | "unclassified" {
  if (people.length === 0) return "unclassified"
  const hasAny = people.some((p) => p.currentAssignment !== null)
  if (!hasAny) return "unclassified"
  const allConfirmed = people.every(
    (p) => p.currentAssignment?.levelSource === "confirmed"
  )
  return allConfirmed ? "confirmed" : "pending"
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Stable row key: never use the possibly-null title as a Map/React key.
function rowKey(group: ClassifyTitleGroup): string {
  return group.title ?? "__no_title__"
}

// The first (lowest) valid level for a role's track, used as a fallback when
// the engine gave no per-person level. Guarantees a level that passes the
// backend's isValidLevelForTrack check.
function defaultLevelFor(
  roleId: string,
  roleById: Map<string, ClassifyRole>
): string {
  const role = roleById.get(roleId)
  if (role === undefined) return ""
  const levels = TRACK_LEVELS[role.trackKey as keyof typeof TRACK_LEVELS] ?? []
  return levels[0] ?? ""
}

// Build a fresh per-person level Map for a group using the new track's
// default, resetting any stale levels from a previous track.
function buildDefaultLevels(
  people: ClassifyPersonRow[],
  trackKey: string
): Map<string, string> {
  const levels = TRACK_LEVELS[trackKey as keyof typeof TRACK_LEVELS] ?? []
  const first = levels[0] ?? ""
  const result = new Map<string, string>()
  for (const p of people) {
    const level =
      p.suggestedLevel !== null &&
      isValidLevelForTrack(trackKey, p.suggestedLevel)
        ? p.suggestedLevel
        : first
    result.set(p.personId, level)
  }
  return result
}

// ---------------------------------------------------------------------------
// Shared table header: exported so the loading skeleton in classify/page.tsx
// can reuse the exact same cells and the two can never drift apart.
// ---------------------------------------------------------------------------

// The number of columns in the table (checkbox, expand, title, people, role,
// state, actions). Exported so the loading skeleton and the expansion row's
// colSpan can never drift from the real header.
export const CLASSIFY_COLUMN_COUNT = 7

export function ClassifyTableHeader({
  selectAll,
}: {
  // The select-all checkbox slot; the loading skeleton omits it.
  selectAll?: React.ReactNode
}) {
  const t = useTranslations("dashboard.classify")
  return (
    <TableHeader>
      <TableRow>
        {/* Select-all checkbox in a fixed-width slot */}
        <TableHead className="w-8">{selectAll}</TableHead>
        {/* Reserved slot for the expand/collapse control (fixed width avoids layout shift) */}
        <TableHead className="w-8" />
        <TableHead>{t("columns.title")}</TableHead>
        <TableHead>{t("columns.people")}</TableHead>
        <TableHead>{t("columns.suggestedRole")}</TableHead>
        <TableHead>{t("columns.state")}</TableHead>
        <TableHead>{t("columns.actions")}</TableHead>
      </TableRow>
    </TableHeader>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClassifyTitleTable({
  orgId,
  groups,
  roles,
  tracks,
  pseudonymize,
}: {
  orgId: string
  groups: ClassifyTitleGroup[]
  roles: ClassifyRole[]
  tracks: ClassifyTrack[]
  pseudonymize: boolean
}) {
  const t = useTranslations("dashboard.classify")
  const tToast = useTranslations("dashboard.toast")

  // Per-row selected role: keyed by rowKey(group) (never null)
  const [selectedRole, setSelectedRole] = useState<Map<string, string | null>>(
    () => new Map()
  )

  // Which role Selects are programmatically open (used by onMapExisting to
  // focus the picker without adding a separate control).
  const [selectOpen, setSelectOpen] = useState<Set<string>>(() => new Set())

  // Which groups have their per-person rows expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  // Per-person selected levels: outer key = rowKey(group), inner key = personId
  const [selectedLevel, setSelectedLevel] = useState<
    Map<string, Map<string, string>>
  >(() => new Map())

  // Per-row in-flight guard: prevents double-confirm and surfaces errors.
  // Keyed by rowKey(group).
  const [confirming, setConfirming] = useState<Set<string>>(() => new Set())

  // Rows ticked for the bulk Confirm-selected action, keyed by rowKey(group).
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const assignPeople = useMutation(api.people.assignments.assignPeopleToRole)

  const roleById = new Map<string, ClassifyRole>(
    roles.map((r) => [r.roleId, r])
  )

  // tracks is passed to UnmatchedTitleActions so the create-role dialog can
  // offer the track Select. roleById is used for correctness checks on
  // track change (see handleRoleChange).

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleLevelChange(
    groupKey: string,
    personId: string,
    level: string
  ) {
    setSelectedLevel((prev) => {
      const next = new Map(prev)
      const groupLevels = new Map(prev.get(groupKey) ?? new Map())
      groupLevels.set(personId, level)
      next.set(groupKey, groupLevels)
      return next
    })
  }

  function handleRoleChange(
    groupKey: string,
    value: string,
    group: ClassifyTitleGroup
  ) {
    // null is reserved for the unmatched-row handling (no role assigned)
    const newRoleId = value || null
    setSelectedRole((prev) => {
      const next = new Map(prev)
      next.set(groupKey, newRoleId)
      return next
    })

    // When the role changes to one on a different track, reset per-person
    // levels so an out-of-track level can never be submitted (ADR-0005:
    // level must be valid for the track; the server re-validates via
    // isValidLevelForTrack, but the UI must not offer or submit an invalid one).
    if (newRoleId !== null) {
      const newRole = roleById.get(newRoleId)
      const prevRoleId = selectedRole.get(groupKey) ?? group.suggestedRoleId
      const prevRole =
        prevRoleId !== null && prevRoleId !== undefined
          ? roleById.get(prevRoleId)
          : undefined

      const trackChanged =
        newRole !== undefined &&
        (prevRole === undefined || prevRole.trackKey !== newRole.trackKey)

      if (trackChanged && newRole !== undefined) {
        setSelectedLevel((prev) => {
          const next = new Map(prev)
          next.set(groupKey, buildDefaultLevels(group.people, newRole.trackKey))
          return next
        })
      }
    }
  }

  // Builds the per-person assignment payload for a group. Level resolution:
  // the per-person selected level when present; else suggestedLevel when it
  // is valid for the role's track; else the track's first level. This
  // guarantees a valid level is always submitted.
  function buildAssignments(
    group: ClassifyTitleGroup
  ): Array<{ personId: string; roleId: string; level: string }> {
    const key = rowKey(group)
    const roleId = selectedRole.get(key) ?? group.suggestedRoleId
    if (roleId === null) return []
    const groupLevels = selectedLevel.get(key)
    const role = roleById.get(roleId)
    const trackKey = role?.trackKey ?? ""
    return group.people.map((p) => {
      let level = groupLevels?.get(p.personId)
      if (level === undefined) {
        level =
          p.suggestedLevel !== null &&
          isValidLevelForTrack(trackKey, p.suggestedLevel)
            ? p.suggestedLevel
            : defaultLevelFor(roleId, roleById)
      }
      return { personId: p.personId, roleId, level }
    })
  }

  // ONE mutation for the whole batch: a single transaction, so the reactive
  // badge and summary update once instead of ticking down per person.
  async function submitAssignments(
    assignments: Array<{ personId: string; roleId: string; level: string }>
  ) {
    if (assignments.length === 0) return
    await assignPeople({
      orgId,
      assignments: assignments as Parameters<
        typeof assignPeople
      >[0]["assignments"],
      levelSource: "confirmed",
    })
  }

  async function onConfirm(group: ClassifyTitleGroup) {
    const key = rowKey(group)
    // Guard: prevent a double-click from firing duplicate writes.
    if (confirming.has(key)) return
    setConfirming((prev) => new Set(prev).add(key))
    try {
      await submitAssignments(buildAssignments(group))
      toast.success(tToast("classificationConfirmed"))
    } catch {
      toast.error(tToast("error"))
    } finally {
      setConfirming((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  // Bulk confirm: every ticked group in one mutation, one toast at the end.
  async function onConfirmSelected(selectableGroups: ClassifyTitleGroup[]) {
    const toConfirm = selectableGroups.filter((g) => selected.has(rowKey(g)))
    if (toConfirm.length === 0 || confirming.size > 0) return
    setConfirming(
      (prev) => new Set([...prev, ...toConfirm.map((g) => rowKey(g))])
    )
    try {
      await submitAssignments(toConfirm.flatMap((g) => buildAssignments(g)))
      setSelected(new Set())
      toast.success(tToast("classificationConfirmed"))
    } catch {
      toast.error(tToast("error"))
    } finally {
      setConfirming(new Set())
    }
  }

  function stateVariant(
    state: "confirmed" | "pending" | "unclassified"
  ): "default" | "secondary" | "outline" {
    if (state === "confirmed") return "default"
    if (state === "pending") return "secondary"
    return "outline"
  }

  // Groups eligible for bulk confirmation: a resolvable role and not yet
  // fully confirmed (re-confirming a confirmed group would only add writes).
  const selectableGroups = groups.filter((group) => {
    const key = rowKey(group)
    const roleId = selectedRole.get(key) ?? group.suggestedRoleId
    return (
      roleId !== null &&
      classificationStateForPeople(group.people) !== "confirmed"
    )
  })
  const selectableKeys = selectableGroups.map((g) => rowKey(g))
  const selectedCount = selectableKeys.filter((k) => selected.has(k)).length
  const allSelected =
    selectableKeys.length > 0 && selectedCount === selectableKeys.length
  const bulkBusy = confirming.size > 0

  return (
    <div className="space-y-2">
      {/* Bulk toolbar: the slot is always reserved (invisible at zero
          selection) so ticking a row never shifts the table down. */}
      <div className="flex min-h-8 items-center justify-end gap-3">
        <span
          className={cn(
            "text-muted-foreground text-sm",
            selectedCount === 0 && "invisible"
          )}
        >
          {t("selectedCount", { count: selectedCount })}
        </span>
        <Button
          type="button"
          size="sm"
          disabled={bulkBusy}
          className={cn(selectedCount === 0 && "invisible")}
          onClick={() => void onConfirmSelected(selectableGroups)}
          data-testid="confirm-selected"
        >
          {t("confirmSelected")}
        </Button>
      </div>
      <Table>
        <ClassifyTableHeader
          selectAll={
            <Checkbox
              aria-label={t("selectAll")}
              checked={
                allSelected ? true : selectedCount > 0 ? "indeterminate" : false
              }
              disabled={selectableKeys.length === 0 || bulkBusy}
              onCheckedChange={(checked) => {
                setSelected(
                  checked === true ? new Set(selectableKeys) : new Set()
                )
              }}
            />
          }
        />
        <TableBody>
          {groups.map((group) => {
            const key = rowKey(group)
            const state = classificationStateForPeople(group.people)
            const currentRoleId = selectedRole.get(key) ?? group.suggestedRoleId
            const isExpanded = expanded.has(key)
            const currentRole =
              currentRoleId !== null && currentRoleId !== undefined
                ? roleById.get(currentRoleId)
                : undefined
            const trackKey = currentRole?.trackKey ?? ""
            const groupLevels =
              selectedLevel.get(key) ?? new Map<string, string>()
            const isConfirming = confirming.has(key)

            // FIX 1: Fragment carries the key so React can track the pair
            // (title row + expansion row) as a unit. The inner TableRow must
            // NOT repeat the key.
            const isSelectable =
              currentRoleId !== null &&
              currentRoleId !== undefined &&
              state !== "confirmed"

            return (
              <Fragment key={key}>
                <TableRow>
                  {/* Bulk-selection checkbox; disabled when the group has no
                    resolvable role or is already fully confirmed. */}
                  <TableCell className="w-8 pr-0">
                    <Checkbox
                      aria-label={t("selectTitle", {
                        title: group.title ?? t("noTitle"),
                      })}
                      checked={selected.has(key)}
                      disabled={!isSelectable || isConfirming}
                      onCheckedChange={(checked) => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (checked === true) {
                            next.add(key)
                          } else {
                            next.delete(key)
                          }
                          return next
                        })
                      }}
                    />
                  </TableCell>
                  {/* Expand/collapse control in a pre-reserved slot so toggling
                    never causes the other cells to reflow. */}
                  <TableCell className="w-8 pr-0">
                    <button
                      type="button"
                      aria-label={
                        isExpanded ? t("collapseLabel") : t("expandLabel")
                      }
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(key)}
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        size={14}
                        strokeWidth={2}
                        aria-hidden="true"
                        className={cn(
                          "transition-transform motion-reduce:transition-none",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {group.title !== null ? group.title : t("noTitle")}
                  </TableCell>
                  <TableCell>{group.personCount}</TableCell>
                  <TableCell>
                    {/* open/onOpenChange lets onMapExisting focus the picker
                      programmatically without a separate UI control. */}
                    <Select
                      value={currentRoleId ?? ""}
                      open={selectOpen.has(key)}
                      onOpenChange={(next) => {
                        setSelectOpen((prev) => {
                          const s = new Set(prev)
                          if (next) {
                            s.add(key)
                          } else {
                            s.delete(key)
                          }
                          return s
                        })
                      }}
                      onValueChange={(value) => {
                        setSelectOpen((prev) => {
                          const s = new Set(prev)
                          s.delete(key)
                          return s
                        })
                        handleRoleChange(key, value, group)
                      }}
                    >
                      {/* FIX 5: aria-label on the role SelectTrigger so
                        screen readers announce which select this is. */}
                      <SelectTrigger aria-label={t("columns.suggestedRole")}>
                        <SelectValue placeholder={t("selectRolePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.roleId} value={r.roleId}>
                            {r.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stateVariant(state)}>
                      {t(`state.${state}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {group.confidence === "unmatched" ? (
                      <UnmatchedTitleActions
                        orgId={orgId}
                        title={group.title ?? ""}
                        tracks={tracks}
                        onRoleCreated={(roleId) =>
                          setSelectedRole((prev) => {
                            const next = new Map(prev)
                            next.set(key, roleId)
                            return next
                          })
                        }
                        onMapExisting={() => {
                          setSelectOpen((prev) => {
                            const s = new Set(prev)
                            s.add(key)
                            return s
                          })
                        }}
                      />
                    ) : (
                      // FIX 2+3: disabled while in-flight (prevents double-write);
                      // try/catch/finally in onConfirm surfaces errors via toast.error.
                      <Button
                        type="button"
                        size="sm"
                        disabled={isConfirming}
                        onClick={() => void onConfirm(group)}
                      >
                        {t("assignCta")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>

                {/* FIX 8: expansion animation follows docs/ui-animation.md rule 2.
                  A <tr> treats height as a minimum and ignores overflow, so
                  animating height on a <motion.tr> snaps rather than glides.
                  Fix: use a plain (non-animated) <tr> whose only child is a
                  <motion.div> that carries BOTH the height animation AND
                  overflow-hidden. The block div is where height:0 truly clips.
                  No nested <Table> inside the animation (avoids the
                  overflow-x:auto scroll container that a Table wraps itself in,
                  which would fight the height collapse). */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <tr key={`${key}-people`}>
                      <td
                        colSpan={CLASSIFY_COLUMN_COUNT}
                        style={{ padding: 0 }}
                      >
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={SPRING}
                          // overflow-hidden on the block div so height:0
                          // truly clips; no visual box styles on this element
                          // (rule 2: outer carries geometry, inner carries style).
                          className="overflow-hidden"
                        >
                          {/* Inner div carries indentation context for person
                            rows; rendered as a plain block layout (not a
                            nested Table) so the scroll container does not
                            fight the height animation. */}
                          <div className="py-1">
                            <ClassifyPersonRows
                              people={group.people}
                              trackKey={trackKey}
                              selectedLevel={groupLevels}
                              onLevelChange={(personId, level) =>
                                handleLevelChange(key, personId, level)
                              }
                              pseudonymize={pseudonymize}
                            />
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
