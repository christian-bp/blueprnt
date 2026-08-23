"use client"

import type { ReactNode } from "react"

// One passive label/value row inside an inner-sidebar footer block (the
// people area's classification split, a run's key figures). Shared so every
// footer's rows keep one pitch; the optional share draws the thin
// proportion bar between label and value (decorative: the value carries the
// information, so the bar is hidden from assistive technology).
//
// valueWidthCh reserves one fixed value-column width for every row of a
// block (the caller passes the same number to each row, sized from its
// largest value), so rows with different digit counts keep their bars on
// one vertical line and a live count crossing a digit boundary never nudges
// its bar sideways. Without it the value simply sits at the row's right
// edge, for blocks whose rows carry no bars.
export function SidebarStatRow({
  label,
  value,
  share,
  valueWidthCh,
}: {
  label: string
  value: ReactNode
  // 0..1 share of the whole this row represents.
  share?: number
  valueWidthCh?: number
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
        {label}
      </span>
      {share !== undefined && (
        <span
          aria-hidden="true"
          className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full bg-muted-foreground/60"
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </span>
      )}
      <span
        className="shrink-0 text-right text-sm tabular-nums"
        style={
          valueWidthCh === undefined
            ? undefined
            : { width: `${valueWidthCh}ch` }
        }
      >
        {value}
      </span>
    </div>
  )
}
