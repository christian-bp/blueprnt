import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { AiUsageChart } from "@/components/admin/ai-usage-chart"
import type { AiUsageOrgRow } from "@/lib/admin-ai-usage"

const t = messages.dashboard.admin.aiUsage
const tChart = t.chart

function row(overrides: Partial<AiUsageOrgRow>): AiUsageOrgRow {
  return {
    orgId: "org-a",
    orgName: "Acme",
    costNanos: 0,
    callCount: 0,
    totalTokens: 0,
    byKind: {},
    prevCostNanos: 0,
    ...overrides,
  }
}

// recharts renders no meaningful SVG geometry in jsdom (no layout, no
// dimensions), so these tests assert the panel's own structure (title,
// caption, loading/empty states, the chart container mounting at all) and
// never bar counts or positions.
function renderChart(
  rows: AiUsageOrgRow[] | undefined,
  outliers: Set<string> = new Set()
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AiUsageChart rows={rows} outliers={outliers} />
    </NextIntlClientProvider>
  )
}

afterEach(cleanup)

describe("AiUsageChart", () => {
  it("shows the panel title while loading, with no caption yet", () => {
    const { container } = renderChart(undefined)
    expect(screen.getByText(tChart.title)).toBeTruthy()
    expect(screen.queryByText(tChart.caption)).toBeNull()
    expect(container.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows the localized empty sentence for a period with no usage", () => {
    renderChart([])
    expect(screen.getByText(t.empty)).toBeTruthy()
    expect(screen.queryByText(tChart.caption)).toBeNull()
  })

  it("mounts the chart and the outlier caption once rows resolve", () => {
    const { container } = renderChart([
      row({ orgId: "a", orgName: "Acme", costNanos: 5_000_000_000 }),
      row({ orgId: "b", orgName: "Globex", costNanos: 100_000_000 }),
    ])
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
    expect(screen.getByText(tChart.caption)).toBeTruthy()
  })

  it("mounts without crashing for a single org", () => {
    const { container } = renderChart([row({ orgId: "solo" })])
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })
})
