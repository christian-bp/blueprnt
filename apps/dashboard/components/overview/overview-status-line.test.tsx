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
