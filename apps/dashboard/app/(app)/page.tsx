"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { useLocale, useTranslations } from "next-intl"
import { OverviewWidgets } from "@/components/overview/overview-widgets"
import { QuickActions } from "@/components/overview/quick-actions"
import { TodoList } from "@/components/overview/todo-list"
import { WelcomeGreeting } from "@/components/overview/welcome-greeting"
import { useOrganization } from "@/components/org-context"
import { useBandOverview } from "@/hooks/use-band-overview"
import { useHeadcountTrend } from "@/hooks/use-headcount-trend"
import { useOverviewStats } from "@/hooks/use-overview-stats"
import { usePageTitle } from "@/hooks/use-page-title"
import { usePayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
import { useTodo } from "@/hooks/use-todo"

// Front page: a left-aligned welcome heading + subtitle (the total from
// buildTodo), a "To do" section (the always-open TodoList: one card per
// non-empty buildTodo group, or the all-caught-up line), an "Overview"
// section (the STABLE 3-card OverviewWidgets grid: every card always
// renders, narrating either its work or its all-clear state), and a
// quick-action row below. buildTodo and buildOverviewStats share one
// counting pass (computeCounts in lib/todo.ts); nothing here is stored.
export default function OverviewPage() {
  const tNav = useTranslations("dashboard.nav")
  const t = useTranslations("dashboard.overview")
  usePageTitle(tNav("home"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const todo = useTodo(orgId, locale)
  const stats = useOverviewStats(orgId, locale)
  const bandOverview = useBandOverview(orgId, locale)
  const payMappingHeadline = usePayMappingHeadline(orgId)
  const headcountTrend = useHeadcountTrend(orgId)

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
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">{t("sectionTodo")}</h2>
        <TodoList todo={todo} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-muted-foreground text-sm">
          {t("sectionOverview")}
        </h2>
        <OverviewWidgets
          stats={stats}
          bandOverview={bandOverview}
          payMappingHeadline={payMappingHeadline}
          headcountTrend={headcountTrend}
        />
      </section>
      <QuickActions />
    </div>
  )
}
