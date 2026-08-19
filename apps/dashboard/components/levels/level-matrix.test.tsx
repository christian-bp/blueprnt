import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { LevelMatrix } from "@/components/levels/level-matrix"
import { type LevelRoleRow, trackColumns } from "@/lib/levels"

const LEVELS = [
  { level: 1, minScore: 80 },
  { level: 2, minScore: 0 },
]

function role(overrides: Partial<LevelRoleRow>): LevelRoleRow {
  return {
    roleId: "r1",
    slug: "r1",
    title: "CTO",
    trackKey: "M",
    trackName: "Manager",
    score: 90,
    level: 1,
    ratedCount: 9,
    totalCriteria: 9,
    readyToLock: false,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function renderMatrix(
  rows: LevelRoleRow[],
  groupByFamily = false,
  tracks = trackColumns(rows.filter((row) => row.level !== null))
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LevelMatrix
        levels={LEVELS}
        rows={rows}
        tracks={tracks}
        groupByFamily={groupByFamily}
      />
    </NextIntlClientProvider>
  )
}

describe("LevelMatrix", () => {
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

  it("places a role in the cell where its level meets its track", () => {
    renderMatrix([
      role({ roleId: "m1", title: "CTO", level: 1, trackKey: "M" }),
    ])
    expect(screen.getByText("Level 1")).toBeDefined()
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
  })

  it("excludes roles without a level from the grid", () => {
    renderMatrix([
      role({ roleId: "m1", title: "CTO", level: 1, trackKey: "M" }),
      role({
        roleId: "x1",
        title: "Draftee",
        level: null,
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
          level: 1,
          trackKey: "M",
          trackName: "Manager",
          familyId: "f1",
          familyName: "Engineering",
        }),
        role({
          roleId: "b",
          title: "VP Sales",
          level: 1,
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

  it("pins every empty-cell hatch to a fixed background-size (WebKit #94795 guard)", () => {
    // See LevelLadder: a fixed background-size keeps the hatch crisp in tall
    // cells in Safari (WebKit #94795). The matrix is where this actually bites,
    // because a cell stretches to the tallest sibling. jsdom cannot paint, so we
    // guard the class: every empty cell must carry the size-pinned hatch.
    const { container } = renderMatrix([], false, [
      { key: "IC", name: "Individual contributor" },
      { key: "M", name: "Manager" },
    ])
    const hatches = container.querySelectorAll('[class*="background-size:"]')
    // 2 levels x 2 tracks, every cell empty and hatched.
    expect(hatches.length).toBe(4)
    for (const hatch of hatches) {
      expect(hatch.className).toContain("repeating-linear-gradient")
    }
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
