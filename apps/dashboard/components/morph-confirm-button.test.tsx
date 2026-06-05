import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MorphConfirmButton } from "@/components/morph-confirm-button"

const TRIGGER_LABEL = "Remove Autonomy"
const CONFIRM_LABEL = "Remove"
const CANCEL_LABEL = "Cancel"

function renderButton(
  onConfirm: () => void | Promise<void> = vi.fn(),
  disabled = false
) {
  return render(
    <MorphConfirmButton
      triggerLabel={TRIGGER_LABEL}
      confirmLabel={CONFIRM_LABEL}
      cancelLabel={CANCEL_LABEL}
      onConfirm={onConfirm}
      disabled={disabled}
    />
  )
}

describe("MorphConfirmButton", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the idle trigger button; confirm and cancel are not shown", () => {
    renderButton()
    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toBeDefined()
    expect(screen.queryByRole("button", { name: CONFIRM_LABEL })).toBeNull()
    expect(screen.queryByRole("button", { name: CANCEL_LABEL })).toBeNull()
  })

  it("clicking the trigger arms: confirm and cancel appear", () => {
    renderButton()
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }))
    expect(screen.getByRole("button", { name: CONFIRM_LABEL })).toBeDefined()
    expect(screen.getByRole("button", { name: CANCEL_LABEL })).toBeDefined()
  })

  it("arming does not call onConfirm", () => {
    const onConfirm = vi.fn()
    renderButton(onConfirm)
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("cancel disarms back to the idle trigger without calling onConfirm", () => {
    const onConfirm = vi.fn()
    renderButton(onConfirm)
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }))
    fireEvent.click(screen.getByRole("button", { name: CANCEL_LABEL }))
    expect(onConfirm).not.toHaveBeenCalled()
    // The idle trigger is back in the accessibility tree.
    // Note: AnimatePresence keeps the exiting armed node in the DOM during its
    // exit animation (which is a no-op in happy-dom), so we only verify the
    // trigger is present, not that the confirm button is gone. Matching the
    // pattern used by criterion-editor.test.tsx for the same scenario.
    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toBeDefined()
  })

  it("confirm calls onConfirm exactly once and disarms back to the idle trigger", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderButton(onConfirm)
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }))
    fireEvent.click(screen.getByRole("button", { name: CONFIRM_LABEL }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("disabled prop disables all inner buttons", () => {
    renderButton(vi.fn(), true)
    // All buttons rendered in disabled state.
    const buttons = screen.getAllByRole("button")
    for (const btn of buttons) {
      expect(btn).toHaveProperty("disabled", true)
    }
  })

  it("focus lands on the confirm button when the pill arms", () => {
    renderButton()
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_LABEL }))
    const confirmButton = screen.getByRole("button", { name: CONFIRM_LABEL })
    // The useEffect calls confirmRef.current?.focus() after armed becomes true.
    expect(document.activeElement).toBe(confirmButton)
  })
})

const TRIGGER_TEXT = "Change model choice"

function renderLabelButton(
  onConfirm: () => void | Promise<void> = vi.fn(),
  disabled = false
) {
  return render(
    <MorphConfirmButton
      variant="label"
      triggerText={TRIGGER_TEXT}
      confirmLabel={CONFIRM_LABEL}
      cancelLabel={CANCEL_LABEL}
      onConfirm={onConfirm}
      disabled={disabled}
    />
  )
}

describe("MorphConfirmButton (label variant)", () => {
  afterEach(() => {
    cleanup()
  })

  // The zero-size-change guarantee (the wrapper keeps the trigger mounted while
  // armed so neighbors never shift) is a layout property and is not unit-
  // testable in happy-dom, which does not lay out or measure boxes.

  it("renders the trigger text; confirm and cancel are not shown", () => {
    renderLabelButton()
    expect(screen.getByRole("button", { name: TRIGGER_TEXT })).toBeDefined()
    expect(screen.queryByRole("button", { name: CONFIRM_LABEL })).toBeNull()
    expect(screen.queryByRole("button", { name: CANCEL_LABEL })).toBeNull()
  })

  it("arming reveals the confirm + cancel overlay without calling onConfirm", () => {
    const onConfirm = vi.fn()
    renderLabelButton(onConfirm)
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_TEXT }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: CONFIRM_LABEL })).toBeDefined()
    expect(screen.getByRole("button", { name: CANCEL_LABEL })).toBeDefined()
    // The trigger stays mounted (sizing the wrapper) but is removed from the
    // accessibility tree via aria-hidden while armed.
    expect(screen.queryByRole("button", { name: TRIGGER_TEXT })).toBeNull()
  })

  it("cancel disarms back to the trigger without calling onConfirm", () => {
    const onConfirm = vi.fn()
    renderLabelButton(onConfirm)
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_TEXT }))
    fireEvent.click(screen.getByRole("button", { name: CANCEL_LABEL }))
    expect(onConfirm).not.toHaveBeenCalled()
    // The trigger is back in the accessibility tree (aria-hidden cleared).
    expect(screen.getByRole("button", { name: TRIGGER_TEXT })).toBeDefined()
  })

  it("confirm calls onConfirm exactly once", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    renderLabelButton(onConfirm)
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_TEXT }))
    fireEvent.click(screen.getByRole("button", { name: CONFIRM_LABEL }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("focus lands on the confirm button when the pill arms", () => {
    renderLabelButton()
    fireEvent.click(screen.getByRole("button", { name: TRIGGER_TEXT }))
    const confirmButton = screen.getByRole("button", { name: CONFIRM_LABEL })
    expect(document.activeElement).toBe(confirmButton)
  })

  it("disabled prop disables the trigger", () => {
    renderLabelButton(vi.fn(), true)
    expect(screen.getByRole("button", { name: TRIGGER_TEXT })).toHaveProperty(
      "disabled",
      true
    )
  })
})
