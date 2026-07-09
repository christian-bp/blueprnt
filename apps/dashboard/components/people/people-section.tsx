"use client"

import { UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button, buttonVariants } from "@workspace/ui/components/button"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { AddPersonDialog } from "@/components/people/add-person-dialog"
import { TablePagination } from "@/components/table-pagination"
import { TableSearchField } from "@/components/table-search-field"
import { ariaSort, TableSortButton } from "@/components/table-sort-button"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { displayNameFor } from "@/lib/person-display"
import { onSelectValue } from "@/lib/select"

// The people list surface. Displays active (non-archived) people imported from
// payroll as a searchable, filterable, paginated data table (the shadcn data
// table recipe on @tanstack/react-table, same as the role register).
// Classification state lives on the Classify tab (badge + page), not here.
// The pseudonymizeNames org setting is applied to the name cell.

// One table row with the RESOLVED display name: pseudonymization is applied
// up front so search matches exactly what is shown, never the hidden real
// name.
export interface PeopleTableRow {
  personId: string
  publicId: string
  name: string
  gender: "Man" | "Kvinna" | null
  department: string | null
  ftePercent: number | null
}

// The people list's free-text search: case-insensitive substring over the
// visible free-text cells (name, department). Pure and exported so the
// matching rules are unit-tested without a DOM (same pattern as
// matchesRoleQuery in roles-table).
export function matchesPersonQuery(
  person: { name: string; department: string | null },
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  return [person.name, person.department ?? ""].some((field) =>
    field.toLowerCase().includes(q)
  )
}

const PAGE_SIZE = 25

const exactString = (
  row: Row<PeopleTableRow>,
  columnId: string,
  value: string
) => row.getValue<string>(columnId) === value

// Skeleton shape per column, mirroring the real row content (name link, short
// gender word, department, tiny FTE value) so the loading table has the same
// silhouette as the loaded one.
const PEOPLE_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-36 max-w-full" },
  { className: "w-16" },
  { className: "w-28 max-w-full" },
  { className: "w-10" },
]

