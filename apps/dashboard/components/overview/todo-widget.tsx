// apps/dashboard/components/overview/todo-widget.tsx
"use client"

import { ArrowDown02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { useTranslations } from "next-intl"
import { TodoGroupItems } from "@/components/overview/todo-group"
import { TodoSkeleton } from "@/components/overview/todo-skeleton"
import type { Todo } from "@/lib/todo"

// The front-page "To do": a heading with the total count and one expandable
// accordion section per non-empty group (top-priority group open by default).
// Prop-driven so it is trivially testable; the page supplies useTodo's result.
// undefined = loading (skeleton); total 0 = the all-caught-up empty state.
export function TodoWidget({ todo }: { todo: Todo | undefined }) {
  const t = useTranslations("dashboard.overview.todo")

  if (todo === undefined) return <TodoSkeleton />

  if (todo.total === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("empty.title")}</EmptyTitle>
          <EmptyDescription>{t("empty.body")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold text-lg">
        {t("heading")}
        <span className="text-brand tabular-nums">{todo.total}</span>
        {/* Decorative flourish matching the reference; becomes a link to the
            dedicated to-do page in V2. */}
        <HugeiconsIcon
          icon={ArrowDown02Icon}
          strokeWidth={2}
          aria-hidden="true"
          className="size-5 text-brand"
        />
      </h2>
      {/* Each group is its own outlined card (rounded border + px), spaced by
          gap-3, rather than the accordion's default divider lines. */}
      <Accordion
        type="multiple"
        defaultValue={[todo.groups[0]?.key ?? ""]}
        className="gap-3"
      >
        {todo.groups.map((group) => (
          <AccordionItem
            key={group.key}
            value={group.key}
            className="rounded-xl border px-4"
          >
            {/* A brand chevron at the START of the row: force-hide the built-in
                right chevron with `[&>svg]:hidden!` (the `!` beats its
                expanded-state `group-aria-expanded:inline`; `>` targets only its
                direct-child icons, not our nested one) and render our own,
                rotating 90deg on open. */}
            <AccordionTrigger className="[&>svg]:hidden!">
              <span className="flex flex-1 items-center gap-2">
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="size-4 shrink-0 text-brand transition-transform group-aria-expanded/accordion-trigger:rotate-90"
                />
                <span>{t(`groups.${group.key}`)}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {t("groupCount", { count: group.count })}
                </span>
              </span>
            </AccordionTrigger>
            {/* Override the accordion's prose default (`[&_a]:underline`): the
                item rows are whole-row links, not text links, so they should not
                be underlined. The "view all" link opts back into hover-underline
                itself. */}
            <AccordionContent className="[&_a]:no-underline">
              <TodoGroupItems group={group} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
