import { cleanup, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { EqualityClock } from "./equality-clock"

function renderClock(gapPct: number | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EqualityClock gapPct={gapPct} />
    </NextIntlClientProvider>
  )
}

afterEach(cleanup)

describe("EqualityClock", () => {
  // The digit boxes are aria-hidden, so the value AND its direction have to
  // survive as text: on a KPI tile there is no room for a visible sentence,
  // and the sr-only line is the only reading a screen reader gets.
  it("reads the time and the women-behind direction out as one line", () => {
    renderClock(10)
    expect(
      screen.getByText(`00:48:00 ${en.dashboard.payMapping.clock.womenBehind}`)
    ).toBeDefined()
  })

  it("reads the no-gap direction for a null gap", () => {
    renderClock(null)
    expect(
      screen.getByText(new RegExp(en.dashboard.payMapping.clock.noGap))
    ).toBeDefined()
  })

  // Three boxes and two colons: the group reads as a time without the unit
  // labels it used to carry beneath each box.
  it("draws three digit boxes separated by colons", () => {
    const { container } = renderClock(10)
    expect(container.querySelectorAll(".tabular-nums")).toHaveLength(3)
    expect(screen.getAllByText(":")).toHaveLength(2)
  })
})
