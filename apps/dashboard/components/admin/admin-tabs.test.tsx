import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const pathState = vi.hoisted(() => ({ current: "/admin" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import { AdminTabs } from "@/components/admin/admin-tabs"

const USERS = messages.dashboard.admin.tabs.users
const ORGANIZATIONS = messages.dashboard.admin.tabs.organizations
const AUDIT_LOG = messages.dashboard.admin.tabs.auditLog

function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdminTabs />
    </NextIntlClientProvider>
  )
}

describe("AdminTabs", () => {
  beforeEach(() => {
    pathState.current = "/admin"
  })
  afterEach(() => cleanup())

  it("links Users, Organizations and Audit log to their pages", () => {
    renderTabs()
    expect(screen.getByRole("link", { name: USERS }).getAttribute("href")).toBe(
      "/admin"
    )
    expect(
      screen.getByRole("link", { name: ORGANIZATIONS }).getAttribute("href")
    ).toBe("/admin/organizations")
    expect(
      screen.getByRole("link", { name: AUDIT_LOG }).getAttribute("href")
    ).toBe("/admin/audit-log")
  })

  it("marks Users as current on /admin", () => {
    pathState.current = "/admin"
    renderTabs()
    expect(
      screen.getByRole("link", { name: USERS }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen
        .getByRole("link", { name: ORGANIZATIONS })
        .getAttribute("aria-current")
    ).toBeNull()
    expect(
      screen.getByRole("link", { name: AUDIT_LOG }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("marks Users as current on a nested non-org admin path", () => {
    pathState.current = "/admin/users/u1"
    renderTabs()
    expect(
      screen.getByRole("link", { name: USERS }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen
        .getByRole("link", { name: ORGANIZATIONS })
        .getAttribute("aria-current")
    ).toBeNull()
  })

  it("marks Organizations as current on /admin/organizations", () => {
    pathState.current = "/admin/organizations"
    renderTabs()
    expect(
      screen
        .getByRole("link", { name: ORGANIZATIONS })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: USERS }).getAttribute("aria-current")
    ).toBeNull()
    expect(
      screen.getByRole("link", { name: AUDIT_LOG }).getAttribute("aria-current")
    ).toBeNull()
  })

  it("marks Audit log as current on /admin/audit-log", () => {
    pathState.current = "/admin/audit-log"
    renderTabs()
    expect(
      screen.getByRole("link", { name: AUDIT_LOG }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: USERS }).getAttribute("aria-current")
    ).toBeNull()
    expect(
      screen
        .getByRole("link", { name: ORGANIZATIONS })
        .getAttribute("aria-current")
    ).toBeNull()
  })
})
