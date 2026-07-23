import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { Accordion } from "@workspace/ui/components/accordion"
import { afterEach, describe, expect, it } from "vitest"
import { AccordionSection } from "@/components/accordion-section"

function renderSection(meta?: string) {
  return render(
    <Accordion multiple defaultValue={["a"]}>
      <AccordionSection value="a" title="Praxis" meta={meta}>
        <p>Section content</p>
      </AccordionSection>
    </Accordion>
  )
}

afterEach(() => cleanup())

describe("AccordionSection", () => {
  it("renders the title and, when given one, the right-aligned meta", () => {
    renderSection("2 of 4")
    expect(screen.getByText("Praxis")).toBeDefined()
    expect(screen.getByText("2 of 4")).toBeDefined()
  })

  it("omits the meta span entirely when meta is not given", () => {
    renderSection(undefined)
    expect(screen.getByText("Praxis")).toBeDefined()
    // Nothing else muted/tabular-nums renders next to the title.
    const trigger = screen.getByRole("button", { name: "Praxis" })
    expect(trigger.querySelector(".tabular-nums")).toBeNull()
  })

  it("renders its own chevron, aria-hidden, ahead of the title", () => {
    renderSection()
    const trigger = screen.getByRole("button", { name: "Praxis" })
    const ownIcon = trigger.querySelector("svg[aria-hidden='true']")
    expect(ownIcon).not.toBeNull()
  })

  it("carries exactly one SVG the [&>svg]:hidden! rule cannot reach (nested, not a direct child), so exactly one chevron stays visible in a real browser", () => {
    renderSection()
    const trigger = screen.getByRole("button", { name: "Praxis" })
    const allSvgs = trigger.querySelectorAll("svg")
    // AccordionSection's own chevron + the vendor trigger's own up/down pair.
    expect(allSvgs.length).toBe(3)

    const directChildSvgs = Array.from(trigger.children).filter(
      (child) => child.tagName.toLowerCase() === "svg"
    )
    // The vendor's own pair renders as direct children of the trigger
    // button, which `[&>svg]:hidden!` (a direct-child selector) hides.
    expect(directChildSvgs.length).toBe(2)
    // AccordionSection's own chevron is nested inside the title span, one
    // level deeper, so that selector never reaches it: it is the one SVG
    // left visible.
    expect(allSvgs.length - directChildSvgs.length).toBe(1)
  })

  it("toggles the content when the trigger is clicked", () => {
    renderSection()
    expect(screen.getByText("Section content")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Praxis" }))
    expect(screen.queryByText("Section content")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Praxis" }))
    expect(screen.getByText("Section content")).toBeDefined()
  })
})
