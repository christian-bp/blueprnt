"use client"

import { buttonVariants } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { WidgetCard } from "@/components/widget-card"
import { usePayMappingRun } from "./pay-mapping-run-context"

// The Overview hub's progress line: how far the mapping has come, and one
// way into the work. It deliberately owns nothing else. The chapter
// breakdown and the Complete/Reopen controls live on the Analysis tab's
// completion panel (Iteration 3 decision 3), so there is exactly one
// authoritative answer to "where do I stand" and one place to finish;
// Overview stays communicative.
export function PayMappingJourneyCard() {
  const tJourney = useTranslations("dashboard.payMapping.journey")
  const tAnalysis = useTranslations("dashboard.payMapping.analysis")
  const tDoc = useTranslations("dashboard.payMapping.documentation")
  const tHelp = useTranslations("dashboard.help")
  const pathname = usePathname()
  const { queue, locked } = usePayMappingRun()

  // The Overview page is the run's own index route, so the analysis tab
  // nests directly under the current path.
  const [, slug] = pathname.split("/").filter(Boolean)
  const analysisHref = `/pay-mappings/${slug}/analysis`

  const completed = locked

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
            {completed && (
              <p className="text-muted-foreground text-sm">
                {tDoc("completedNote")}
              </p>
            )}
          </div>
        )}
        {/* One way in: the work, and the finishing, both live on Analysis. */}
        <Link href={analysisHref} className={cn(buttonVariants())}>
          {tAnalysis("openAnalysis")}
        </Link>
      </div>
    </WidgetCard>
  )
}
