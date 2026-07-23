import { render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import { EqualityClock } from "./equality-clock"

function renderClock(gapPct: number | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EqualityClock gapPct={gapPct} />
    </NextIntlClientProvider>
  )
}

describe("EqualityClock", () => {
  it("renders the digit-box unit labels and the women-behind sentence", () => {
    renderClock(10)
    expect(screen.getByText("Hours")).toBeDefined()
    expect(screen.getByText("Minutes")).toBeDefined()
    expect(screen.getByText("Seconds")).toBeDefined()
    expect(
      screen.getByText(en.dashboard.payMapping.clock.womenBehind)
    ).toBeDefined()
    // The sr-only time keeps the value available to assistive tech (the
    // digit boxes are aria-hidden).
    expect(screen.getByText(/00:48:00/)).toBeDefined()
  })

  it("renders the no-gap sentence for a null gap", () => {
    renderClock(null)
    expect(screen.getByText(en.dashboard.payMapping.clock.noGap)).toBeDefined()
  })
})
