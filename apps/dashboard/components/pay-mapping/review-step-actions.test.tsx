import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReviewStepActions } from "@/components/pay-mapping/review-step-actions"

const t = messages.dashboard.payMapping.review

function renderActions(
  overrides: Partial<{
    onPrevious: () => void
    onSkip: () => void
    primaryDisabled: boolean
    hint: string
  }> = {}
) {
  const onPrimary = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewStepActions
        onPrevious={overrides.onPrevious}
        onSkip={overrides.onSkip}
        primaryLabel="Continue"
        onPrimary={onPrimary}
        primaryDisabled={overrides.primaryDisabled}
        hint={overrides.hint}
      />
    </NextIntlClientProvider>
  )
  return { onPrimary }
}

describe("ReviewStepActions", () => {
  afterEach(() => {
    cleanup()
  })

  it("always renders the primary action and fires onPrimary on click", () => {
    const { onPrimary } = renderActions()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(onPrimary).toHaveBeenCalledTimes(1)
  })

  it("hides Previous and Skip when their callbacks are undefined", () => {
    renderActions()
    expect(screen.queryByRole("button", { name: t.previous })).toBeNull()
    expect(screen.queryByRole("button", { name: t.skip })).toBeNull()
  })

  it("shows Previous and Skip and fires their callbacks when provided", () => {
    const onPrevious = vi.fn()
    const onSkip = vi.fn()
    renderActions({ onPrevious, onSkip })

    fireEvent.click(screen.getByRole("button", { name: t.previous }))
    fireEvent.click(screen.getByRole("button", { name: t.skip }))

    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it("disables the primary action when primaryDisabled is true", () => {
    renderActions({ primaryDisabled: true })
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })

  it("renders the hint when provided and omits it otherwise", () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ReviewStepActions
          primaryLabel="Continue"
          onPrimary={vi.fn()}
          hint="Fill in both fields first."
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Fill in both fields first.")).toBeDefined()

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ReviewStepActions primaryLabel="Continue" onPrimary={vi.fn()} />
      </NextIntlClientProvider>
    )
    expect(screen.queryByText("Fill in both fields first.")).toBeNull()
  })
})