export function PeopleSection() {
  const t = useTranslations("dashboard.people")
  const tToolbar = useTranslations("dashboard.people.toolbar")
  const tGender = useTranslations("dashboard.people.gender")
  const tOrg = useTranslations("dashboard.organization.general")
  const { orgId } = useOrganization()

  const people = useQuery(api.people.people.listPeople, { orgId })
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })

  const rows = useMemo<PeopleTableRow[]>(() => {
    if (people === undefined || settings === undefined) return []
    const pseudonymize = settings?.pseudonymizeNames ?? false
    return people.map((person) => ({
      personId: String(person.personId),
      publicId: person.publicId,
      name: displayNameFor(person, pseudonymize, (ref) =>
        tOrg("pseudonymTemplate", { ref })
      ),
      gender: person.gender ?? null,
      department: person.department ?? null,
      ftePercent: person.ftePercent ?? null,
    }))
  }, [people, settings, tOrg])

  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  // Default order: by name, ascending.
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  // Column defs exist for the filter/pagination pipeline only: the header row
  // is the static tableHeader below (shared with the skeleton) and cells
  // render from row.original, so no header/cell defs are needed here.
  const columns = useMemo<ColumnDef<PeopleTableRow>[]>(
    () => [
      { id: "name", accessorKey: "name" },
      {
        id: "gender",
        accessorKey: "gender",
        filterFn: exactString,
        enableGlobalFilter: false,
      },
      {
        id: "department",
        accessorFn: (row) => row.department ?? "",
        filterFn: exactString,
        enableGlobalFilter: false,
      },
      {
        id: "fte",
        // Missing FTE sorts below any real percentage instead of tripping
        // the numeric comparator with nulls; cells render from row.original.
        accessorFn: (row) => row.ftePercent ?? -1,
        // Full-time is exactly 100 %; part-time is any real value below it.
        // Missing FTE (the -1 sentinel) shows only under "all".
        filterFn: (row, columnId, value: string) => {
          const fte = row.getValue<number>(columnId)
          return value === "full" ? fte === 100 : fte > -1 && fte < 100
        },
        enableGlobalFilter: false,
      },
    ],
    []
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter, columnFilters, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    // Auto-resets setState on data-identity changes and can loop on unrelated
    // re-renders (see the GROUPING note in roles-table.tsx); the toolbar
    // handlers reset the page explicitly instead.
    autoResetPageIndex: false,
    // The matcher reads the whole row, so it runs on the name column only
    // (every other column opts out of global filtering).
    globalFilterFn: (row, _columnId, value: string) =>
      matchesPersonQuery(row.original, value),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const shown = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows.map((row) => row.original)
  const pageCount = table.getPageCount()
  const filtersActive = globalFilter.trim() !== "" || columnFilters.length > 0
  const departmentFilter =
    (table.getColumn("department")?.getFilterValue() as string | undefined) ??
    "all"
  const genderFilter =
    (table.getColumn("gender")?.getFilterValue() as string | undefined) ?? "all"
  const fteFilter =
    (table.getColumn("fte")?.getFilterValue() as string | undefined) ?? "all"

  // Shared handler for the toolbar's column-filter selects: "all" clears.
  function setColumnFilter(columnId: string, value: string) {
    table
      .getColumn(columnId)
      ?.setFilterValue(value === "all" ? undefined : value)
    resetPage()
  }

  // Distinct departments for the filter options, sorted for a stable list.
  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.department)
            .filter((d): d is string => d !== null && d !== "")
        )
      ).sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  // Every filter change resets to the first page; this clamp covers the
  // remaining case where a reactive data update shrinks the filtered set
  // while a later page is open.
  useEffect(() => {
    if (pagination.pageIndex > 0 && pagination.pageIndex >= pageCount) {
      setPagination((p) => ({ ...p, pageIndex: Math.max(0, pageCount - 1) }))
    }
  }, [pageCount, pagination.pageIndex])

  function resetPage() {
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  }

  function clearFilters() {
    setGlobalFilter("")
    setColumnFilters([])
    resetPage()
  }

  // Clickable, sortable column heading: first click sorts ascending, the
  // next flips to descending (TableSortButton owns the shared visual
  // language; sorting resets to the first page like the filters do).
  function sortableHead(id: string, label: string, widthClass?: string) {
    const column = table.getColumn(id)
    const sorted = column?.getIsSorted() ?? false
    return (
      <TableHead className={widthClass} aria-sort={ariaSort(sorted)}>
        <TableSortButton
          label={label}
          sorted={sorted}
          onToggle={() => {
            column?.toggleSorting(sorted === "asc")
            resetPage()
          }}
        />
      </TableHead>
    )
  }

  // Fixed column widths (with table-fixed on the Table): auto layout
  // re-measures columns from each page's content, so widths jump on every
  // page flip and when the skeleton swaps for data. Name takes the remaining
  // space; the narrow columns are pinned.
  const tableHeader = (
    <TableHeader>
      <TableRow>
        {sortableHead("name", t("columns.name"))}
        {sortableHead("gender", t("columns.gender"), "w-28")}
        {sortableHead("department", t("columns.department"), "w-[22%]")}
        {/* w-28 fits the widest locale label (sv "Omfattning") plus the sort
            chevron slot; narrower clips it and forces a horizontal scroll. */}
        {sortableHead("fte", t("columns.fte"), "w-28")}
      </TableRow>
    </TableHeader>
  )

  const loading = people === undefined || settings === undefined

  // Toolbar: search + the department filter; the counter appears only while
  // something is narrowing the table (mirrors the role register's toolbar).
  // The table state lives in this component, so the SAME live toolbar renders
  // during loading (static chrome is never a skeleton bar, and it needs no
  // disabling: a search typed into the loading state carries over). The
  // department select appears with the data (its options ARE the data).
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <TableSearchField
        placeholder={tToolbar("searchPlaceholder")}
        value={globalFilter}
        onChange={(value) => {
          setGlobalFilter(value)
          resetPage()
        }}
      />
      {departments.length > 0 && (
        <Select
          items={{
            all: tToolbar("departmentAll"),
            ...Object.fromEntries(
              departments.map((department) => [department, department])
            ),
          }}
          value={departmentFilter}
          onValueChange={onSelectValue((value: string) =>
            setColumnFilter("department", value)
          )}
        >
          <SelectTrigger aria-label={t("columns.department")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tToolbar("departmentAll")}</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department} value={department}>
                {department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {rows.length > 0 && (
        <Select
          items={{
            all: tToolbar("genderAll"),
            Man: tGender("Man"),
            Kvinna: tGender("Kvinna"),
          }}
          value={genderFilter}
          onValueChange={onSelectValue((value: string) =>
            setColumnFilter("gender", value)
          )}
        >
          <SelectTrigger aria-label={t("columns.gender")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tToolbar("genderAll")}</SelectItem>
            <SelectItem value="Man">{tGender("Man")}</SelectItem>
            <SelectItem value="Kvinna">{tGender("Kvinna")}</SelectItem>
          </SelectContent>
        </Select>
      )}
      {rows.length > 0 && (
        <Select
          items={{
            all: tToolbar("fteAll"),
            full: tToolbar("fteFull"),
            part: tToolbar("ftePart"),
          }}
          value={fteFilter}
          onValueChange={onSelectValue((value: string) =>
            setColumnFilter("fte", value)
          )}
        >
          <SelectTrigger aria-label={t("columns.fte")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tToolbar("fteAll")}</SelectItem>
            <SelectItem value="full">{tToolbar("fteFull")}</SelectItem>
            <SelectItem value="part">{tToolbar("ftePart")}</SelectItem>
          </SelectContent>
        </Select>
      )}
      {filtersActive && (
        <span className="ml-auto text-muted-foreground text-sm tabular-nums">
          {tToolbar("resultCount", { shown, total: rows.length })}
        </span>
      )}
    </div>
  )

  // Import stays the primary action (payroll exports are the canonical data
  // source); the manual single-person add sits beside it as the secondary
  // path (its dialog carries its own outline trigger).
  const headerActions = (
    <div className="flex items-center gap-2">
      <AddPersonDialog />
      <Link href="/people/import" className={buttonVariants()}>
        <HugeiconsIcon
          icon={UserMultiple02Icon}
          size={16}
          strokeWidth={2}
          aria-hidden="true"
        />
        {t("import.title")}
      </Link>
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("heading")}
        description={t("description")}
        action={headerActions}
      />

      {loading ? (
        // Loading: the live toolbar over a content-shaped table skeleton.
        <>
          {toolbar}
          <Table className="table-fixed">
            {tableHeader}
            <TableSkeleton rows={PAGE_SIZE} columns={PEOPLE_SKELETON_COLUMNS} />
          </Table>
        </>
      ) : people.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href="/people/import"
            className={buttonVariants({ variant: "outline" })}
          >
            {t("import.title")}
          </Link>
        </Empty>
      ) : (
        <>
          {toolbar}

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
            <>
              <Table className="table-fixed">
                {tableHeader}
                <TableBody>
                  {pageRows.map((row) => {
                    return (
                      <TableRow key={row.personId}>
                        <TableCell className="truncate font-medium">
                          <Link
                            className="underline-offset-4 hover:underline"
                            href={`/people/${row.publicId}`}
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.gender != null ? t(`gender.${row.gender}`) : ""}
                        </TableCell>
                        <TableCell className="truncate text-muted-foreground">
                          {row.department ?? ""}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.ftePercent != null ? `${row.ftePercent}%` : ""}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {pageCount > 1 && (
                <div className="flex justify-center">
                  <TablePagination
                    page={pagination.pageIndex}
                    pageCount={pageCount}
                    hasMore={false}
                    canPrev={table.getCanPreviousPage()}
                    canNext={table.getCanNextPage()}
                    onPrev={() => table.previousPage()}
                    onNext={() => table.nextPage()}
                    onSelect={(page0) => table.setPageIndex(page0)}
                    previousLabel={tToolbar("previous")}
                    nextLabel={tToolbar("next")}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
