import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MorphPopover } from "@/components/morph-popover"

function renderPopover() {
  return render(
    <MorphPopover
      triggerLabel="Review"
      title="AI assistance"
      description="Nothing is applied automatically."
      closeLabel="Close"
    >
      <p>panel content</p>
    </MorphPopover>
  )
}

describe("MorphPopover", () => {
  afterEach(() => {
    cleanup()
  })

  it("opens into a labelled dialog with the content", () => {
    renderPopover()
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Review" }))

    expect(screen.getByRole("dialog", { name: "AI assistance" })).toBeDefined()
    expect(screen.getByText("panel content")).toBeDefined()
    // The trigger is hidden from the accessibility tree while open but stays
    // mounted so the wrapper keeps its size (zero layout shift).
    expect(screen.queryByRole("button", { name: "Review" })).toBeNull()
  })

  it("the close button morphs back to the trigger", async () => {
    renderPopover()
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(await screen.findByRole("button", { name: "Review" })).toBeDefined()
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("Escape closes the panel", async () => {
    renderPopover()
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })

    expect(await screen.findByRole("button", { name: "Review" })).toBeDefined()
  })

  it("Escape does not reach a host that also closes on Escape", async () => {
    // The panel is rendered inside dismissable hosts (the create-role Dialog),
    // where an Escape that kept bubbling would throw away the half-filled form
    // underneath it. Asserting the propagation, not just the close, because
    // the close alone passes either way.
    // A document-level listener is how the real host dismisses: Base UI's
    // Dialog registers its Escape handling on document, so this stands in for
    // it exactly rather than approximating it with a React parent handler.
    const onKeyDown = vi.fn()
    document.addEventListener("keydown", onKeyDown)
    try {
      renderPopover()
      fireEvent.click(screen.getByRole("button", { name: "Review" }))
      const panel = screen.getByRole("dialog")

      // Same element, same open state, so the two assertions are a true A/B:
      // a non-Escape key proves keydown DOES reach document from the panel...
      fireEvent.keyDown(panel, { key: "a" })
      expect(onKeyDown).toHaveBeenCalledTimes(1)

      // ...and Escape proves only the dismissal is held back.
      fireEvent.keyDown(panel, { key: "Escape" })
      expect(onKeyDown).toHaveBeenCalledTimes(1)
      expect(
        await screen.findByRole("button", { name: "Review" })
      ).toBeDefined()
    } finally {
      document.removeEventListener("keydown", onKeyDown)
    }
  })

  it("moves focus to the close button on open", () => {
    renderPopover()
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" })
    )
  })

  // The primitive actually consumes the placement helper. happy-dom reports
  // every rect as zero, so the trigger and the panel content are given real
  // boxes: a trigger 120px wide in the right gutter of a wide viewport, where
  // a panel anchored to the trigger's left edge would grow straight off the
  // screen and so must be placed fully on-screen instead.
  it("flips the panel inward when the preferred side would leave the screen", () => {
    const original = Element.prototype.getBoundingClientRect
    const innerWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1814,
    })
    Element.prototype.getBoundingClientRect = function measured(this: Element) {
      // The trigger: a small button hard against the page's right gutter.
      if (this.tagName === "BUTTON") {
        return { left: 1670, right: 1790, width: 120, height: 36 } as DOMRect
      }
      // The panel's content, at its settled w-[26rem].
      if (this.className.includes("space-y-4")) {
        return { left: 0, right: 416, width: 416, height: 300 } as DOMRect
      }
      return { left: 0, right: 0, width: 0, height: 0 } as DOMRect
    }
    try {
      // anchor="left" would grow 416px rightward from x=1670, off the screen.
      render(
        <MorphPopover
          triggerLabel="Review"
          anchor="left"
          title="AI assistance"
          closeLabel="Close"
        >
          <p>panel content</p>
        </MorphPopover>
      )
      fireEvent.click(screen.getByRole("button", { name: "Review" }))
      const panel = screen.getByRole("dialog")
      // Flipped to the trigger's other edge, and anchored there rather than
      // shifted off it: the panel now grows leftward, into the page.
      expect(panel.className).toContain("right-0")
      expect(panel.className).not.toContain("left-0")
      expect(panel.style.right).toBe("0px")
    } finally {
      Element.prototype.getBoundingClientRect = original
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: innerWidth,
      })
    }
  })
})
