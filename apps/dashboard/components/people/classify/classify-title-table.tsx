"use client"

import { Medallion } from "@/components/medallion"
import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  MAX_ASSIGNMENTS_PER_MUTATION,
  TRACK_SENIORITIES,
  isValidSeniorityForTrack,
} from "@workspace/constants"
import { ArrowDown01Icon, Tag01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Spinner } from "@workspace/ui/components/spinner"
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
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Fragment, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { newGestureId } from "@/lib/gesture"
import { toast } from "@/lib/toast"
import { SPRING } from "@/lib/motion"
import { FrameTable } from "@/components/frame-table"
import { ariaSort, TableSortButton } from "@/components/table-sort-button"
import type { TableSkeletonColumn } from "@/components/table-skeleton"
import { selectionState } from "@/lib/selection"
import { type BulkAssignment, packAssignmentChunks } from "./classify-bulk"
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
  suggestedSeniority: string | null
  currentAssignment: {
    roleId: string
    seniority: string
    senioritySource: "suggested" | "confirmed"
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
    currentAssignment: { senioritySource: "suggested" | "confirmed" } | null
  }>
): "confirmed" | "pending" | "unclassified" {
  if (people.length === 0) return "unclassified"
  const hasAny = people.some((p) => p.currentAssignment !== null)
  if (!hasAny) return "unclassified"
  const allConfirmed = people.every(
    (p) => p.currentAssignment?.senioritySource === "confirmed"
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

// The table's own initial sort (title ascending).
const DEFAULT_SORT: ClassifySort = { key: "title", desc: false }

// Column sorting. The no-title bucket stays pinned last in every order (it
// is the "needs a title" catch-all, not a sortable value).
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
      senioritySource: "suggested" | "confirmed"
    } | null
  }>
}): string | null {
  if (group.people.length === 0) return null
  let roleId: string | null = null
  for (const p of group.people) {
    if (p.currentAssignment?.senioritySource !== "confirmed") return null
    if (roleId === null) {
      roleId = p.currentAssignment.roleId
    } else if (roleId !== p.currentAssignment.roleId) {
      return null
    }
  }
  return roleId
}

// The seniority to show/submit for a person, in priority order: their
// currently assigned seniority (kept across a role swap when it is still
// valid on the track), the engine's suggestion, the track's first seniority.
// An explicit per-person selection overrides all of these at the call sites.
export function resolveSeniority(
  person: Pick<ClassifyPersonRow, "suggestedSeniority" | "currentAssignment">,
  trackKey: string
): string {
  const current = person.currentAssignment?.seniority
  if (current !== undefined && isValidSeniorityForTrack(trackKey, current)) {
    return current
  }
  if (
    person.suggestedSeniority !== null &&
    isValidSeniorityForTrack(trackKey, person.suggestedSeniority)
  ) {
    return person.suggestedSeniority
  }
  const seniorities =
    TRACK_SENIORITIES[trackKey as keyof typeof TRACK_SENIORITIES] ?? []
  return seniorities[0] ?? ""
}

