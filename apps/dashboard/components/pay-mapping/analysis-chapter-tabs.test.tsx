import { cleanup, render, screen, within } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026/analysis/equal-work",
}))

// NumberFlow renders a custom element happy-dom never upgrades. The digit
// animation is the library's business; these tests are about the figures.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { AnalysisChapterTabs } from "@/components/pay-mapping/analysis-chapter-tabs"

const m = messages.dashboard.payMapping.review
const mAnalysis = messages.dashboard.payMapping.analysis

// Skewed on purpose, and deliberately not in size order: a tab wired to the
// wrong chapter's progress would pick up a different pair, so every figure
// below is unique to one chapter.
const CHAPTERS = [
  { key: "start" as const, done: 1, total: 1 },
  { key: "praxis" as const, done: 2, total: 9 },
  { key: "equalWork" as const, done: 3, total: 17 },
  { key: "equivalentWork" as const, done: 0, total: 5 },
]

// The row reads the path for WHICH chapter is open, and takes each chapter's
// progress from the section shell, which hands the same array to the spine.
// `null` stands for "the run has not loaded yet", because an explicit
// `undefined` argument would fall back to the default parameter instead.
function renderTabs(chapters: typeof CHAPTERS | null = CHAPTERS) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AnalysisChapterTabs chapters={chapters ?? undefined} />
    </NextIntlClientProvider>
  )
}

function tab(label: string) {
  return screen
    .getAllByRole("link")
    .find((link) => link.textContent?.includes(label))
}

afterEach(() => cleanup())

describe("AnalysisChapterTabs", () => {
  // Only the chapter being worked in prints its own figures: a pair on all
  // four would turn a switcher into a status table, and the reader only ever
  // needs the one they are inside.
  it("prints the open chapter's own count, and no other tab's", () => {
    renderTabs()
    const open = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("aria-current") === "page")
    // Lika arbete is the open chapter (the mocked path), so its own 3 of 17.
    expect(open?.textContent).toBe(`3. ${m.chaptersShort.equalWork}3 of 17`)
    const count = open?.querySelector(".tabular-nums")
    expect(count?.className).toContain("text-muted-foreground")
    // Both figures move while the reader works inside the chapter, so each is
    // its OWN element carrying NumberFlow (the mock stands in for it).
    expect(
      [...(count?.children ?? [])].map((node) => node.textContent)
    ).toEqual(["3", "17"])
    for (const link of screen.getAllByRole("link")) {
      if (link.getAttribute("aria-current") === "page") continue
      expect(link.querySelector(".tabular-nums")).toBeNull()
      expect(link.textContent).not.toMatch(/\d+ of \d+/)
    }
  })

  // Withheld while the run is loading, so a tab never prints a zero it is
  // about to replace.
  it("prints no count at all until the run knows one", () => {
    renderTabs(null)
    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector(".tabular-nums")).toBeNull()
    }
  })

  it("names the four chapters and nothing else, with the short labels", () => {
    // Four tabs, all of them work. A fifth for the section index existed
    // briefly and named a page that listed no steps.
    renderTabs()
    const nav = screen.getByRole("navigation", { name: mAnalysis.chapterNav })
    const links = within(nav).getAllByRole("link")
    expect(links).toHaveLength(4)
    // Short names: the descriptive titles read as a paragraph in a row that
    // also carries four counts.
    expect(links[2]?.textContent).toContain(m.chaptersShort.equalWork)
    expect(links[2]?.textContent).not.toContain(m.chapters.equalWork)
  })

  it("links each chapter to its own page", () => {
    renderTabs()
    expect(tab(m.chaptersShort.equivalentWork)?.getAttribute("href")).toBe(
      "/pay-mappings/pay-2026/analysis/equivalent-work"
    )
    expect(tab(m.chaptersShort.start)?.getAttribute("href")).toBe(
      "/pay-mappings/pay-2026/analysis/start"
    )
  })

  // A tab is its number and its name, nothing else. Four pairs of numbers in
  // one row read as a status table when the reader only ever needs the pair
  // they are working in, and the done mark that replaced them still spent a
  // slot the row had to keep empty on every unfinished chapter, so both are
  // gone: progress lives in the spine above and on the completion panel.
  it("carries no done mark, on any tab", () => {
    renderTabs()
    for (const link of screen.getAllByRole("link")) {
      expect(link.textContent).not.toContain(m.status.done)
      expect(link.querySelector("[aria-hidden]")).toBeNull()
    }
  })

  it("marks the current chapter, and only it, as the current page", () => {
    renderTabs()
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
    expect(current).toHaveLength(1)
    expect(current[0]?.textContent).toContain(m.chaptersShort.equalWork)
  })

  // The underline is positioned against the TAB (inset-x-2, matching the row
  // above), which only hugs the text while the tab holds nothing but its
  // label. It once held a done mark's slot in front of the label and the bar
  // ran 20px past the start of the text on every unfinished chapter, with
  // nothing above that stretch. jsdom cannot measure boxes, so what is pinned
  // is the condition the geometry rests on.
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
    // The tab reads as one label, number included, with its own figures after
    // it on the open chapter.
    expect(current?.textContent).toBe(`3. ${m.chaptersShort.equalWork}3 of 17`)
  })
})
