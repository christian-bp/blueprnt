import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BrandMark } from "@/components/brand-mark"

describe("BrandMark", () => {
  it("is announced by its label when given one", () => {
    render(<BrandMark label="blueprnt" />)
    expect(screen.getByRole("img", { name: "blueprnt" })).toBeTruthy()
  })

  it("is decorative without a label", () => {
    const { container } = render(<BrandMark />)
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true"
    )
  })

  it("draws the primary square at rail size", () => {
    const { container } = render(<BrandMark />)
    const square = container.firstElementChild as HTMLElement
    expect(square.className).toContain("size-7")
    expect(square.className).toContain("bg-primary")
  })
})
