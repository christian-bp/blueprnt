"use client"

import type { PayGapFlag } from "@workspace/core"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useFormatter, useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { LevelBadge } from "@/components/level-badge"
import { TablePagination } from "@/components/table-pagination"
import { ariaSort, TableSortButton } from "@/components/table-sort-button"
import { percentText } from "@/lib/percent"
import { PayGapFlagBadge } from "./pay-gap-flag-badge"

// One shared page size for the table and, when it lands, its skeleton.
const PAGE_SIZE = 25

// Where a group stands in the statutory work, as one word. "noDuty" is a
// real state, not an absence: an ok-flag equal-work group and a
// zero-comparator women-dominated group are analysed and shown, they simply
// carry no documentation duty (ADR-0015).
export type WorklistStatus = "needsDocumenting" | "documented" | "noDuty"

// One row of a chapter's worklist. The caller builds these from the gap
// wire plus the checklist's own done state, so the worklist can never
// disagree with the checklist about what exists or what is done.
export interface WorklistRow {
  id: string
  label: string
  level: number | null
  status: WorklistStatus
  // Equal-work columns.
  women?: number
  men?: number
  gapPct?: number | null
  flag?: PayGapFlag
  // Women-dominated columns.
  headcount?: number
  womenSharePct?: number
  comparisons?: number
}

const STATUS_RANK: Record<WorklistStatus, number> = {
  needsDocumenting: 0,
  documented: 1,
  noDuty: 2,
}

type SortKey = "label" | "gap" | "status" | "headcount" | "comparisons"

// The chapter's whole worklist as a register table: every group at once,
// sortable, paginated. It answers the two questions the 320px checklist
// column cannot at scale (21 women-dominated groups today, ten times that
// at a large customer): "show me everything you analysed" and "where is
// the worst of it". It is also the surface to put on screen in a samverkan
// meeting or in front of an inspector.
//
// The default order is the same attention order the wizard queue uses:
// duty first, then the widest gap, then a stable key order.
export function ChapterWorklist({
  rows,
  variant,
  onOpen,
  setAside,
}: {
  rows: WorklistRow[]
  variant: "equalWork" | "equivalentWork"
  onOpen: (id: string) => void
  // The full comparison universe stated in words under the table, so the
  // set of groups that never reached it is visible rather than implied.
  setAside?: ReactNode
}) {
  const t = useTranslations("dashboard.payMapping.analysis.worklist")
  const tToolbar = useTranslations("dashboard.payMapping.toolbar")
  const format = useFormatter()
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "status",
    desc: false,
  })
  const [page, setPage] = useState(0)

  const sorted = [...rows].sort((a, b) => {
    const direction = sort.desc ? -1 : 1
    switch (sort.key) {
      case "label":
        return direction * (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)
      case "gap": {
        const gapA = a.gapPct ?? Number.NEGATIVE_INFINITY
        const gapB = b.gapPct ?? Number.NEGATIVE_INFINITY
        return direction * (gapB - gapA)
      }
      case "headcount":
        return direction * ((b.headcount ?? 0) - (a.headcount ?? 0))
      case "comparisons":
        return direction * ((b.comparisons ?? 0) - (a.comparisons ?? 0))
      default: {
        const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status]
        if (rank !== 0) return direction * rank
        // Within a status, the widest gap (or the most comparisons) first,
        // then a stable id order: the same attention order the queue uses.
        const weightA = a.gapPct ?? a.comparisons ?? 0
        const weightB = b.gapPct ?? b.comparisons ?? 0
        if (weightA !== weightB) return direction * (weightB - weightA)
        return a.id < b.id ? -1 : 1
      }
    }
  })

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const page0 = Math.min(page, pageCount - 1)
  const visible = sorted.slice(page0 * PAGE_SIZE, (page0 + 1) * PAGE_SIZE)

  // First click sorts, the next flips; a sort change resets to page 1.
  function head(key: SortKey, label: string, className?: string) {
    const active = sort.key === key
    const direction: false | "asc" | "desc" = active
      ? sort.desc
        ? "desc"
        : "asc"
      : false
    return (
      <TableHead className={className} aria-sort={ariaSort(direction)}>
        <TableSortButton
          label={label}
          sorted={direction}
          onToggle={() => {
            setSort({ key, desc: active ? !sort.desc : false })
            setPage(0)
          }}
        />
      </TableHead>
    )
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noMatches")}</p>
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table className="min-w-[44rem] table-fixed">
          <TableHeader>
            <TableRow>
              {head("label", t("columns.group"))}
              {variant === "equalWork" ? (
                <>
                  <TableHead className="w-20 text-right">
                    {t("columns.womenShare")}
                  </TableHead>
                  {head("gap", t("columns.gap"), "w-24 text-right")}
                  <TableHead className="w-28">{t("columns.flag")}</TableHead>
                </>
              ) : (
                <>
                  {head("headcount", t("columns.headcount"), "w-24 text-right")}
                  <TableHead className="w-24 text-right">
                    {t("columns.womenShare")}
                  </TableHead>
                  {head(
                    "comparisons",
                    t("columns.comparisons"),
                    "w-44 text-right"
                  )}
                </>
              )}
              {head("status", t("columns.status"), "w-44")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="truncate font-medium">
                  <button
                    type="button"
                    onClick={() => onOpen(row.id)}
                    className="underline-offset-4 hover:underline"
                  >
                    {row.label}
                  </button>
                  {row.level !== null && (
                    <span className="ml-2 align-middle">
                      <LevelBadge level={row.level} />
                    </span>
                  )}
                </TableCell>
                {variant === "equalWork" ? (
                  <>
                    <TableCell className="text-right tabular-nums">
                      {row.women} / {row.men}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.gapPct === null || row.gapPct === undefined
                        ? "-"
                        : percentText(row.gapPct, format)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {row.flag !== undefined && (
                          <PayGapFlagBadge flag={row.flag} />
                        )}
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-right tabular-nums">
                      {row.headcount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.womenSharePct === undefined
                        ? "-"
                        : percentText(row.womenSharePct, format)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.comparisons}
                    </TableCell>
                  </>
                )}
                <TableCell className="text-muted-foreground">
                  {t(`status.${row.status}`)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {setAside}
      {sorted.length > PAGE_SIZE && (
        <TablePagination
          page={page0}
          pageCount={pageCount}
          hasMore={false}
          canPrev={page0 > 0}
          canNext={page0 < pageCount - 1}
          onPrev={() => setPage(page0 - 1)}
          onNext={() => setPage(page0 + 1)}
          onSelect={setPage}
          previousLabel={tToolbar("previous")}
          nextLabel={tToolbar("next")}
        />
      )}
    </div>
  )
}
