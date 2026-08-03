"use client"

import type { TableSkeletonColumn } from "@/components/table-skeleton"
import { TrackBadge } from "@/components/track-badge"
import {
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"

// ONE role row, shared by the two surfaces that list roles: the register
// (components/roles/roles-table.tsx, grouped by family) and a single family's
// page. They show the same five columns of the same data and differ only in
// which roles they contain and how those are ordered, so the headings, the
// widths, the skeleton and every cell live here rather than being written
// twice.
//
// Keeping them together is not only tidiness. The table is table-fixed with its
// widths declared on the headings, so a row with fewer cells than headings
// leaves no gap at the end: every later value slides one column left and sits
// under someone else's heading. The family page shipped exactly that way (an
// Employees heading and skeleton bar with no body cell, so each band rendered
// under "Employees"), which is what a second hand-written copy of a row buys.
//
// The role import's review table is deliberately NOT a consumer. It shows
// different columns (a drag handle, an editable title, a track select, a remove
// control) because it edits a proposal rather than listing a register, and the
// onboarding step is not a table at all. What those surfaces do share, the look
// of a family's group row, lives in lib/role-family-row.ts.

// Declared once, on the headings, because table-fixed takes the column widths
// from the header: auto layout would re-measure from the visible rows and
// widths would jump whenever filtering changed which rows show. Title takes the
// remaining space.
//
// Band is w-40 to fit the column's widest content on one line (the sv "Inte
// utvärderad ännu" cell text, wider than the fi "Vaativuusluokka" heading);
// narrower wraps or clips. Employees is w-32 to fit the widest locale label
// (da "Medarbejdere", fi "Työntekijät"); the value itself is a short number.
export function RoleTableHeadings() {
  const t = useTranslations("dashboard.roles")
  const tAssessment = useTranslations("assessment")
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{t("table.title")}</TableHead>
        <TableHead className="w-44">{t("table.track")}</TableHead>
        <TableHead className="w-[22%]">{t("table.team")}</TableHead>
        <TableHead className="w-32">{t("table.employees")}</TableHead>
        <TableHead className="w-40">{tAssessment("band")}</TableHead>
      </TableRow>
    </TableHeader>
  )
}

// The loading silhouette for the same row. Only the track is a pill; the two
// numeric columns are text bars, because their cells are plain text.
export const ROLE_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "w-40 max-w-full" },
  { className: "h-5 w-20 rounded-full" },
  { className: "w-24 max-w-full" },
  { className: "w-6" },
  { className: "w-6" },
]

// block truncate: a long title clamps inside the fixed column instead of
// widening it.
export function RoleTitleCell({
  slug,
  title,
}: {
  slug: string
  title: string
}) {
  return (
    <Link
      href={`/roles/${slug}`}
      className="block truncate font-medium underline-offset-4 hover:underline"
    >
      {title}
    </Link>
  )
}

// Block flex wrapper: an inline-flex badge directly in the cell sits on the
// text baseline and inflates the line box, desyncing the row height from the
// skeleton rows (skeleton parity rule).
export function RoleTrackCell({
  trackKey,
  name,
}: {
  trackKey: string
  name: string
}) {
  return (
    <div className="flex items-center">
      <TrackBadge trackKey={trackKey} name={name} />
    </div>
  )
}

export function RoleTeamCell({ team }: { team: string }) {
  return <span className="block truncate text-muted-foreground">{team}</span>
}

// A cell whose value is absent rather than unknown: no one holds the role, no
// band has been computed yet. Shown rather than blanked, because "none yet" is
// information, but a step fainter than real values so a column of them reads as
// the gaps it is and the actual data stays the thing you see first. One
// constant, so the two absences in this row can never end up different weights.
const ABSENT_VALUE = "text-muted-foreground/60"

// How many people currently hold the role. Zero is muted rather than hidden:
// "nobody in this role" is information (an unstaffed role), not an empty cell.
export function RoleEmployeesCell({ count }: { count: number }) {
  return (
    <span className={cn("tabular-nums", count === 0 && ABSENT_VALUE)}>
      {count}
    </span>
  )
}

// The evaluation outcome: a role's band once it is fully evaluated, otherwise a
// muted "not yet evaluated" line (an incomplete or still-computing role has no
// band yet, the same rule as the overview tables), so a register shows which
// roles still need evaluating instead of a blank cell.
//
// The number plain, the way the employee count beside it is. A filled brand
// pill on every evaluated row turned the column into a stripe of colour down
// the register, which read as a status needing attention rather than as the
// ordinary outcome it is on a fully evaluated role.
export function RoleBandCell({ band }: { band: number | null }) {
  const t = useTranslations("dashboard.roles")
  return band != null ? (
    <span className="tabular-nums">{band}</span>
  ) : (
    <span className={cn("block truncate", ABSENT_VALUE)}>
      {t("notEvaluated")}
    </span>
  )
}
