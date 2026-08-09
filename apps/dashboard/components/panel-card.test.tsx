import { cleanup, render, screen } from "@testing-library/react"
import { UserGroupIcon } from "@hugeicons/core-free-icons"
import { afterEach, describe, expect, it } from "vitest"
import { PanelCard } from "@/components/panel-card"

afterEach(cleanup)

describe("PanelCard", () => {
  it("renders its title, body and optional trailing readout", () => {
    render(
      <PanelCard
        title="Classify people into roles"
        icon={UserGroupIcon}
        meta={<span>9 items</span>}
      >
        <div data-testid="rows" />
      </PanelCard>
    )
    expect(screen.getByText("Classify people into roles")).toBeDefined()
    expect(screen.getByText("9 items")).toBeDefined()
    expect(screen.getByTestId("rows")).toBeDefined()
  })

  // A panel is a section of the page, so its title is a heading: browsing by
  // heading should not skip everything below the first one.
  it("titles itself with a heading", () => {
    render(
      <PanelCard title="Workforce over time">
        <div />
      </PanelCard>
    )
    expect(
      screen.getByRole("heading", { name: "Workforce over time" })
    ).toBeDefined()
  })

  it("links out to the full surface when given an action", () => {
    render(
      <PanelCard title="To do" action={{ label: "View all 9", href: "/roles" }}>
        <div />
      </PanelCard>
    )
    expect(
      screen.getByRole("link", { name: /View all 9/ }).getAttribute("href")
    ).toBe("/roles")
  })

  it("renders no link when there is nowhere further to go", () => {
    render(
      <PanelCard title="To do">
        <div />
      </PanelCard>
    )
    expect(screen.queryByRole("link")).toBeNull()
  })
})
