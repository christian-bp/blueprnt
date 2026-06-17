import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const LABELS = {
  home: "Home",
  workOverview: "Overview",
  roles: "Roles",
  model: "Model",
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
    expect(buildBreadcrumbs("/", LABELS, {})).toEqual([{ label: "Home" }])
    expect(buildBreadcrumbs("/roles", LABELS, {})).toEqual([{ label: "Roles" }])
    expect(buildBreadcrumbs("/model", LABELS, {})).toEqual([{ label: "Model" }])
    expect(buildBreadcrumbs("/work", LABELS, {})).toEqual([
      { label: "Overview" },
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

  it("shows a plain section title and no breadcrumb trail on a top-level non-Work route", () => {
    pathState.current = "/"
    renderHeader()
    expect(screen.getByText("Home")).toBeDefined()
    // No section tabs and no breadcrumb trail on Home -> no links at all.
    expect(document.querySelector("a")).toBeNull()
  })

  it("shows the Work section tabs on a Work route", () => {
    pathState.current = "/work"
    renderHeader()
    expect(
      screen
        .getByRole("link", { name: messages.dashboard.nav.overview })
        .getAttribute("href")
    ).toBe("/work")
    expect(
      screen
        .getByRole("link", { name: messages.dashboard.nav.roles })
        .getAttribute("href")
    ).toBe("/roles")
  })

  it("adds the breadcrumb trail naming the current role on a deep role page", () => {
    pathState.current = "/roles/r1"
    onQuery((ref) =>
      ref === "assessment.roles.getRole"
        ? { title: "Senior Engineer" }
        : undefined
    )
    renderHeader()
    // Section tabs still render (Overview is uniquely named) ...
    expect(
      screen
        .getByRole("link", { name: messages.dashboard.nav.overview })
        .getAttribute("href")
    ).toBe("/work")
    // ... and the demoted trail names the current role.
    expect(
      screen.getByText("Senior Engineer").getAttribute("aria-current")
    ).toBe("page")
  })

  it("reserves a skeleton for the role name while the query is loading", () => {
    pathState.current = "/roles/r1"
    onQuery(() => undefined)
    renderHeader()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    expect(screen.queryByText("Senior Engineer")).toBeNull()
  })
})
