"use client"

import { fteTotalMonthlyComp } from "@workspace/constants"
import { diffVsMenMean } from "@workspace/core"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { genderKeyStyle } from "@/components/gender-mark"
import { TablePagination } from "@/components/table-pagination"
import { ariaSort, TableSortButton } from "@/components/table-sort-button"
import { useMoney } from "@/hooks/use-money"
import { percentText } from "@/lib/percent"
import {
  type GapGroup,
  groupMembers,
  type PayMappingSnapshotRow,
  primaryGapMetric,
} from "./pay-mapping-gap-types"

// One rendered member row: FTE-adjusted values (comparisons are always
// like-for-like) plus the diff against the men's mean on the group's
// PRIMARY metric (base salary, or total comp for a tccDriven group), so the
// columns always agree with the group's own finding sentence and dot plot.
export interface MemberRow {
  name: string
  erased: boolean
  woman: boolean
  base: number
  tcc: number
  ftePercent: number | null
  diffKr: number | null
  diffPct: number | null
}

// Pure: members -> rendered rows. Exported for direct unit testing.
export function buildMemberRows(
  members: PayMappingSnapshotRow[],
  group: Pick<GapGroup, "base" | "tcc" | "tccDriven">
): MemberRow[] {
  const menMean = primaryGapMetric(group).menMean
  return members.map((row) => {
    const base = fteTotalMonthlyComp(row.basicMonthly ?? 0, [], row.ftePercent)
    const tcc = fteTotalMonthlyComp(
      row.basicMonthly ?? 0,
      row.components,
      row.ftePercent
    )
    const primary = group.tccDriven ? tcc : base
    const diff = menMean === null ? null : diffVsMenMean(primary, menMean)
    return {
      name: row.displayName,
      erased: row.erased,
      woman: row.gender === "Kvinna",
      base,
      tcc,
      ftePercent: row.ftePercent ?? null,
      diffKr: diff?.kr ?? null,
      diffPct: diff?.pct ?? null,
    }
  })
}

const PAGE_SIZE = 25

// v9 registers features explicitly (same idiom as the people register).
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

type MemberFeatures = typeof features

const columnHelper = createColumnHelper<MemberFeatures, MemberRow>()

// Column defs feed the sort/pagination pipeline only; cells render from
// row.original below. `woman` sorts false-last ascending, so the default
// ascending gender sort puts the women on top (Iteration 2 note 3).
const columns = columnHelper.columns([
  columnHelper.accessor("name", { id: "name" }),
  columnHelper.accessor((row) => (row.woman ? 0 : 1), { id: "gender" }),
  columnHelper.accessor("base", { id: "base" }),
  columnHelper.accessor("tcc", { id: "tcc" }),
  columnHelper.accessor((row) => row.diffKr ?? 0, { id: "diffKr" }),
])

// The equal-work detail view's individual table (Iteration 2 note 3): one
// row per frozen member with FTE-adjusted base salary and total comp, plus
// the signed difference against the men's mean on the group's primary
// metric. Default sort: the women first, lowest paid on top; every heading
// re-sorts freely. Client pagination past 25 rows.
export function GroupMemberTable({
  group,
  rows,
  currency,
}: {
  group: GapGroup
  rows: PayMappingSnapshotRow[]
  currency: string
}) {
  const t = useTranslations("dashboard.payMapping.detail")
  const tGender = useTranslations("dashboard.people.gender")
  const tToolbar = useTranslations("dashboard.payMapping.toolbar")
  const format = useFormatter()
  const money = useMoney()

  const data = useMemo(
    () => buildMemberRows(groupMembers(rows, group) ?? [], group),
    [rows, group]
  )

  // Default order: women first, then lowest base salary on top.
  const [sorting, setSorting] = useState<SortingState>([
    { id: "gender", desc: false },
    { id: "base", desc: false },
  ])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    // The table always has a sort (default above): a heading toggles between
    // ascending and descending, never back to unsorted.
    enableSortingRemoval: false,
  })

  const pageRows = table.getRowModel().rows.map((row) => row.original)
  const pageCount = table.getPageCount()

  // First click sorts ascending, the next flips to descending; a sort change
  // resets to the first page (table anatomy). The state is REPLACED with the
  // clicked column (never merged): the default is a two-column sort (gender,
  // then base), and toggleSorting would only flip that entry in place.
  function sortableHead(id: string, label: string, widthClass?: string) {
    const column = table.getColumn(id)
    const sorted = column?.getIsSorted() ?? false
    return (
      <TableHead
        className={widthClass ? `${widthClass} text-right` : undefined}
        aria-sort={ariaSort(sorted)}
      >
        <TableSortButton
          label={label}
          sorted={sorted}
          onToggle={() => {
            setSorting([{ id, desc: sorted === "asc" }])
            setPagination((p) =>
              p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }
            )
          }}
        />
      </TableHead>
    )
  }

  // Signed like the source data: negative = below the men's mean.
  const diffText = (row: MemberRow) => ({
    kr:
      row.diffKr === null ? "-" : money(row.diffKr, currency, { signed: true }),
    pct:
      row.diffPct === null
        ? "-"
        : `${row.diffPct < 0 ? "-" : row.diffPct > 0 ? "+" : ""}${percentText(row.diffPct, format)}`,
  })

  return (
    <div className="space-y-2">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            {sortableHead("name", t("columns.name"))}
            {sortableHead("gender", t("columns.gender"), "w-24")}
            {sortableHead("base", t("columns.basePay"), "w-32")}
            {sortableHead("tcc", t("columns.totalComp"), "w-32")}
            {sortableHead("diffKr", t("columns.diffKr"), "w-32")}
            <TableHead className="w-24 text-right">
              {t("columns.diffPct")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Index keys: the frozen member list never reorders identity-wise,
              and the rows carry no id (erased rows share one tombstone name,
              so a name key would collide). */}
          {pageRows.map((row, index) => {
            const diff = diffText(row)
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: frozen rows, no stable id on the wire
              <TableRow key={index}>
                <TableCell className="truncate font-medium">
                  {row.erased ? t("erased") : row.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-[2px]"
                      style={genderKeyStyle(row.woman ? "women" : "men")}
                    />
                    {tGender(row.woman ? "Kvinna" : "Man")}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(row.base, currency)}
                  {row.ftePercent !== null && row.ftePercent < 100 && (
                    <span className="text-muted-foreground">
                      {" "}
                      {t("fteShare", { fte: row.ftePercent })}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(row.tcc, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {diff.kr}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {diff.pct}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {pageCount > 1 && (
        <TablePagination
          page={pagination.pageIndex}
          pageCount={pageCount}
          hasMore={false}
          canPrev={table.getCanPreviousPage()}
          canNext={table.getCanNextPage()}
          onPrev={() => table.previousPage()}
          onNext={() => table.nextPage()}
          onSelect={(page0) =>
            setPagination((p) => ({ ...p, pageIndex: page0 }))
          }
          previousLabel={tToolbar("previous")}
          nextLabel={tToolbar("next")}
        />
      )}
    </div>
  )
}
