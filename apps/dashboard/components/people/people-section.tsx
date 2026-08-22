"use client"

import { UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  columnFilteringFeature,
  type ColumnFiltersState,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  type Row,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button, buttonVariants } from "@workspace/ui/components/button"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { NoMatchesEmpty } from "@/components/no-matches-empty"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { AddPersonDialog } from "@/components/people/add-person-dialog"
import { BulkDeletePeopleDialog } from "@/components/people/bulk-delete-people-dialog"
import { SuggestedRoleBadge } from "@/components/suggested-role-badge"
import { TablePagination } from "@/components/table-pagination"
import { TableSearchField } from "@/components/table-search-field"
import { ariaSort, TableSortButton } from "@/components/table-sort-button"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { onSelectValue } from "@/lib/select"
import { selectionState } from "@/lib/selection"

// The people list surface. Displays active (non-archived) people imported from
// payroll as a searchable, filterable, paginated data table (the shadcn data
// table recipe on @tanstack/react-table, same as the role register).
// Classification is still DONE on the Classify tab; here it only surfaces as a
// role filter (over every created role) and, while narrowing by role, a
// "Suggested" badge on people whose assignment is not yet confirmed.

// One table row for a person.
export interface PeopleTableRow {
  personId: string
  publicId: string
  name: string
  gender: "Man" | "Kvinna" | null
  department: string | null
  ftePercent: number | null
  // The person's active role assignment (null when unclassified): its role id
  // drives the role filter, and senioritySource flags a still-suggested assignment.
  roleId: string | null
  senioritySource: "suggested" | "confirmed" | null
}

// The people list's free-text search: case-insensitive substring over the
// visible free-text cells (name, department). Pure and exported so the
// matching rules are unit-tested without a DOM (same pattern as
// matchesRoleQuery in role-table-toolbar).
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

// v9 registers features explicitly: an API is absent unless its feature is
// here, and each row-model slot follows the feature it belongs to.
const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

type PeopleFeatures = typeof features

const exactString = (
  row: Row<PeopleFeatures, PeopleTableRow>,
  columnId: string,
  value: string
) => row.getValue<string>(columnId) === value

// Built through the column helper rather than annotated as ColumnDef[]: the
// annotation widens every accessor's value type to unknown, while the helper
// infers each one from its accessor (so the fte filter below reads a number
// without asking for one). Module level because the definitions are static,
// so the table's model inputs keep one identity for the process.
const columnHelper = createColumnHelper<PeopleFeatures, PeopleTableRow>()

// Column defs exist for the filter/pagination pipeline only: the header row
// is the static tableHeader below (shared with the skeleton) and cells
// render from row.original, so no header/cell defs are needed here.
const columns = columnHelper.columns([
  columnHelper.accessor("name", { id: "name" }),
  columnHelper.accessor("gender", {
    id: "gender",
    filterFn: exactString,
    enableGlobalFilter: false,
  }),
  columnHelper.accessor((row) => row.department ?? "", {
    id: "department",
    filterFn: exactString,
    enableGlobalFilter: false,
  }),
  // Filter-only (no visible column): matches on the assigned role id.
  // Unclassified people (roleId null -> "") match no role, so selecting
  // a role narrows to its classified people.
  columnHelper.accessor((row) => row.roleId ?? "", {
    id: "role",
    filterFn: exactString,
    enableGlobalFilter: false,
  }),
  // Missing FTE sorts below any real percentage instead of tripping
  // the numeric comparator with nulls; cells render from row.original.
  columnHelper.accessor((row) => row.ftePercent ?? -1, {
    id: "fte",
    // Full-time is exactly 100 %; part-time is any real value below it.
    // Missing FTE (the -1 sentinel) shows only under "all".
    filterFn: (row, columnId, value: string) => {
      const fte = row.getValue<number>(columnId)
      return value === "full" ? fte === 100 : fte > -1 && fte < 100
    },
    enableGlobalFilter: false,
  }),
])

// Skeleton shape per column, mirroring the real row content (selection
// checkbox, name link, short gender word, department, tiny FTE value) so the
// loading table has the same silhouette as the loaded one. The checkbox is
// per-row chrome that is identical on every row, not data, so it renders as
// its real control (muted, non-interactive) rather than a bar.
const PEOPLE_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  {
    content: (
      <span className="flex items-center">
        <Checkbox disabled aria-hidden="true" tabIndex={-1} />
      </span>
    ),
  },
  { className: "w-36 max-w-full" },
  { className: "w-16" },
  { className: "w-28 max-w-full" },
  { className: "w-10" },
]

