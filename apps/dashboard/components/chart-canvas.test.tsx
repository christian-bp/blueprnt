import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"

import { ChartCanvas, ChartCanvasSkeleton } from "@/components/chart-canvas"
import { ChartLegend } from "@/components/chart-legend"
import { WidgetCard } from "@/components/widget-card"

afterEach(cleanup)

function renderInCard(children: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WidgetCard title="Gender split" expandable>
        {children}
      </WidgetCard>
    </NextIntlClientProvider>
  )
}

function expand() {
  fireEvent.click(
    screen.getByRole("button", { name: messages.dashboard.widgetCard.expand })
  )
}

const inDialog = (selector: string) =>
  document.querySelector(`[data-slot="dialog-content"] ${selector}`)

const classesOf = (node: Element | null) =>
  (node?.getAttribute("class") ?? "").split(/\s+/)

describe("ChartCanvas", () => {
  const canvas = (
    <ChartCanvas config={{}} collapsed="h-64">
      <svg aria-label="plot" />
    </ChartCanvas>
  )

  it("keeps the card's own height in the card", () => {
    renderInCard(canvas)
    expect(classesOf(document.querySelector("[data-chart]"))).toContain("h-64")
  })

  // Expanding is a request for a bigger canvas. The flag travels by context,
  // and the decision lives HERE rather than at each chart because a chart
  // usually renders the WidgetCard around itself: a hook called there sits
  // above the dialog's provider and quietly answers "not expanded".
  it("takes the taller shared canvas inside the dialog", () => {
    renderInCard(canvas)
    expand()
    const classes = classesOf(inDialog("[data-chart]"))
    expect(classes).not.toContain("h-64")
    expect(classes.some((cls) => cls.startsWith("h-["))).toBe(true)
  })

  // A chart three times the size with the same 12px ticks beside it reads as
  // a rendering mistake rather than as a bigger chart. SVG text inherits
  // font-size, so one class on the canvas moves every tick and in-plot label
  // the chart draws.
  it("scales the chart's type with its canvas", () => {
    renderInCard(canvas)
    expect(classesOf(document.querySelector("[data-chart]"))).not.toContain(
      "text-sm"
    )
    expand()
    const classes = classesOf(inDialog("[data-chart]"))
    expect(classes).toContain("text-sm")
    // And the container's own text-xs is gone rather than fighting it: two
    // size classes on one element resolve by stylesheet order, not by the
    // order they were written in.
    expect(classes).not.toContain("text-xs")
  })

  it("sizes the waiting state to whichever canvas the chart will land on", () => {
    renderInCard(<ChartCanvasSkeleton collapsed="h-64" />)
    expect(
      classesOf(document.querySelector('[data-slot="skeleton"]'))
    ).toContain("h-64")
    expand()
    expect(classesOf(inDialog('[data-slot="skeleton"]'))).not.toContain("h-64")
  })
})

// The key sits OUTSIDE the canvas, so it cannot inherit the type scale and
// has to read the same flag itself. Left alone it stayed at card size beside
// a chart three times as large.
describe("ChartLegend inside an expanded card", () => {
  const legend = (
    <ChartLegend
      layout="row"
      items={[{ id: "women", label: "Women", mark: <svg aria-label="mark" /> }]}
    />
  )

  it("grows with the chart it names", () => {
    renderInCard(legend)
    expect(classesOf(document.querySelector("ul"))).toContain("text-sm")
    expand()
    expect(classesOf(inDialog("ul"))).toContain("text-base")
  })
})
