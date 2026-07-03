"use client"

import { useLocale, useTranslations } from "next-intl"
import { GettingStartedCard } from "@/components/overview/getting-started-card"
import { ModelReadinessCard } from "@/components/overview/model-readiness-card"
import { RolesPerBandChart } from "@/components/overview/roles-per-band-chart"
import { TodoWidget } from "@/components/overview/todo-widget"
import { WelcomeGreeting } from "@/components/overview/welcome-greeting"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"
import { useTodo } from "@/hooks/use-todo"

// Front page: a welcome greeting over a dashboard grid. The To-do fills two of
// three columns with a supporting side column beside it (model readiness +
// getting started), and a full-width sample chart sits below. Everything is a
// derived view; nothing is stored.
export default function OverviewPage() {
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("home"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const todo = useTodo(orgId, locale)

  return (
    <div className="space-y-6">
      <WelcomeGreeting />
      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodoWidget todo={todo} />
        </div>
        {/* On large screens, drop the side column by the To-do heading's height
            (text-lg, 28px) + its 12px gap (lg:mt-10 = 40px) so the first card
            lines up with the first to-do group card. No offset when stacked. */}
        <div className="space-y-4 md:space-y-6 lg:mt-10">
          <ModelReadinessCard orgId={orgId} />
          <GettingStartedCard />
        </div>
      </div>
      <RolesPerBandChart />
    </div>
  )
}
