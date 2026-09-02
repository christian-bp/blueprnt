"use client"

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
import { GenderDotIcon } from "@/components/gender-mark"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { TablePagination } from "@/components/table-pagination"
import { TableSearchField } from "@/components/table-search-field"
import { ariaSort, TableSortButton } from "@/components/table-sort-button"
import { useMoney } from "@/hooks/use-money"
import { percentText } from "@/lib/percent"
import {
  DocumentationBadges,
  documentationFor,
  DocumentationMenu,
} from "./documentation-controls"
import {
  type ActionTargetWire,
  fteBaseMonthly,
  fteTotalMonthly,
  type GapGroup,
  membersOf,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  type PayMappingSnapshotRow,
  primaryGapMetric,
} from "./pay-mapping-gap-types"

// One rendered member row: FTE-adjusted values (comparisons are always
// like-for-like) plus the diff against the men's mean on the group's
// PRIMARY metric (total comp, or base salary for a baseDriven group), so
// the columns always agree with the group's own badges and dot plot.
export interface MemberRow {
  personPublicId: string
  name: string
  erased: boolean
  woman: boolean
  trackKey: string
  roleTitle: string
  seniority: string
  base: number
  tcc: number
  ftePercent: number | null
  diffKr: number | null
  diffPct: number | null
}

// Pure: members -> rendered rows. Exported for direct unit testing.
export function buildMemberRows(
  members: PayMappingSnapshotRow[],
  group: Pick<GapGroup, "base" | "tcc" | "baseDriven">
): MemberRow[] {
  const menMean = primaryGapMetric(group).menMean
  return members.map((row) => {
    const base = fteBaseMonthly(row)
    const tcc = fteTotalMonthly(row)
    const primary = group.baseDriven ? base : tcc
    const diff = menMean === null ? null : diffVsMenMean(primary, menMean)
    return {
      personPublicId: row.personPublicId,
      name: row.displayName,
      erased: row.erased,
      woman: row.gender === "Kvinna",
      trackKey: row.trackKey,
      roleTitle: row.roleTitle,
      seniority: row.seniority,
      base,
      tcc,
      ftePercent: row.ftePercent ?? null,
      diffKr: diff?.kr ?? null,
      diffPct: diff?.pct ?? null,
    }
  })
}

// Five, not the registers' 25. This table opens inside a disclosure that sits
// between the plot and the documentation form, so its height is what pushes
// both off the screen: a 30-person group at 25 rows a page did exactly that,
// and the reader had to scroll back up to the chart they opened it against.
// Five keeps the step's shape whatever the group's size, and the search is
// how a reader reaches a particular person instead of paging to them.
const PAGE_SIZE = 5

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
  columnHelper.accessor("trackKey", { id: "track" }),
  columnHelper.accessor((row) => `${row.roleTitle} ${row.seniority}`, {
    id: "role",
  }),
  columnHelper.accessor("base", { id: "base" }),
  columnHelper.accessor("tcc", { id: "tcc" }),
  columnHelper.accessor((row) => row.diffKr ?? 0, { id: "diffKr" }),
])

