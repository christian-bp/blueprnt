import { render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import { formatMoney } from "@/lib/currency"
import { MeanComparisonBars } from "./mean-comparison-bars"

function renderBars(womenMean: number, menMean: number, currency = "SEK") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MeanComparisonBars
        womenMean={womenMean}
        menMean={menMean}
        currency={currency}
      />
    </NextIntlClientProvider>
  )
}

// Intl.NumberFormat inserts a non-breaking space between the currency code
// and the amount for "en" + "SEK". Testing Library's getByText normalizes
// only the node's own text (collapsing that to a regular space), not a
// literal string matcher, so the expected string needs the same
// normalization to compare equal.
function moneyText(value: number, currency: string) {
  return formatMoney(value, currency, "en").replace(/\s+/g, " ")
}

describe("MeanComparisonBars", () => {
  it("renders the gender labels and their formatted money values", () => {
    renderBars(50_000, 100_000)
    expect(
      screen.getByText(en.dashboard.payMapping.gap.columns.women)
    ).toBeDefined()
    expect(
      screen.getByText(en.dashboard.payMapping.gap.columns.men)
    ).toBeDefined()
    expect(screen.getByText(moneyText(50_000, "SEK"))).toBeDefined()
    expect(screen.getByText(moneyText(100_000, "SEK"))).toBeDefined()
  })

  it("scales each bar's width relative to the larger mean, women first", () => {
    const { container } = renderBars(50_000, 100_000)
    const bars = container.querySelectorAll('[data-testid="mean-bar"]')
    expect(bars).toHaveLength(2)
    expect((bars[0] as HTMLElement).style.width).toBe("50%")
    expect((bars[1] as HTMLElement).style.width).toBe("100%")
  })

  it("draws the dashed gap marker through both tracks at the lower mean", () => {
    const { container } = renderBars(50_000, 100_000)
    const markers = container.querySelectorAll('[data-testid="mean-marker"]')
    expect(markers).toHaveLength(2)
    for (const marker of markers) {
      expect((marker as HTMLElement).style.left).toBe("50%")
    }
  })

  it("puts the marker at the men's level when the women earn more", () => {
    const { container } = renderBars(100_000, 75_000)
    const marker = container.querySelector(
      '[data-testid="mean-marker"]'
    ) as HTMLElement
    expect(marker.style.left).toBe("75%")
  })

  it("draws no marker when the means are equal", () => {
    const { container } = renderBars(80_000, 80_000)
    expect(container.querySelector('[data-testid="mean-marker"]')).toBeNull()
  })

  it("hides the tracks from assistive tech: the labels and values carry the meaning", () => {
    const { container } = renderBars(50_000, 100_000)
    const bar = container.querySelector(
      '[data-testid="mean-bar"]'
    ) as HTMLElement
    expect(bar.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
