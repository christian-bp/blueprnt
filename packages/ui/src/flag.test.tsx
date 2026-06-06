import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Flag } from "@workspace/ui/flag"

describe("Flag", () => {
  afterEach(() => {
    cleanup()
  })

  it("builds the asset URL from size and uppercased code", () => {
    render(<Flag code="se" size="M" alt="Sverige" />)
    const img = screen.getByRole("img", { name: "Sverige" })
    expect(img.getAttribute("src")).toContain("/flags/m/SE.svg")
  })

  it("defaults to size L and the bare code as alt", () => {
    render(<Flag code="NO" />)
    const img = screen.getByRole("img", { name: "NO" })
    expect(img.getAttribute("src")).toContain("/flags/l/NO.svg")
  })

  it("renders the border overlay by default and omits it when disabled", () => {
    const withBorder = render(<Flag code="DK" alt="Danmark" />)
    expect(withBorder.container.querySelectorAll("img + div").length).toBe(1)
    cleanup()

    const withoutBorder = render(
      <Flag code="DK" alt="Danmark" hasBorder={false} />
    )
    expect(withoutBorder.container.querySelectorAll("img + div").length).toBe(0)
  })
})
