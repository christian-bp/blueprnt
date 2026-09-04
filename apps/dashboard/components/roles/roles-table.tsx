"use client"

import { ArrowRight01Icon, Briefcase01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  columnFilteringFeature,
  type ColumnFiltersState,
  columnGroupingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  type ExpandedState,
  globalFilteringFeature,
  type Row,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { CountChip } from "@/components/count-chip"
import { FrameTable } from "@/components/frame-table"
import { NoMatchesEmpty } from "@/components/no-matches-empty"
import {
  ALL_TRACKS,
  matchesRoleQuery,
  RoleTableToolbar,
  type RolesTableTrack,
} from "@/components/roles/role-table-toolbar"
import {
  ROLE_SKELETON_COLUMNS,
  RoleEmployeesCell,
  RoleLevelCell,
  RoleTableHeadings,
  RoleTeamCell,
  RoleTitleCell,
  RoleTrackCell,
} from "@/components/roles/role-table-row"
import { TableSkeleton } from "@/components/table-skeleton"
import { FAMILY_NAME_CLASS, FAMILY_ROW_CLASS } from "@/lib/role-family-row"
import { groupByFamily } from "@/lib/role-groups"

// The role register as ONE grouped data table (shadcn data table recipe on
// @tanstack/react-table): a hidden family column carries the grouping, the
// pipeline filters BEFORE grouping so families without matches disappear, and
// each family band collapses and expands like the reference's segment rows
// (default open; changing a filter re-opens everything so a match can never
// hide inside a closed group). Search and the track filter come from the
// shared toolbar module: its matcher runs as globalFilterFn, its track value
// drives a column filter.

// Structural subset of listRoles rows (same precedent as CreateRoleDialog's
// TrackOption): the table needs no convex types of its own.
export interface RolesTableRow {
  roleId: string
  title: string
  slug: string
  function: string
  team: string
  trackKey: string
  trackName: string
  ratedCount: number
  totalCriteria: number
  familyId: string | null
  familyName: string | null
  familySlug: string | null
  employeeCount: number
  level: number | null
  profileComplete: boolean
}

// MODULE-LEVEL constant: state.grouping keys the grouped-row-model memo, and
// every recompute of that memo queues TanStack's auto-resets, whose
// resetPageIndex setState re-renders the table. An inline ["family"] array
// (new identity per render) therefore turns ANY re-render (e.g. a
// Select opening inside this tree) into an infinite render loop that
// freezes the page. Keep the identity stable and the auto-resets off.
const GROUPING = ["family"]

// v9 registers features explicitly: an API is absent unless its feature is
// here, and each row-model slot follows the feature it belongs to. Pagination
// is deliberately absent (this register is unpaginated), which also removes
// the auto-reset that used to need switching off.
const features = tableFeatures({
  columnFilteringFeature,
  columnGroupingFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowExpandingFeature,
  filteredRowModel: createFilteredRowModel(),
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),
})

type RolesFeatures = typeof features

const exactString = (
  row: Row<RolesFeatures, RolesTableRow>,
  columnId: string,
  value: string
) => row.getValue<string>(columnId) === value

// Built through the column helper rather than annotated as ColumnDef[]: the
// annotation widens every accessor's value type to unknown, while the helper
// infers each one from its accessor and keeps the two cell-only columns
// declared as displays (no accessor, so nothing to widen). Module level
// because the definitions are static, so the table's model inputs keep one
// identity for the process.
const columnHelper = createColumnHelper<RolesFeatures, RolesTableRow>()

