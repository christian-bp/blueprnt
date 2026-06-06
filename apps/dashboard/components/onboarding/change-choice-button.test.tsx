import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { ChangeChoiceButton } from "@/components/onboarding/change-choice-button"

const change = messages.dashboard.model.change

function renderButton(
  onConfirm: () => void | Promise<void> = () => {},
  disabled?: boolean
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ChangeChoiceButton onConfirm={onConfirm} disabled={disabled} />
    </NextIntlClientProvider>
  )
}

describe("ChangeChoiceButton", () => {
  afterEach(() => {
    cleanup()
  })

  it("starts unarmed with only the cta and does not confirm on the first click", () => {
    const onConfirm = vi.fn()
    renderButton(onConfirm)

    // Unarmed: confirm and cancel are not shown.
    expect(screen.queryByRole("button", { name: change.confirm })).toBeNull()
    expect(screen.queryByRole("button", { name: change.cancel })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: change.cta }))
    // Arming does not call onConfirm.
    expect(onConfirm).not.toHaveBeenCalled()
    // Now the confirm and cancel buttons are revealed.
    expect(screen.getByRole("button", { name: change.confirm })).toBeDefined()
    expect(screen.getByRole("button", { name: change.cancel })).toBeDefined()
  })

  it("cancel disarms back to the cta without confirming", () => {
    const onConfirm = vi.fn()
    renderButton(onConfirm)

    fireEvent.click(screen.getByRole("button", { name: change.cta }))
    fireEvent.click(screen.getByRole("button", { name: change.cancel }))

    expect(onConfirm).not.toHaveBeenCalled()
    // The cta trigger is back in the accessibility tree (aria-hidden cleared).
    // Note: AnimatePresence keeps the exiting armed pill in the DOM during its
    // exit animation (a no-op in happy-dom), so we only verify the trigger is
    // present, not that the confirm button is gone, matching the morph-confirm
    // -button cancel test for the same scenario.
    expect(screen.getByRole("button", { name: change.cta })).toBeDefined()
  })

  it("confirm calls onConfirm", () => {
    const onConfirm = vi.fn()
    renderButton(onConfirm)

    fireEvent.click(screen.getByRole("button", { name: change.cta }))
    fireEvent.click(screen.getByRole("button", { name: change.confirm }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("disables the cta when disabled", () => {
    renderButton(() => {}, true)
    expect(screen.getByRole("button", { name: change.cta })).toHaveProperty(
      "disabled",
      true
    )
  })
})
