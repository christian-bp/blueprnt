"use client"

import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"
import { useWidgetExpanded } from "@/components/widget-card"

// One legend entry: the mark its series is drawn with, what it is called, and
// optionally the figure it stands for.
//
// `onToggle` turns the row into a control that hides and shows the series.
// Given, the row is a real toggle button (aria-pressed, keyboard-reachable),
// because filtering a chart by clicking its key is a control like any other
// and must not be mouse-only.
export interface ChartKeyItem {
  // Stable identity for React and for the caller's own hidden-set.
  id: string
  mark: ReactNode
  label: string
  // Right-aligned figure, column layout only (the share beside a donut's
  // series). A row layout has no column for it to align to.
  value?: string
  hidden?: boolean
  onToggle?: () => void
  // Set on the last visible series: hiding it would leave an empty plot with
  // nothing on it to click back.
  toggleDisabled?: boolean
}

// The key's shared row, so a legend and the hover it belongs to can never
// drift into different pitches or sizes. gap-1.5 and text-sm on the list
// mirror ChartTooltipContent's own list.
export function ChartKeyRow({
  item,
  layout,
}: {
  item: ChartKeyItem
  layout: "column" | "row"
}) {
  const expanded = useWidgetExpanded()
  const body = (
    <>
      <span className={cn("shrink-0", expanded ? "size-3" : "size-2.5")}>
        {item.mark}
      </span>
      <span className="text-muted-foreground">{item.label}</span>
      {item.value !== undefined && layout === "column" && (
        <span className="ml-auto font-medium text-foreground tabular-nums">
          {item.value}
        </span>
      )}
    </>
  )
  const shape = cn(
    "flex items-center gap-2",
    layout === "column" && "w-full",
    // Dimmed rather than removed: a hidden series still has to be findable,
    // or the only way back is to remember what used to be there.
    item.hidden === true && "opacity-40"
  )
  if (item.onToggle === undefined) return <div className={shape}>{body}</div>
  return (
    <button
      type="button"
      aria-pressed={item.hidden !== true}
      disabled={item.toggleDisabled === true}
      onClick={item.onToggle}
      className={cn(
        shape,
        "rounded-sm text-left transition-opacity hover:opacity-70",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        "disabled:pointer-events-none"
      )}
    >
      {body}
    </button>
  )
}

// A chart's key, outside the plot rather than recharts' own ChartLegend
// (which renders a strip inside the plot area and reads as chart furniture).
//
// Two layouts. "column" is for a key of two or three fixed series, especially
// one carrying a figure per row. "row" is for a key as long as the data is:
// six jobs stacked vertically push the chart's own findings off the screen,
// and centring the row under the plot keeps it attached to what it names.
export function ChartLegend({
  items,
  layout = "column",
  className,
}: {
  items: ChartKeyItem[]
  layout?: "column" | "row"
  className?: string
}) {
  // The key grows with the plot it names. It sits OUTSIDE the chart canvas,
  // so it cannot inherit the canvas's type scale and reads the same flag
  // itself; left alone it stayed 14px beside a chart three times the size.
  const expanded = useWidgetExpanded()
  return (
    <ul
      className={cn(
        expanded ? "text-base" : "text-sm",
        layout === "column"
          ? "grid gap-1.5"
          : "flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5",
        className
      )}
    >
      {items.map((item) => (
        <li key={item.id} className={layout === "column" ? "w-full" : ""}>
          <ChartKeyRow item={item} layout={layout} />
        </li>
      ))}
    </ul>
  )
}
