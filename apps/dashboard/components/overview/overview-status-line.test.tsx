import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { OverviewStatusLine } from "@/components/overview/overview-status-line"
import type { Todo } from "@/lib/todo"

function renderLine(todo: Todo | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OverviewStatusLine todo={todo} />
    </NextIntlClientProvider>
  )
}

function todoWithTotal(total: number): Todo {
  return { groups: [], total }
}

describe("OverviewStatusLine", () => {
  afterEach(cleanup)

  it("renders a loading skeleton while todo is undefined", () => {
    renderLine(undefined)
    expect(document.querySelector("[data-slot='skeleton']")).not.toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })

  // Skeleton renders a div, and a div inside a p is invalid HTML: the parser
  // closes the p before it, so the server's tree and the client's disagree
  // and React reports a hydration mismatch. The placeholder therefore does
  // not reuse the loaded line's <p>, while keeping its typography (which is
  // what makes the two measure the same).
  it("keeps the skeleton out of a paragraph, and carries the line's own type", () => {
    const { container } = renderLine(undefined)
    const bar = container.querySelector("[data-slot='skeleton']")
    expect(bar?.closest("p")).toBeNull()
    expect(bar?.parentElement?.className).toContain("leading-relaxed")
  })

  it("renders the all-caught-up line when nothing is outstanding", () => {
    renderLine(todoWithTotal(0))
    expect(
      screen.getByText(
        "You're all caught up. Nothing needs your attention right now."
      )
    ).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("renders the singular todo summary with a link to the To do section", () => {
    renderLine(todoWithTotal(1))
    const link = screen.getByRole("link", { name: "1 thing to do" })
    expect(link.getAttribute("href")).toBe("#todo")
    expect(screen.getByText(/You have/)).toBeDefined()
  })

  it("renders the plural todo summary with the count", () => {
    renderLine(todoWithTotal(3))
    expect(screen.getByRole("link", { name: "3 things to do" })).toBeDefined()
  })
})
