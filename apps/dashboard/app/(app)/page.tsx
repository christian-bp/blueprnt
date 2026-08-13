"use client"

import { cn } from "@workspace/ui/lib/utils"
import { useLocale, useTranslations } from "next-intl"
import { AssistantPrompt } from "@/components/assistant/assistant-prompt"
import { OverviewWidgets } from "@/components/overview/overview-widgets"
import { OverviewStatusLine } from "@/components/overview/overview-status-line"
import { TodoActions } from "@/components/overview/todo-actions"
import { WelcomeGreeting } from "@/components/overview/welcome-greeting"
import { useOrganization } from "@/components/org-context"
import { useLevelOverview } from "@/hooks/use-level-overview"
import { useOverviewStats } from "@/hooks/use-overview-stats"
import { usePageTitle } from "@/hooks/use-page-title"
import { usePayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
import { useTodo } from "@/hooks/use-todo"

// The constraint: the hero reads centered while the band below stays visible
// above the fold, so the page never looks finished at the chat box. svh, not
// vh, so a mobile browser's own chrome does not lie about how much of the
// screen the hero actually gets.
const HERO_MIN_H = "min-h-[65svh]"

// Front page, read top to bottom as what-to-do / where-we-stand: a centered
// hero (greeting, one status line, the chat prompt) that fills most of the
// first viewport, then the page's ordinary content, the "To do" row (an
// action card per outstanding buildTodo group, or the standing destinations
// under their own heading when there is nothing waiting), and the stat strip
// (three figures, each linking to its own surface). buildTodo and
// buildOverviewStats share one counting pass (computeCounts in
// lib/todo.ts); nothing here is stored.
// The two trend charts that used to sit below the strip moved into the
// assistant (AssistantChartPart): a front page states where things stand,
// and a history belongs to the conversation that asks for it.
export default function OverviewPage() {
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("home"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const todo = useTodo(orgId, locale)
  const stats = useOverviewStats(orgId, locale)
  const levelOverview = useLevelOverview(orgId, locale)
  const payMappingHeadline = usePayMappingHeadline(orgId)

  // Whether the page is done arriving. The To do row's arrival burst waits for
  // this rather than for its own query: the queries land in separate batches,
  // the later ones mount the widgets, and an animation started in that render
  // is spent inside blocked frames instead of on screen. Every result on the
  // page, so adding a hook here also holds the burst until it has landed.
  // undefined is loading; null is a loaded answer of "nothing yet".
  const pageLoaded = [todo, stats, levelOverview, payMappingHeadline].every(
    (result) => result !== undefined
  )

  return (
    // One spacing rhythm for the whole page: the gap between the bands is the
    // same as the gap between the widgets inside them, which is what the
    // pay-mapping overview already uses. The page used to separate its bands
    // by 32px while its cards sat 12px apart, so the same cards were spaced
    // differently depending on the direction you read them in.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {/* The hero: plain flex divs throughout, deliberately no `grid` class
          and no `<section>`, so the page's band-gap invariant (every
          `div.grid`/`section` carries the same gap-4) never scans it. Fills
          most of the first viewport (HERO_MIN_H) and centers its content
          vertically, at the same full content width as the To do row and the
          stat strip below it: no `max-w` cap of its own, since the inner
          cap sits on this shared root div instead. */}
      <div className={cn("flex w-full flex-col justify-center", HERO_MIN_H)}>
        <div className="flex flex-col items-center pt-6 pb-10 text-center">
          <WelcomeGreeting />
          <OverviewStatusLine todo={todo} />
        </div>
        <AssistantPrompt />
      </div>
      <TodoActions todo={todo} pageLoaded={pageLoaded} />
      <OverviewWidgets
        stats={stats}
        levelOverview={levelOverview}
        payMappingHeadline={payMappingHeadline}
      />
    </div>
  )
}
