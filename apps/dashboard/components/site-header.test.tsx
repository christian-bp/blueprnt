import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({ current: "/" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

// The sidebar context is irrelevant here; render the trigger as a button.
vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarTrigger: (props: React.ComponentProps<"button">) => (
    <button type="button" {...props} />
  ),
}))

// Inside a pay-mapping run the header mounts the run indicator, which
// resolves the run over Convex; mock the client + api like the other
// component tests, and org-context for the orgId.
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))

import { SiteHeader } from "@/components/site-header"
import { onQuery } from "@/test/convex-mocks"

// RUN_2026 doubles as the detail-query result (runId/label/status/rows) and
// a list-query summary (slug for the switcher's active mark and hrefs).
const RUN_2026 = {
  runId: "run1",
  slug: "pay-2026",
  label: "Lonekartlaggning 2026",
  status: "active",
  referenceDate: Date.UTC(2026, 6, 1),
  rows: [],
  collaboration: null,
}

const RUN_2025 = {
  runId: "run0",
  slug: "pay-2025",
  label: "Lonekartlaggning 2025",
  status: "completed",
}

onQuery((ref) => {
  if (ref === "payMapping.runs.getPayMappingRunBySlug") return RUN_2026
  if (ref === "payMapping.runs.listPayMappingRuns") return [RUN_2026, RUN_2025]
  return undefined
})

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SiteHeader />
    </NextIntlClientProvider>
  )
}

describe("SiteHeader", () => {
  beforeEach(() => {
    pathState.current = "/"
  })

  afterEach(() => {
    cleanup()
  })

  it("shows a plain section title and no navigation on a top-level non-Work route", () => {
    pathState.current = "/"
    renderHeader()
    expect(screen.getByText("Home")).toBeDefined()
    // No section tabs and (now) no breadcrumb trail in the header -> no links.
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

  it("keeps the Work section tabs and renders no breadcrumb trail on a deep role page", () => {
    pathState.current = "/roles/r1"
    renderHeader()
    // The header stays identity-only: section tabs, never a breadcrumb trail.
    expect(
      screen
        .getByRole("link", { name: messages.dashboard.nav.overview })
        .getAttribute("href")
    ).toBe("/work")
    expect(document.querySelector('nav[aria-label="breadcrumb"]')).toBeNull()
  })

  it("shows the admin section tabs on an admin route", () => {
    pathState.current = "/admin"
    renderHeader()
    expect(
      screen
        .getByRole("link", { name: messages.dashboard.admin.tabs.users })
        .getAttribute("href")
    ).toBe("/admin")
    expect(
      screen
        .getByRole("link", {
          name: messages.dashboard.admin.tabs.organizations,
        })
        .getAttribute("href")
    ).toBe("/admin/organizations")
  })

  it("shows the account section tabs on an account route", () => {
    pathState.current = "/account/profile"
    renderHeader()
    expect(
      screen
        .getByRole("link", { name: messages.dashboard.account.tabs.profile })
        .getAttribute("href")
    ).toBe("/account/profile")
    expect(
      screen
        .getByRole("link", { name: messages.dashboard.account.tabs.security })
        .getAttribute("href")
    ).toBe("/account/security")
  })

  it("shows the per-run tabs and the run switcher inside a pay mapping", () => {
    pathState.current = "/pay-mappings/pay-2026"
    renderHeader()
    expect(
      screen
        .getByRole("link", {
          name: messages.dashboard.payMapping.tabs.overview,
        })
        .getAttribute("href")
    ).toBe("/pay-mappings/pay-2026")
    // The run switcher carries the run's name and status on the right.
    expect(screen.getByText("Lonekartlaggning 2026")).toBeDefined()
    expect(
      screen.getByText(messages.dashboard.payMapping.status.active)
    ).toBeDefined()
  })

  it("opens the run switcher: other runs keep the sub-page, plus the way to the list", async () => {
    pathState.current = "/pay-mappings/pay-2026/analysis"
    renderHeader()
    const trigger = screen.getByRole("button", {
      name: /Lonekartlaggning 2026/,
    })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    fireEvent.click(trigger)
    // Swapping the run lands on the SAME sub-page in the other run.
    const other = await screen.findByRole("menuitem", {
      name: "Lonekartlaggning 2025",
    })
    expect(other.getAttribute("href")).toBe("/pay-mappings/pay-2025/analysis")
    // The active run is marked, and the list is one click away.
    expect(
      screen
        .getByRole("menuitem", { name: /Lonekartlaggning 2026/ })
        .getAttribute("aria-current")
    ).toBe("true")
    expect(
      screen
        .getByRole("menuitem", {
          name: messages.dashboard.payMapping.switcher.all,
        })
        .getAttribute("href")
    ).toBe("/pay-mappings")
  })

  it("keeps the plain header on the pay-mappings list (the tabs belong to a run)", () => {
    pathState.current = "/pay-mappings"
    renderHeader()
    expect(
      screen.queryByRole("link", {
        name: messages.dashboard.payMapping.tabs.overview,
      })
    ).toBeNull()
  })
})
