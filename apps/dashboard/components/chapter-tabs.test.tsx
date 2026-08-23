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
  extras: { action?: React.ReactNode } = {}
) {
  return render(
    <ChapterActionSlotProvider>
      <ChapterTabs navLabel="Chapters" tabs={TABS} underlineId={underlineId} />
      {extras.action !== undefined && (
        <ChapterAction>{extras.action}</ChapterAction>
      )}
    </ChapterActionSlotProvider>
  )
}

// The row's own box, which is what holds the section's content at a constant Y.
const rowOf = (container: HTMLElement) =>
  container.querySelector('[class*="min-h-7"]') as HTMLElement | null

describe("ChapterTabs", () => {
  afterEach(cleanup)

  // The journey row is the tabs and this chapter's action, and nothing else.
  // The journey's own instrument sits on the title row above, with the
  // section's name.
  it("carries the tabs and the chapter's action, and no instrument", () => {
    const { container } = renderRow("x-underline", {
      action: <button type="button">Export</button>,
    })
    const row = rowOf(container)
    const clusters = [...(row?.children ?? [])] as HTMLElement[]
    expect(clusters).toHaveLength(2)
    expect(clusters[0]?.tagName).toBe("NAV")
    expect(clusters[1]?.getAttribute("data-slot")).toBe("chapter-action")
    expect(clusters[1]?.textContent).toBe("Export")
    // The row draws no progress of its own: an instrument here would be the
    // drift back to the shape the owner rejected.
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
    // One auto margin only, on the action: a second would split the free
    // space instead of consuming it.
    expect(clusters[1]?.className).toContain("ms-auto")
    expect(
      clusters.filter((cluster) => cluster.className.includes("ms-auto"))
    ).toHaveLength(1)
  })

  // The row's height is the action button's, held whether or not a chapter
  // offers one, so the content below starts at the same Y on every chapter.
  it("holds one height with an action and without one", () => {
    const { container: bare } = renderRow()
    expect(rowOf(bare)?.className).toContain("min-h-7")
    cleanup()
    const { container: full } = renderRow("x-underline", {
      action: <button type="button">Export</button>,
    })
    expect(rowOf(full)?.className).toContain("min-h-7")
    // Wrapping, not squeezing: at a narrow width the action drops to its own
    // right-aligned line rather than the tabs truncating. That is the only
    // wrap this row has.
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
