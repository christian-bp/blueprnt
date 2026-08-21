import { cleanup, render, screen, within } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/model/method",
}))

// NumberFlow renders a custom element happy-dom never upgrades. The digit
// animation is the library's business; these tests are about the figures.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { ModelChapterTabs } from "@/components/model/model-chapter-tabs"

const m = messages.dashboard.model.chapters

// The row reads the path for WHICH chapter is open, and takes each chapter's
// progress from the section shell, which hands the same array to the spine.
// `null` stands for "the section does not know yet", because an explicit
// `undefined` argument would fall back to the default parameter instead.
function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelChapterTabs />
    </NextIntlClientProvider>
  )
}

const tab = (label: string) =>
  screen.getAllByRole("link").find((link) => link.textContent?.includes(label))

afterEach(() => cleanup())

describe("ModelChapterTabs", () => {
  // The journey's own instrument sits on the title row above this one. A
  // progressbar here would be the drift back to the shape the owner rejected.
  it("draws no instrument of its own", () => {
    const { container } = renderTabs()
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })

  it("names the four chapters and nothing else", () => {
    renderTabs()
    const nav = screen.getByRole("navigation", { name: m.nav })
    const links = within(nav).getAllByRole("link")
    expect(links).toHaveLength(4)
    expect(links.map((link) => link.textContent)).toEqual([
      `1. ${m.criteria}`,
      `2. ${m.weighting}`,
      `3. ${m.method}`,
      `4. ${m.approval}`,
    ])
  })

  it("links each chapter to its own page", () => {
    renderTabs()
    expect(tab(m.criteria)?.getAttribute("href")).toBe("/model/criteria")
    expect(tab(m.approval)?.getAttribute("href")).toBe("/model/approval")
  })

  it("marks the current chapter, and only it, as the current page", () => {
    renderTabs()
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
    expect(current).toHaveLength(1)
    expect(current[0]?.textContent).toContain(m.method)
  })

  // A tab is its number and its name, nothing else: the counts and the done
  // marks belong to the spine directly above.
  // A tab is its number and its name, nothing else: the counts belong to the
  // instrument on the title row above.
  it("carries neither a count nor a done mark", () => {
    renderTabs()
    for (const link of screen.getAllByRole("link")) {
      expect(link.textContent).not.toMatch(/\d+ of \d+/)
      expect(link.querySelector("[aria-hidden]")).toBeNull()
    }
  })

  // The underline is positioned against the TAB (inset-x-2), which only hugs
  // the text while the tab holds nothing but its label. jsdom cannot measure
  // boxes, so what is pinned is the condition the geometry rests on.
  it("keeps the tab a label, so its underline hugs the text", () => {
    renderTabs()
    const current = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("aria-current") === "page")
    const underline = current?.querySelector(".bg-foreground")
    expect(underline?.parentElement).toBe(current)
    expect(underline?.className).toContain("inset-x-2")
    // Only the number's span and the bar itself: nothing sits beside the text
    // that the bar would then have to stretch across.
    expect(current?.querySelectorAll("span")).toHaveLength(2)
  })

  // The position recedes to muted so the four names carry the row, which means
  // it is styled apart from the name and therefore has to stay inside the
  // message rather than being concatenated around it.
  it("mutes the chapter's position without splitting the label", () => {
    renderTabs()
    const current = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("aria-current") === "page")
    const number = [...(current?.querySelectorAll("span") ?? [])].find((span) =>
      span.className.includes("text-muted-foreground")
    )
    expect(number?.textContent).toBe("3.")
  })
})
