import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { HeadcountPoint } from "@/lib/headcount-trend"
import type { PayGapPoint } from "@/lib/pay-gap-trend"

const useHeadcountTrendMock = vi.fn<() => HeadcountPoint[] | undefined | null>()
const usePayGapTrendMock = vi.fn<() => PayGapPoint[] | undefined | null>()

vi.mock("@/hooks/use-headcount-trend", () => ({
  useHeadcountTrend: () => useHeadcountTrendMock(),
}))
vi.mock("@/hooks/use-pay-gap-trend", () => ({
  usePayGapTrend: () => usePayGapTrendMock(),
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import { AssistantChartPart } from "@/components/assistant/assistant-chart-part"

const t = messages.dashboard.overview.widgets

function renderChart(chart: "headcountTrend" | "payGapTrend") {
  return render(
    <NextIntlClientProvider
      locale="en"
      timeZone="Europe/Stockholm"
      messages={messages}
    >
      <AssistantChartPart chart={chart} />
    </NextIntlClientProvider>
  )
}

function panelFor(title: string) {
  return screen.getByText(title).closest('[data-slot="card"]')
}

const TWO_RUNS: HeadcountPoint[] = [
  { date: 1, runLabel: "Pay mapping 2025", women: 3, men: 4 },
  { date: 2, runLabel: "Pay mapping 2026", women: 5, men: 5 },
]

const MEASURED_GAP: PayGapPoint[] = [
  { date: 1, runLabel: "2025", gapPct: 5.2, flag: "elevated" },
  { date: 2, runLabel: "2026", gapPct: 4.1, flag: "ok" },
]

const ALL_NULL_GAP: PayGapPoint[] = [
  { date: 1, runLabel: "2025", gapPct: null, flag: "insufficient" },
  { date: 2, runLabel: "2026", gapPct: null, flag: "insufficient" },
]

afterEach(() => {
  cleanup()
  useHeadcountTrendMock.mockReset()
  usePayGapTrendMock.mockReset()
})

describe("AssistantChartPart (headcountTrend)", () => {
  it("shows a loading skeleton while the query has not resolved", () => {
    useHeadcountTrendMock.mockReturnValue(undefined)
    usePayGapTrendMock.mockReturnValue(undefined)
    renderChart("headcountTrend")
    const panel = panelFor(t.workforce.trendTitle)
    expect(panel?.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    expect(panel?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows the empty text when there are no pay-mapping runs yet", () => {
    useHeadcountTrendMock.mockReturnValue(null)
    usePayGapTrendMock.mockReturnValue(undefined)
    renderChart("headcountTrend")
    const panel = panelFor(t.workforce.trendTitle)
    expect(panel?.textContent).toContain(t.trendEmpty)
    expect(panel?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("renders the chart once runs exist", () => {
    useHeadcountTrendMock.mockReturnValue(TWO_RUNS)
    usePayGapTrendMock.mockReturnValue(undefined)
    renderChart("headcountTrend")
    const panel = panelFor(t.workforce.trendTitle)
    expect(panel?.querySelector('[data-slot="chart"]')).not.toBeNull()
  })
})

describe("AssistantChartPart (payGapTrend)", () => {
  it("shows a loading skeleton while the query has not resolved", () => {
    useHeadcountTrendMock.mockReturnValue(undefined)
    usePayGapTrendMock.mockReturnValue(undefined)
    renderChart("payGapTrend")
    const panel = panelFor(t.gapTrend.title)
    expect(panel?.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    expect(panel?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows the empty text when there are no pay mappings yet", () => {
    useHeadcountTrendMock.mockReturnValue(undefined)
    usePayGapTrendMock.mockReturnValue(null)
    renderChart("payGapTrend")
    const panel = panelFor(t.gapTrend.title)
    expect(panel?.textContent).toContain(t.trendEmpty)
    expect(panel?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  // The regression this closes: every run exists but none has a measurable
  // gap, which used to report state "ready" and render a titled panel with
  // an invisible chart (connectNulls is false, so an all-null series draws
  // no visible mark at all).
  it("falls back to the unmeasured empty text when every run's gap is null", () => {
    useHeadcountTrendMock.mockReturnValue(undefined)
    usePayGapTrendMock.mockReturnValue(ALL_NULL_GAP)
    renderChart("payGapTrend")
    const panel = panelFor(t.gapTrend.title)
    expect(panel?.querySelector('[data-slot="chart"]')).toBeNull()
    expect(panel?.textContent).toContain(t.gapTrend.unmeasuredEmpty)
    expect(panel?.textContent).not.toContain(t.trendEmpty)
  })

  it("renders the chart once at least two runs have a measurable gap", () => {
    useHeadcountTrendMock.mockReturnValue(undefined)
    usePayGapTrendMock.mockReturnValue(MEASURED_GAP)
    renderChart("payGapTrend")
    const panel = panelFor(t.gapTrend.title)
    expect(panel?.querySelector('[data-slot="chart"]')).not.toBeNull()
  })
})
