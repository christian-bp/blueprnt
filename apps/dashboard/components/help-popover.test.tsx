import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { HelpPopover } from "@/components/help-popover"

function renderHelp() {
  return render(
    <HelpPopover label="What is a criterion?">
      Criteria are what roles are rated against.
    </HelpPopover>
  )
}

// Radix renders the portaled popover content only on real pointer events
// (same happy-dom limitation as the Select tests), so these tests assert the
// trigger's wiring and open state; the panel itself is vendor behavior.
describe("HelpPopover", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders an icon-only trigger named by the label", () => {
    renderHelp()
    const trigger = screen.getByRole("button", {
      name: "What is a criterion?",
    })
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  })

  it("toggles the popover open and closed from the trigger", () => {
    renderHelp()
    const trigger = screen.getByRole("button", {
      name: "What is a criterion?",
    })
    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  })
})
