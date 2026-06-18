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

function renderLadder(rows: BandRoleRow[], groupByFamily = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BandLadder bands={BANDS} rows={rows} groupByFamily={groupByFamily} />
    </NextIntlClientProvider>
  )
}

describe("BandLadder", () => {
  afterEach(() => cleanup())

  it("renders a lane per band without weighting numbers", () => {
    renderLadder([role({})])
    expect(screen.getByText("Band 1")).toBeDefined()
    expect(screen.getByText("Band 2")).toBeDefined()
    // The band weighting range is intentionally not shown.
    expect(screen.queryByText("80–100")).toBeNull()
  })

  it("places a role in its band and hatches empty bands", () => {
    renderLadder([role({ roleId: "r1", title: "CTO", band: 1 })])
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    // Band 2 is empty: a diagonal-hatch placeholder, labelled for a11y.
    expect(
      screen.getByRole("img", { name: messages.dashboard.bands.bandEmpty })
    ).toBeDefined()
  })

  it("pins the empty-band hatch to a fixed background-size (WebKit #94795 guard)", () => {
    // The hatch must keep a fixed background-size so WebKit rasterizes one small
    // tile and repeats it. Without it Safari samples the gradient across the
    // whole paint box and renders the hatch sparse and faint in tall areas;
    // Chrome is unaffected. jsdom cannot paint, so we guard the class instead.
    renderLadder([role({ roleId: "r1", band: 1 })])
    const hatch = screen.getByRole("img", {
      name: messages.dashboard.bands.bandEmpty,
    })
    expect(hatch.className).toContain("repeating-linear-gradient")
    expect(hatch.className).toContain("background-size:")
  })

  it("ignores roles without a band (they belong in the pending zone)", () => {
    renderLadder([role({ roleId: "r9", title: "Draftee", band: null })])
    expect(screen.queryByRole("link", { name: /Draftee/ })).toBeNull()
  })

  it("clusters roles by family within a band when grouping is on", () => {
    renderLadder(
      [
        role({
          roleId: "a",
          title: "CTO",
          band: 1,
          familyId: "f1",
          familyName: "Engineering",
        }),
        role({
          roleId: "b",
          title: "VP Sales",
          band: 1,
          familyId: "f2",
          familyName: "Sales",
        }),
      ],
      true
    )
    expect(screen.getByText("Engineering")).toBeDefined()
    expect(screen.getByText("Sales")).toBeDefined()
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    expect(screen.getByRole("link", { name: /VP Sales/ })).toBeDefined()
  })
})