export function PeopleSection() {
  const t = useTranslations("dashboard.people")
  // The page's own name (the Directory sub-page) comes from the nav label so
  // the heading can never drift from the sidebar sub-menu and header tab.
  const tTabs = useTranslations("dashboard.people.tabs")
  const tToolbar = useTranslations("dashboard.people.toolbar")
  const tGender = useTranslations("dashboard.people.gender")
  const tBulk = useTranslations("dashboard.people.bulk")
  const { orgId, role } = useOrganization()
  // Erasing people is irreversible and admin-only (people/erase.ts), so the
  // bulk control is hidden from an editor for the same reason the per-person
  // one is: absence is this app's treatment for an admin-only thing, and a
  // destructive button that would 403 is worse than no button.
  const canErase = role === "admin"
  const locale = useLocale()

  const people = useQuery(api.people.people.listPeople, { orgId })
  // All created roles are the role-filter options (not just roles that happen
  // to have people), so the filter always offers the full set.
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })

  const rows = useMemo<PeopleTableRow[]>(() => {
    if (people === undefined) return []
    return people.map((person) => ({
      personId: String(person.personId),
      publicId: person.publicId,
      name: person.displayName,
      gender: person.gender ?? null,
      department: person.department ?? null,
      ftePercent: person.ftePercent ?? null,
      roleId: person.roleId !== null ? String(person.roleId) : null,
      senioritySource: person.senioritySource,
    }))
  }, [people])

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
  // Selected people, keyed by personId. Survives paging and filtering; the
  // EFFECTIVE selection below is what any action reads.
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkOpen, setBulkOpen] = useState(false)

  const table = useTable({
    features,
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
    // The register always has a sort (default: name ascending), so a heading
    // toggles between ascending and descending and never back to unsorted.
    // The handler already passes an explicit direction, so the removal step
    // is unreachable; stating the policy keeps it that way if that changes.
    enableSortingRemoval: false,
    // The matcher reads the whole row, so it runs on the name column only
    // (every other column opts out of global filtering).
    globalFilterFn: (row, _columnId, value: string) =>
      matchesPersonQuery(row.original, value),
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
  const roleFilter =
    (table.getColumn("role")?.getFilterValue() as string | undefined) ?? "all"
  // The suggested-assignment badge is shown only while narrowing by role: it
  // answers "which of these are still unconfirmed in this role?".
  const roleFilterActive = roleFilter !== "all"

  // One selection, two questions. The header checkbox reads the CURRENT PAGE
  // (a select-all must never arm an irreversible delete over rows the user
  // cannot see), while the bulk action reads the whole FILTERED set, so a
  // selection built across pages stays actionable and rows hidden by a filter
  // or already erased drop out on their own.
  const pageIds = pageRows.map((row) => row.personId)
  const filteredIds = table
    .getFilteredRowModel()
    .rows.map((row) => row.original.personId)
  const pageSelection = selectionState(selected, pageIds)
  const selection = selectionState(selected, filteredIds)
  const selectedCount = selection.effective.size

  function toggleSelected(personId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(personId)
      } else {
        next.delete(personId)
      }
      return next
    })
  }

  // Adds or removes exactly the rows on screen, leaving a selection made on
  // another page untouched.
  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const personId of pageIds) {
        if (checked) {
          next.add(personId)
        } else {
          next.delete(personId)
        }
      }
      return next
    })
  }

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

  // Role-filter options: every created role (id + title), not only roles with
  // people, so the filter always offers the full set. listRoles is already
  // locale-sorted by title.
  const roleOptions = useMemo(
    () =>
      (roles ?? []).map((role) => ({
        id: String(role.roleId),
        title: role.title,
      })),
    [roles]
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
        {/* Fixed-width selection slot. The label is static i18n text, so this
            renders live (and enabled) during loading like the rest of the page
            chrome; with no rows on screen a click selects nothing. */}
        <TableHead className="w-10">
          <Checkbox
            aria-label={tBulk("selectAll")}
            checked={pageSelection.all}
            indeterminate={pageSelection.some}
            onCheckedChange={(checked) => togglePage(checked === true)}
          />
        </TableHead>
        {sortableHead("name", t("columns.name"))}
        {sortableHead("gender", t("columns.gender"), "w-28")}
        {sortableHead("department", t("columns.department"), "w-[22%]")}
        {/* w-28 fits the widest locale label (sv "Omfattning") plus the sort
            chevron slot; narrower clips it and forces a horizontal scroll. */}
        {sortableHead("fte", t("columns.fte"), "w-28")}
      </TableRow>
    </TableHeader>
  )

  const loading = people === undefined

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
      {roleOptions.length > 0 && (
        <Select
          items={{
            all: tToolbar("roleAll"),
            ...Object.fromEntries(
              roleOptions.map((role) => [role.id, role.title])
            ),
          }}
          value={roleFilter}
          onValueChange={onSelectValue((value: string) =>
            setColumnFilter("role", value)
          )}
        >
          <SelectTrigger aria-label={t("columns.role")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tToolbar("roleAll")}</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.title}
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
      {/* The right-aligned end of the filter row: the result count, then the
          bulk action last so it sits hard against the right edge. Grouping
          them means the pair wraps together on a narrow viewport instead of
          the count and the button splitting across lines. */}
      <div className="ml-auto flex items-center gap-2">
        {filtersActive && (
          <span className="text-muted-foreground text-sm tabular-nums">
            {tToolbar("resultCount", { shown, total: rows.length })}
          </span>
        )}
        {/* Appears only once something is selected, and takes the default
            Button size so it matches the height of the search field and the
            filter selects beside it (never a hand-picked size). Its label
            carries the count, so no separate counter text is needed. */}
        {selectedCount > 0 && canErase && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setBulkOpen(true)}
          >
            {tBulk("cta", { count: selectedCount })}
          </Button>
        )}
        {/* The button's label states the count visually, but a changing label
            is not announced: this is what tells a screen reader the selection
            changed, and it is the only thing that does. */}
        <span aria-live="polite" className="sr-only">
          {selectedCount > 0
            ? tBulk("selectedCount", { count: selectedCount })
            : ""}
        </span>
      </div>
    </div>
  )

  // Import stays the primary action (payroll exports are the canonical data
  // source); the manual single-person add sits beside it as the secondary
  // path (its dialog carries its own outline trigger).
  const headerActions = (
    <div className="flex items-center gap-2">
      <AddPersonDialog />
      <Link href="/people/import" className={cn(buttonVariants())}>
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
        title={tTabs("people")}
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
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={UserMultiple02Icon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </EmptyMedia>
            <EmptyTitle>{tTabs("people")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href="/people/import"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("import.title")}
          </Link>
        </Empty>
      ) : (
        <>
          {toolbar}

          {shown === 0 ? (
            <NoMatchesEmpty
              title={tTabs("people")}
              description={tToolbar("noMatches")}
              clearLabel={tToolbar("clearFilters")}
              onClear={clearFilters}
            />
          ) : (
            <>
              <Table className="table-fixed">
                {tableHeader}
                <TableBody>
                  {pageRows.map((row) => {
                    return (
                      <TableRow key={row.personId}>
                        <TableCell className="w-10">
                          {/* Block flex wrapper: an inline-flex control sitting
                              directly on a cell's text baseline inflates the
                              line box, which would desync data rows from the
                              skeleton's row height. */}
                          <div className="flex items-center">
                            <Checkbox
                              aria-label={tBulk("selectRow", {
                                name: row.name,
                              })}
                              checked={selection.effective.has(row.personId)}
                              onCheckedChange={(checked) =>
                                toggleSelected(row.personId, checked === true)
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {/* Name truncates; the suggested badge (shown only
                              while narrowing by role) stays visible beside it. */}
                          <div className="flex items-center gap-2">
                            <Link
                              className="truncate underline-offset-4 hover:underline"
                              href={`/people/${row.publicId}`}
                            >
                              {row.name}
                            </Link>
                            {roleFilterActive &&
                              row.senioritySource === "suggested" && (
                                <SuggestedRoleBadge />
                              )}
                          </div>
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

      {canErase && (
        <BulkDeletePeopleDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          personIds={[...selection.effective]}
          onDeleted={() => setSelected(new Set())}
        />
      )}
    </div>
  )
}
