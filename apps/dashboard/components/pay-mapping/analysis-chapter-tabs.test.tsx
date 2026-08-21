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

// The row reads the path for WHICH chapter is open, and takes each chapter's
// progress from the section shell, which hands the same array to the spine.
// `null` stands for "the run has not loaded yet", because an explicit
// `undefined` argument would fall back to the default parameter instead.
function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AnalysisChapterTabs />
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
  // The journey's own instrument sits on the title row above this one. A
  // progressbar here would be the drift back to the shape the owner rejected.
  it("draws no instrument of its own", () => {
    const { container } = renderTabs()
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
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
  // A tab is its number and its name, nothing else: the counts belong to the
  // instrument on the title row above.
  it("carries neither a count nor a done mark", () => {
    renderTabs()
    for (const link of screen.getAllByRole("link")) {
      expect(link.textContent).not.toMatch(/\d+ of \d+/)
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
    // The tab reads as one label, number included, with its own figures after
    // it on the open chapter.
    expect(current?.textContent).toBe(`3. ${m.chaptersShort.equalWork}`)
  })
})
