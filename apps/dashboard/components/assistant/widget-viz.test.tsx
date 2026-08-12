import { cleanup, render } from "@testing-library/react"
import type { ChartConfig } from "@workspace/ui/components/chart"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { HeadcountTrend, PayGapTrend } from "@/components/assistant/widget-viz"

// recharts renders no meaningful SVG geometry in jsdom (no layout, no
// dimensions), so these tests assert mount-without-crash and the presence
// of the shadcn chart container, never bar counts or positions.
function renderWithIntl(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

afterEach(cleanup)

describe("HeadcountTrend", () => {
  const config = {
    women: { label: "Women", color: "var(--gender-woman)" },
    men: { label: "Men", color: "var(--gender-man)" },
  } satisfies ChartConfig

  const point = (
    label: string,
    caption: string,
    women: number,
    men: number
  ) => ({
    label,
    caption,
    women,
    men,
  })

  it("mounts a chart container for representative data", () => {
    const { container } = renderWithIntl(
      <HeadcountTrend
        data={[
          point("Pay mapping 2025", "Jan 1", 2, 3),
          point("Pay mapping 2026", "Jan 2", 4, 4),
        ]}
        config={config}
        labels={{ women: "Women", men: "Men" }}
        totalLabel="Employees"
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("mounts without crashing for a single data point", () => {
    const { container } = renderWithIntl(
      <HeadcountTrend
        data={[point("Pay mapping 2026", "Jan 1", 2, 3)]}
        config={config}
        labels={{ women: "Women", men: "Men" }}
        totalLabel="Employees"
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("mounts without crashing for an empty data array", () => {
    const { container } = renderWithIntl(
      <HeadcountTrend
        data={[]}
        config={config}
        labels={{ women: "Women", men: "Men" }}
        totalLabel="Employees"
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("mounts for two points sharing a heading and a date", () => {
    // Two pay-mapping runs can share a reference date and a name, so both
    // points can carry identical text; the axis keys on a synthetic unique
    // value so the tooltip still resolves (browser-only, see widget-viz.tsx).
    const { container } = renderWithIntl(
      <HeadcountTrend
        data={[
          point("Pay mapping 2026", "Jan 1", 59, 59),
          point("Pay mapping 2026", "Jan 1", 60, 61),
        ]}
        config={config}
        labels={{ women: "Women", men: "Men" }}
        totalLabel="Employees"
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("exposes its chart to assistive tech", () => {
    const { container } = renderWithIntl(
      <HeadcountTrend
        data={[point("Pay mapping 2026", "Jan 1", 2, 3)]}
        config={config}
        labels={{ women: "Women", men: "Men" }}
        totalLabel="Employees"
      />
    )
    expect(
      container
        .querySelector('[data-slot="chart"]')
        ?.getAttribute("aria-hidden")
    ).toBeNull()
  })
})

describe("PayGapTrend", () => {
  const config = {
    gapPct: { label: "Pay gap", color: "var(--brand)" },
  } satisfies ChartConfig

  it("mounts a chart for a measured history", () => {
    const { container } = renderWithIntl(
      <PayGapTrend
        data={[
          { label: "2025", caption: "1 Jan 2025", gapPct: 5.2 },
          { label: "2026", caption: "1 Jan 2026", gapPct: 4.1 },
        ]}
        config={config}
        seriesLabel="Pay gap"
        unmeasuredLabel="Not measurable"
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  // A mapping with no measurable gap is a break in the line, not a zero, so
  // a null point must not crash the chart either.
  it("mounts with an unmeasured point in the middle", () => {
    const { container } = renderWithIntl(
      <PayGapTrend
        data={[
          { label: "2024", caption: "1 Jan 2024", gapPct: 6 },
          { label: "2025", caption: "1 Jan 2025", gapPct: null },
          { label: "2026", caption: "1 Jan 2026", gapPct: 4.1 },
        ]}
        config={config}
        seriesLabel="Pay gap"
        unmeasuredLabel="Not measurable"
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("mounts for a negative gap (women ahead)", () => {
    const { container } = renderWithIntl(
      <PayGapTrend
        data={[
          { label: "2025", caption: "1 Jan 2025", gapPct: -1.4 },
          { label: "2026", caption: "1 Jan 2026", gapPct: -2.8 },
        ]}
        config={config}
        seriesLabel="Pay gap"
        unmeasuredLabel="Not measurable"
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })
})
