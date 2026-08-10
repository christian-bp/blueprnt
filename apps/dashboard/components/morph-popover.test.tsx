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
})
