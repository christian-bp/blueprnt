// apps/dashboard/components/overview/todo-widget.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import type { Todo } from "@/lib/todo"
import { TodoWidget } from "@/components/overview/todo-widget"

function renderWidget(todo: Todo | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TodoWidget todo={todo} />
    </NextIntlClientProvider>
  )
}

describe("TodoWidget", () => {
  afterEach(cleanup)

  it("shows the empty state when there is nothing to do", () => {
    renderWidget({ groups: [], total: 0 })
    expect(screen.getByText("You're all caught up")).toBeDefined()
  })

  it("renders a skeleton while loading (undefined)", () => {
    const { container } = renderWidget(undefined)
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it("renders groups with the total, expands the first group, and links items", () => {
    const todo: Todo = {
      total: 7,
      groups: [
        {
          key: "evaluateRoles",
          count: 6,
          items: [
            {
              id: "r1",
              title: "Backend Engineer",
              href: "/roles/backend-engineer/rate",
              ratedCount: 3,
              totalCriteria: 9,
            },
          ],
        },
        {
          key: "approveCriteria",
          count: 1,
          items: [
            {
              id: "c1",
              title: "Scope",
              href: "/model/method",
              status: "documented",
            },
          ],
        },
      ],
    }
    renderWidget(todo)
    // Heading + total
    expect(screen.getByText("To do:")).toBeDefined()
    expect(screen.getByText("7")).toBeDefined()
    // Group labels
    expect(screen.getByText("Evaluate these roles")).toBeDefined()
    expect(screen.getByText("Approve criteria")).toBeDefined()
    // First group is expanded -> its item is visible; the progress subtitle renders
    expect(screen.getByText("Backend Engineer")).toBeDefined()
    expect(screen.getByText("3/9 evaluated")).toBeDefined()
    // Over-cap -> "View all 6"
    expect(screen.getByText("View all 6")).toBeDefined()
  })
})
