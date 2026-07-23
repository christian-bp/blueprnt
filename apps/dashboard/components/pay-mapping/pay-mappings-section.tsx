"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
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
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
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
import { useQuery } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { PayMappingRunActions } from "@/components/pay-mapping/pay-mapping-run-actions"
import { StartPayMappingDialog } from "@/components/pay-mapping/start-pay-mapping-dialog"
import { TablePagination } from "@/components/table-pagination"
import { TableSearchField } from "@/components/table-search-field"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { SPRING } from "@/lib/motion"
import { onSelectValue } from "@/lib/select"

// The pay mappings (kartlaggningar) list: a searchable, paginated data table
// (the shadcn data table recipe on @tanstack/react-table, same as the people
// and role registers), but NOT sortable: runs are always newest first (the
// query's own order; getCoreRowModel with no getSortedRowModel preserves it),
// because this is a chronological timeline like the audit log, not a
// sortable register.

// One table row for a pay-mapping run.
export interface PayMappingRunRow {
  runId: string
  slug: string
  label: string
  status: "active" | "paused" | "underReview" | "completed"
  referenceDate: number
  initiatedByName: string
  populationCount: number
}

// The pay-mappings list's free-text search: case-insensitive substring over
// the run's name and the operator who started it. Pure and exported so the
// matching rule is unit-tested without a DOM (same pattern as
// matchesPersonQuery in people-section).
export function matchesPayMappingQuery(
  run: { label: string; initiatedByName: string },
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  return [run.label, run.initiatedByName].some((field) =>
    field.toLowerCase().includes(q)
  )
}

const PAGE_SIZE = 25

// Exact-match column filter (mirrors the department/gender/fte columns in
// people-section): the status filter narrows on the group value below, not
// a substring.
const exactString = (
  row: Row<PayMappingRunRow>,
  columnId: string,
  value: string
) => row.getValue<string>(columnId) === value

// Skeleton shape per column, mirroring the real row content (name link, a
// medium date, a status pill, a count, a started-by name, a row-actions
// trigger) so the loading table has the same silhouette as the loaded one.
// The trigger is per-row chrome identical for every row, not data, so it
// renders as its real (muted, non-interactive) icon rather than a bar.
const PAY_MAPPING_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-48 max-w-full" },
  { className: "w-24" },
  { className: "h-5 w-16 rounded-full" },
  { className: "w-10" },
  { className: "w-32 max-w-full" },
  {
    content: (
      <span className="flex size-9 shrink-0 items-center justify-end text-muted-foreground/50">
        <HugeiconsIcon
          icon={MoreVerticalIcon}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>
    ),
  },
]

