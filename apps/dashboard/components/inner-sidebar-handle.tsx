"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

// The inner sidebar's collapse control: a small pill standing in the content
// gutter a step to the RIGHT of the seam (the Verve geometry: the button box
// starts at the seam and pl-2 offsets the bars from the border, so the pill
// never sits on the line itself), folding into a chevron on hover pointing
// the way the sidebar will move. It MUST be rendered inside a RELATIVE,
// NON-SCROLLING wrapper whose left edge IS that seam (the shell's content
// column), never inside the sidebar itself: the sidebar is a width-animated
// overflow-hidden box, so anything inside it is clipped away at width 0,
// while the content column's left edge tracks the seam at every animation
// frame with no position syncing at all.
export function InnerSidebarHandle({
  open,
  onToggle,
  collapseLabel,
  expandLabel,
}: {
  open: boolean
  onToggle: () => void
  collapseLabel: string
  expandLabel: string
}) {
  const label = open ? collapseLabel : expandLabel
  const bar =
    "block h-2 w-0.5 bg-foreground/40 transition-all duration-100 ease-linear group-hover/handle:bg-foreground/60"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-expanded={open}
            onClick={onToggle}
            className="group/handle absolute top-1/2 left-0 z-30 hidden h-12 w-7 -translate-y-1/2 cursor-pointer items-center pl-2 outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 md:flex"
          />
        }
      >
        <span className="flex flex-col items-center">
          <span
            className={cn(
              bar,
              "origin-bottom rounded-t-full",
              open
                ? "group-hover/handle:rotate-40"
                : "group-hover/handle:-rotate-40"
            )}
          />
          <span
            className={cn(
              bar,
              "origin-top rounded-b-full",
              open
                ? "group-hover/handle:-rotate-40"
                : "group-hover/handle:rotate-40"
            )}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
