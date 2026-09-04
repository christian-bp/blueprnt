"use client"

import { SparklesIcon } from "@hugeicons/core-free-icons"
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import { NoMatchesEmpty } from "@/components/no-matches-empty"
import { FrameTable, FrameTableFooter } from "@/components/frame-table"
import { TablePagination } from "@/components/table-pagination"
import { TableSearchField } from "@/components/table-search-field"
import { ariaSort, TableSortButton } from "@/components/table-sort-button"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import {
  type AiUsageOrgRow,
  formatUsdCost,
  kindCounts,
  rowChange,
  sharePct,
} from "@/lib/admin-ai-usage"
import { signedPercentText } from "@/lib/percent"

// The per-org register below the chart (design doc item 3): house
// register-table anatomy exactly (TanStack, a search toolbar, sortable
// headings, table-fixed, pagination past 25 rows, a content-shaped
// skeleton sharing PAGE_SIZE). `outliers` and `totalCostNanos` come from the
// section (the same lib/admin-ai-usage.ts derivations the chart and KPI
// strip read), so all three surfaces read one set of numbers. Owns its own
// toolbar/sort/pagination state and renders the SAME live toolbar in every
// state (people-section's pattern), so a search typed while loading carries
// over instead of being lost when the skeleton swaps for real rows.

export const PAGE_SIZE = 25

interface AiUsageTableRow {
  orgId: string
  orgName: string
  costNanos: number
  callCount: number
  totalTokens: number
  byKind: Record<string, number>
  sharePct: number
  change: ReturnType<typeof rowChange>
  isOutlier: boolean
}

// The table's free-text search: case-insensitive substring over the org
// name. Pure and exported so the match rule is unit-tested without a DOM
// (same precedent as people-section's matchesPersonQuery).
export function matchesOrgUsageQuery(
  row: { orgName: string },
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  return row.orgName.toLowerCase().includes(q)
}

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

type AiUsageFeatures = typeof features

const columnHelper = createColumnHelper<AiUsageFeatures, AiUsageTableRow>()

// change sorts as its signed percent, with a "new" org (no percent to
// compare against) sorting as the most dramatic possible increase: it is the
// row most worth a look, the same reason it gets its own badge instead of a
// fabricated number.
const columns = columnHelper.columns([
  columnHelper.accessor("orgName", { id: "org" }),
  columnHelper.accessor("costNanos", { id: "cost" }),
  columnHelper.accessor("callCount", { id: "calls" }),
  columnHelper.accessor("totalTokens", { id: "tokens" }),
  columnHelper.accessor("sharePct", { id: "share" }),
  columnHelper.accessor(
    (row) =>
      row.change.kind === "pct" ? row.change.pct : Number.POSITIVE_INFINITY,
    { id: "change", enableGlobalFilter: false }
  ),
])

// Skeleton shape per column, mirroring the real row content: a wide bar for
// the org name, narrow numeric bars for cost/calls/tokens/share, a wider bar
// for the kind chips, and a pill for the flagged badge (per-row chrome
// that is identical in SHAPE across rows, so it gets the badge's own rounded
// silhouette rather than a plain bar).
const AI_USAGE_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-40 max-w-full" },
  { className: "w-20" },
  { className: "w-14" },
  { className: "w-16" },
  { className: "w-14" },
  { className: "w-16" },
  { className: "w-36 max-w-full" },
  { className: "h-5 w-16 rounded-full" },
]

// Shared header row for the loaded table and the loading skeleton, so the
// two can never drift apart. `onToggle` is undefined-safe: a sort click
// while loading is a harmless no-op, the same convention as the search
// field staying enabled during loading.
function AiUsageTableHeadings({
  sorting,
  onToggle,
}: {
  sorting: SortingState
  onToggle: (columnId: string) => void
}) {
  const t = useTranslations("dashboard.admin.aiUsage.table")

  function sortedState(columnId: string): false | "asc" | "desc" {
    const entry = sorting.find((s) => s.id === columnId)
    if (entry === undefined) return false
    return entry.desc ? "desc" : "asc"
  }

  function head(id: string, label: string, widthClass: string) {
    const sorted = sortedState(id)
    return (
      <TableHead className={widthClass} aria-sort={ariaSort(sorted)}>
        <TableSortButton
          label={label}
          sorted={sorted}
          onToggle={() => onToggle(id)}
        />
      </TableHead>
    )
  }

  return (
    <TableHeader>
      <TableRow>
        {head("org", t("org"), "")}
        {head("cost", t("cost"), "w-28")}
        {head("calls", t("calls"), "w-32")}
        {head("tokens", t("tokens"), "w-24")}
        {head("share", t("share"), "w-20")}
        <TableHead className="w-40">{t("change")}</TableHead>
        <TableHead className="w-44">{t("kinds")}</TableHead>
        <TableHead className="w-24">{t("flagged")}</TableHead>
      </TableRow>
    </TableHeader>
  )
}

