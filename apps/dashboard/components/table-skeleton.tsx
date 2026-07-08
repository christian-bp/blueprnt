import { Skeleton } from "@workspace/ui/components/skeleton"
import { TableBody, TableCell, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

// Per-column shaping for the skeleton bar. Tailor it to the column's real
// content for a natural look, e.g. "h-5 w-16 rounded-full" for a badge column or
// "w-24" for a short value. Defaults to a full-width "h-4" bar.
// `content` replaces the bar entirely: skeleton bars stand in for unknown
// DATA, so per-row chrome that is identical for every row (an expand chevron,
// a row-actions trigger) renders as its real icon, muted and non-interactive,
// instead of a gray bar.
export type TableSkeletonColumn = { className?: string; content?: ReactNode }

// A reusable table loading state: skeleton rows for a table body. Render it in
// place of <TableBody> inside the same <Table> while data loads, so the table
// keeps its header and column widths and nothing reflows when the rows arrive.
// Pass a column count for uniform bars, or an array of per-column shapes to
// mirror each column's content (inspired by per-table skeletons, but reusable).
export function TableSkeleton({
  rows = 8,
  columns,
}: {
  rows?: number
  columns: number | TableSkeletonColumn[]
}) {
  const cols =
    typeof columns === "number"
      ? Array.from({ length: columns }, (): TableSkeletonColumn => ({}))
      : columns
  return (
    <TableBody>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
          key={rowIndex}
          className="hover:bg-transparent"
        >
          {cols.map((col, colIndex) => (
            <TableCell
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
              key={colIndex}
            >
              {/* The wrapper reserves a text-sm line box (min-h-5) around the
                  thinner bar, so skeleton rows are exactly as tall as rows of
                  real text; taller control-shaped bars (selects, buttons)
                  still grow it. */}
              <div className="flex min-h-5 items-center">
                {col.content !== undefined ? (
                  col.content
                ) : (
                  <Skeleton className={cn("h-4 w-full", col.className)} />
                )}
              </div>
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}
