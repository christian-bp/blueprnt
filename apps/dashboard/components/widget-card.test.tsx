import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { WidgetCard } from "@/components/widget-card"
import { UserGroupIcon } from "@hugeicons/core-free-icons"

function renderCard(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  )
}

afterEach(cleanup)

describe("WidgetCard", () => {
  // The two shapes the one card takes. With a figure it is a stat tile and
  // the title demotes to the figure's label; without one it is a chart card
  // and the title stays the heading.
  it("labels the figure with the title when there is a value", () => {
    const { container } = renderCard(
      <WidgetCard title="Workforce" value={118} footer="All classified" />
    )
    expect(
      container.querySelector('[data-slot="card-description"]')?.textContent
    ).toBe("Workforce")
    expect(
      container.querySelector('[data-slot="card-title"]')?.textContent
    ).toBe("118")
    expect(
      container.querySelector('[data-slot="card-footer"]')?.textContent
    ).toBe("All classified")
  })

  it("keeps the title as the heading when there is no figure", () => {
    const { container } = renderCard(
      <WidgetCard title="Age distribution">
        <div data-testid="chart" />
      </WidgetCard>
    )
    expect(container.querySelector('[data-slot="card-description"]')).toBeNull()
    expect(
      container.querySelector('[data-slot="card-title"]')?.textContent
    ).toBe("Age distribution")
    expect(screen.getByTestId("chart")).toBeDefined()
  })

  // The whole card is the target, and its accessible name is the title. An
  // sr-only child would have put the title in the text tree twice.
  it("makes the whole card one link named by its title", () => {
    renderCard(<WidgetCard title="Workforce" value={118} href="/people" />)
    const link = screen.getByRole("link", { name: "Workforce" })
    expect(link.getAttribute("href")).toBe("/people")
    expect(screen.getAllByText("Workforce")).toHaveLength(1)
  })

  // A Card clips its overflow and this anchor's box IS the clip edge, so an
  // outward ring is painted away entirely and focus becomes invisible.
  it("draws the link's focus ring inside the clipped card box", () => {
    renderCard(<WidgetCard title="Workforce" value={118} href="/people" />)
    const link = screen.getByRole("link", { name: "Workforce" })
    expect(link.className).toContain("focus-visible:inset-ring-2")
  })

  it("renders the icon chip decoratively, never as the card's name", () => {
    const { container } = renderCard(
      <WidgetCard title="Workforce" icon={UserGroupIcon} value={118} />
    )
    const chip = container.querySelector('[data-slot="card-action"] span')
    expect(chip?.getAttribute("aria-hidden")).toBe("true")
  })

  it("opens the expanded view from the header control", () => {
    renderCard(
      <WidgetCard
        title="Gender split"
        expandable
        expandedChildren={<div data-testid="expanded" />}
      >
        <div />
      </WidgetCard>
    )
    expect(screen.queryByTestId("expanded")).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.widgetCard.expand })
    )
    expect(screen.getByTestId("expanded")).toBeDefined()
  })
})
