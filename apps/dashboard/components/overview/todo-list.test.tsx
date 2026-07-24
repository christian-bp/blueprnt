import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import type { Todo } from "@/lib/todo"
import { TodoList } from "@/components/overview/todo-list"

function renderList(todo: Todo | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TodoList todo={todo} />
    </NextIntlClientProvider>
  )
}

describe("TodoList", () => {
  afterEach(cleanup)

  it("renders each group's medallion, title, and count, and links its item rows with meta", () => {
    const todo: Todo = {
      total: 13,
      groups: [
        {
          key: "classifyPeople",
          count: 12,
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
        {
          key: "describeRoles",
          count: 1,
          items: [
            {
              id: "r1",
              title: "Backend Engineer",
              href: "/roles/backend-engineer",
              family: "Engineering",
            },
          ],
        },
      ],
    }
    const { container } = renderList(todo)

    // Group headers: medallion (a brand-tinted icon chip), title, count.
    const medallions = Array.from(
      container.querySelectorAll('[aria-hidden="true"]')
    ).filter((el) => el.className.includes("bg-brand/10"))
    expect(medallions.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("Classify people into roles")).toBeDefined()
    expect(screen.getByText("12 items")).toBeDefined()
    expect(screen.getByText("Describe these roles")).toBeDefined()
    expect(screen.getByText("1 item")).toBeDefined()

    // classify item rows: title (or no-title label) + people-count meta, linked.
    expect(screen.getByText("Sales Manager")).toBeDefined()
    expect(screen.getByText("4 people")).toBeDefined()
    expect(screen.getByText("Unclassified / no title")).toBeDefined()
    expect(screen.getByText("1 person")).toBeDefined()
    const classifyRow = screen.getByText("Sales Manager").closest("a")
    expect(classifyRow?.getAttribute("href")).toBe("/people/classify")

    // describe item row: title + family meta, linked.
    expect(screen.getByText("Backend Engineer")).toBeDefined()
    expect(screen.getByText("Engineering")).toBeDefined()
    const describeRow = screen.getByText("Backend Engineer").closest("a")
    expect(describeRow?.getAttribute("href")).toBe("/roles/backend-engineer")

    // classify group is over the row cap (12 > 3): a "view all 12" link to
    // the classify surface. describe (count 1) shows no such link.
    const viewAll = screen.getByText("View all 12")
    expect(viewAll.closest("a")?.getAttribute("href")).toBe("/people/classify")

    // The card chrome itself stays plain (the brand accent lives on the
    // medallion, asserted above): no colored border/background compounding
    // card after card down the list.
    const firstCard = screen
      .getByText("Classify people into roles")
      .closest(".rounded-xl")
    const secondCard = screen
      .getByText("Describe these roles")
      .closest(".rounded-xl")
    for (const card of [firstCard, secondCard]) {
      expect(card?.className).not.toContain("border-brand")
      expect(card?.className).not.toContain("bg-brand/5")
    }
  })

  it("caps item rows at 3 per group regardless of how many items the group carries", () => {
    const todo: Todo = {
      total: 5,
      groups: [
        {
          key: "evaluateRoles",
          count: 5,
          items: [
            {
              id: "r1",
              title: "Role A",
              href: "/roles/a/rate",
              ratedCount: 1,
              totalCriteria: 4,
            },
            {
              id: "r2",
              title: "Role B",
              href: "/roles/b/rate",
              ratedCount: 2,
              totalCriteria: 4,
            },
            {
              id: "r3",
              title: "Role C",
              href: "/roles/c/rate",
              ratedCount: 3,
              totalCriteria: 4,
            },
            {
              id: "r4",
              title: "Role D",
              href: "/roles/d/rate",
              ratedCount: 0,
              totalCriteria: 4,
            },
          ],
        },
      ],
    }
    renderList(todo)
    expect(screen.getByText("Role A")).toBeDefined()
    expect(screen.getByText("Role B")).toBeDefined()
    expect(screen.getByText("Role C")).toBeDefined()
    expect(screen.queryByText("Role D")).toBeNull()
    expect(screen.getByText("1/4 evaluated")).toBeDefined()
    const viewAll = screen.getByText("View all 5")
    expect(viewAll.closest("a")?.getAttribute("href")).toBe("/roles")
  })

  it("shows the criterion status badge for document/approve groups", () => {
    const todo: Todo = {
      total: 1,
      groups: [
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
    renderList(todo)
    expect(screen.getByText("Scope")).toBeDefined()
    expect(screen.getByText("Documented")).toBeDefined()
    // A single item never triggers the "view all" overflow link.
    expect(screen.queryByText(/View all/)).toBeNull()
  })

  it("renders the startPayMapping group as a single labeled row with no meta and no view-all", () => {
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
    renderList(todo)
    const row = screen.getByText("Start the pay mapping").closest("a")
    expect(row?.getAttribute("href")).toBe("/pay-mappings")
    expect(screen.queryByText(/View all/)).toBeNull()
  })

  it("renders the importPeople group as a single labeled row with no meta and no view-all", () => {
    const todo: Todo = {
      total: 1,
      groups: [
        {
          key: "importPeople",
          count: 1,
          items: [{ id: "importPeople", href: "/people/import" }],
        },
      ],
    }
    renderList(todo)
    const row = screen.getByText("Import your employees").closest("a")
    expect(row?.getAttribute("href")).toBe("/people/import")
    expect(screen.queryByText(/View all/)).toBeNull()
  })

  it("renders a describeRoles item with no family and shows no family meta", () => {
    const todo: Todo = {
      total: 1,
      groups: [
        {
          key: "describeRoles",
          count: 1,
          items: [
            {
              id: "r1",
              title: "Backend Engineer",
              href: "/roles/backend-engineer",
              family: undefined,
            },
          ],
        },
      ],
    }
    const { container } = renderList(todo)
    const row = screen.getByText("Backend Engineer").closest("a")
    expect(row?.getAttribute("href")).toBe("/roles/backend-engineer")
    // No family meta span alongside the title: the row's only text is the
    // title itself.
    expect(row?.querySelectorAll("span").length).toBe(1)
    expect(container.querySelectorAll(".text-xs").length).toBe(0)
  })

  it("renders the all-caught-up line and no group headers when there is nothing to do", () => {
    renderList({ groups: [], total: 0 })
    expect(screen.getByText("You're all caught up")).toBeDefined()
    expect(screen.queryByText("Classify people into roles")).toBeNull()
  })

  it("renders a skeleton whose medallion is the empty brand square (no icon) with barred content while loading", () => {
    const { container } = renderList(undefined)
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    // The medallion square (brand-tinted chip) renders for real while loading,
    // but WITHOUT an icon: which icon belongs there is data-dependent.
    const medallion = Array.from(
      container.querySelectorAll('[aria-hidden="true"]')
    ).find((el) => el.className.includes("bg-brand/10"))
    expect(medallion).not.toBeUndefined()
    expect(medallion?.querySelector("svg")).toBeNull()
  })
})
