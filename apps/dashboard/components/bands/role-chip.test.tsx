import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { RoleChip } from "@/components/bands/role-chip"
import type { BandRoleRow } from "@/lib/bands"

function row(overrides: Partial<BandRoleRow>): BandRoleRow {
  return {
    roleId: "r1",
    title: "Staff Engineer",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: 78,
    band: 3,
    ratedCount: 9,
    totalCriteria: 9,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function renderChip(r: BandRoleRow) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleChip role={r} />
    </NextIntlClientProvider>
  )
}

describe("RoleChip", () => {
  afterEach(() => cleanup())

  it("links to the role and shows the title, not a weighting number", () => {
    renderChip(row({}))
    const link = screen.getByRole("link", { name: /Staff Engineer/ })
    expect(link.getAttribute("href")).toBe("/roles/r1")
    // Weighting numbers are intentionally not shown on the Overview.
    expect(screen.queryByText("78")).toBeNull()
    // The track renders as the short key, not the full name.
    expect(screen.getByText("IC")).toBeDefined()
    expect(screen.queryByText("Individual contributor")).toBeNull()
  })

  it("flags an anchor whose computed band deviates from the agreed band", () => {
    renderChip(row({ band: 3, anchor: { expectedBand: 2, status: "active" } }))
    const expected = messages.dashboard.bands.deviation.replace("{band}", "2")
    expect(screen.getByText(expected)).toBeDefined()
  })

  it("shows no deviation flag when the computed band matches the agreed band", () => {
    renderChip(row({ band: 2, anchor: { expectedBand: 2, status: "active" } }))
    const expected = messages.dashboard.bands.deviation.replace("{band}", "2")
    expect(screen.queryByText(expected)).toBeNull()
  })
})