export function PayMappingsSection() {
  const t = useTranslations("dashboard.payMapping")
  const tToolbar = useTranslations("dashboard.payMapping.toolbar")
  const tHelp = useTranslations("dashboard.help")
  const format = useFormatter()
  const { orgId } = useOrganization()

  const runs = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  const loading = runs === undefined

  const rows = useMemo<PayMappingRunRow[]>(() => {
    if (runs === undefined) return []
    return runs.map((run) => ({
      runId: String(run.runId),
      slug: run.slug,
      label: run.label,
      status: run.status,
      referenceDate: run.referenceDate,
      initiatedByName: run.initiatedByName,
      populationCount: run.populationCount,
    }))
  }, [runs])

  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  // The label column carries the search pipeline; statusGroup is a
  // filter-only column (no visible header of its own, the real "Status"
  // column renders from row.original below) narrowed by the toolbar's status
  // Select. Mirrors people-section: columns exist for the filter/pagination
  // machinery, not for rendering.
  const columns = useMemo<ColumnDef<PayMappingRunRow>[]>(
    () => [
      { id: "label", accessorKey: "label" },
      {
        id: "statusGroup",
        accessorFn: (row) =>
          row.status === "completed" ? "completed" : "notCompleted",
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
    // Auto-resets setState on data-identity changes and can loop on
    // unrelated re-renders (see the GROUPING note in roles-table.tsx); the
    // toolbar's handlers reset the page explicitly instead.
    autoResetPageIndex: false,
    // The matcher reads the whole row, so it runs on the label column only
    // (statusGroup opts out of global filtering).
    globalFilterFn: (row, _columnId, value: string) =>
      matchesPayMappingQuery(row.original, value),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const shown = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows.map((row) => row.original)
  const pageCount = table.getPageCount()
  const filtersActive = globalFilter.trim() !== "" || columnFilters.length > 0
  const statusFilter =
    (table.getColumn("statusGroup")?.getFilterValue() as string | undefined) ??
    "all"

  // A search or filter change resets to the first page; this clamp covers
  // the remaining case where a reactive data update shrinks the filtered set
  // while a later page is open.
  useEffect(() => {
    if (pagination.pageIndex > 0 && pagination.pageIndex >= pageCount) {
      setPagination((p) => ({ ...p, pageIndex: Math.max(0, pageCount - 1) }))
    }
  }, [pageCount, pagination.pageIndex])

  function resetPage() {
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  }

  // Shared handler for the toolbar's status Select: "all" clears the filter.
  function setColumnFilter(columnId: string, value: string) {
    table
      .getColumn(columnId)
      ?.setFilterValue(value === "all" ? undefined : value)
    resetPage()
  }

  function clearFilters() {
    setGlobalFilter("")
    setColumnFilters([])
    resetPage()
  }

  const startDialog = (
    <StartPayMappingDialog orgId={orgId} triggerLabel={t("startCta")} />
  )

  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>{t("table.label")}</TableHead>
        <TableHead className="w-36">{t("table.referenceDate")}</TableHead>
        <TableHead className="w-28">{t("table.status")}</TableHead>
        <TableHead className="w-20">{t("table.population")}</TableHead>
        <TableHead className="w-40">{t("table.responsible")}</TableHead>
        {/* No header text: a trailing row-actions trigger, like the
            expand-chevron column in classify-title-table. */}
        <TableHead className="w-14" />
      </TableRow>
    </TableHeader>
  )

  // Toolbar: search + the status filter (Not completed / Completed); the
  // counter appears only while something is narrowing the table (mirrors the
  // people and role registers' toolbar). The table state lives in this
  // component, so the SAME live toolbar (including the status Select, always
  // showing "All") renders during loading: static chrome is never a skeleton
  // bar, and it needs no disabling since a change typed/picked during loading
  // carries over.
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
      <Select
        items={{
          all: tToolbar("statusAll"),
          notCompleted: tToolbar("statusNotCompleted"),
          completed: t("status.completed"),
        }}
        value={statusFilter}
        onValueChange={onSelectValue((value: string) =>
          setColumnFilter("statusGroup", value)
        )}
      >
        <SelectTrigger aria-label={t("table.status")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{tToolbar("statusAll")}</SelectItem>
          <SelectItem value="notCompleted">
            {tToolbar("statusNotCompleted")}
          </SelectItem>
          <SelectItem value="completed">{t("status.completed")}</SelectItem>
        </SelectContent>
      </Select>
      {filtersActive && (
        <span className="ml-auto text-muted-foreground text-sm tabular-nums">
          {tToolbar("resultCount", { shown, total: rows.length })}
        </span>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("heading")}
        description={t("description")}
        action={startDialog}
      />

      {loading ? (
        // Loading: the live toolbar over a content-shaped table skeleton,
        // sized to one full page (PAGE_SIZE) so the table does not grow
        // when the first page of data arrives.
        <>
          {toolbar}
          <Table className="table-fixed">
            {tableHeader}
            <TableSkeleton
              rows={PAGE_SIZE}
              columns={PAY_MAPPING_SKELETON_COLUMNS}
            />
          </Table>
        </>
      ) : runs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <div className="flex items-center gap-1.5">
              <EmptyTitle>{t("heading")}</EmptyTitle>
              <HelpMorphButton label={tHelp("payMappingLabel")}>
                {tHelp("payMappingBody")}
              </HelpMorphButton>
            </div>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          {startDialog}
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
                  <AnimatePresence initial={false}>
                    {pageRows.map((run) => (
                      <motion.tr
                        key={run.runId}
                        layout="position"
                        transition={SPRING}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      >
                        <TableCell className="font-medium">
                          <Link
                            className="truncate underline-offset-4 hover:underline"
                            href={`/pay-mappings/${run.slug}`}
                          >
                            {run.label}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format.dateTime(new Date(run.referenceDate), {
                            dateStyle: "medium",
                          })}
                        </TableCell>
                        <TableCell>
                          {/* Block flex wrapper: an inline-flex Badge on the
                              text baseline would inflate the line box (see
                              the people table's badge cell), desyncing this
                              row's height from the skeleton's. */}
                          <div className="flex min-h-5 items-center">
                            <Badge variant="outline">
                              {t(`status.${run.status}`)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {run.populationCount}
                        </TableCell>
                        <TableCell className="truncate text-muted-foreground">
                          {run.initiatedByName}
                        </TableCell>
                        <TableCell>
                          {/* Block flex wrapper: the trigger never sits bare
                              in the cell (see the status badge above). */}
                          <div className="flex justify-end">
                            <PayMappingRunActions
                              orgId={orgId}
                              runId={run.runId as Id<"payMappingRuns">}
                              label={run.label}
                            />
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
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
