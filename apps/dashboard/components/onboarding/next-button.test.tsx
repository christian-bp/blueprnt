import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { NextButton } from "@/components/onboarding/next-button"

const nextCta = messages.dashboard.onboarding.screens.nextCta

function renderButton(props: Parameters<typeof NextButton>[0] = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NextButton {...props} />
    </NextIntlClientProvider>
  )
}

describe("NextButton", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the Next label with a decorative arrow icon", () => {
    renderButton()
    const button = screen.getByRole("button", { name: nextCta })
    // The arrow is aria-hidden so the accessible name stays just "Next".
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true"
    )
  })

  it("passes through disabled and click handling", () => {
    const onClick = vi.fn()
    renderButton({ disabled: true, onClick })
    const button = screen.getByRole("button", { name: nextCta })
    expect(button).toHaveProperty("disabled", true)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
