import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { BandLadder } from "@/components/bands/band-ladder"
import type { BandRoleRow } from "@/lib/bands"

const BANDS = [
  { band: 1, minScore: 80 },
  { band: 2, minScore: 0 },
]

function role(overrides: Partial<BandRoleRow>): BandRoleRow {
  return {
    roleId: "r1",
    title: "CTO",
    trackKey: "M",
    trackName: "Manager",
    score: 90,
    band: 1,
    ratedCount: 9,
    totalCriteria: 9,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function renderLadder(rows: BandRoleRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BandLadder bands={BANDS} rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("BandLadder", () => {
  afterEach(() => cleanup())

  it("renders a lane per band with the band 1 range topping at 100", () => {
    renderLadder([role({})])
    expect(screen.getByText("Band 1")).toBeDefined()
    expect(screen.getByText("Band 2")).toBeDefined()
    expect(screen.getByText("80–100")).toBeDefined()
  })

  it("places a role in its band and shows the empty note for empty bands", () => {
    renderLadder([role({ roleId: "r1", title: "CTO", band: 1 })])
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    expect(screen.getByText(messages.dashboard.bands.bandEmpty)).toBeDefined()
  })

  it("ignores roles without a band (they belong in the pending zone)", () => {
    renderLadder([role({ roleId: "r9", title: "Draftee", band: null })])
    expect(screen.queryByRole("link", { name: /Draftee/ })).toBeNull()
  })
})
