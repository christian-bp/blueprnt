import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ChapterTabs, chapterTabNumber } from "@/components/chapter-tabs"

const TABS = [
  { key: "one", label: "First", href: "/x/one", current: false },
  { key: "two", label: "Second", href: "/x/two", current: true },
  { key: "three", label: "Third", href: "/x/three", current: false },
]

function renderRow(underlineId = "x-underline") {
  return render(
    <ChapterTabs navLabel="Chapters" underlineId={underlineId} tabs={TABS} />
  )
}

describe("ChapterTabs", () => {
  afterEach(cleanup)

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
