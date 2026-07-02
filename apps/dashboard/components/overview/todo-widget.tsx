// apps/dashboard/components/overview/todo-widget.tsx
"use client"

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
      <h2 className="flex items-baseline gap-2 font-semibold text-lg">
        {t("heading")}
        <span className="text-foreground tabular-nums">{todo.total}</span>
      </h2>
      <Accordion type="multiple" defaultValue={[todo.groups[0]?.key ?? ""]}>
        {todo.groups.map((group) => (
          <AccordionItem key={group.key} value={group.key}>
            <AccordionTrigger>
              <span className="flex flex-1 items-center justify-between pr-2">
                {t(`groups.${group.key}`)}
                <span className="text-muted-foreground tabular-nums">
                  {group.count}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <TodoGroupItems group={group} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