// The individual member table (Iteration 2 notes 3-4): one row per frozen
// member with FTE-adjusted base salary and total comp, plus the signed
// difference against the men's mean on the group's primary metric. Default
// sort: the women first, lowest total comp on top; every heading re-sorts
// freely.
// Client pagination at PAGE_SIZE rows, with a name search above the table.
export function GroupMemberTable({
  group,
  rows,
  currency,
  documentation,
}: {
  group: GapGroup
  rows: PayMappingSnapshotRow[]
  currency: string
  // Omitted by surfaces that render the table read-only (the deep-dive's
  // own affordances differ); present, the trailing column carries each
  // member's documentation badge + "..." menu.
  documentation?: {
    runId: Id<"payMappingRuns">
    scope: "equalWork" | "equivalentWork"
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    locked: boolean
  }
}) {
  const t = useTranslations("dashboard.payMapping.detail")
  const tGender = useTranslations("dashboard.people.gender")
  const tToolbar = useTranslations("dashboard.payMapping.toolbar")
  const format = useFormatter()
  const money = useMoney()

  const data = useMemo(
    () => buildMemberRows(membersOf(rows, group), group),
    [rows, group]
  )

  // Free-text over the member's own name, which is the only thing that
  // distinguishes rows here: every member of an equal-work group shares its
  // role and seniority by definition, so there is nothing else to filter on.
  // An erased member matches the tombstone, which is what their row shows.
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === "") return data
    return data.filter((row) => row.name.toLowerCase().includes(needle))
  }, [data, query])

  // Default order: women first, then lowest total comp (the primary
  // measure) on top.
  const [sorting, setSorting] = useState<SortingState>([
    { id: "gender", desc: false },
    { id: "tcc", desc: false },
  ])
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  const table = useTable({
    features,
    data: filtered,
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
  // then total comp), and toggleSorting would only flip that entry in place.
  function sortableHead(id: string, label: string, className?: string) {
    const column = table.getColumn(id)
    const sorted = column?.getIsSorted() ?? false
    return (
      <TableHead className={className} aria-sort={ariaSort(sorted)}>
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
      {/* The toolbar: a search, and the narrowed count beside it. The count
          only appears while the search is narrowing, so a group that fits on
          one page carries no chrome it does not need (register anatomy). */}
      <div className="flex items-center gap-2">
        <TableSearchField
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(value) => {
            setQuery(value)
            // A narrowed list is shorter than the page the reader is on.
            setPagination((p) =>
              p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }
            )
          }}
          className="w-full sm:w-56"
        />
        {query.trim() !== "" && (
          <span className="ml-auto shrink-0 text-muted-foreground text-sm tabular-nums">
            {t("resultCount", { shown: filtered.length, total: data.length })}
          </span>
        )}
      </div>
      {/* Six columns do not fit the analysis pane's width, and table-fixed
          answers that by collapsing the one flexible column (the name) to
          nothing. The table keeps a readable minimum and scrolls inside its
          own container instead, per the wide-content rule. */}
      <div className="overflow-x-auto">
        <Table className="min-w-[46rem] table-fixed">
          <TableHeader>
            <TableRow>
              {sortableHead("name", t("columns.name"))}
              {sortableHead("gender", t("columns.gender"), "w-20")}
              {sortableHead("base", t("columns.basePay"), "w-28 text-right")}
              {sortableHead("tcc", t("columns.totalComp"), "w-28 text-right")}
              {/* One combined difference column: two separate ones pushed
                  the documentation control past the analysis pane's visible
                  width, and the kr and percent read better together. */}
              {sortableHead(
                "diffKr",
                t("columns.diffVsMen"),
                "w-40 text-right"
              )}
              {documentation !== undefined && (
                <TableHead className="w-28">
                  {t("columns.documentation")}
                </TableHead>
              )}
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
                      {/* The POINT mark (triangle / circle), because this
                          table is the evidence behind the scatter directly
                          above it and sits under the same badges. It drew the
                          area charts' key here, a solid or hatched square, so
                          one surface showed the same person as a square in the
                          table and a circle in the plot. */}
                      <span aria-hidden="true" className="size-2.5 shrink-0">
                        <GenderDotIcon series={row.woman ? "women" : "men"} />
                      </span>
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
                    {diff.pct === "-" ? "" : ` (${diff.pct})`}
                  </TableCell>
                  {documentation !== undefined && (
                    <TableCell>
                      {/* Fixed-height flex slot: a row gaining documentation
                        must never reflow its neighbours (layout-shift rule),
                        and an inline-flex control directly in a cell would
                        inflate the line box (skeleton-parity rule). */}
                      <div className="flex h-7 items-center justify-between gap-1">
                        {(() => {
                          const target: ActionTargetWire = {
                            kind: "person",
                            scope: documentation.scope,
                            groupKey: group.key,
                            personPublicId: row.personPublicId,
                          }
                          const own = documentationFor(
                            target,
                            documentation.actions,
                            documentation.notes
                          )
                          return (
                            <>
                              <DocumentationBadges
                                actions={own.actions}
                                notes={own.notes}
                              />
                              <DocumentationMenu
                                runId={documentation.runId}
                                target={target}
                                targetLabel={
                                  row.erased ? t("erased") : row.name
                                }
                                actions={own.actions}
                                notes={own.notes}
                                currency={currency}
                                locked={documentation.locked}
                                erasedTarget={row.erased}
                              />
                            </>
                          )
                        })()}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {/* A search that matches nobody leaves an empty table with its
                headings, which reads as a load that failed. One row saying so,
                inside the table, so the columns stay put. */}
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={documentation === undefined ? 5 : 6}
                  className="text-muted-foreground"
                >
                  {t("noMatches")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
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
