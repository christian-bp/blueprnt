"use client"

import { buttonVariants } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { WidgetCard } from "@/components/widget-card"
import { chapterSegment } from "./analysis-chapters"
import { PayMappingCompletionPanel } from "./pay-mapping-completion-panel"
import { usePayMappingRun } from "./pay-mapping-run-context"

// The Overview hub's process card: how far the mapping has come, the way
// into the work, and where the run is finished.
//
// Finishing used to live only inside the Analysis tab, on a section index
// page. That page listed no steps of its own and is gone, so the action
// needs a home that does not depend on being mid-flow. This is it: the
// run's own index route, next to the progress it belongs to. The chapter
// pane still shows the same panel after the last remaining step, which is
// the in-flow convenience; both render the ONE component, so there is still
// exactly one derivation of "is the duty met".
export function PayMappingJourneyCard() {
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const tAnalysis = useTranslations("dashboard.payMapping.analysis")
  const tHelp = useTranslations("dashboard.help")
  const pathname = usePathname()
  const { run, queue, locked } = usePayMappingRun()

  // The Overview page is the run's own index route, so the analysis section
  // nests directly under the current path. Straight to the first chapter:
  // the section's own path is only a redirect there, and going through it
  // would cost a round trip.
  const [, slug] = pathname.split("/").filter(Boolean)
  const analysisHref = `/pay-mappings/${slug}/analysis/${chapterSegment("start")}`

  return (
    <WidgetCard
      title={tJourney("title")}
      help={{ label: tHelp("payGapGateLabel"), body: tHelp("payGapGateBody") }}
    >
      <div className="space-y-4">
        {queue === null ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Progress value={0} aria-label={tAnalysis("progressLabel")} />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {tAnalysis("progressLabel")}{" "}
              <span className="text-foreground tabular-nums">
                {tJourney("count", queue.progress.overall)}
              </span>
            </p>
            <Progress
              value={
                queue.progress.overall.total === 0
                  ? 0
                  : Math.round(
                      (queue.progress.overall.done /
                        queue.progress.overall.total) *
                        100
                    )
              }
              aria-label={tAnalysis("progressLabel")}
            />
          </div>
        )}
        {/* Above the panel: entering the work is the common move, and a
            completed run still reads its own note inside the panel. */}
        <Link
          href={analysisHref}
          className={cn(
            buttonVariants({ variant: locked ? "outline" : "default" })
          )}
        >
          {tAnalysis("openAnalysis")}
        </Link>
        {queue !== null && run !== undefined && (
          <PayMappingCompletionPanel queue={queue} run={run} />
        )}
      </div>
    </WidgetCard>
  )
}
