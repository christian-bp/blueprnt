"use client"

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
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
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { TableSearchField } from "@/components/table-search-field"
import { useMoney } from "@/hooks/use-money"

// Structural subset of getPayMappingRunBySlug's per-person row (the frozen
// snapshot). currency/payYear are only present once a pay record was frozen
// (see payMapping/runs.ts).
export interface PayMappingSnapshotRow {
  displayName: string
  erased: boolean
  gender: "Man" | "Kvinna"
  roleTitle: string
  trackKey: string
  level: string
  band: number | null
  basicMonthly: number | null
  currency?: string
  payYear?: number
}

// Structural subset of getPayMappingRunBySlug's return shape, kept local
// (like RoleProfile in role-profile-card.tsx) rather than importing the
// generated query type.
export interface PayMappingRunDetail {
  runId: Id<"payMappingRuns">
  label: string
  status: "active" | "paused" | "underReview" | "completed"
  referenceDate: number
  initiatedBy: string
  initiatedByName: string
  populationCount: number
  withPayCount: number
  unclassifiedExcludedCount: number
  populationNote: string | null
  rows: PayMappingSnapshotRow[]
}

// The frozen-population table's free-text search: case-insensitive substring
// over the person's name and role title. For an erased row the searchable
// "name" is the erased label, never the tombstoned displayName (so an erased
// row is found by the erased-label text, not a raw name). Pure and exported
// so the matching rule is unit-tested without a DOM (same pattern as
// matchesPayMappingQuery in pay-mappings-section).
export function matchesSnapshotRowQuery(
  row: Pick<PayMappingSnapshotRow, "displayName" | "erased" | "roleTitle">,
  erasedLabel: string,
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  const name = row.erased ? erasedLabel : row.displayName
  return [name, row.roleTitle].some((field) => field.toLowerCase().includes(q))
}

const PAGE_SIZE = 25

// The kartlaggning (pay mapping) detail: a frozen-population survey. Read-only
// throughout, since the whole point of the snapshot is that it never changes
// after the freeze (ADR-0011). Renders the run's metadata and every frozen
// row.
export function PayMappingDetail({
  run,
}: {
  orgId: string
  run: PayMappingRunDetail
}) {
  const t = useTranslations("dashboard.payMapping")
  const tToolbar = useTranslations("dashboard.payMapping.toolbar")
  const tHelp = useTranslations("dashboard.help")
  const tPeople = useTranslations("dashboard.people")
  const format = useFormatter()
  const money = useMoney()

  const erasedLabel = t("detail.erased")

  const [globalFilter, setGlobalFilter] = useState("")
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  // A single column carries the filter pipeline: the header row is the
  // static tableHeader below and cells render from row.original, so no other
  // column defs are needed here (mirrors pay-mappings-section).
  const columns = useMemo<ColumnDef<PayMappingSnapshotRow>[]>(
    () => [{ id: "name", accessorKey: "displayName" }],
    []
  )

  const table = useReactTable({
    data: run.rows,
    columns,
    state: { globalFilter, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    // Auto-resets setState on data-identity changes and can loop on
    // unrelated re-renders (see the GROUPING note in roles-table.tsx); the
    // toolbar's search handler resets the page explicitly instead.
    autoResetPageIndex: false,
    // The matcher reads the whole row, so it runs on the name column only
    // (the only column, which stays global-filterable by default). No
    // getSortedRowModel: the frozen population keeps its freeze order.
    globalFilterFn: (row, _columnId, value: string) =>
      matchesSnapshotRowQuery(row.original, erasedLabel, value),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const shown = table.getFilteredRowModel().rows.length
  const pageRows = table.getRowModel().rows
  const pageCount = table.getPageCount()
  const filtersActive = globalFilter.trim() !== ""

  // A search change resets to the first page; this clamp covers the
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

  function clearSearch() {
    setGlobalFilter("")
    resetPage()
  }

  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>{t("detail.columns.name")}</TableHead>
        <TableHead className="w-28">{t("detail.columns.gender")}</TableHead>
        <TableHead className="w-48">{t("detail.columns.role")}</TableHead>
        <TableHead className="w-20">{t("detail.columns.band")}</TableHead>
        <TableHead className="w-20">{t("detail.columns.level")}</TableHead>
        <TableHead className="w-36">{t("detail.columns.salary")}</TableHead>
      </TableRow>
    </TableHeader>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <PageBreadcrumb
            segments={[
              { label: t("heading"), href: "/pay-mappings" },
              { label: run.label },
            ]}
          />
        }
        title={run.label}
        titleAdornment={
          <HelpMorphButton label={tHelp("payMappingLabel")}>
            {tHelp("payMappingBody")}
          </HelpMorphButton>
        }
      />

      <Card>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t("table.label")}</dt>
              <dd>{run.label}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t("detail.referenceDate")}
              </dt>
              <dd>
                {format.dateTime(new Date(run.referenceDate), {
                  dateStyle: "medium",
                })}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("table.status")}</dt>
              {/* min-h-5: the inline-flex Badge would otherwise inflate the
                  line box beyond a plain text value's height. */}
              <dd className="flex min-h-5 items-center">
                <Badge variant="outline">{t(`status.${run.status}`)}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t("table.responsible")}
              </dt>
              <dd>{run.initiatedByName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t("detail.population")}
              </dt>
              <dd>{run.populationCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("detail.withPay")}</dt>
              <dd>{run.withPayCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("detail.excluded")}</dt>
              <dd>{run.unclassifiedExcludedCount}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {run.populationNote !== null ? (
        <p className="text-muted-foreground text-sm">{run.populationNote}</p>
      ) : null}

      {run.rows.length === 0 ? (
        <Table className="table-fixed">{tableHeader}</Table>
      ) : (
        // space-y-4 (not the page's space-y-6) so the toolbar-to-table gap
        // matches the pay-mappings list table.
        <div className="space-y-4">
          {/* Toolbar: search only (there is no other filter here); the
              counter appears only while a search is narrowing the table
              (mirrors the pay-mappings list's toolbar). */}
          <div className="flex flex-wrap items-center gap-2">
            <TableSearchField
              placeholder={t("detail.searchPlaceholder")}
              value={globalFilter}
              onChange={(value) => {
                setGlobalFilter(value)
                resetPage()
              }}
            />
            {filtersActive && (
              <span className="ml-auto text-muted-foreground text-sm tabular-nums">
                {tToolbar("resultCount", { shown, total: run.rows.length })}
              </span>
            )}
          </div>

          {shown === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("detail.population")}</EmptyTitle>
                <EmptyDescription>{tToolbar("noMatches")}</EmptyDescription>
              </EmptyHeader>
              <Button type="button" variant="outline" onClick={clearSearch}>
                {tToolbar("clearFilters")}
              </Button>
            </Empty>
          ) : (
            <>
              <Table className="table-fixed">
                {tableHeader}
                <TableBody>
                  {pageRows.map((row) => {
                    const snapshot = row.original
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="truncate font-medium">
                          {snapshot.erased ? erasedLabel : snapshot.displayName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tPeople(`gender.${snapshot.gender}`)}
                        </TableCell>
                        <TableCell className="truncate text-muted-foreground">
                          {snapshot.roleTitle}
                        </TableCell>
                        <TableCell>
                          <div className="flex min-h-5 items-center">
                            {snapshot.band !== null ? (
                              <Badge>{snapshot.band}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {snapshot.level}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {snapshot.basicMonthly !== null &&
                          snapshot.currency !== undefined
                            ? money(snapshot.basicMonthly, snapshot.currency)
                            : "-"}
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
        </div>
      )}
    </div>
  )
}
