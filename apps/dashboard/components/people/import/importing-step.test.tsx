import { act, cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ImportingStep } from "./importing-step"

describe("ImportingStep", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("renders a progress bar that advances over time", () => {
    vi.useFakeTimers()
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ImportingStep />
      </NextIntlClientProvider>
    )
    // The vendored shadcn Progress conveys the value through the indicator's
    // translateX(-remaining%) style, so read the remaining percentage there.
    const remaining = () => {
      const indicator = screen
        .getByTestId("import-progress")
        .querySelector('[data-slot="progress-indicator"]') as HTMLElement
      const match = indicator.style.transform.match(/translateX\(-([\d.]+)%\)/)
      return Number(match?.[1])
    }
    const initial = remaining()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    const later = remaining()
    expect(later).toBeLessThan(initial)
    // The simulated progress never claims completion (caps at 90%).
    expect(later).toBeGreaterThanOrEqual(10)
  })
})
