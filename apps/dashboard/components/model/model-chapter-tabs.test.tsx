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

// Skewed on purpose, and deliberately NOT in chapter order by size: a tab
// wired to the wrong chapter's progress would pick up a different pair, so
// every figure below is unique to one chapter.
const CHAPTERS = [
  { key: "criteria" as const, done: 6, total: 7 },
  { key: "weighting" as const, done: 2, total: 3 },
  { key: "method" as const, done: 1, total: 21 },
  { key: "approval" as const, done: 0, total: 1 },
]

// The row reads the path for WHICH chapter is open, and takes each chapter's
// progress from the section shell, which hands the same array to the spine.
// `null` stands for "the section does not know yet", because an explicit
// `undefined` argument would fall back to the default parameter instead.
function renderTabs(chapters: typeof CHAPTERS | null = CHAPTERS) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelChapterTabs chapters={chapters ?? undefined} done={4} total={17} />
    </NextIntlClientProvider>
  )
}

const tab = (label: string) =>
  screen.getAllByRole("link").find((link) => link.textContent?.includes(label))

afterEach(() => cleanup())

describe("ModelChapterTabs", () => {
  // The instrument rides the journey row now, not the title above it: same
  // fixed width in both guided sections, and its announced percentage is the
  // whole model's WORK, not its chapter count.
  it("carries the whole model's instrument on the journey row", () => {
    const { container } = renderTabs()
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute("aria-label")).toBe(m.progressBarLabel)
    // 4 of 17 steps, not 2 of 4 chapters.
    expect(bar?.getAttribute("aria-valuenow")).toBe("24")
    const tokens = (bar?.className ?? "").split(/\s+/)
    expect(tokens).toContain("w-64")
    expect(tokens).toContain("shrink-0")
    // One segment per chapter, all the same width whatever each holds.
    expect(
      [...(bar?.children ?? [])].map(
        (segment) => (segment as HTMLElement).style.flexGrow
      )
    ).toEqual(["1", "1", "1", "1"])
  })

  // The open chapter's segment is held at full strength while the rest
  // recede, which is what ties the instrument to the tab beside it.
  it("holds the open chapter's segment up and lets the rest recede", () => {
    const { container } = renderTabs()
    const bar = container.querySelector('[role="progressbar"]')
    expect(
      [...(bar?.children ?? [])].map(
        (segment) => (segment as HTMLElement).dataset.active
      )
    ).toEqual(["false", "false", "true", "false"])
  })

  // Only the chapter being worked in prints its own figures: a pair on all
  // four would turn a switcher into a status table, and the reader only ever
  // needs the one they are inside.
  it("prints the open chapter's own count, and no other tab's", () => {
    renderTabs()
    const open = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("aria-current") === "page")
    // Metod is the open chapter (the mocked path), so its own 1 of 21.
    expect(open?.textContent).toBe(`3. ${m.method}1 of 21`)
    const count = open?.querySelector(".tabular-nums")
    expect(count?.className).toContain("text-muted-foreground")
    // Both figures move while the reader works inside the chapter, so each is
    // its OWN element carrying NumberFlow (the mock stands in for it).
    expect(
      [...(count?.children ?? [])].map((node) => node.textContent)
    ).toEqual(["1", "21"])
    for (const link of screen.getAllByRole("link")) {
      if (link.getAttribute("aria-current") === "page") continue
      expect(link.querySelector(".tabular-nums")).toBeNull()
      expect(link.textContent).not.toMatch(/\d+ of \d+/)
    }
  })

  // Withheld while the section's progress query is in flight, so a tab never
  // prints a zero it is about to replace.
  it("prints no count at all until the section knows one", () => {
    renderTabs(null)
    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector(".tabular-nums")).toBeNull()
    }
  })

  it("names the four chapters and nothing else", () => {
    renderTabs()
    const nav = screen.getByRole("navigation", { name: m.nav })
    const links = within(nav).getAllByRole("link")
    expect(links).toHaveLength(4)
    // Only the open chapter carries a pair after its name.
    expect(links.map((link) => link.textContent)).toEqual([
      `1. ${m.criteria}`,
      `2. ${m.weighting}`,
      `3. ${m.method}1 of 21`,
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
  it("carries no done mark, on any tab", () => {
    renderTabs()
    for (const link of screen.getAllByRole("link")) {
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
    // The number's span, the count's span and its two figures, and the bar
    // itself: everything inside the tab is visible, which is what lets the
    // bar span the whole of it.
    expect(current?.querySelectorAll("span")).toHaveLength(5)
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
