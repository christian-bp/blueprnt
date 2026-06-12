"use client"

import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
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
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { groupByFamily } from "@/lib/role-groups"
import { statusBadgeVariant } from "@/lib/role-status"

// The role register as ONE grouped data table (shadcn data table recipe on
// @tanstack/react-table), per the 2026-06-12 design spec: a hidden family
// column carries the grouping, the pipeline filters BEFORE grouping so
// families without matches disappear, and expansion is pinned open (the
// groups are organization, not disclosure). Search is the exported pure
// matcher below; status/track filter through column filters.

// Structural subset of listRoles rows (same precedent as CreateRoleDialog's
// TrackOption): the table needs no convex types of its own.
export interface RolesTableRow {
  roleId: string
  title: string
  function: string
  team: string
  trackKey: string
  trackName: string
  status: string
  ratedCount: number
  totalCriteria: number
  familyId: string | null
  familyName: string | null
}

export interface RolesTableTrack {
  key: string
  name: string
}

// The role register's free-text search: case-insensitive substring over the
// role's free-text fields (title, team, function). Pure and exported so the
// matching rules are unit-tested without a DOM; the table wires it in as
// its globalFilterFn.
export function matchesRoleQuery(
  role: { title: string; team: string; function: string },
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  return [role.title, role.team, role.function].some((field) =>
    field.toLowerCase().includes(q)
  )
}

const ROLE_STATUSES = ["draft", "inReview", "approved"] as const
type RoleStatus = (typeof ROLE_STATUSES)[number]

const exactString = (
  row: Row<RolesTableRow>,
  columnId: string,
  value: string
) => row.getValue<string>(columnId) === value

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
  const tStatus = useTranslations("assessment.status")
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
        header: t("table.title"),
        cell: ({ row }) => (
          <Link
            href={`/roles/${row.original.roleId}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: "track",
        accessorFn: (row) => row.trackKey,
        header: t("table.track"),
        filterFn: exactString,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.trackName}
          </span>
        ),
      },
      {
        id: "team",
        accessorKey: "team",
        header: t("table.team"),
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.team}</span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
        header: t("table.status"),
        filterFn: exactString,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>
            {tStatus(row.original.status as RoleStatus)}
          </Badge>
        ),
      },
      {
        id: "rated",
        header: () => (
          <span className="block text-right">{t("table.rated")}</span>
        ),
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.ratedCount}/{row.original.totalCriteria}
          </span>
        ),
      },
    ],
    [t, tStatus]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      // Grouping and expansion are pinned: the family grouping is the
      // page's organization, never user state, so groups cannot collapse
      // (and autoReset on filter changes cannot close them either).
      grouping: ["family"],
      expanded: true,
      globalFilter,
      columnFilters,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: () => {},
    onGroupingChange: () => {},
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
  const filtersActive = globalFilter.trim() !== "" || columnFilters.length > 0
  const visibleColumnCount = table.getVisibleLeafColumns().length

  function clearFilters() {
    setGlobalFilter("")
    setColumnFilters([])
  }

  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string | undefined) ?? "all"
  const trackFilter =
    (table.getColumn("track")?.getFilterValue() as string | undefined) ?? "all"

  return (
    <div className="space-y-4">
      {/* Toolbar: search + the two filters; the counter appears only while
          something is narrowing the table. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={globalFilter}
            placeholder={tToolbar("searchPlaceholder")}
            aria-label={tToolbar("searchPlaceholder")}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="w-64 pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            table
              .getColumn("status")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger aria-label={t("table.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tToolbar("statusAll")}</SelectItem>
            {ROLE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {tStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={trackFilter}
          onValueChange={(value) =>
            table
              .getColumn("track")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger aria-label={t("table.track")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tToolbar("trackAll")}</SelectItem>
            {tracks.map((track) => (
              <SelectItem key={track.key} value={track.key}>
                {track.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtersActive && (
          <span className="ml-auto text-muted-foreground text-sm tabular-nums">
            {tToolbar("resultCount", { shown, total: roles.length })}
          </span>
        )}
      </div>

      {shown === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{tToolbar("noMatches")}</EmptyDescription>
          </EmptyHeader>
          <Button type="button" variant="outline" onClick={clearFilters}>
            {tToolbar("clearFilters")}
          </Button>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
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
                        firstLeaf.familyId !== null ? (
                          <Link
                            href={`/roles/families/${firstLeaf.familyId}`}
                            className="font-medium text-sm underline-offset-4 hover:underline"
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
                    router.push(`/roles/${row.original.roleId}`)
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
