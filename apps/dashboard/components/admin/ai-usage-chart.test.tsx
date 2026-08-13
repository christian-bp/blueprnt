import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { AiUsageChart } from "@/components/admin/ai-usage-chart"
import type { AiUsageDailyOrgRow } from "@/lib/admin-ai-usage"
import { AI_USAGE_TREND_HEIGHT } from "@/lib/chart-style"

const t = messages.dashboard.admin.aiUsage
const tChart = t.chart

function dailyRow(overrides: Partial<AiUsageDailyOrgRow>): AiUsageDailyOrgRow {
  return {
    orgId: "org-a",
    orgName: "Acme",
    dailyCostNanos: new Array(30).fill(0),
    ...overrides,
  }
}

// recharts renders no meaningful SVG geometry in jsdom (no layout, no
// dimensions), so these tests assert the panel's own structure (title,
// caption, legend rows, loading/empty/ready states, the chart container
// mounting at all) and never curve positions.
function renderChart(
  data: { days: number; rows: AiUsageDailyOrgRow[] } | undefined,
  period = "2026-08"
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AiUsageChart data={data} period={period} />
    </NextIntlClientProvider>
  )
}

afterEach(cleanup)

describe("AiUsageChart", () => {
  it("shows the panel title while loading, with no legend or caption yet", () => {
    const { container } = renderChart(undefined)
    expect(screen.getByText(tChart.title)).toBeTruthy()
    expect(screen.queryByText("Acme")).toBeNull()
    expect(container.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows the localized empty sentence for a period with no usage", () => {
    renderChart({ days: 30, rows: [] })
    expect(screen.getByText(t.empty)).toBeTruthy()
    expect(screen.queryByText("Acme")).toBeNull()
  })

  it("mounts the chart and a legend row per org once rows resolve", () => {
    const { container } = renderChart({
      days: 30,
      rows: [
        dailyRow({ orgId: "a", orgName: "Acme" }),
        dailyRow({ orgId: "b", orgName: "Globex" }),
      ],
    })
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
    expect(screen.getByText("Acme")).toBeTruthy()
    expect(screen.getByText("Globex")).toBeTruthy()
    // Under the cap: no "Others" series and no cap caption.
    expect(screen.queryByText(tChart.othersLabel)).toBeNull()
  })

  it("mounts without crashing for a single org", () => {
    const { container } = renderChart({
      days: 30,
      rows: [dailyRow({ orgId: "solo" })],
    })
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("folds every org past the cap into one Others series and states the cap in the caption", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      dailyRow({ orgId: `org-${i}`, orgName: `Org ${i}` })
    )
    renderChart({ days: 30, rows })
    // 10 orgs, cap 8: the 9th and 10th fold into Others.
    expect(screen.getByText(tChart.othersLabel)).toBeTruthy()
    expect(screen.getByText("Org 0")).toBeTruthy()
    expect(screen.getByText("Org 7")).toBeTruthy()
    expect(screen.queryByText("Org 8")).toBeNull()
    expect(screen.queryByText("Org 9")).toBeNull()
  })

  it("keeps one fixed height across the loading, empty, and ready states", () => {
    const heightClass = AI_USAGE_TREND_HEIGHT
    const loading = renderChart(undefined)
    expect(loading.container.querySelector(`.${heightClass}`)).not.toBeNull()
    loading.unmount()

    const empty = renderChart({ days: 30, rows: [] })
    expect(empty.container.querySelector(`.${heightClass}`)).not.toBeNull()
    empty.unmount()

    const ready = renderChart({
      days: 30,
      rows: [dailyRow({ orgId: "a" })],
    })
    expect(ready.container.querySelector(`.${heightClass}`)).not.toBeNull()
    ready.unmount()
  })
})
