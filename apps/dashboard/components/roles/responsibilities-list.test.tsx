import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ResponsibilitiesList } from "@/components/roles/responsibilities-list"

describe("ResponsibilitiesList", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders one list item per non-empty line", () => {
    render(
      <ResponsibilitiesList value={"Ship features\nReview code\nMentor"} />
    )
    const items = screen.getAllByRole("listitem")
    expect(items.map((li) => li.textContent)).toEqual([
      "Ship features",
      "Review code",
      "Mentor",
    ])
  })

  it("drops blank and whitespace-only lines", () => {
    render(<ResponsibilitiesList value={"First\n\n   \nSecond\n"} />)
    const items = screen.getAllByRole("listitem")
    expect(items.map((li) => li.textContent)).toEqual(["First", "Second"])
  })

  it("strips a leading list marker so we never get a double bullet", () => {
    render(
      <ResponsibilitiesList
        value={"- Dash item\n* Star item\n• Dot item\n1. Numbered\n1) Parened"}
      />
    )
    const items = screen.getAllByRole("listitem")
    expect(items.map((li) => li.textContent)).toEqual([
      "Dash item",
      "Star item",
      "Dot item",
      "Numbered",
      "Parened",
    ])
    // The single bullet comes from the <ul>, not a leading marker in the text.
    for (const li of items) {
      expect(li.textContent?.startsWith("-")).toBe(false)
      expect(li.textContent?.startsWith("•")).toBe(false)
    }
  })

  it("leaves marker-like text without a following space intact", () => {
    // "e-mail" and "3 reports" must not be mistaken for list markers.
    render(<ResponsibilitiesList value={"Manage e-mail\n3 reports"} />)
    const items = screen.getAllByRole("listitem")
    expect(items.map((li) => li.textContent)).toEqual([
      "Manage e-mail",
      "3 reports",
    ])
  })

  it("renders a single item for a single line", () => {
    render(<ResponsibilitiesList value="Just one" />)
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(1)
    expect(items[0]?.textContent).toBe("Just one")
  })

  it("renders nothing for an empty or whitespace-only value", () => {
    const { rerender } = render(<ResponsibilitiesList value="" />)
    expect(screen.queryByRole("list")).toBeNull()
    rerender(<ResponsibilitiesList value={"   \n  \n"} />)
    expect(screen.queryByRole("list")).toBeNull()
  })

  it("applies the id to the list element", () => {
    render(<ResponsibilitiesList id="profile-responsibilities" value="One" />)
    expect(screen.getByRole("list").getAttribute("id")).toBe(
      "profile-responsibilities"
    )
  })

  it("merges a host className onto the list (for emphasis control)", () => {
    render(
      <ResponsibilitiesList value="One" className="text-muted-foreground" />
    )
    const list = screen.getByRole("list")
    // The base classes stay; the host class is appended.
    expect(list.className).toContain("list-disc")
    expect(list.className).toContain("text-muted-foreground")
  })
})
