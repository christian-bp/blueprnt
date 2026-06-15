import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { PendingRoles } from "@/components/bands/pending-roles"
import type { BandRoleRow } from "@/lib/bands"

function role(overrides: Partial<BandRoleRow>): BandRoleRow {
  return {
    roleId: "r1",
    title: "Data Analyst",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: null,
    band: null,
    ratedCount: 3,
    totalCriteria: 9,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function renderPending(rows: BandRoleRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PendingRoles rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("PendingRoles", () => {
  afterEach(() => cleanup())

  it("lists roles without a band, with rating progress and a link", () => {
    renderPending([role({})])
    expect(
      screen.getByText(messages.dashboard.bands.pendingHeading)
    ).toBeDefined()
    expect(screen.getByText("3/9 rated")).toBeDefined()
    expect(
      screen.getByRole("link", { name: /Data Analyst/ }).getAttribute("href")
    ).toBe("/roles/r1")
  })

  it("ignores roles that already have a band", () => {
    renderPending([
      role({ roleId: "r2", title: "Engineer", band: 5, score: 58 }),
    ])
    expect(
      screen.queryByText(messages.dashboard.bands.pendingHeading)
    ).toBeNull()
  })

  it("renders nothing when there are no pending roles", () => {
    const { container } = renderPending([])
    expect(container.firstChild).toBeNull()
  })
})
