"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { TRACK_LEVELS, isValidLevelForTrack } from "@workspace/constants"
import { ArrowDown01Icon, Tag01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
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
import { Fragment, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { SPRING } from "@/lib/motion"
import { ariaSort, TableSortButton } from "@/components/table-sort-button"
import type { TableSkeletonColumn } from "@/components/table-skeleton"
import { ClassifyPersonRows } from "./classify-person-rows"
import { UnmatchedTitleActions } from "./unmatched-title-actions"
import { onSelectValue } from "@/lib/select"

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

// Sort rank for the classification state: work first, done last.
const STATE_RANK = { unclassified: 0, pending: 1, confirmed: 2 } as const

export type ClassifySort = { key: ClassifySortKey; desc: boolean }

// The table's own initial sort (title ascending): shared so the auto-expand
// pick below (which needs "the first row in the DEFAULT view") and the
// sort state's own initial value can never drift apart.
const DEFAULT_SORT: ClassifySort = { key: "title", desc: false }

// Column sorting, extracted so both the live table (sortedGroups) and the
// auto-expand pick on mount (which needs the groups in DISPLAY order before
// any state hook has run) share one implementation. The no-title bucket
// stays pinned last in every order (it is the "needs a title" catch-all, not
// a sortable value).
function sortGroups(
  groups: ClassifyTitleGroup[],
  sort: ClassifySort
): ClassifyTitleGroup[] {
  const arr = [...groups]
  arr.sort((a, b) => {
    if ((a.title === null) !== (b.title === null)) {
      return a.title === null ? 1 : -1
    }
    let cmp = 0
    if (sort.key === "title") {
      cmp = (a.title ?? "").localeCompare(b.title ?? "", undefined, {
        sensitivity: "base",
      })
    } else if (sort.key === "people") {
      cmp = a.personCount - b.personCount
    } else {
      cmp =
        STATE_RANK[classificationStateForPeople(a.people)] -
        STATE_RANK[classificationStateForPeople(b.people)]
    }
    return sort.desc ? -cmp : cmp
  })
  return arr
}

// The role every person in the group is confirmed to, or null when the group
// is not uniformly confirmed to a single role. This is what the role select
// shows for a confirmed group (the engine suggestion may be stale by then).
export function confirmedRoleFor(group: {
  people: Array<{
    currentAssignment: {
      roleId: string
      levelSource: "suggested" | "confirmed"
    } | null
  }>
}): string | null {
  if (group.people.length === 0) return null
  let roleId: string | null = null
  for (const p of group.people) {
    if (p.currentAssignment?.levelSource !== "confirmed") return null
    if (roleId === null) {
      roleId = p.currentAssignment.roleId
    } else if (roleId !== p.currentAssignment.roleId) {
      return null
    }
  }
  return roleId
}

// The level to show/submit for a person, in priority order: their currently
// assigned level (kept across a role swap when it is still valid on the
// track), the engine's suggestion, the track's first level. An explicit
// per-person selection overrides all of these at the call sites.
export function resolveLevel(
  person: Pick<ClassifyPersonRow, "suggestedLevel" | "currentAssignment">,
  trackKey: string
): string {
  const current = person.currentAssignment?.level
  if (current !== undefined && isValidLevelForTrack(trackKey, current)) {
    return current
  }
  if (
    person.suggestedLevel !== null &&
    isValidLevelForTrack(trackKey, person.suggestedLevel)
  ) {
    return person.suggestedLevel
  }
  const levels = TRACK_LEVELS[trackKey as keyof typeof TRACK_LEVELS] ?? []
  return levels[0] ?? ""
}

// Build a fresh per-person level Map for a group using the new track's
// defaults, resetting any stale levels from a previous track.
function buildDefaultLevels(
  people: ClassifyPersonRow[],
  trackKey: string
): Map<string, string> {
  const result = new Map<string, string>()
  for (const p of people) {
    result.set(p.personId, resolveLevel(p, trackKey))
  }
  return result
}

// ---------------------------------------------------------------------------
// Shared table header: exported so the loading skeleton in classify/page.tsx
// can reuse the exact same cells and the two can never drift apart.
// ---------------------------------------------------------------------------

// Skeleton shape per column, mirroring the real row content (expand chevron,
// title text, people count, resolved role text, state badge) so the loading
// table has the same silhouette and row height as the loaded one. The chevron
// is static per-row chrome, not data, so it renders as its real icon (muted,
// non-interactive) rather than a bar. The column count for the expansion
// row's colSpan derives from it, so header, skeleton, and colSpan can never
// drift apart.
export const CLASSIFY_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  {
    // pr-0 mirrors the real chevron cell so the icon sits at the exact same
    // position in both states.
    cellClassName: "pr-0",
    content: (
      <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground/50">
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>
    ),
  },
  { className: "w-40 max-w-full" },
  { className: "w-8" },
  { className: "w-32 max-w-full" },
  { className: "h-5 w-20 rounded-full" },
]
export const CLASSIFY_COLUMN_COUNT = CLASSIFY_SKELETON_COLUMNS.length

// The columns a user can sort the title groups by. The role column is a
// select (input, not data) and actions carry no order, so neither sorts.
export type ClassifySortKey = "title" | "people" | "state"

export function ClassifyTableHeader({
  sort,
  onSort,
}: {
  // Current sort + toggle; the loading skeleton omits both (static labels).
  sort?: ClassifySort
  onSort?: (key: ClassifySortKey) => void
}) {
  const t = useTranslations("dashboard.classify")

  // Sortable heading (static label in the skeleton). Widths are declared here
  // once, with table-fixed on the Table, so columns cannot re-measure from
  // content when rows change (layout-shift rule); the title column takes the
  // remaining space.
  const head = (key: ClassifySortKey, label: string, widthClass?: string) => {
    const sorted: false | "asc" | "desc" =
      sort !== undefined && sort.key === key
        ? sort.desc
          ? "desc"
          : "asc"
        : false
    return (
      <TableHead className={widthClass} aria-sort={ariaSort(sorted)}>
        {onSort !== undefined ? (
          <TableSortButton
            label={label}
            sorted={sorted}
            onToggle={() => onSort(key)}
          />
        ) : (
          label
        )}
      </TableHead>
    )
  }

  return (
    <TableHeader>
      <TableRow>
        {/* Reserved slot for the expand/collapse control (fixed width avoids layout shift) */}
        <TableHead className="w-8" />
        {head("title", t("columns.title"))}
        {/* w-32 fits the widest locale label (da "Medarbejdere") plus the
            sort chevron slot. */}
        {head("people", t("columns.people"), "w-32")}
        <TableHead className="w-[26%]">{t("columns.role")}</TableHead>
        {head("state", t("columns.state"), "w-36")}
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
}: {
  orgId: string
  groups: ClassifyTitleGroup[]
  roles: ClassifyRole[]
  tracks: ClassifyTrack[]
}) {
  const t = useTranslations("dashboard.classify")
  const tToast = useTranslations("dashboard.toast")

  // Per-row selected role: keyed by rowKey(group) (never null)
  const [selectedRole, setSelectedRole] = useState<Map<string, string | null>>(
    () => new Map()
  )

  // Which groups have their per-person rows expanded. Lands the user on the
  // first group that still needs attention (not yet confirmed), in the
  // table's default display order, so opening Classify immediately shows
  // what to do instead of a flat list with nothing focused; a fully
  // classified org (nothing unconfirmed) opens with nothing expanded.
  // Computed once via this lazy initializer (mount only, never revisited as
  // groups changes reactively afterward) -- mirrors the review journey's own
  // resume-once landing (pay-mapping-review.tsx), not a perpetual auto-open.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const firstUnfinished = sortGroups(groups, DEFAULT_SORT).find(
      (group) => classificationStateForPeople(group.people) !== "confirmed"
    )
    return firstUnfinished !== undefined
      ? new Set([rowKey(firstUnfinished)])
      : new Set()
  })

  // Per-person selected levels: outer key = rowKey(group), inner key = personId
  const [selectedLevel, setSelectedLevel] = useState<
    Map<string, Map<string, string>>
  >(() => new Map())

  // Per-row in-flight guard: prevents double-confirm and surfaces errors.
  // Keyed by rowKey(group).
  const [confirming, setConfirming] = useState<Set<string>>(() => new Set())

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
      const prevRoleId =
        selectedRole.get(groupKey) ??
        confirmedRoleFor(group) ??
        group.suggestedRoleId
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

  // Everything a row (and the toolbar's selectable set) needs to know about
  // a group, derived once: the resolved role (an explicit pick wins over the
  // confirmed role, which wins over the engine suggestion) and whether the
  // group is actionable. A confirmed group becomes actionable again when the
  // pending selection differs from what is confirmed (role swap or level
  // change), so re-confirming applies the change.
  function resolveGroup(group: ClassifyTitleGroup) {
    const key = rowKey(group)
    const state = classificationStateForPeople(group.people)
    const confirmedRoleId = confirmedRoleFor(group)
    const currentRoleId =
      selectedRole.get(key) ?? confirmedRoleId ?? group.suggestedRoleId
    const role =
      currentRoleId !== null && currentRoleId !== undefined
        ? roleById.get(currentRoleId)
        : undefined
    const trackKey = role?.trackKey ?? ""
    const groupLevels = selectedLevel.get(key)
    const levelsDirty =
      groupLevels !== undefined &&
      group.people.some((p) => {
        const picked = groupLevels.get(p.personId)
        return picked !== undefined && picked !== p.currentAssignment?.level
      })
    const dirty =
      state === "confirmed" &&
      (currentRoleId !== confirmedRoleId || levelsDirty)
    const actionable =
      currentRoleId !== null &&
      currentRoleId !== undefined &&
      (state !== "confirmed" || dirty)
    return { key, state, confirmedRoleId, currentRoleId, trackKey, actionable }
  }

  // Builds the per-person assignment payload for a group. Level resolution:
  // the per-person selected level when present, else resolveLevel (current
  // assigned level, then suggestion, then the track's first level). This
  // guarantees a valid level is always submitted.
  function buildAssignments(
    group: ClassifyTitleGroup
  ): Array<{ personId: string; roleId: string; level: string }> {
    const key = rowKey(group)
    const { currentRoleId, trackKey } = resolveGroup(group)
    if (currentRoleId === null || currentRoleId === undefined) return []
    const groupLevels = selectedLevel.get(key)
    return group.people.map((p) => ({
      personId: p.personId,
      roleId: currentRoleId,
      level: groupLevels?.get(p.personId) ?? resolveLevel(p, trackKey),
    }))
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

  function stateVariant(
    state: "confirmed" | "pending" | "unclassified"
  ): "default" | "secondary" | "outline" {
    if (state === "confirmed") return "default"
    if (state === "pending") return "secondary"
    return "outline"
  }

  // Column sorting: default by title ascending (the backend's order); a
  // click on the same heading flips the direction. The no-title bucket stays
  // pinned last in every order (it is the "needs a title" catch-all, not a
  // sortable value).
  const [sort, setSort] = useState<ClassifySort>(DEFAULT_SORT)
  function toggleSort(key: ClassifySortKey) {
    setSort((prev) =>
      prev.key === key ? { key, desc: !prev.desc } : { key, desc: false }
    )
  }
  const sortedGroups = useMemo(() => sortGroups(groups, sort), [groups, sort])

  if (groups.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon
              icon={Tag01Icon}
              strokeWidth={2}
              aria-hidden="true"
            />
          </EmptyMedia>
          <EmptyTitle>{t("heading")}</EmptyTitle>
          <EmptyDescription>{t("empty")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table className="table-fixed">
      <ClassifyTableHeader sort={sort} onSort={toggleSort} />
      <TableBody>
        {sortedGroups.map((group) => {
          const { key, state, currentRoleId, trackKey, actionable } =
            resolveGroup(group)
          const isExpanded = expanded.has(key)
          const groupLevels =
            selectedLevel.get(key) ?? new Map<string, string>()
          const isConfirming = confirming.has(key)
          const roleTitle =
            currentRoleId !== null && currentRoleId !== undefined
              ? (roleById.get(currentRoleId)?.title ?? "")
              : null

          // FIX 1: Fragment carries the key so React can track the pair
          // (title row + expansion row) as a unit. The inner TableRow must
          // NOT repeat the key.
          return (
            <Fragment key={key}>
              {/* The collapsed row is pure status: title, count, the resolved
                  role (read-only), and the state. Every edit (role, levels)
                  and the Confirm itself live in the expanded panel, so a
                  group cannot be confirmed without its people on screen.
                  The whole row toggles; the chevron stays the accessible
                  control. */}
              <TableRow
                className="cursor-pointer"
                onClick={(event) => {
                  // Real controls handle themselves; a click ending a text
                  // selection is a copy gesture, not a toggle.
                  if ((event.target as HTMLElement).closest("button,a")) return
                  if (window.getSelection()?.toString()) return
                  toggleExpanded(key)
                }}
              >
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
                <TableCell className="truncate font-medium">
                  {group.title !== null ? group.title : t("noTitle")}
                </TableCell>
                <TableCell>{group.personCount}</TableCell>
                <TableCell className="truncate">
                  {roleTitle !== null ? (
                    roleTitle
                  ) : (
                    <span className="text-muted-foreground">
                      {t("noRoleMatch")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {/* Block flex wrapper: inline-flex content on the text
                      baseline inflates the line box by a font-metric-
                      dependent amount (see the people table's badge cell),
                      which would desync data rows from the skeleton's. */}
                  <div className="flex min-h-5 items-center">
                    <Badge variant={stateVariant(state)}>
                      {t(`state.${state}`)}
                    </Badge>
                  </div>
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
                    <td colSpan={CLASSIFY_COLUMN_COUNT} style={{ padding: 0 }}>
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
                        {/* The review workspace: the inner div carries the
                            panel's box styles (rule 2). Everything editable
                            lives here, next to what it affects. */}
                        <div className="space-y-4 border-b bg-muted/30 py-4 pr-4 pl-12">
                          {/* Role picker: the one place the group's role is
                              set; creating a missing role sits beside it.
                              Label above, then select + create button on ONE
                              flex line centered against each other, so they
                              stay aligned whatever their heights. */}
                          <div className="space-y-1.5">
                            <span className="block font-medium text-muted-foreground text-xs">
                              {t("columns.role")}
                            </span>
                            <div className="flex flex-wrap items-center gap-3">
                              <Select
                                value={currentRoleId ?? ""}
                                onValueChange={onSelectValue((value: string) =>
                                  handleRoleChange(key, value, group)
                                )}
                                items={roles.map((r) => ({
                                  value: r.roleId,
                                  label: r.title,
                                }))}
                              >
                                {/* FIX 5: aria-label so screen readers
                                    announce which select this is. */}
                                <SelectTrigger
                                  aria-label={t("columns.role")}
                                  className="w-72 max-w-full bg-card"
                                >
                                  <SelectValue
                                    placeholder={t("selectRolePlaceholder")}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {roles.map((r) => (
                                    <SelectItem key={r.roleId} value={r.roleId}>
                                      {r.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {(currentRoleId === null ||
                                currentRoleId === undefined) && (
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
                                />
                              )}
                            </div>
                          </div>

                          <ClassifyPersonRows
                            people={group.people}
                            trackKey={trackKey}
                            selectedLevel={groupLevels}
                            onLevelChange={(personId, level) =>
                              handleLevelChange(key, personId, level)
                            }
                          />

                          {/* The ONLY Confirm: it exists solely inside the
                              open panel, with every person's level on screen,
                              and only while there is something to confirm
                              (not yet confirmed, or a pending change). */}
                          {actionable && (
                            <div className="flex justify-end">
                              {/* FIX 2+3: disabled while in-flight (prevents
                                  double-write); try/catch/finally in onConfirm
                                  surfaces errors via toast.error. */}
                              <Button
                                type="button"
                                size="sm"
                                disabled={isConfirming}
                                onClick={() => void onConfirm(group)}
                              >
                                {t("assignCta")}
                              </Button>
                            </div>
                          )}
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
  )
}
