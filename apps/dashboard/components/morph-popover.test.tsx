import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
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

  it("moves focus to the close button on open", () => {
    renderPopover()
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" })
    )
  })
})
