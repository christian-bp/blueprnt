import messages from "@workspace/i18n/messages/en.json"
import { cleanup, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it } from "vitest"
import type { Crumb } from "@/components/page-breadcrumb"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"

afterEach(cleanup)

const home = messages.dashboard.nav.home

function renderRow(segments: Crumb[], actions?: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PageBreadcrumbRow segments={segments} actions={actions} />
    </NextIntlClientProvider>
  )
}

describe("PageBreadcrumbRow", () => {
  it("prepends the home crumb as a link and renders the last segment as the current page", () => {
    renderRow([
      { label: "Settings", href: "/organization/general" },
      { label: "Members" },
    ])
    const homeLink = screen.getByRole("link", { name: home })
    expect(homeLink.getAttribute("href")).toBe("/")
    const current = screen
      .getAllByText("Members")
      .find((el) => el.getAttribute("aria-current") === "page")
    expect(current).toBeDefined()
    expect(current?.className).toContain("text-foreground")
  })

  it("is titled by its last segment for assistive tech", () => {
    renderRow([{ label: "Roles" }])
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading.textContent).toBe("Roles")
    expect(heading.className).toContain("sr-only")
  })

  it("renders a skeleton crumb for a loading entity name", () => {
    const { container } = renderRow([
      { label: "Roles", href: "/roles" },
      { skeleton: true },
    ])
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it("shows the single home crumb on the home page without doubling it", () => {
    renderRow([])
    const trail = screen.getByRole("navigation")
    const crumbs = within(trail).getAllByText(home)
    expect(crumbs).toHaveLength(1)
    // The single crumb is the current page (the vendor's BreadcrumbPage keeps
    // role="link" without an href), not a navigable link back to itself.
    expect(crumbs[0]?.getAttribute("href")).toBeNull()
    expect(crumbs[0]?.getAttribute("aria-current")).toBe("page")
  })

  it("right-aligns the page actions on the same row", () => {
    renderRow([{ label: "Roles" }], <button type="button">Create role</button>)
    expect(screen.getByRole("button", { name: "Create role" })).toBeTruthy()
  })
})
