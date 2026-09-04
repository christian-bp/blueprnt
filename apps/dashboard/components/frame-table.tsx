"use client"

import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@workspace/ui/components/frame"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { IconSvgElement } from "@hugeicons/react"
import { Separator } from "@workspace/ui/components/separator"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { CountChip } from "@/components/count-chip"
import { TablePagination } from "@/components/table-pagination"
import { onSelectValue } from "@/lib/select"

// The table sits flush against the panel's rounded edges, so its first and
// last columns re-add the panel padding inside their own cells (shared by the
// flat and grouped frames below, so the two can never drift).
const FRAME_TABLE_EDGE =
  "[&_td:first-child]:ps-(--frame-panel-px) [&_td:last-child]:pe-(--frame-panel-px) [&_th:first-child]:ps-(--frame-panel-px) [&_th:last-child]:pe-(--frame-panel-px)"

// The register tables' shared anatomy (the Verve frame): the section title,
// its live count chip, an optional description, and the section's primary
// actions all sit ON the muted frame ground itself; the white panel below
// holds only the filter row and the table; the pagination foot returns to
// the frame ground under the panel. One composite so every register
// measures the same.
//
// `size` picks the title's weight, the reference's own two registers: "lg"
// (default) is the flat register with its text-lg heading; "sm" is the
// grouped register (the Attainment frame), whose small FrameTitle leaves the
// group bands as the loudest text on the surface.
export function FrameTable({
  title,
  count,
  countIcon,
  description,
  toolbar,
  filters,
  footer,
  size = "lg",
  children,
}: {
  // ReactNode so a loading surface can stand a skeleton bar in for a
  // data-driven title (the family page's name arrives with the data).
  title: ReactNode
  // What the count counts: people, roles, entries. Required even on a frame
  // whose count is still loading, because the unit is a property of the
  // register rather than of its data.
  countIcon: IconSvgElement
  // The register's CURRENT (filtered) size; hidden while undefined (loading).
  // Live, so it rolls when filtering narrows the register (NumberFlow rule).
  count?: number
  // A one-line summary under the title, on the frame ground (the reference's
  // "36 of 36 deals need a decision this week" line).
  description?: ReactNode
  // Short controls on the title row's right (the section's primary actions).
  toolbar?: ReactNode
  // A full-width row inside the panel, above the table (search + selects).
  filters?: ReactNode
  footer?: ReactNode
  size?: "lg" | "sm"
  children: ReactNode
}) {
  return (
    <Frame spacing="sm">
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-px">
          <div className="flex min-w-0 items-center gap-2.5">
            {size === "lg" ? (
              <h2 className="truncate font-semibold text-lg">{title}</h2>
            ) : (
              <FrameTitle className="truncate">{title}</FrameTitle>
            )}
            {count !== undefined && (
              <CountChip value={count} icon={countIcon} />
            )}
          </div>
          {description !== undefined && (
            <FrameDescription className="text-xs">
              {description}
            </FrameDescription>
          )}
        </div>
        {toolbar !== undefined && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {toolbar}
          </div>
        )}
      </FrameHeader>
      <FramePanel className="p-0">
        {filters !== undefined && (
          <div className="px-(--frame-panel-header-px) py-3">{filters}</div>
        )}
        {filters !== undefined && <Separator />}
        <div className={FRAME_TABLE_EDGE}>{children}</div>
      </FramePanel>
      {footer !== undefined && (
        <FrameFooter className="py-2">{footer}</FrameFooter>
      )}
    </Frame>
  )
}

// The foot row: the visible range on the left ("1-25 of 132", with an
// optional page-size select before it), the numbered pager on the right.
// `total` may be undefined while more cursor pages can still load (the range
// then shows only its start). Rendered inside FrameTable's `footer` slot.
export function FrameTableFooter({
  page,
  pageSize,
  total,
  pager,
  pageSizeControl,
}: {
  page: number // 0-based
  pageSize: number
  total: number | undefined
  pager: ReactNode // a <TablePagination .../>
  pageSizeControl?: ReactNode // a <FrameTablePageSize .../>
}) {
  const t = useTranslations("dashboard.table")
  const from = total === 0 ? 0 : page * pageSize + 1
  const to =
    total === undefined
      ? page * pageSize + pageSize
      : Math.min((page + 1) * pageSize, total)
  return (
    <div className="flex flex-col flex-wrap items-center justify-between gap-2.5 sm:flex-row">
      <div className="flex items-center gap-2.5">{pageSizeControl}</div>
      <div className="flex items-center gap-2.5">
        {total !== undefined && (
          <span className="text-muted-foreground text-sm tabular-nums">
            {t("range", { from, to, total })}
          </span>
        )}
        {pager}
      </div>
    </div>
  )
}

// The opt-in page-size select ("Rows per page [25]"). Surfaces with a fixed
// page size simply do not render it.
export function FrameTablePageSize({
  value,
  options,
  onChange,
}: {
  value: number
  options: readonly number[]
  onChange: (size: number) => void
}) {
  const t = useTranslations("dashboard.table")
  return (
    <>
      <span className="text-muted-foreground text-sm">{t("rowsPerPage")}</span>
      <Select
        value={String(value)}
        onValueChange={onSelectValue((next: string) => onChange(Number(next)))}
      >
        <SelectTrigger size="sm" className="w-16" aria-label={t("rowsPerPage")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

export { TablePagination }
