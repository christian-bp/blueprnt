import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { WidgetCard } from "./widget-card"

function renderCard(props: {
  expandable?: boolean
  expandedChildren?: React.ReactNode
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WidgetCard
        title="My widget"
        headerExtra={<span>extra</span>}
        expandable={props.expandable}
        expandedChildren={props.expandedChildren}
      >
        <p>card content</p>
      </WidgetCard>
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("WidgetCard", () => {
  it("renders the title, header extra, and content", () => {
    renderCard({})
    expect(screen.getByText("My widget")).toBeDefined()
    expect(screen.getByText("extra")).toBeDefined()
    expect(screen.getByText("card content")).toBeDefined()
    // Not expandable: no expand affordance.
    expect(
      screen.queryByRole("button", { name: en.dashboard.widgetCard.expand })
    ).toBeNull()
  })

  it("opens the large dialog with the expanded content", () => {
    renderCard({
      expandable: true,
      expandedChildren: <p>expanded content</p>,
    })
    expect(screen.queryByText("expanded content")).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: en.dashboard.widgetCard.expand })
    )
    expect(screen.getByText("expanded content")).toBeDefined()
    // The dialog carries the widget's title.
    expect(screen.getAllByText("My widget").length).toBeGreaterThan(1)
  })

  it("falls back to the card children when no expanded variant is given", () => {
    renderCard({ expandable: true })
    fireEvent.click(
      screen.getByRole("button", { name: en.dashboard.widgetCard.expand })
    )
    expect(screen.getAllByText("card content")).toHaveLength(2)
  })
})
