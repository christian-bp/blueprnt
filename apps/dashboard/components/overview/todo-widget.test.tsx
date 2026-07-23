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

  it("keeps the heading with a zero count and an all-caught-up card when there is nothing to do", () => {
    renderWidget({ groups: [], total: 0 })
    expect(screen.getByText("To do:")).toBeDefined()
    expect(screen.getByText("0")).toBeDefined()
    expect(screen.getByText("You're all caught up")).toBeDefined()
  })

  it("renders a skeleton while loading (undefined)", () => {
    const { container } = renderWidget(undefined)
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it("renders the classify group with the imported title and awaiting-people count", () => {
    const todo: Todo = {
      total: 2,
      groups: [
        {
          key: "classifyPeople",
          count: 2,
          items: [
            {
              id: "Sales Manager",
              title: "Sales Manager",
              href: "/people/classify",
              peopleCount: 4,
            },
            {
              id: "__no_title__",
              title: null,
              href: "/people/classify",
              peopleCount: 1,
            },
          ],
        },
      ],
    }
    renderWidget(todo)
    expect(screen.getByText("Classify people into roles")).toBeDefined()
    // First group is open by default: rows show the title (or the no-title
    // label) and how many people await confirmation.
    expect(screen.getByText("Sales Manager")).toBeDefined()
    expect(screen.getByText("4 people")).toBeDefined()
    expect(screen.getByText("Unclassified / no title")).toBeDefined()
    expect(screen.getByText("1 person")).toBeDefined()
    const row = screen.getByText("Sales Manager").closest("a")
    expect(row?.getAttribute("href")).toBe("/people/classify")
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
    // Group count carries a unit (en pluralizes; Nordic use st/stk/kpl).
    expect(screen.getByText("6 items")).toBeDefined()
  })

  it("renders the startPayMapping group as a single full-row link to the create surface", () => {
    const todo: Todo = {
      total: 1,
      groups: [
        {
          key: "startPayMapping",
          count: 1,
          items: [{ id: "startPayMapping", href: "/pay-mappings" }],
        },
      ],
    }
    renderWidget(todo)
    expect(screen.getByText("Start the pay mapping")).toBeDefined()
    const row = screen.getByText("Start the pay mapping").closest("a")
    expect(row?.getAttribute("href")).toBe("/pay-mappings")
    // A single item never triggers the "view all" overflow link.
    expect(screen.queryByText(/View all/)).toBeNull()
  })
})
