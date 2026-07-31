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
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
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
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { TrackBadge } from "@/components/track-badge"
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

// The register's header, shared by the data table and the page's loading
// skeleton so the two cannot drift. The columns are not sortable (grouped
// registers take no per-column sorting), so a static header is equivalent to
// rendering TanStack's header groups. Fixed column widths (with table-fixed
// on the Table): auto layout would re-measure columns from the visible rows,
// so widths would jump whenever filtering changes which rows show. Title
// takes the remaining space. Band is w-40 to fit the column's widest content
// on one line (the sv "Inte utvärderad ännu" cell text, wider than the fi
// "Vaativuusluokka" heading); narrower wraps or clips.
export function RolesTableHeader() {
  const t = useTranslations("dashboard.roles")
  const tAssessment = useTranslations("assessment")
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{t("table.title")}</TableHead>
        <TableHead className="w-44">{t("table.track")}</TableHead>
        <TableHead className="w-[22%]">{t("table.team")}</TableHead>
        {/* w-32 fits the widest locale label (da/nb "Medarbejdere") on one
            line; the value itself is a short number. */}
        <TableHead className="w-32">{t("table.employees")}</TableHead>
        <TableHead className="w-40">{tAssessment("band")}</TableHead>
      </TableRow>
    </TableHeader>
  )
}

// Skeleton shape per column, mirroring the real row content (title link,
// track badge, team text, band badge) so the loading table has the same
// silhouette as the loaded one.
const ROLES_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-40 max-w-full" },
  { className: "h-5 w-20 rounded-full" },
  { className: "w-24 max-w-full" },
  { className: "w-6" },
  { className: "h-5 w-10 rounded-full" },
]

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
        <RolesTableHeader />
        <TableSkeleton rows={8} columns={ROLES_SKELETON_COLUMNS} />
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
          // block truncate: a long title clamps inside the fixed column
          // instead of widening it.
          <Link
            href={`/roles/${row.original.slug}`}
            className="block truncate font-medium underline-offset-4 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: "track",
        accessorFn: (row) => row.trackKey,
        filterFn: exactString,
        enableGlobalFilter: false,
        // Block flex wrapper: an inline-flex badge directly in the cell sits
        // on the text baseline and inflates the line box, desyncing the row
        // height from the skeleton rows (skeleton parity rule).
        cell: ({ row }) => (
          <div className="flex items-center">
            <TrackBadge
              trackKey={row.original.trackKey}
              name={row.original.trackName}
            />
          </div>
        ),
      },
      {
        id: "team",
        accessorKey: "team",
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="block truncate text-muted-foreground">
            {row.original.team}
          </span>
        ),
      },
      {
        id: "employees",
        enableGlobalFilter: false,
        // How many people currently hold the role. Zero is muted rather than
        // hidden: "nobody in this role" is information (an unstaffed role), not
        // an empty cell.
        cell: ({ row }) => (
          <span
            className={
              row.original.employeeCount === 0
                ? "text-muted-foreground/60 tabular-nums"
                : "tabular-nums"
            }
          >
            {row.original.employeeCount}
          </span>
        ),
      },
      {
        id: "evaluation",
        enableGlobalFilter: false,
        // The evaluation outcome: a role's band once it is fully evaluated,
        // otherwise a muted "not yet evaluated" line (an incomplete or
        // still-computing role has no band yet, the same rule as the family
        // and overview tables), so the register shows which roles still need
        // evaluating instead of a blank cell.
        // Block flex wrapper: skeleton parity, same as the track cell.
        cell: ({ row }) =>
          row.original.band != null ? (
            <div className="flex items-center">
              <Badge>{row.original.band}</Badge>
            </div>
          ) : (
            <span className="block truncate text-muted-foreground">
              {t("notEvaluated")}
            </span>
          ),
      },
    ],
    [t]
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
          <RolesTableHeader />
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                // The group's identity comes from its leaf rows (the family
                // column itself is removed via groupedColumnMode).
                const firstLeaf = row.subRows[0]?.original
                return (
                  <TableRow
                    key={row.id}
                    className="bg-muted/50 hover:bg-muted/50"
                  >
                    <TableCell colSpan={visibleColumnCount}>
                      <span className="flex items-baseline gap-2">
                        {firstLeaf !== undefined &&
                        firstLeaf.familySlug !== null ? (
                          <Link
                            href={`/roles/families/${firstLeaf.familySlug}`}
                            className="font-bold text-sm underline-offset-4 hover:underline"
                          >
                            {firstLeaf.familyName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {tFamily("none")}
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs">
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
