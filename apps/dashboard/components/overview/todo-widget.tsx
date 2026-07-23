// apps/dashboard/components/overview/todo-widget.tsx
"use client"

import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Accordion } from "@workspace/ui/components/accordion"
import { useTranslations } from "next-intl"
import { AccordionSection } from "@/components/accordion-section"
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

  // Shared heading, shown whether or not there is anything to do: the label, the
  // total in brand, and a decorative chevron (a link to the dedicated to-do
  // page in V2).
  const heading = (
    <h2 className="flex items-center gap-2 font-semibold text-lg">
      {t("heading")}
      <span className="text-brand tabular-nums">{todo.total}</span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        aria-hidden="true"
        className="size-5 text-brand"
      />
    </h2>
  )

  // Nothing to do: keep the heading (with a 0) and, in the accordion's place,
  // an all-caught-up card styled like the group cards, rather than replacing the
  // whole widget with a centered empty state.
  if (todo.total === 0) {
    return (
      <div className="space-y-3">
        {heading}
        <div className="flex items-center gap-3 rounded-xl border px-4 py-4">
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="size-5 shrink-0 text-brand"
          />
          <div>
            <p className="font-medium text-sm">{t("empty.title")}</p>
            <p className="text-muted-foreground text-sm">{t("empty.body")}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {heading}
      {/* Each group is its own outlined card (rounded border + px), spaced by
          gap-3, rather than the accordion's default divider lines. */}
      <Accordion
        multiple
        defaultValue={[todo.groups[0]?.key ?? ""]}
        className="gap-3"
      >
        {/* The brand-chevron-first trigger anatomy lives in AccordionSection
            (the shared app primitive this widget's local markup was
            generalized into). contentClassName overrides the accordion's
            prose default (`[&_a]:underline`): the item rows are whole-row
            links, not text links, so they should not be underlined. The
            "view all" link opts back into hover-underline itself. */}
        {todo.groups.map((group) => (
          <AccordionSection
            key={group.key}
            value={group.key}
            className="rounded-xl border px-4"
            title={t(`groups.${group.key}`)}
            meta={t("groupCount", { count: group.count })}
            contentClassName="[&_a]:no-underline"
          >
            <TodoGroupItems group={group} />
          </AccordionSection>
        ))}
      </Accordion>
    </div>
  )
}
