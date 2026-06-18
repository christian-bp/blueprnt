import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

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

import { SiteHeader } from "@/components/site-header"

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
})
