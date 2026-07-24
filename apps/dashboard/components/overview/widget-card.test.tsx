import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { OverviewWidgetCard } from "@/components/overview/widget-card"

describe("OverviewWidgetCard", () => {
  afterEach(cleanup)

  it("renders the title, headline, badge, a linked View action, and the decorative viz", () => {
    render(
      <OverviewWidgetCard
        title="Band distribution"
        headline={<>48 roles</>}
        badge={<span>6 bands</span>}
        action={{ label: "View", href: "/work" }}
        viz={<svg data-testid="viz" />}
      />
    )

    expect(screen.getByText("Band distribution")).toBeDefined()
    expect(screen.getByText("48 roles")).toBeDefined()
    expect(screen.getByText("6 bands")).toBeDefined()

    const action = screen.getByRole("link", { name: "View" })
    expect(action.getAttribute("href")).toBe("/work")

    const viz = screen.getByTestId("viz")
    expect(viz.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
