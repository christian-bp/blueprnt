import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  ChapterAction,
  ChapterActionSlotProvider,
} from "@/components/chapter-action-slot"
import { ChapterTabs, chapterTabNumber } from "@/components/chapter-tabs"

const TABS = [
  { key: "one", label: "First", href: "/x/one", current: false },
  { key: "two", label: "Second", href: "/x/two", current: true },
  { key: "three", label: "Third", href: "/x/three", current: false },
]

function renderRow(
  underlineId = "x-underline",
  extras: { instrument?: React.ReactNode; action?: React.ReactNode } = {}
) {
  return render(
    <ChapterActionSlotProvider>
      <ChapterTabs
        instrument={extras.instrument}
        navLabel="Chapters"
        tabs={TABS}
        underlineId={underlineId}
      />
      {extras.action !== undefined && (
        <ChapterAction>{extras.action}</ChapterAction>
      )}
    </ChapterActionSlotProvider>
  )
}

// The row's own box, which is what holds the section's content at a constant Y.
const rowOf = (container: HTMLElement) =>
  container.querySelector('[class*="min-h-9"]') as HTMLElement | null

describe("ChapterTabs", () => {
  afterEach(cleanup)

  // The section's journey line: where you are, how far along the whole thing
  // is, and what this chapter offers, on one axis. The three clusters sit in
  // that order, and the instrument is pushed to the right edge by the row's
  // one auto margin.
  it("carries the tabs, the instrument and the chapter's action in order", () => {
    const { container } = renderRow("x-underline", {
      instrument: <div data-testid="instrument" />,
      action: <button type="button">Export</button>,
    })
    const row = rowOf(container)
    const clusters = [...(row?.children ?? [])] as HTMLElement[]
    expect(clusters[0]?.tagName).toBe("NAV")
    expect(
      clusters[1]?.querySelector('[data-testid="instrument"]')
    ).not.toBeNull()
    expect(clusters[1]?.className).toContain("ms-auto")
    expect(clusters[2]?.getAttribute("data-slot")).toBe("chapter-action")
    expect(clusters[2]?.textContent).toBe("Export")
    // One auto margin only: a second would split the free space instead of
    // consuming it, and the instrument would drift to the middle.
    expect(
      clusters.filter((cluster) => cluster.className.includes("ms-auto"))
    ).toHaveLength(1)
  })

  // The row's height is the action button's, held whether or not a chapter
  // offers one, so the content below starts at the same Y on every chapter.
  // The instrument is two pixels tall and must not change it either.
  it("holds one height with an action, without one, and with the instrument", () => {
    const { container: bare } = renderRow()
    expect(rowOf(bare)?.className).toContain("min-h-9")
    cleanup()
    const { container: full } = renderRow("x-underline", {
      instrument: <div className="h-2" data-testid="instrument" />,
      action: <button type="button">Export</button>,
    })
    expect(rowOf(full)?.className).toContain("min-h-9")
    // Wrapping, not squeezing: at a narrow width a cluster drops to its own
    // line rather than the tabs truncating.
    expect(rowOf(full)?.className).toContain("flex-wrap")
  })

  // The slot is always in the DOM, empty or not: it is what keeps a chapter
  // with no action the same height as one with a button.
  it("keeps the action slot present on a chapter that offers nothing", () => {
    const { container } = renderRow()
    const slot = container.querySelector('[data-slot="chapter-action"]')
    expect(slot).not.toBeNull()
    expect(slot?.textContent).toBe("")
  })

  it("renders one link per chapter, under the row's own name", () => {
    renderRow()
    const nav = screen.getByRole("navigation", { name: "Chapters" })
    const links = within(nav).getAllByRole("link")
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/x/one",
      "/x/two",
      "/x/three",
    ])
  })

  it("marks the open chapter, and only it, as the current page", () => {
    renderRow()
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
    expect(current).toHaveLength(1)
    expect(current[0]?.textContent).toBe("Second")
  })

  // A tab is its label and its underline, nothing else: the counts and the
  // done marks belong to the spine directly above the row.
  it("draws the underline on the current tab's own label box", () => {
    renderRow()
    const current = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("aria-current") === "page")
    const underline = current?.querySelector(".bg-foreground")
    expect(underline?.parentElement).toBe(current)
    expect(underline?.className).toContain("inset-x-2")
    for (const link of screen.getAllByRole("link")) {
      expect(link.querySelector("[aria-hidden]")).toBeNull()
    }
  })

  // Six chapters at a narrow width must scroll, never wrap into a second row
  // that would push the chapter's own content off screen.
  it("scrolls rather than wrapping", () => {
    renderRow()
    expect(
      screen.getByRole("navigation", { name: "Chapters" }).className
    ).toContain("overflow-x-auto")
  })

  // The position recedes so the four names carry the row, which means it is
  // styled apart from the name and therefore has to stay inside the message
  // rather than being concatenated around it.
  it("mutes a chapter's position without splitting the label", () => {
    const { container } = render(<span>{chapterTabNumber("2.")}</span>)
    const number = container.querySelector("span span")
    expect(number?.textContent).toBe("2.")
    expect(number?.className).toContain("text-muted-foreground")
    // The gap is a margin, not the message's space: a flex tab drops a
    // whitespace-only text node entirely.
    expect(number?.className).toContain("me-1")
  })
})
