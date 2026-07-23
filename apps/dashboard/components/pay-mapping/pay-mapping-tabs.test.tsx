import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({ current: "/pay-mappings/pay-2026" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import { PayMappingTabs } from "./pay-mapping-tabs"

const tabs = messages.dashboard.payMapping.tabs

function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingTabs />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  pathState.current = "/pay-mappings/pay-2026"
})

describe("PayMappingTabs", () => {
  it("renders the three run tabs with slug-scoped hrefs", () => {
    renderTabs()
    expect(
      screen.getByRole("link", { name: tabs.overview }).getAttribute("href")
    ).toBe("/pay-mappings/pay-2026")
    expect(
      screen.getByRole("link", { name: tabs.analysis }).getAttribute("href")
    ).toBe("/pay-mappings/pay-2026/analysis")
    expect(
      screen.getByRole("link", { name: tabs.report }).getAttribute("href")
    ).toBe("/pay-mappings/pay-2026/report")
  })

  it("marks the overview tab active on the run index route", () => {
    renderTabs()
    expect(
      screen
        .getByRole("link", { name: tabs.overview })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen
        .getByRole("link", { name: tabs.analysis })
        .getAttribute("aria-current")
    ).toBeNull()
  })

  it("marks the analysis tab active on its sub-route", () => {
    pathState.current = "/pay-mappings/pay-2026/analysis"
    renderTabs()
    expect(
      screen
        .getByRole("link", { name: tabs.analysis })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen
        .getByRole("link", { name: tabs.overview })
        .getAttribute("aria-current")
    ).toBeNull()
  })

  it("renders nothing on the /review takeover (its full-viewport overlay covers this row)", () => {
    pathState.current = "/pay-mappings/pay-2026/review"
    const { container } = renderTabs()
    expect(container.innerHTML).toBe("")
    expect(screen.queryByRole("link")).toBeNull()
  })
})
