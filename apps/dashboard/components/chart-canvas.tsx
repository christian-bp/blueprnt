"use client"

import {
  type ChartConfig,
  ChartContainer,
} from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useWidgetExpanded } from "@/components/widget-card"
import { EXPANDED_CHART_HEIGHT, EXPANDED_CHART_TEXT } from "@/lib/chart-style"

// The plot area of a chart that lives in a widget card: the one place that
// decides how tall a chart is, in the card and in the card's expanded dialog.
//
// It exists as a COMPONENT rather than as a hook call at each chart, because
// the flag travels by context and a chart is usually the thing that renders
// the WidgetCard around itself. A hook called there sits ABOVE the dialog's
// provider and quietly answers "not expanded", so the chart keeps its card
// height inside the dialog and expanding gains width and no height at all.
// That is the exact bug this replaces, and it is invisible in review: the
// code reads correctly and the value is simply wrong. Rendering the decision
// as a child puts it under the provider by construction.
export function ChartCanvas({
  config,
  collapsed,
  className,
  children,
}: {
  config: ChartConfig
  // The height this chart takes inside its card. Per-surface on purpose: a
  // tile in a three-across strip and a card under a table are not the same
  // shape. The EXPANDED height is shared, so expanding feels the same
  // wherever it is done.
  collapsed: string
  className?: string
  children: React.ComponentProps<typeof ChartContainer>["children"]
}) {
  const expanded = useWidgetExpanded()
  return (
    <ChartContainer
      config={config}
      className={cn(
        // aspect-auto overrides the container's default aspect-video, so the
        // height class is what decides.
        "aspect-auto w-full",
        // Height AND type together: a chart three times the size with 12px
        // ticks beside it reads as a rendering mistake, not as a bigger
        // chart. SVG text inherits font-size, so this one class moves every
        // tick and in-plot label the chart draws.
        expanded && EXPANDED_CHART_TEXT,
        expanded ? EXPANDED_CHART_HEIGHT : collapsed,
        className
      )}
    >
      {children}
    </ChartContainer>
  )
}

// The same canvas while the data is still loading, so a chart card does not
// change height the moment its figures arrive (and does not change height
// when it is opened in the dialog either).
export function ChartCanvasSkeleton({
  collapsed,
  className,
}: {
  collapsed: string
  className?: string
}) {
  const expanded = useWidgetExpanded()
  return (
    <Skeleton
      className={cn(
        "w-full",
        expanded ? EXPANDED_CHART_HEIGHT : collapsed,
        className
      )}
    />
  )
}
