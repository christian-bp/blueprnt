import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DisclosureChevron,
  DisclosureToggle,
} from "@/components/disclosure-toggle"

describe("DisclosureToggle", () => {
  afterEach(() => cleanup())

  // LABEL FIRST, chevron after. The label is what the reader is looking for;
  // the chevron only says which way it will go.
  it("puts the label before the chevron", () => {
    render(<DisclosureToggle label="Show me" open={false} onToggle={vi.fn()} />)
    const button = screen.getByRole("button", { name: "Show me" })
    expect(button.textContent).toBe("Show me")
    expect(button.firstChild?.textContent).toBe("Show me")
  })

  // aria-expanded carries the state, which is why the chevron can be
  // decorative and rotate rather than swapping glyphs: the control's width
  // stays fixed and its box does not jog as it opens.
  it("carries its state on aria-expanded, not on the glyph", () => {
    const { rerender } = render(
      <DisclosureToggle label="Show me" open={false} onToggle={vi.fn()} />
    )
    const button = screen.getByRole("button", { name: "Show me" })
    expect(button.getAttribute("aria-expanded")).toBe("false")
    const svg = button.querySelector("svg")
    expect(svg?.getAttribute("aria-hidden")).toBe("true")

    rerender(<DisclosureToggle label="Show me" open onToggle={vi.fn()} />)
    expect(
      screen
        .getByRole("button", { name: "Show me" })
        .getAttribute("aria-expanded")
    ).toBe("true")
  })

  it("reports a press to its caller", () => {
    const onToggle = vi.fn()
    render(
      <DisclosureToggle label="Show me" open={false} onToggle={onToggle} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Show me" }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  // The caller owns the panel: this is the trigger only, so a surface can
  // reveal in place, inside a table cell, or through AnimatePresence without
  // this component knowing which.
  it("renders no panel of its own", () => {
    const { container } = render(
      <DisclosureToggle label="Show me" open onToggle={vi.fn()} />
    )
    expect(container.querySelectorAll("button").length).toBe(1)
  })

  // The glyph is exported separately for the ONE surface that cannot use the
  // button: the audit log's story row, whose whole <TableRow> is already the
  // button. Both must draw the same rotation, or the two copies this
  // extraction removed grow back.
  it("shares one chevron spec with the surfaces that cannot use the button", () => {
    const { container: standalone } = render(<DisclosureChevron open />)
    const { container: inButton } = render(
      <DisclosureToggle label="Show me" open onToggle={vi.fn()} />
    )
    const chevronClass = standalone.querySelector("svg")?.getAttribute("class")
    expect(chevronClass).toContain("rotate-180")
    expect(inButton.querySelector("svg")?.getAttribute("class")).toBe(
      chevronClass
    )
  })

  it("leaves the chevron unrotated while closed", () => {
    const { container } = render(<DisclosureChevron open={false} />)
    expect(container.querySelector("svg")?.getAttribute("class")).not.toContain(
      "rotate-180"
    )
  })
})
