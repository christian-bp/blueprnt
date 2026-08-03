"use client"

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table"
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
import { useMemo, useState } from "react"
import { NoMatchesEmpty } from "@/components/no-matches-empty"
import {
  ALL_TRACKS,
  matchesRoleQuery,
  RoleTableToolbar,
  type RolesTableTrack,
} from "@/components/roles/role-table-toolbar"
import {
  ROLE_SKELETON_COLUMNS,
  RoleBandCell,
  RoleEmployeesCell,
  RoleTableHeadings,
  RoleTeamCell,
  RoleTitleCell,
  RoleTrackCell,
} from "@/components/roles/role-table-row"
import { TableSkeleton } from "@/components/table-skeleton"
import {
  FAMILY_COUNT_CLASS,
  FAMILY_NAME_CLASS,
  FAMILY_ROW_CLASS,
} from "@/lib/role-family-row"
import { groupByFamily } from "@/lib/role-groups"

// The role register as ONE grouped data table (shadcn data table recipe on
// @tanstack/react-table), per the 2026-06-12 design spec: a hidden family
// column carries the grouping, the pipeline filters BEFORE grouping so
// families without matches disappear, and expansion is pinned open (the
// groups are organization, not disclosure). Search and the track filter come
// from the shared toolbar module: its matcher runs as globalFilterFn, its
// track value drives a column filter.

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
  band: number | null
}

// MODULE-LEVEL constant: state.grouping keys the grouped-row-model memo, and
// every recompute of that memo queues TanStack's auto-resets, whose
// resetPageIndex setState re-renders the table. An inline ["family"] array
// (new identity per render) therefore turns ANY re-render (e.g. a
// Select opening inside this tree) into an infinite render loop that
// freezes the page. Keep the identity stable and the auto-resets off.
const GROUPING = ["family"]

const exactString = (
  row: Row<RolesTableRow>,
  columnId: string,
  value: string
) => row.getValue<string>(columnId) === value

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
export function RolesTableSkeleton() {
  return (
    <div className="space-y-4">
      <RoleTableToolbar tracks={[]} />
      <Table className="table-fixed">
        <RoleTableHeadings />
        <TableSkeleton rows={8} columns={ROLE_SKELETON_COLUMNS} />
      </Table>
    </div>
  )
}

export function RolesTable({
  roles,
  tracks,
}: {
  roles: RolesTableRow[]
  tracks: RolesTableTrack[]
}) {
  const t = useTranslations("dashboard.roles")
  const tToolbar = useTranslations("dashboard.roles.toolbar")
  const tFamily = useTranslations("dashboard.roles.family")
  const router = useRouter()

  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Family adjacency and order (name order, family-less last) come from the
  // shared grouping helper, flattened: TanStack groups by first appearance,
  // so presorted data yields the same group order as the family pages.
  const data = useMemo(
    () => groupByFamily(roles).flatMap((group) => group.rows),
    [roles]
  )

  const columns = useMemo<ColumnDef<RolesTableRow>[]>(
    () => [
      {
        id: "family",
        // The sentinel keeps family-less roles in ONE group; the group row
        // renders the real name (or the none label) from its leaf rows.
        accessorFn: (row) => row.familyId ?? "__none__",
        enableGlobalFilter: false,
      },
      {
        id: "title",
        accessorKey: "title",
        cell: ({ row }) => (
          <RoleTitleCell slug={row.original.slug} title={row.original.title} />
        ),
      },
      {
        id: "track",
        accessorFn: (row) => row.trackKey,
        filterFn: exactString,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <RoleTrackCell
            trackKey={row.original.trackKey}
            name={row.original.trackName}
          />
        ),
      },
      {
        id: "team",
        accessorKey: "team",
        enableGlobalFilter: false,
        cell: ({ row }) => <RoleTeamCell team={row.original.team} />,
      },
      {
        id: "employees",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <RoleEmployeesCell count={row.original.employeeCount} />
        ),
      },
      {
        id: "evaluation",
        enableGlobalFilter: false,
        cell: ({ row }) => <RoleBandCell band={row.original.band} />,
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      // Grouping and expansion are pinned: the family grouping is the
      // page's organization, never user state, so groups cannot collapse
      // (and autoReset on filter changes cannot close them either).
      grouping: GROUPING,
      expanded: true,
      globalFilter,
      columnFilters,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: () => {},
    onGroupingChange: () => {},
    // Unused features must not queue resets: expansion is pinned and there
    // is no pagination, but their auto-resets would still setState (see the
    // GROUPING note above).
    autoResetExpanded: false,
    autoResetPageIndex: false,
    groupedColumnMode: "remove",
    // The matcher reads the whole row, so it runs on the title column only
    // (every other column opts out of global filtering).
    globalFilterFn: (row, _columnId, value: string) =>
      matchesRoleQuery(row.original, value),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
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
    <div className="space-y-4">
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

      {shown === 0 ? (
        <NoMatchesEmpty
          title={t("heading")}
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
                return (
                  <TableRow key={row.id} className={FAMILY_ROW_CLASS}>
                    <TableCell colSpan={visibleColumnCount}>
                      <span className="flex items-baseline gap-2">
                        {firstLeaf !== undefined &&
                        firstLeaf.familySlug !== null ? (
                          <Link
                            href={`/roles/families/${firstLeaf.familySlug}`}
                            className={cn(
                              FAMILY_NAME_CLASS,
                              "underline-offset-4 hover:underline"
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
                              "font-normal text-muted-foreground"
                            )}
                          >
                            {tFamily("none")}
                          </span>
                        )}
                        <span className={FAMILY_COUNT_CLASS}>
                          {tFamily("roleCount", { count: row.subRows.length })}
                        </span>
                      </span>
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
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
