import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { TableSearchField } from "./table-search-field"

afterEach(() => cleanup())

describe("TableSearchField", () => {
  it("defaults to the toolbar width", () => {
    render(<TableSearchField placeholder="Search" />)
    expect(screen.getByLabelText("Search").className).toContain("w-64")
  })

  it("lets a call site widen it (the analysis worklist passes w-full)", () => {
    render(<TableSearchField placeholder="Search" className="w-full" />)
    const input = screen.getByLabelText("Search")
    expect(input.className).toContain("w-full")
    expect(input.className).not.toContain("w-64")
  })
})
