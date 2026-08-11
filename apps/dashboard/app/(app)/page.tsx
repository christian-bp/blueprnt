"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { useLocale, useTranslations } from "next-intl"
import {
  OverviewCharts,
  OverviewWidgets,
} from "@/components/overview/overview-widgets"
import { TodoActions } from "@/components/overview/todo-actions"
import { WelcomeGreeting } from "@/components/overview/welcome-greeting"
import { useOrganization } from "@/components/org-context"
import { useHeadcountTrend } from "@/hooks/use-headcount-trend"
import { useLevelOverview } from "@/hooks/use-level-overview"
import { useOverviewStats } from "@/hooks/use-overview-stats"
import { usePageTitle } from "@/hooks/use-page-title"
import { usePayGapTrend } from "@/hooks/use-pay-gap-trend"
import { usePayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
import { useTodo } from "@/hooks/use-todo"

// Front page, read top to bottom as what-to-do / where-we-stand / how it
// moved: a welcome heading + subtitle (the total from buildTodo), the "To
// do" row (an action card per outstanding buildTodo group, or the standing
// destinations under their own heading when there is nothing waiting), the
// stat strip (four figures,
// each linking to its own surface), and the chart panels behind those
// figures. buildTodo and buildOverviewStats share one counting pass
// (computeCounts in lib/todo.ts); nothing here is stored.
export default function OverviewPage() {
  const tNav = useTranslations("dashboard.nav")
  const t = useTranslations("dashboard.overview")
  usePageTitle(tNav("home"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const todo = useTodo(orgId, locale)
  const stats = useOverviewStats(orgId, locale)
  const levelOverview = useLevelOverview(orgId, locale)
  const payMappingHeadline = usePayMappingHeadline(orgId)
  const headcountTrend = useHeadcountTrend(orgId)
  const gapTrend = usePayGapTrend(orgId)

  // Whether the page is done arriving. The To do row's arrival burst waits for
  // this rather than for its own query: the queries land in separate batches,
  // the later ones mount the widgets and the charts, and an animation started
  // in that render is spent inside blocked frames instead of on screen. Every
  // result on the page, so adding a hook here also holds the burst until it
  // has landed. undefined is loading; null is a loaded answer of "nothing yet".
  const pageLoaded = [
    todo,
    stats,
    levelOverview,
    payMappingHeadline,
    headcountTrend,
    gapTrend,
  ].every((result) => result !== undefined)

  return (
    // One spacing rhythm for the whole page: the gap between the bands is the
    // same as the gap between the widgets inside them, which is what the
    // pay-mapping overview already uses. The page used to separate its bands
    // by 32px while its cards sat 12px apart, so the same cards were spaced
    // differently depending on the direction you read them in.
    <div className="flex flex-col gap-4">
      <div>
        <WelcomeGreeting />
        {todo === undefined ? (
          <Skeleton className="mt-2 h-4 w-64" />
        ) : (
          <p className="mt-1 text-muted-foreground text-sm">
            {t("subtitle", { count: todo.total })}
          </p>
        )}
      </div>
      <TodoActions todo={todo} pageLoaded={pageLoaded} />
      <OverviewWidgets
        stats={stats}
        levelOverview={levelOverview}
        payMappingHeadline={payMappingHeadline}
      />
      <OverviewCharts
        stats={stats}
        headcountTrend={headcountTrend}
        gapTrend={gapTrend}
      />
    </div>
  )
}