export function AiUsageTable({
  rows,
  outliers,
  totalCostNanos,
}: {
  rows: AiUsageOrgRow[] | undefined
  outliers: Set<string>
  totalCostNanos: number
}) {
  const t = useTranslations("dashboard.admin.aiUsage.table")
  const tPage = useTranslations("dashboard.admin.aiUsage")
  const format = useFormatter()
  const locale = useLocale()

  const data = useMemo<AiUsageTableRow[]>(
    () =>
      (rows ?? []).map((row) => ({
        orgId: row.orgId,
        orgName: row.orgName,
        costNanos: row.costNanos,
        callCount: row.callCount,
        totalTokens: row.totalTokens,
        byKind: row.byKind,
        sharePct: sharePct(row.costNanos, totalCostNanos),
        change: rowChange(row),
        isOutlier: outliers.has(row.orgId),
      })),
    [rows, outliers, totalCostNanos]
  )

  const [globalFilter, setGlobalFilter] = useState("")
  // Default: cost descending (design doc item 3).
  const [sorting, setSorting] = useState<SortingState>([
    { id: "cost", desc: true },
  ])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  const table = useTable({
    features,
    data,
    columns,
    state: { globalFilter, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    enableSortingRemoval: false,
    globalFilterFn: (row, _columnId, value: string) =>
      matchesOrgUsageQuery(row.original, value),
  })

  const shown = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows.map((row) => row.original)
  const pageCount = table.getPageCount()
  const filtersActive = globalFilter.trim() !== ""

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
    resetPage()
  }

  function toggleSort(columnId: string) {
    const column = table.getColumn(columnId)
    const sorted = column?.getIsSorted() ?? false
    column?.toggleSorting(sorted === "asc")
    resetPage()
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <TableSearchField
        placeholder={t("searchPlaceholder")}
        value={globalFilter}
        onChange={(value) => {
          setGlobalFilter(value)
          resetPage()
        }}
      />
      {filtersActive && (
        <span className="ml-auto text-muted-foreground text-sm tabular-nums">
          {shown}/{rows?.length ?? 0}
        </span>
      )}
    </div>
  )

  const loading = rows === undefined

  if (loading) {
    return (
      <FrameTable
        title={tPage("heading")}
        countIcon={SparklesIcon}
        filters={toolbar}
      >
        <Table className="table-fixed">
          <AiUsageTableHeadings sorting={sorting} onToggle={toggleSort} />
          <TableSkeleton rows={PAGE_SIZE} columns={AI_USAGE_SKELETON_COLUMNS} />
        </Table>
      </FrameTable>
    )
  }

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{tPage("heading")}</EmptyTitle>
          <EmptyDescription>{tPage("empty")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      <FrameTable
        title={tPage("heading")}
        count={shown}
        countIcon={SparklesIcon}
        filters={toolbar}
        footer={
          shown > 0 && pageCount > 1 ? (
            <FrameTableFooter
              page={pagination.pageIndex}
              pageSize={PAGE_SIZE}
              total={shown}
              pager={
                <TablePagination
                  page={pagination.pageIndex}
                  pageCount={pageCount}
                  hasMore={false}
                  canPrev={table.getCanPreviousPage()}
                  canNext={table.getCanNextPage()}
                  onPrev={() => table.previousPage()}
                  onNext={() => table.nextPage()}
                  onSelect={(page0) => table.setPageIndex(page0)}
                  previousLabel={t("previous")}
                  nextLabel={t("next")}
                />
              }
            />
          ) : undefined
        }
      >
        {shown === 0 ? (
          // Inside the panel so the search above stays usable to widen an
          // over-narrowed filter back out.
          <NoMatchesEmpty
            title={tPage("heading")}
            description={t("noMatches")}
            clearLabel={t("clearFilters")}
            onClear={clearFilters}
          />
        ) : (
          <Table className="table-fixed">
            <AiUsageTableHeadings sorting={sorting} onToggle={toggleSort} />
            <TableBody>
              {pageRows.map((row) => {
                const kinds = kindCounts(row.byKind)
                return (
                  <TableRow key={row.orgId}>
                    <TableCell className="truncate font-medium">
                      {row.orgName}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatUsdCost(row.costNanos, locale)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {format.number(row.callCount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {format.number(row.totalTokens)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {format.number(row.sharePct / 100, {
                        style: "percent",
                        maximumFractionDigits: 1,
                      })}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {row.change.kind === "new" ? (
                        <Badge variant="secondary">{t("new")}</Badge>
                      ) : (
                        signedPercentText(row.change.pct, format)
                      )}
                    </TableCell>
                    <TableCell className="truncate">
                      {kinds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {kinds.map((k) => (
                            <Badge
                              key={k.kind}
                              variant="outline"
                              className="whitespace-nowrap"
                            >
                              {k.kind} {format.number(k.count)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.isOutlier && (
                        <Badge className="border-transparent bg-flag-elevated/10 text-flag-elevated dark:bg-flag-elevated/20">
                          {t("flagged")}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </FrameTable>
      {/* The outlier rule, in words, so the flagged badge is never a
          mystery. Sits with the table rather than the chart above it
          (the flags live here): the chart no longer colors by outlier
          status, it carries period context only. */}
      {shown > 0 && (
        <p className="text-muted-foreground text-sm">{t("flaggedCaption")}</p>
      )}
    </div>
  )
}
