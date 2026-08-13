import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"
import { PanelCard } from "@/components/panel-card"
import { WIDGET_CHART_HEIGHT } from "@/lib/chart-style"

export type TrendPanelState = "loading" | "empty" | "ready"

// What a trend panel shows when it has no line to draw, in the exact height
// the chart will occupy so the panel never changes size.
//
// While the data is still loading it shows a placeholder line, NOT the empty
// sentence: an empty sentence ("you need two pay mappings") is a claim about
// the org, and a surface that has not heard back yet cannot make it.
//
// The sentence is never aria-hidden, whatever the caller decides for its
// chart: it is the only thing telling a reader why the panel is blank, so
// it IS the content rather than a decoration.
function TrendBody({
  state,
  emptyText,
}: {
  state: TrendPanelState
  emptyText: string
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center",
        WIDGET_CHART_HEIGHT
      )}
    >
      {state === "loading" ? (
        <Skeleton className="h-4 w-48 max-w-full" />
      ) : (
        <p className="max-w-64 text-balance text-center text-muted-foreground text-sm">
          {emptyText}
        </p>
      )}
    </div>
  )
}

// The house trend-chart panel: a titled PanelCard whose body is one of three
// states, always in the chart's own WIDGET_CHART_HEIGHT slot so the panel
// never resizes between them (a loading skeleton, a real empty-state
// sentence, or the chart itself). Any trend chart, on the overview or
// elsewhere, renders through this so it inherits the house chart anatomy by
// construction rather than by convention.
//
// Never bleeds: the plot sits inset within the card's padding, the
// reference design's chart anatomy (a plain bordered box with the chart
// inside it). The frame itself comes from the CALLER as a real border
// class where the surface needs one: the Card's default ring and shadow
// are box-shadows, which paint patchily inside the chat's composited
// scroll container (verified empirically with a solid test shadow), so
// the caller also zeroes them and the border is the one stroke that
// always paints.
//
// Takes no view on accessibility: whether `children` should be hidden from
// the tree is the CALLER's decision, never baked in here. The overview hides
// its charts because the stat tiles above already state the same numbers in
// words; a surface with no such tile (an in-chat chart, say) needs its chart
// to stay in the tree.
export function TrendPanel({
  title,
  state,
  emptyText,
  className,
  children,
}: {
  title: string
  state: TrendPanelState
  emptyText: string
  className?: string
  children: ReactNode
}) {
  return (
    <PanelCard title={title} className={className}>
      {state === "ready" ? (
        children
      ) : (
        <TrendBody state={state} emptyText={emptyText} />
      )}
    </PanelCard>
  )
}