const columns = columnHelper.columns([
  // The sentinel keeps family-less roles in ONE group; the group row
  // renders the real name (or the none label) from its leaf rows.
  columnHelper.accessor((row) => row.familyId ?? "__none__", {
    id: "family",
    enableGlobalFilter: false,
  }),
  columnHelper.accessor("title", {
    id: "title",
    cell: ({ row }) => (
      <RoleTitleCell slug={row.original.slug} title={row.original.title} />
    ),
  }),
  columnHelper.accessor((row) => row.trackKey, {
    id: "track",
    filterFn: exactString,
    enableGlobalFilter: false,
    cell: ({ row }) => (
      <RoleTrackCell
        trackKey={row.original.trackKey}
        name={row.original.trackName}
      />
    ),
  }),
  columnHelper.accessor("team", {
    id: "team",
    enableGlobalFilter: false,
    cell: ({ row }) => <RoleTeamCell team={row.original.team} />,
  }),
  columnHelper.display({
    id: "employees",
    enableGlobalFilter: false,
    cell: ({ row }) => <RoleEmployeesCell count={row.original.employeeCount} />,
  }),
  columnHelper.display({
    id: "evaluation",
    enableGlobalFilter: false,
    cell: ({ row }) => (
      <RoleLevelCell
        level={row.original.level}
        slug={row.original.slug}
        profileComplete={row.original.profileComplete}
      />
    ),
  }),
])

// The headings, the widths, the skeleton and the cells all come from the
// shared role row (components/roles/role-table-row.tsx), so this register and
// a single family's page cannot drift apart. The columns are not sortable
// (grouped registers take no per-column sorting), so a static header is
// equivalent to rendering TanStack's header groups.

// The register's loading state: the REAL toolbar controls over the shared
// header and skeleton rows (unpaginated, so sized to typical content). The
// controls' labels are static i18n text, so bars would hide known chrome,
// and they stay enabled: the load is brief, interacting is a harmless no-op,
// and a grayed control would just flash. The track filter shows its
// all-option; the real options arrive with the data.
export function RolesTableSkeleton({ actions }: { actions?: ReactNode }) {
  const tNav = useTranslations("dashboard.nav")
  return (
    <FrameTable
      title={tNav("roles")}
      countIcon={Briefcase01Icon}
      toolbar={actions}
      filters={<RoleTableToolbar tracks={[]} />}
    >
      <Table className="table-fixed">
        <RoleTableHeadings />
        <TableSkeleton rows={8} columns={ROLE_SKELETON_COLUMNS} />
      </Table>
    </FrameTable>
  )
}

