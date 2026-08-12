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
export function OverviewStatusLine({ todo }: { todo: Todo | undefined }) {
  const t = useTranslations("dashboard.overview.hero")

  if (todo === undefined) {
    return <Skeleton className="mt-3 h-5 w-64" />
  }

  return (
    <p className="mt-3 max-w-lg text-center text-muted-foreground text-sm leading-relaxed">
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
