import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { BandMatrix } from "@/components/bands/band-matrix"
import { type BandRoleRow, trackColumns } from "@/lib/bands"

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

function renderMatrix(
  rows: BandRoleRow[],
  groupByFamily = false,
  tracks = trackColumns(rows.filter((row) => row.band !== null))
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BandMatrix
        bands={BANDS}
        rows={rows}
        tracks={tracks}
        groupByFamily={groupByFamily}
      />
    </NextIntlClientProvider>
  )
}

describe("BandMatrix", () => {
  afterEach(() => cleanup())

  it("renders a column header per present track in IC, Lead, M order", () => {
    renderMatrix([
      role({ roleId: "m1", trackKey: "M", trackName: "Manager" }),
      role({
        roleId: "i1",
        trackKey: "IC",
        trackName: "Individual contributor",
      }),
    ])
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent)
    // Empty corner cell first, then IC before M (short track keys).
    expect(headers).toEqual(["", "IC", "M"])
  })

  it("places a role in the cell where its band meets its track", () => {
    renderMatrix([role({ roleId: "m1", title: "CTO", band: 1, trackKey: "M" })])
    expect(screen.getByText("Band 1")).toBeDefined()
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
  })

  it("excludes roles without a band from the grid", () => {
    renderMatrix([
      role({ roleId: "m1", title: "CTO", band: 1, trackKey: "M" }),
      role({
        roleId: "x1",
        title: "Draftee",
        band: null,
        trackKey: "IC",
        score: null,
      }),
    ])
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    expect(screen.queryByRole("link", { name: /Draftee/ })).toBeNull()
  })

  it("clusters cell roles by family when grouping is on", () => {
    renderMatrix(
      [
        role({
          roleId: "a",
          title: "CTO",
          band: 1,
          trackKey: "M",
          trackName: "Manager",
          familyId: "f1",
          familyName: "Engineering",
        }),
        role({
          roleId: "b",
          title: "VP Sales",
          band: 1,
          trackKey: "M",
          trackName: "Manager",
          familyId: "f2",
          familyName: "Sales",
        }),
      ],
      true
    )
    expect(screen.getByText("Engineering")).toBeDefined()
    expect(screen.getByText("Sales")).toBeDefined()
  })

  it("keeps the columns and hatches every cell when all roles are filtered out", () => {
    // The family filter can hide every role; the matrix must still show the
    // grid (hatched), not collapse to nothing. Columns come from the
    // unfiltered roles, so they survive an empty `rows`.
    renderMatrix([], false, [
      { key: "IC", name: "Individual contributor" },
      { key: "M", name: "Manager" },
    ])
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent)
    expect(headers).toEqual(["", "IC", "M"])
    // No roles to place: every cell is the hatched placeholder, no links.
    expect(screen.queryByRole("link")).toBeNull()
  })
})