// Build a fresh per-person seniority Map for a group using the new track's
// defaults, resetting any stale seniorities from a previous track.
function buildDefaultSeniorities(
  people: ClassifyPersonRow[],
  trackKey: string
): Map<string, string> {
  const result = new Map<string, string>()
  for (const p of people) {
    result.set(p.personId, resolveSeniority(p, trackKey))
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
    content: (
      <span className="flex items-center">
        <Checkbox disabled aria-hidden="true" tabIndex={-1} />
      </span>
    ),
  },
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
  selectAll,
}: {
  // Current sort + toggle; the loading skeleton omits both (static labels).
  sort?: ClassifySort
  onSort?: (key: ClassifySortKey) => void
  // Header select-all state; the loading skeleton omits it (renders the real
  // control, enabled: the loaded checkbox's own initial state is enabled, and
  // a click during the brief load is a harmless no-op).
  selectAll?: {
    checked: boolean
    indeterminate: boolean
    onChange: (checked: boolean) => void
  }
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
        {/* Fixed-width selection slot, before the expand chevron slot. */}
        <TableHead className="w-10">
          {/* No selectable rows means no select-all: an unclickable
              checkbox is noise. The fixed-width head keeps the slot. */}
          {selectAll !== undefined && (
            <Checkbox
              aria-label={t("bulk.selectAll")}
              checked={selectAll.checked}
              indeterminate={selectAll.indeterminate}
              onCheckedChange={(checked) =>
                selectAll.onChange(checked === true)
              }
            />
          )}
        </TableHead>
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

// Bulk toolbar: exported so the loading skeleton in classify/page.tsx can
// render the exact same slot (real controls, zero-selection state) instead
// of nothing, so the table's data arrival never adds a row that was not
// already reserved during loading (the layout-shift rule). Omitting
// `selection` renders the zero state: no count text, the CTA present but
// disabled, matching the loaded table's own zero-selection rendering.
export function ClassifyBulkToolbar({
  selection,
}: {
  selection?: {
    titles: number
    people: number
    onOpen: () => void
  }
}) {
  const t = useTranslations("dashboard.classify")
  const titles = selection?.titles ?? 0
  return (
    <div className="flex min-h-8 items-center justify-between gap-2">
      {/* The only feedback for select-all/select-row: announce it to screen
        readers too, since nothing else states the current selection. */}
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {titles > 0
          ? t("bulk.selectedCount", {
              titles,
              people: selection?.people ?? 0,
            })
          : null}
      </p>
      <Button
        type="button"
        size="sm"
        disabled={titles === 0}
        onClick={() => selection?.onOpen()}
      >
        {t("bulk.cta")}
      </Button>
    </div>
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
  // The empty state's title is the page's nav label (people.tabs.classify),
  // matching the heading, header tab, and sidebar sub-page.
  const tTabs = useTranslations("dashboard.people.tabs")
  const tToast = useTranslations("dashboard.toast")

  // Per-row selected role: keyed by rowKey(group) (never null)
  const [selectedRole, setSelectedRole] = useState<Map<string, string | null>>(
    () => new Map()
  )

  // Bulk selection: raw picks by row key; the EFFECTIVE selection is derived
  // against what is currently actionable, so rows confirmed meanwhile drop
  // out on their own.
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkOpen, setBulkOpen] = useState(false)

  // Chunk progress while the bulk confirm runs, or null when idle. done and
  // total count PEOPLE, matching the dialog description's unit.
  const [bulkProgress, setBulkProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  // Which groups have their per-person rows expanded. Everything starts
  // collapsed: the table is scanned for bulk selection first, and a group's
  // per-person review panel is opt-in via its row.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  // Per-person selected seniorities: outer key = rowKey(group), inner key = personId
  const [selectedSeniority, setSelectedSeniority] = useState<
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

  // The group whose panel was just opened, so it can be scrolled into view
  // once it has finished expanding. Null while nothing is pending.
  const [justExpanded, setJustExpanded] = useState<string | null>(null)
  // Only one panel is ever pending a scroll, so a single ref is enough: it is
  // attached to that panel alone.
  const openedPanelRef = useRef<HTMLDivElement | null>(null)
  const reduceMotion = useReducedMotion()

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        setJustExpanded(null)
      } else {
        next.add(key)
        // Opening a row near the bottom puts its panel below the fold, and
        // the panel is the whole point of opening it. Scroll it into view
        // once expanded (see the panel's onAnimationComplete): doing it now
        // would measure a zero-height box mid-animation.
        setJustExpanded(key)
      }
      return next
    })
  }

  // Collapses a group's panel. Called when a group is confirmed: its work is
  // done, so leaving the review panel open buries the rows still to classify.
  function collapse(keys: string[]) {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const key of keys) next.delete(key)
      return next
    })
  }

  function handleSeniorityChange(
    groupKey: string,
    personId: string,
    seniority: string
  ) {
    setSelectedSeniority((prev) => {
      const next = new Map(prev)
      const groupSeniorities = new Map(prev.get(groupKey) ?? new Map())
      groupSeniorities.set(personId, seniority)
      next.set(groupKey, groupSeniorities)
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
    // seniorities so an out-of-track seniority can never be submitted
    // (ADR-0005: seniority must be valid for the track; the server
    // re-validates via isValidSeniorityForTrack, but the UI must not offer or
    // submit an invalid one).
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
        setSelectedSeniority((prev) => {
          const next = new Map(prev)
          next.set(
            groupKey,
            buildDefaultSeniorities(group.people, newRole.trackKey)
          )
          return next
        })
      }
    }
  }

  // Everything a row (and the toolbar's selectable set) needs to know about
  // a group, derived once: the resolved role (an explicit pick wins over the
  // confirmed role, which wins over the engine suggestion) and whether the
  // group is actionable. A confirmed group becomes actionable again when the
  // pending selection differs from what is confirmed (role swap or
  // seniority change), so re-confirming applies the change.
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
    const groupSeniorities = selectedSeniority.get(key)
    const senioritiesDirty =
      groupSeniorities !== undefined &&
      group.people.some((p) => {
        const picked = groupSeniorities.get(p.personId)
        return picked !== undefined && picked !== p.currentAssignment?.seniority
      })
    const dirty =
      state === "confirmed" &&
      (currentRoleId !== confirmedRoleId || senioritiesDirty)
    const actionable =
      currentRoleId !== null &&
      currentRoleId !== undefined &&
      (state !== "confirmed" || dirty)
    return { key, state, confirmedRoleId, currentRoleId, trackKey, actionable }
  }

  // Builds the per-person assignment payload for a group. Seniority
  // resolution: the per-person selected seniority when present, else
  // resolveSeniority (current assigned seniority, then suggestion, then the
  // track's first seniority). This guarantees a valid seniority is always
  // submitted.
  function buildAssignments(group: ClassifyTitleGroup): BulkAssignment[] {
    const key = rowKey(group)
    const { currentRoleId, trackKey } = resolveGroup(group)
    if (currentRoleId === null || currentRoleId === undefined) return []
    const groupSeniorities = selectedSeniority.get(key)
    return group.people.map((p) => ({
      personId: p.personId,
      roleId: currentRoleId,
      seniority:
        groupSeniorities?.get(p.personId) ?? resolveSeniority(p, trackKey),
    }))
  }

  // The one path every classify confirm submits through: packs one or more
  // groups' assignments into bounded chunks (the server rejects batches over
  // the shared limit) and awaits them in order, each chunk its own atomic
  // transaction. onChunkDone reports how many people just landed, for the
  // bulk dialog's progress readout; the per-group confirm has no progress UI
  // and omits it.
  async function submitChunks(
    groups: ReadonlyArray<readonly BulkAssignment[]>,
    onChunkDone?: (count: number) => void
  ) {
    // The gesture id is minted ONCE, outside the loop, and therefore spans
    // every chunk: chunking is a transaction-size decision, not something the
    // reader did, so a confirm of 400 people has to read as one story and not
    // as however many transactions it happened to take. This is the strongest
    // case for batching in the app, since one press can otherwise scatter
    // hundreds of assignment.set rows down the log.
    const batchId = newGestureId()
    for (const chunk of packAssignmentChunks(
      groups,
      MAX_ASSIGNMENTS_PER_MUTATION
    )) {
      await assignPeople({
        orgId,
        batchId,
        assignments: chunk as Parameters<typeof assignPeople>[0]["assignments"],
        senioritySource: "confirmed",
      })
      onChunkDone?.(chunk.length)
    }
  }

  // A single group is the one-group case of the shared chunk-submit path: a
  // typical group is one chunk and one transaction; an oversized group lands
  // as consecutive chunks.
  async function submitAssignments(assignments: BulkAssignment[]) {
    await submitChunks([assignments])
  }

  async function onConfirm(group: ClassifyTitleGroup) {
    const key = rowKey(group)
    // Guard: prevent a double-click from firing duplicate writes.
    if (confirming.has(key)) return
    setConfirming((prev) => new Set(prev).add(key))
    try {
      await submitAssignments(buildAssignments(group))
      toast.success(tToast("classificationConfirmed"))
      collapse([key])
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

  // Confirms every selected group, one bounded chunk at a time. On a failed
  // chunk the dialog stays open; the chunks that landed have already flipped
  // their groups to confirmed, the derived selection has pruned them, and
  // pressing confirm again finishes the remainder. If the selection pruned
  // to nothing while the dialog was open (every selected group got confirmed
  // elsewhere meanwhile), there is nothing to submit: close the dialog
  // without a success toast, since nothing was actually confirmed.
  async function onBulkConfirm() {
    if (bulkProgress !== null) return
    const groupAssignments = selectedGroups.map((group) =>
      buildAssignments(group)
    )
    if (
      packAssignmentChunks(groupAssignments, MAX_ASSIGNMENTS_PER_MUTATION)
        .length === 0
    ) {
      setBulkOpen(false)
      return
    }
    const total = groupAssignments.reduce((sum, a) => sum + a.length, 0)
    setBulkProgress({ done: 0, total })
    try {
      let done = 0
      await submitChunks(groupAssignments, (count) => {
        done += count
        setBulkProgress({ done, total })
      })
      toast.success(tToast("classificationConfirmed"))
      collapse(selectedGroups.map(rowKey))
      setSelected(new Set())
      setBulkOpen(false)
    } catch {
      toast.error(tToast("error"))
    } finally {
      setBulkProgress(null)
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

  const actionableKeys = sortedGroups
    .filter((group) => resolveGroup(group).actionable)
    .map(rowKey)
  const sel = selectionState(selected, actionableKeys)
  const selectedGroups = sortedGroups.filter((group) =>
    sel.effective.has(rowKey(group))
  )
  const selectedPeopleCount = selectedGroups.reduce(
    (sum, group) => sum + group.people.length,
    0
  )

  function toggleSelected(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  if (groups.length === 0) {
    // Inside the frame, like every other register's empty state: the surface
    // keeps its anatomy (title, count, the bulk toolbar's static chrome)
    // whether or not anyone has been imported yet.
    return (
      <FrameTable
        title={tTabs("classify")}
        count={0}
        toolbar={<ClassifyBulkToolbar />}
      >
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <Medallion icon={Tag01Icon} size="lg" />
            </EmptyMedia>
            <EmptyTitle>{tTabs("classify")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </FrameTable>
    )
  }

  return (
    <>
      <FrameTable
        title={tTabs("classify")}
        count={groups.length}
        toolbar={
          <ClassifyBulkToolbar
            selection={{
              titles: sel.effective.size,
              people: selectedPeopleCount,
              onOpen: () => setBulkOpen(true),
            }}
          />
        }
      >
        <Table className="table-fixed">
          <ClassifyTableHeader
            sort={sort}
            onSort={toggleSort}
            selectAll={
              actionableKeys.length === 0
                ? undefined
                : {
                    checked: sel.all,
                    indeterminate: sel.some,
                    onChange: (checked) =>
                      setSelected(
                        checked ? new Set(actionableKeys) : new Set()
                      ),
                  }
            }
          />
          <TableBody>
            {sortedGroups.map((group) => {
              const { key, state, currentRoleId, trackKey, actionable } =
                resolveGroup(group)
              const isExpanded = expanded.has(key)
              const groupSeniorities =
                selectedSeniority.get(key) ?? new Map<string, string>()
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
                  role (read-only), and the state. Every edit (role, seniorities)
                  and the Confirm itself live in the expanded panel, so a
                  group cannot be confirmed without its people on screen.
                  The whole row toggles; the chevron stays the accessible
                  control. */}
                  <TableRow
                    className="cursor-pointer"
                    onClick={(event) => {
                      // Real controls handle themselves; a click ending a text
                      // selection is a copy gesture, not a toggle. The Checkbox
                      // renders a role=checkbox span plus a visually-hidden
                      // sibling <input type=checkbox> that also dispatches its
                      // own click (not a button), so both need exemption
                      // alongside button/a.
                      if (
                        (event.target as HTMLElement).closest(
                          'button,a,[role="checkbox"],input[type="checkbox"]'
                        )
                      )
                        return
                      if (window.getSelection()?.toString()) return
                      toggleExpanded(key)
                    }}
                  >
                    <TableCell className="w-10">
                      {/* A group with nothing to confirm gets no checkbox at
                          all rather than a disabled one; the fixed-width cell
                          keeps the slot, so the box appearing when the group
                          becomes actionable shifts nothing. */}
                      {actionable && (
                        <div className="flex items-center">
                          <Checkbox
                            aria-label={t("bulk.selectRow", {
                              title: group.title ?? t("noTitle"),
                            })}
                            checked={sel.effective.has(key)}
                            onCheckedChange={(checked) =>
                              toggleSelected(key, checked === true)
                            }
                          />
                        </div>
                      )}
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
                        <td
                          colSpan={CLASSIFY_COLUMN_COUNT}
                          style={{ padding: 0 }}
                        >
                          <motion.div
                            // The ref is attached to the just-opened panel only,
                            // so the scroll below can never target another row's.
                            ref={
                              justExpanded === key ? openedPanelRef : undefined
                            }
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={SPRING}
                            // Bring a newly opened panel into view once it has
                            // reached full height: opening a row near the bottom
                            // otherwise leaves the content the user just asked
                            // for below the fold. "nearest" is a no-op when the
                            // panel already fits, so an in-view row never jumps.
                            onAnimationComplete={() => {
                              if (justExpanded !== key) return
                              openedPanelRef.current?.scrollIntoView({
                                block: "nearest",
                                behavior: reduceMotion ? "auto" : "smooth",
                              })
                              setJustExpanded(null)
                            }}
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
                                    onValueChange={onSelectValue(
                                      (value: string) =>
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
                                        <SelectItem
                                          key={r.roleId}
                                          value={r.roleId}
                                        >
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
                                selectedSeniority={groupSeniorities}
                                onSeniorityChange={(personId, seniority) =>
                                  handleSeniorityChange(
                                    key,
                                    personId,
                                    seniority
                                  )
                                }
                              />

                              {/* The ONLY Confirm: it exists solely inside the
                              open panel, with every person's seniority on screen,
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
      </FrameTable>

      {/* Standard AlertDialog anatomy (confirm-delete-dialog.tsx): header
        (title + description), footer with cancel first (outline) and the
        primary action last. Cancel reuses createRole.cancel (the same
        "Cancel" copy already translated in every locale for this surface)
        instead of a new bulk.cancel key. AlertDialogAction in this vendored
        alert-dialog.tsx is a plain Button (not a Close), so it never
        auto-closes: the dialog only closes explicitly, inside
        onBulkConfirm, on success. */}
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bulk.dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulk.dialogDescription", {
                titles: sel.effective.size,
                people: selectedPeopleCount,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkProgress !== null}>
              {t("createRole.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkProgress !== null}
              onClick={() => void onBulkConfirm()}
            >
              {bulkProgress !== null ? (
                <>
                  <Spinner />
                  {/* The progress numbers render through NumberFlow (the
                      message's tags carry the layout) so the done count
                      rolls as each chunk lands instead of swapping. */}
                  {t.rich("bulk.progress", {
                    done: () => <NumberFlow value={bulkProgress.done} />,
                    total: () => <NumberFlow value={bulkProgress.total} />,
                  })}
                </>
              ) : (
                t("bulk.confirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
