import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const LABELS = {
  overview: "Overview",
  roles: "Roles",
  model: "Model",
  results: "Results",
  rate: "Rate",
}

const pathState = vi.hoisted(() => ({ current: "/" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

// The sidebar context is irrelevant here; render the trigger as a button.
vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarTrigger: (props: React.ComponentProps<"button">) => (
    <button type="button" {...props} />
  ),
}))

import { onQuery } from "@/test/convex-mocks"
import { OrganizationProvider } from "@/components/org-context"
import { buildBreadcrumbs, SiteHeader } from "@/components/site-header"

describe("buildBreadcrumbs", () => {
  it("renders a single current-page crumb for each top-level section", () => {
    expect(buildBreadcrumbs("/", LABELS, {})).toEqual([{ label: "Overview" }])
    expect(buildBreadcrumbs("/roles", LABELS, {})).toEqual([{ label: "Roles" }])
    expect(buildBreadcrumbs("/model", LABELS, {})).toEqual([{ label: "Model" }])
    expect(buildBreadcrumbs("/results", LABELS, {})).toEqual([
      { label: "Results" },
    ])
  })

  it("builds Roles > {role} for a role detail page", () => {
    expect(
      buildBreadcrumbs("/roles/r1", LABELS, { roleTitle: "Senior Engineer" })
    ).toEqual([
      { label: "Roles", href: "/roles" },
      { label: "Senior Engineer" },
    ])
  })

  it("marks the role leaf as loading until the title resolves", () => {
    expect(
      buildBreadcrumbs("/roles/r1", LABELS, { roleTitle: undefined })
    ).toEqual([
      { label: "Roles", href: "/roles" },
      { label: "", loading: true },
    ])
  })

  it("collapses to the section when the role is missing", () => {
    expect(buildBreadcrumbs("/roles/r1", LABELS, { roleTitle: null })).toEqual([
      { label: "Roles" },
    ])
  })

  it("builds Roles > {role} > Rate with a linked role ancestor", () => {
    expect(
      buildBreadcrumbs("/roles/r1/rate", LABELS, {
        roleTitle: "Senior Engineer",
      })
    ).toEqual([
      { label: "Roles", href: "/roles" },
      { label: "Senior Engineer", href: "/roles/r1" },
      { label: "Rate" },
    ])
  })

  it("keeps the rate leaf while the role ancestor is still loading", () => {
    expect(
      buildBreadcrumbs("/roles/r1/rate", LABELS, { roleTitle: undefined })
    ).toEqual([
      { label: "Roles", href: "/roles" },
      { label: "", href: "/roles/r1", loading: true },
      { label: "Rate" },
    ])
  })

  it("builds Roles > {family} for a family page", () => {
    expect(
      buildBreadcrumbs("/roles/families/f1", LABELS, { familyName: "Platform" })
    ).toEqual([{ label: "Roles", href: "/roles" }, { label: "Platform" }])
  })

  it("marks the family leaf as loading and collapses when missing", () => {
    expect(
      buildBreadcrumbs("/roles/families/f1", LABELS, { familyName: undefined })
    ).toEqual([
      { label: "Roles", href: "/roles" },
      { label: "", loading: true },
    ])
    expect(
      buildBreadcrumbs("/roles/families/f1", LABELS, { familyName: null })
    ).toEqual([{ label: "Roles" }])
  })
})

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationProvider
        value={{ orgId: "o1", name: "Acme", role: "admin" }}
      >
        <SiteHeader />
      </OrganizationProvider>
    </NextIntlClientProvider>
  )
}

describe("SiteHeader", () => {
  beforeEach(() => {
    pathState.current = "/"
    onQuery(() => undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it("shows the section as a non-link current page on a top-level route", () => {
    pathState.current = "/"
    renderHeader()
    expect(screen.getByText("Overview").getAttribute("aria-current")).toBe(
      "page"
    )
    // No real anchors: the lone crumb is the current page.
    expect(document.querySelector("a")).toBeNull()
  })

  it("links the section and names the current role on a role page", () => {
    pathState.current = "/roles/r1"
    onQuery((ref) =>
      ref === "assessment.roles.getRole"
        ? { title: "Senior Engineer" }
        : undefined
    )
    renderHeader()
    expect(
      screen.getByRole("link", { name: "Roles" }).getAttribute("href")
    ).toBe("/roles")
    expect(
      screen.getByText("Senior Engineer").getAttribute("aria-current")
    ).toBe("page")
  })

  it("reserves a skeleton for the role name while the query is loading", () => {
    pathState.current = "/roles/r1"
    onQuery(() => undefined)
    renderHeader()
    expect(screen.getByRole("link", { name: "Roles" })).toBeDefined()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    expect(screen.queryByText("Senior Engineer")).toBeNull()
  })
})
