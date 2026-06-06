import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ConfirmButtons } from "@/components/confirm-buttons"

function renderButtons(
  onConfirm: () => void | Promise<void> = () => {},
  disabled?: boolean
) {
  return render(
    <ConfirmButtons
      triggerText="Change choice"
      confirmLabel="Discard"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      disabled={disabled}
    />
  )
}

describe("ConfirmButtons", () => {
  afterEach(() => {
    cleanup()
  })

  it("arming reveals the confirm and cancel buttons without confirming", () => {
    const onConfirm = vi.fn()
    renderButtons(onConfirm)

    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Change choice" }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Discard" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined()
    // The trigger is hidden from the accessibility tree while armed but stays
    // in the DOM so the wrapper keeps its size (zero layout shift).
    expect(screen.queryByRole("button", { name: "Change choice" })).toBeNull()
  })

  it("moves focus to the confirm button when armed", () => {
    renderButtons()
    fireEvent.click(screen.getByRole("button", { name: "Change choice" }))
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Discard" })
    )
  })

  it("confirm calls onConfirm and disarms", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderButtons(onConfirm)

    fireEvent.click(screen.getByRole("button", { name: "Change choice" }))
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    // The trigger returns to the accessibility tree once disarmed.
    expect(
      await screen.findByRole("button", { name: "Change choice" })
    ).toBeDefined()
  })

  it("cancel disarms without confirming", async () => {
    const onConfirm = vi.fn()
    renderButtons(onConfirm)

    fireEvent.click(screen.getByRole("button", { name: "Change choice" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      await screen.findByRole("button", { name: "Change choice" })
    ).toBeDefined()
  })

  it("disabled blocks every inner button", () => {
    const onConfirm = vi.fn()
    const view = render(
      <ConfirmButtons
        triggerText="Change choice"
        confirmLabel="Discard"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Change choice" }))
    view.rerender(
      <ConfirmButtons
        triggerText="Change choice"
        confirmLabel="Discard"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        disabled
      />
    )
    expect(screen.getByRole("button", { name: "Discard" })).toHaveProperty(
      "disabled",
      true
    )
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
      "disabled",
      true
    )
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
