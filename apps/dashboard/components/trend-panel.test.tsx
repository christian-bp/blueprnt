import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { TrendPanel } from "@/components/trend-panel"
import { WIDGET_CHART_HEIGHT } from "@/lib/chart-style"

afterEach(cleanup)

describe("TrendPanel", () => {
  it("renders a loading skeleton inside the chart-height slot", () => {
    const { container } = render(
      <TrendPanel
        title="Workforce over time"
        state="loading"
        emptyText="Not enough data yet"
      >
        <div data-testid="chart" />
      </TrendPanel>
    )
    const skeleton = container.querySelector('[data-slot="skeleton"]')
    expect(skeleton).not.toBeNull()
    expect(skeleton?.parentElement?.className).toContain(WIDGET_CHART_HEIGHT)
    expect(screen.queryByTestId("chart")).toBeNull()
  })

  it("renders the passed emptyText as real text, not a skeleton", () => {
    const { container } = render(
      <TrendPanel
        title="Workforce over time"
        state="empty"
        emptyText="Not enough data yet"
      >
        <div data-testid="chart" />
      </TrendPanel>
    )
    expect(screen.getByText("Not enough data yet")).toBeDefined()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull()
    expect(screen.queryByTestId("chart")).toBeNull()
  })

  it("renders its children once ready", () => {
    render(
      <TrendPanel
        title="Workforce over time"
        state="ready"
        emptyText="Not enough data yet"
      >
        <div data-testid="chart" />
      </TrendPanel>
    )
    expect(screen.getByTestId("chart")).toBeDefined()
    expect(screen.queryByText("Not enough data yet")).toBeNull()
    expect(document.querySelector('[data-slot="skeleton"]')).toBeNull()
  })
})
