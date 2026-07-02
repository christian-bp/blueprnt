"use client"

import { useLocale, useTranslations } from "next-intl"
import { WelcomeGreeting } from "@/components/overview/welcome-greeting"
import { TodoWidget } from "@/components/overview/todo-widget"
import { useOrganization } from "@/components/org-context"
import { useTodo } from "@/hooks/use-todo"
import { usePageTitle } from "@/hooks/use-page-title"

// Front page: a personal welcome greeting over a single actionable "To do".
// Both are derived views (no stored aggregates); the greeting reads the session,
// the to-do derives from the role + method queries via useTodo.
export default function OverviewPage() {
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("home"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const todo = useTodo(orgId, locale)

  return (
    <div className="space-y-6">
      <WelcomeGreeting />
      <TodoWidget todo={todo} />
    </div>
  )
}
