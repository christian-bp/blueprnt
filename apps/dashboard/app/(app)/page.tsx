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

  return (
    <div className="flex flex-col gap-8">
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
      <TodoActions todo={todo} />
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
