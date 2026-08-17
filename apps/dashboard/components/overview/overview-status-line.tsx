"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import Link from "next/link"
import type { ReactNode } from "react"
import type { Todo } from "@/lib/todo"

// The hero's single insight line: midday's exact one-insight branch
// (`text-muted-foreground text-sm mt-3 max-w-lg leading-relaxed
// text-center`), always exactly one of two states because this app has one
// count to report, not a rotating set. Reads the page's already-fetched
// `useTodo` result; fires no query of its own.
// One constant for both states, so the placeholder can never end up measuring
// a different line than the text that replaces it.
const STATUS_LINE_CLASS =
  "mt-3 max-w-lg text-center text-muted-foreground text-sm leading-relaxed"

export function OverviewStatusLine({ todo }: { todo: Todo | undefined }) {
  const t = useTranslations("dashboard.overview.hero")

  if (todo === undefined) {
    // The bar sits inside the REAL paragraph, carrying the real typography,
    // so the placeholder measures the loaded line exactly (23px here: text-sm
    // over leading-relaxed). A bare h-5 bar measured 20px, and those 3px
    // moved every band below it, and the centred hero above it, the moment
    // the count arrived. Inline-block so the line box is what sets the
    // height; the bar stays shorter than it, because a placeholder should
    // read as a stand-in rather than as a filled line.
    return (
      <p className={STATUS_LINE_CLASS}>
        <Skeleton className="inline-block h-4 w-64 align-middle" />
      </p>
    )
  }

  return (
    <p className={STATUS_LINE_CLASS}>
      {todo.total > 0
        ? t.rich("todoSummary", {
            count: todo.total,
            // Points at the To do row further down this same page (its
            // section carries id="todo"), not a separate route: the row
            // groups several kinds of outstanding work behind different
            // hrefs (import, classify, describe/evaluate roles, criteria,
            // pay mapping), so no single destination route represents "the
            // things to do" the way the on-page section itself does.
            link: (chunks: ReactNode) => (
              <Link href="#todo" className="underline-offset-4 hover:underline">
                {chunks}
              </Link>
            ),
          })
        : t("allCaughtUp")}
    </p>
  )
}
