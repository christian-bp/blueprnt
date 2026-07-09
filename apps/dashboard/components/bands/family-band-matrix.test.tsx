import { cleanup, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { FamilyBandMatrix } from "@/components/bands/family-band-matrix"
import type { BandRoleRow } from "@/lib/bands"

const BANDS = [
  { band: 1, minScore: 80 },
  { band: 2, minScore: 0 },
]

function role(overrides: Partial<BandRoleRow>): BandRoleRow {
  return {
    roleId: "r1",
    slug: "r1",
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

function renderMatrix(rows: BandRoleRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamilyBandMatrix bands={BANDS} rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("FamilyBandMatrix", () => {
  afterEach(() => cleanup())

  it("renders a band column per band and a row per family, name-sorted with the family-less bucket last", () => {
    renderMatrix([
      role({
        roleId: "r1",
        title: "Engineer",
        familyId: "f2",
        familyName: "Tech",
        band: 1,
      }),
      role({
        roleId: "r2",
        title: "Accountant",
        familyId: "f1",
        familyName: "Finance",
        band: 2,
      }),
      role({ roleId: "r3", title: "Advisor", band: 2 }),
    ])
    // Column headers: one per band.
    expect(screen.getByRole("columnheader", { name: "Band 1" })).toBeDefined()
    expect(screen.getByRole("columnheader", { name: "Band 2" })).toBeDefined()
    // Row headers in order: Finance, Tech, then the family-less bucket.
    const rowHeaders = screen
      .getAllByRole("rowheader")
      .map((header) => header.textContent)
    expect(rowHeaders).toEqual([
      "Finance",
      "Tech",
      messages.dashboard.roles.family.none,
    ])
  })

  it("places each role in the cell where its family meets its band", () => {
    renderMatrix([
      role({
        roleId: "r1",
        title: "Engineer",
        familyId: "f2",
        familyName: "Tech",
        band: 1,
      }),
      role({
        roleId: "r2",
        title: "Architect",
        familyId: "f2",
        familyName: "Tech",
        band: 2,
      }),
    ])
    const techRow = screen
      .getByRole("rowheader", { name: "Tech" })
      .closest("tr") as HTMLTableRowElement
    const cells = within(techRow).getAllByRole("cell")
    // Band 1 first, Band 2 second.
    expect(within(cells[0] as HTMLElement).getByText("Engineer")).toBeDefined()
    expect(within(cells[1] as HTMLElement).getByText("Architect")).toBeDefined()
    // The occupied cells carry no hatch; each holds exactly its own role.
    expect(within(cells[0] as HTMLElement).queryByText("Architect")).toBeNull()
  })

  it("leaves unplaced roles out (they belong to the pending list)", () => {
    renderMatrix([
      role({
        roleId: "r1",
        title: "Engineer",
        familyId: "f2",
        familyName: "Tech",
        band: 1,
      }),
      role({
        roleId: "r2",
        title: "Draft Role",
        familyId: "f2",
        familyName: "Tech",
        band: null,
      }),
    ])
    expect(screen.queryByText("Draft Role")).toBeNull()
  })

  it("renders nothing but headers when every role is filtered away", () => {
    renderMatrix([])
    expect(screen.getByRole("columnheader", { name: "Band 1" })).toBeDefined()
    expect(screen.queryAllByRole("rowheader")).toHaveLength(0)
  })
})
