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

  // The trail's distance from the header is identical on every page: the
  // row top-aligns and each side centers inside its own min-h-9 strip, so a
  // taller aside (a section's journey instrument) grows downward instead of
  // pushing the crumbs lower than other pages'.
  it("holds the trail in a constant-height strip whatever the aside holds", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PageBreadcrumbRow
          segments={[{ label: "Roles" }]}
          actions={<div style={{ height: 60 }}>tall instrument</div>}
        />
      </NextIntlClientProvider>
    )
    const row = document.querySelector(
      '[data-slot="page-breadcrumb-row"]'
    ) as HTMLElement
    expect(row.className.split(/\s+/)).toContain("items-start")
    const sides = Array.from(row.children).filter(
      (child) => child.tagName === "DIV"
    ) as HTMLElement[]
    expect(sides).toHaveLength(2)
    for (const side of sides) {
      expect(side.className.split(/\s+/)).toContain("min-h-9")
      expect(side.className.split(/\s+/)).toContain("items-center")
    }
  })

  it("right-aligns the page actions on the same row", () => {
    renderRow([{ label: "Roles" }], <button type="button">Create role</button>)
    expect(screen.getByRole("button", { name: "Create role" })).toBeTruthy()
  })
})
