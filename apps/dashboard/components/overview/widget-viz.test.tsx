import { cleanup, render } from "@testing-library/react"
import type { ChartConfig } from "@workspace/ui/components/chart"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import {
  BandBars,
  HeadcountArea,
  QuartileSplitBars,
} from "@/components/overview/widget-viz"

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

describe("BandBars", () => {
  afterEach(cleanup)

  it("mounts a chart container for representative data", () => {
    const { container } = renderWithIntl(
      <BandBars
        counts={[
          { band: 1, count: 2 },
          { band: 2, count: 0 },
          { band: 3, count: 4 },
        ]}
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("mounts without crashing for an empty counts array", () => {
    const { container } = renderWithIntl(<BandBars counts={[]} />)
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("is decorative", () => {
    const { container } = renderWithIntl(
      <BandBars counts={[{ band: 1, count: 1 }]} />
    )
    expect(
      container
        .querySelector('[data-slot="chart"]')
        ?.getAttribute("aria-hidden")
    ).toBe("true")
  })
})

describe("QuartileSplitBars", () => {
  afterEach(cleanup)

  it("mounts a chart container for representative data", () => {
    const { container } = renderWithIntl(
      <QuartileSplitBars
        quartiles={[
          { women: 3, men: 1 },
          { women: 1, men: 3 },
          { women: 2, men: 2 },
          { women: 0, men: 4 },
        ]}
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("mounts without crashing for an all-zero quartiles input", () => {
    const { container } = renderWithIntl(
      <QuartileSplitBars
        quartiles={[
          { women: 0, men: 0 },
          { women: 0, men: 0 },
          { women: 0, men: 0 },
          { women: 0, men: 0 },
        ]}
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("is decorative", () => {
    const { container } = renderWithIntl(
      <QuartileSplitBars quartiles={[{ women: 1, men: 1 }]} />
    )
    expect(
      container
        .querySelector('[data-slot="chart"]')
        ?.getAttribute("aria-hidden")
    ).toBe("true")
  })
})

describe("HeadcountArea", () => {
  afterEach(cleanup)

  const config = {
    value: { label: "Employees", color: "var(--brand)" },
  } satisfies ChartConfig

  const point = (label: string, caption: string, value: number) => ({
    label,
    caption,
    value,
  })

  it("mounts a chart container for representative data", () => {
    const { container } = renderWithIntl(
      <HeadcountArea
        data={[
          point("Pay mapping 2025", "Jan 1", 5),
          point("Pay mapping 2026", "Jan 2", 8),
        ]}
        config={config}
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("mounts without crashing for a single data point", () => {
    const { container } = renderWithIntl(
      <HeadcountArea
        data={[point("Pay mapping 2026", "Jan 1", 5)]}
        config={config}
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("mounts without crashing for an empty data array", () => {
    const { container } = renderWithIntl(
      <HeadcountArea data={[]} config={config} />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("mounts for two points sharing a heading and a date", () => {
    // Two pay-mapping runs can share a reference date and a name, so both
    // points can carry identical text; the axis keys on a synthetic unique
    // value so the tooltip still resolves (browser-only, see widget-viz.tsx).
    const { container } = renderWithIntl(
      <HeadcountArea
        data={[
          point("Pay mapping 2026", "Jan 1", 118),
          point("Pay mapping 2026", "Jan 1", 121),
        ]}
        config={config}
      />
    )
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("is decorative", () => {
    const { container } = renderWithIntl(
      <HeadcountArea
        data={[point("Pay mapping 2026", "Jan 1", 5)]}
        config={config}
      />
    )
    expect(
      container
        .querySelector('[data-slot="chart"]')
        ?.getAttribute("aria-hidden")
    ).toBe("true")
  })
})
