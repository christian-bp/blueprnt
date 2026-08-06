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
import { Alert02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { genderKeyStyle } from "@/components/gender-mark"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { TablePagination } from "@/components/table-pagination"
import { TrackBadge } from "@/components/track-badge"
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
// PRIMARY metric (base salary, or total comp for a tccDriven group), so the
// columns always agree with the group's own finding sentence and dot plot.
// trackKey/roleTitle/seniority render only in the level variant, where the
// members span roles; crossLevel marks a woman with at least one tvärnivå
// pair (derived by the caller from the run's cross-level cases).
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
  crossLevel: boolean
}

// Pure: members -> rendered rows. Exported for direct unit testing.
export function buildMemberRows(
  members: PayMappingSnapshotRow[],
  group: Pick<GapGroup, "base" | "tcc" | "tccDriven">,
  options?: { crossLevelFlagged?: ReadonlySet<string> | undefined }
): MemberRow[] {
  const menMean = primaryGapMetric(group).menMean
  return members.map((row) => {
    const base = fteBaseMonthly(row)
    const tcc = fteTotalMonthly(row)
    const primary = group.tccDriven ? tcc : base
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
      crossLevel: options?.crossLevelFlagged?.has(row.personPublicId) ?? false,
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
// ascending gender sort puts the women on top (Iteration 2 note 3). The
// track/role accessors exist in both variants (unused sort targets cost
// nothing); only the level variant renders their headings.
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
// sort: the women first, lowest paid on top; every heading re-sorts freely.
// Client pagination past 25 rows. The "level" variant (the per-level
// likvärdigt analysis) spans roles, so it adds track and role columns and a
// tvärnivå flag on affected women.
export function GroupMemberTable({
  group,
  rows,
  currency,
  documentation,
  variant = "group",
  crossLevelFlagged,
  memberTarget,
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
  variant?: "group" | "level"
  // Women with at least one tvärnivå pair (by personPublicId): the level
  // variant marks them so the flag reads in the same table as the pay data.
  crossLevelFlagged?: ReadonlySet<string>
  // Overrides the per-row documentation target (the level variant anchors a
  // member to their own SHOWN equal-work group). Returning null renders the
  // row without a menu (the slot keeps its height).
  memberTarget?: (row: MemberRow) => ActionTargetWire | null
}) {
  const t = useTranslations("dashboard.payMapping.detail")
  const tGender = useTranslations("dashboard.people.gender")
  const tToolbar = useTranslations("dashboard.payMapping.toolbar")
  const format = useFormatter()
  const money = useMoney()

  const data = useMemo(
    () => buildMemberRows(membersOf(rows, group), group, { crossLevelFlagged }),
    [rows, group, crossLevelFlagged]
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
      {/* Six columns do not fit the analysis pane's width, and table-fixed
          answers that by collapsing the one flexible column (the name) to
          nothing. The table keeps a readable minimum and scrolls inside its
          own container instead, per the wide-content rule. */}
      <div className="overflow-x-auto">
        <Table
          className={
            variant === "level"
              ? "min-w-[64rem] table-fixed"
              : "min-w-[46rem] table-fixed"
          }
        >
          <TableHeader>
            <TableRow>
              {sortableHead("name", t("columns.name"))}
              {sortableHead("gender", t("columns.gender"), "w-20")}
              {variant === "level" && (
                <>
                  {sortableHead("track", t("columns.track"), "w-20")}
                  {sortableHead("role", t("columns.role"), "w-44")}
                </>
              )}
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
              {variant === "level" && (
                <TableHead className="w-24">
                  {t("columns.crossLevel")}
                </TableHead>
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
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-[2px]"
                        style={genderKeyStyle(row.woman ? "women" : "men")}
                      />
                      {tGender(row.woman ? "Kvinna" : "Man")}
                    </span>
                  </TableCell>
                  {variant === "level" && (
                    <>
                      <TableCell>
                        {/* Frozen data carries only the track KEY; the live
                            track name may have changed since the freeze, so
                            the badge shows the key (frozen-faithful). */}
                        <div className="flex items-center">
                          <TrackBadge
                            trackKey={row.trackKey}
                            name={row.trackKey}
                            short
                          />
                        </div>
                      </TableCell>
                      <TableCell className="truncate text-muted-foreground">
                        {row.roleTitle} · {row.seniority}
                      </TableCell>
                    </>
                  )}
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
                  {variant === "level" && (
                    <TableCell>
                      {row.crossLevel && (
                        <span className="flex items-center">
                          <HugeiconsIcon
                            icon={Alert02Icon}
                            strokeWidth={2}
                            aria-hidden="true"
                            className="size-4 text-flag-elevated"
                          />
                          <span className="sr-only">
                            {t("crossLevelFlagged")}
                          </span>
                        </span>
                      )}
                    </TableCell>
                  )}
                  {documentation !== undefined && (
                    <TableCell>
                      {/* Fixed-height flex slot: a row gaining documentation
                        must never reflow its neighbours (layout-shift rule),
                        and an inline-flex control directly in a cell would
                        inflate the line box (skeleton-parity rule). */}
                      <div className="flex h-9 items-center justify-between gap-1">
                        {(() => {
                          const target: ActionTargetWire | null = memberTarget
                            ? memberTarget(row)
                            : {
                                kind: "person",
                                scope: documentation.scope,
                                groupKey: group.key,
                                personPublicId: row.personPublicId,
                              }
                          // A member whose own group left the primary flow
                          // takes no formal documentation from here; the
                          // slot keeps its height so rows stay uniform.
                          if (target === null) return null
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
