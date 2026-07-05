"use client"

import {
  InformationCircleIcon,
  Search01Icon,
  Tick02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table"
import { api } from "@workspace/backend/convex/_generated/api"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
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
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { useClassificationSummary } from "@/hooks/use-classification-summary"
import { displayNameFor } from "@/lib/person-display"

// The people list surface. Displays active (non-archived) people imported from
// payroll as a searchable, filterable, paginated data table (the shadcn data
// table recipe on @tanstack/react-table, same as the role register). Includes
// a classification badge per person derived from the listPeopleByTitle query
// (the single source for badge state and the N-of-M summary). The
// pseudonymizeNames org setting is applied to the name cell.

// One table row: a person joined with their classification state and the
// RESOLVED display name. Pseudonymization is applied up front so search
// matches exactly what is shown, never the hidden real name.
export interface PeopleTableRow {
  personId: string
  name: string
  gender: "Man" | "Kvinna" | null
  department: string | null
  ftePercent: number | null
  classification: "confirmed" | "suggested" | "none"
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
// gender word, department, tiny FTE value, classification badge pill) so the
// loading table has the same silhouette as the loaded one.
const PEOPLE_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-36 max-w-full" },
  { className: "w-16" },
  { className: "w-28 max-w-full" },
  { className: "w-10" },
  { className: "h-5 w-24 rounded-full" },
]

export function PeopleSection() {
  const t = useTranslations("dashboard.people")
  const tToolbar = useTranslations("dashboard.people.toolbar")
  const tClassify = useTranslations("dashboard.classify")
  const tOrg = useTranslations("dashboard.organization.general")
  const { orgId } = useOrganization()

  const people = useQuery(api.people.people.listPeople, { orgId })
  // Shared flattened person set + summary (also feeds the Classify tab's
  // remaining-count badge, so the two can never disagree).
  const {
    loading: byTitleLoading,
    people: byTitlePeople,
    summary,
  } = useClassificationSummary(orgId)
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })

  // Mirrors the model pages' progress status (method-panel.tsx): a check +
  // neutral tint when everyone is classified, an amber heads-up while people
  // still await classification.
  const allClassified =
    summary.total > 0 && summary.classified === summary.total

  // Map personId -> assignment source for O(1) per-row badge lookup.
  const assignmentByPerson = useMemo(() => {
    const m = new Map<string, "confirmed" | "suggested">()
    for (const p of byTitlePeople) {
      if (p.currentAssignment !== null) {
        m.set(String(p.personId), p.currentAssignment.levelSource)
      }
    }
    return m
  }, [byTitlePeople])

  const rows = useMemo<PeopleTableRow[]>(() => {
    if (people === undefined || settings === undefined) return []
    const pseudonymize = settings?.pseudonymizeNames ?? false
    return people.map((person) => ({
      personId: String(person.personId),
      name: displayNameFor(person, pseudonymize, (ref) =>
        tOrg("pseudonymTemplate", { ref })
      ),
      gender: person.gender ?? null,
      department: person.department ?? null,
      ftePercent: person.ftePercent ?? null,
      classification: assignmentByPerson.get(String(person.personId)) ?? "none",
    }))
  }, [people, settings, assignmentByPerson, tOrg])

  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
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
      { id: "gender", accessorKey: "gender", enableGlobalFilter: false },
      {
        id: "department",
        accessorFn: (row) => row.department ?? "",
        filterFn: exactString,
        enableGlobalFilter: false,
      },
      { id: "fte", accessorKey: "ftePercent", enableGlobalFilter: false },
      {
        id: "classification",
        accessorKey: "classification",
        filterFn: exactString,
        enableGlobalFilter: false,
      },
    ],
    []
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter, columnFilters, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
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
    getPaginationRowModel: getPaginationRowModel(),
  })

  const shown = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows.map((row) => row.original)
  const pageCount = table.getPageCount()
  const filtersActive = globalFilter.trim() !== "" || columnFilters.length > 0
  const classificationFilter =
    (table.getColumn("classification")?.getFilterValue() as
      | string
      | undefined) ?? "all"
  const departmentFilter =
    (table.getColumn("department")?.getFilterValue() as string | undefined) ??
    "all"

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

  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>{t("columns.name")}</TableHead>
        <TableHead>{t("columns.gender")}</TableHead>
        <TableHead>{t("columns.department")}</TableHead>
        <TableHead>{t("columns.fte")}</TableHead>
        <TableHead>{t("columns.classification")}</TableHead>
      </TableRow>
    </TableHeader>
  )

  const importAction = (
    <Button asChild>
      <Link href="/people/import">
        <HugeiconsIcon
          icon={UserMultiple02Icon}
          size={16}
          strokeWidth={2}
          aria-hidden="true"
        />
        {t("import.title")}
      </Link>
    </Button>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("heading")}
        description={t("description")}
        // Classification now lives on its own header tab (PeopleTabs), so the
        // header keeps a single primary action.
        action={importAction}
      />

      {people === undefined || byTitleLoading || settings === undefined ? (
        // Loading: show a content-shaped skeleton while queries resolve.
        // Reuse the real summary Alert (with its icon) and skeleton only the
        // not-yet-known counts; the toolbar slot gets control-shaped bars, so
        // nothing shifts when the data arrives (same pattern as
        // method-panel.tsx).
        <>
          <div className="flex">
            <Alert className="w-auto">
              <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
              <AlertTitle>
                <Skeleton className="h-5 w-40" />
              </AlertTitle>
            </Alert>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-64 rounded-md" />
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
          <Table>
            {tableHeader}
            <TableSkeleton rows={8} columns={PEOPLE_SKELETON_COLUMNS} />
          </Table>
        </>
      ) : people.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline">
            <Link href="/people/import">{t("import.title")}</Link>
          </Button>
        </Empty>
      ) : (
        <>
          {/* Alert has no warning variant, so the amber tint is a call-site
              override (same pattern as method-panel.tsx / model-builder.tsx).
              The flex wrapper lets w-auto shrink the Alert to its content. */}
          <div className="flex">
            <Alert
              className={cn(
                "w-auto",
                !allClassified &&
                  "border-amber-500/50 text-amber-700 dark:text-amber-400"
              )}
            >
              <HugeiconsIcon
                icon={allClassified ? Tick02Icon : InformationCircleIcon}
                strokeWidth={2}
              />
              <AlertTitle>
                {tClassify("summary", {
                  classified: summary.classified,
                  total: summary.total,
                })}
              </AlertTitle>
            </Alert>
          </div>

          {/* Toolbar: search + the classification and department filters; the
              counter appears only while something is narrowing the table
              (mirrors the role register's toolbar). */}
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
                onChange={(event) => {
                  setGlobalFilter(event.target.value)
                  resetPage()
                }}
                className="w-64 pl-8"
              />
            </div>
            <Select
              value={classificationFilter}
              onValueChange={(value) => {
                table
                  .getColumn("classification")
                  ?.setFilterValue(value === "all" ? undefined : value)
                resetPage()
              }}
            >
              <SelectTrigger aria-label={t("columns.classification")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {tToolbar("classificationAll")}
                </SelectItem>
                <SelectItem value="confirmed">
                  {t("badge.confirmed")}
                </SelectItem>
                <SelectItem value="suggested">{t("badge.pending")}</SelectItem>
                <SelectItem value="none">{t("badge.unclassified")}</SelectItem>
              </SelectContent>
            </Select>
            {departments.length > 0 && (
              <Select
                value={departmentFilter}
                onValueChange={(value) => {
                  table
                    .getColumn("department")
                    ?.setFilterValue(value === "all" ? undefined : value)
                  resetPage()
                }}
              >
                <SelectTrigger aria-label={t("columns.department")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {tToolbar("departmentAll")}
                  </SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filtersActive && (
              <span className="ml-auto text-muted-foreground text-sm tabular-nums">
                {tToolbar("resultCount", { shown, total: rows.length })}
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
            <>
              <Table>
                {tableHeader}
                <TableBody>
                  {pageRows.map((row) => {
                    const badge =
                      row.classification === "confirmed"
                        ? {
                            variant: "default" as const,
                            label: t("badge.confirmed"),
                          }
                        : row.classification === "suggested"
                          ? {
                              variant: "secondary" as const,
                              label: t("badge.pending"),
                            }
                          : {
                              variant: "outline" as const,
                              label: t("badge.unclassified"),
                            }

                    return (
                      <TableRow key={row.personId}>
                        <TableCell className="font-medium">
                          <Link
                            className="underline-offset-4 hover:underline"
                            href={`/people/${row.personId}`}
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.gender != null ? t(`gender.${row.gender}`) : ""}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.department ?? ""}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.ftePercent != null ? `${row.ftePercent}%` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
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
