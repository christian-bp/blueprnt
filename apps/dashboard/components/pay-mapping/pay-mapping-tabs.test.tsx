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
    // Analysis links past its own segment: the section has no page there,
    // only a redirect into the first chapter, and a tab click should not
    // spend a round trip on it.
    expect(
      screen.getByRole("link", { name: tabs.analysis }).getAttribute("href")
    ).toBe("/pay-mappings/pay-2026/analysis/start")
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

  it("marks the analysis tab active on a chapter page, not just its own segment", () => {
    // The href now points past the segment while the current-state match
    // still keys off the segment, so the two must not drift: every chapter
    // page has to keep the tab lit.
    pathState.current = "/pay-mappings/pay-2026/analysis/equivalent-work"
    renderTabs()
    expect(
      screen
        .getByRole("link", { name: tabs.analysis })
        .getAttribute("aria-current")
    ).toBe("page")
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
})