export function RolesTable({
  roles,
  tracks,
  actions,
}: {
  roles: RolesTableRow[]
  tracks: RolesTableTrack[]
  actions?: ReactNode
}) {
  // The no-matches title is the page's nav label, matching the page heading.
  const tNav = useTranslations("dashboard.nav")
  const tToolbar = useTranslations("dashboard.roles.toolbar")
  const tFamily = useTranslations("dashboard.roles.family")
  const router = useRouter()

  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  // Which family bands are open. Default all open; a filter change re-opens
  // everything, because a row matching a search must never sit inside a
  // closed group where the count says it exists and the eye cannot find it.
  const [expanded, setExpanded] = useState<ExpandedState>(true)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the filter values are the re-open signal, not a read dependency
  useEffect(() => {
    setExpanded(true)
  }, [globalFilter, columnFilters])

  // Family adjacency and order (name order, family-less last) come from the
  // shared grouping helper, flattened: TanStack groups by first appearance,
  // so presorted data yields the same group order as the family pages.
  const data = useMemo(
    () => groupByFamily(roles).flatMap((group) => group.rows),
    [roles]
  )

  const table = useTable({
    features,
    data,
    columns,
    state: {
      // Grouping is pinned (the family grouping is the page's organization,
      // never user state); expansion is the user's, per family band.
      grouping: GROUPING,
      expanded,
      globalFilter,
      columnFilters,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    onGroupingChange: () => {},
    // The filter effect above owns re-opening; TanStack's own auto-reset
    // must not queue a second setState (see the GROUPING note above).
    autoResetExpanded: false,
    groupedColumnMode: "remove",
    // The matcher reads the whole row, so it runs on the title column only
    // (every other column opts out of global filtering).
    globalFilterFn: (row, _columnId, value: string) =>
      matchesRoleQuery(row.original, value),
  })

  const shown = table.getFilteredRowModel().rows.length
  const visibleColumnCount = table.getVisibleLeafColumns().length
  function clearFilters() {
    setGlobalFilter("")
    setColumnFilters([])
  }

  const trackFilter =
    (table.getColumn("track")?.getFilterValue() as string | undefined) ??
    ALL_TRACKS

  return (
    <FrameTable
      title={tNav("roles")}
      // The register's own size, on the title's line, the way every other
      // register in the app carries it: a sentence under the title that says
      // the same number in words is a subtitle doing a chip's work.
      count={shown}
      // What the number counts, the same mark the surface carries everywhere
      // else (the nav item, its empty state). The family bands inside the
      // table stay bare numbers: the header already said the unit.
      countIcon={Briefcase01Icon}
      toolbar={actions}
      filters={
        <RoleTableToolbar
          tracks={tracks}
          query={globalFilter}
          onQueryChange={setGlobalFilter}
          track={trackFilter}
          onTrackChange={(value) =>
            table
              .getColumn("track")
              ?.setFilterValue(value === ALL_TRACKS ? undefined : value)
          }
          shown={shown}
          total={roles.length}
        />
      }
    >
      {shown === 0 ? (
        <NoMatchesEmpty
          title={tNav("roles")}
          description={tToolbar("noMatches")}
          clearLabel={tToolbar("clearFilters")}
          onClear={clearFilters}
        />
      ) : (
        <Table className="table-fixed">
          <RoleTableHeadings />
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                // The group's identity comes from its leaf rows (the family
                // column itself is removed via groupedColumnMode).
                const firstLeaf = row.subRows[0]?.original
                const familyName = firstLeaf?.familyName ?? tFamily("none")
                const open = row.getIsExpanded()
                return (
                  <TableRow key={row.id} className={FAMILY_ROW_CLASS}>
                    <TableCell colSpan={visibleColumnCount}>
                      <div className="flex min-w-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-expanded={open}
                          aria-label={tFamily(
                            open ? "hideRoles" : "showRoles",
                            { name: familyName }
                          )}
                          onClick={row.getToggleExpandedHandler()}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            strokeWidth={2}
                            aria-hidden="true"
                            className={cn(
                              "transition-transform duration-150",
                              open && "rotate-90"
                            )}
                          />
                        </Button>
                        {firstLeaf !== undefined &&
                        firstLeaf.familySlug !== null ? (
                          <Link
                            href={`/roles/families/${firstLeaf.familySlug}`}
                            className={cn(
                              FAMILY_NAME_CLASS,
                              "truncate underline-offset-4 hover:underline"
                            )}
                          >
                            {firstLeaf.familyName}
                          </Link>
                        ) : (
                          // The roles with no family at all. It stands where a
                          // name would, so it takes the name's size and drops
                          // only the weight: left at the old smaller size it
                          // read as a note about the group rather than as the
                          // group's own heading.
                          <span
                            className={cn(
                              FAMILY_NAME_CLASS,
                              "truncate font-normal text-muted-foreground"
                            )}
                          >
                            {tFamily("none")}
                          </span>
                        )}
                        {/* The same chip the register's own title carries,
                            beside the name it counts. */}
                        <CountChip
                          value={row.subRows.length}
                          icon={Briefcase01Icon}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }
              return (
                <TableRow
                  key={row.id}
                  // Whole-row navigation as an enhancement; the title cell's
                  // Link stays the accessible path (internal-navigation
                  // convention).
                  className="cursor-pointer"
                  onClick={(event) => {
                    // Clicks on real links (the title) handle their own navigation,
                    // including modified clicks opening new tabs; and a click that ends a
                    // text selection is a copy gesture, not navigation.
                    if ((event.target as HTMLElement).closest("a")) return
                    if (window.getSelection()?.toString()) return
                    router.push(`/roles/${row.original.slug}`)
                  }}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <TableCell key={cell.id}>
                      {index === 0 ? (
                        // The reference's indent: an empty box the size of the
                        // band's chevron, so role titles align under their
                        // family's name rather than under its control.
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-7 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <table.FlexRender cell={cell} />
                          </div>
                        </div>
                      ) : (
                        <table.FlexRender cell={cell} />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </FrameTable>
  )
}
