import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { LevelMatrix } from "@/components/levels/level-matrix"
import { type ZoneKey, ZONE_KEYS, zoneForLevel } from "@workspace/core"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
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
    readyToComplete: false,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
    // A fixture stays COHERENT by default: the zone follows the level the
    // row ends up with, so a test that moves a role to another level does
    // not have to remember to move its zone too. A test that wants the two
    // to DISAGREE says so explicitly, which is how the ladder's
    // zone-from-the-engine rule is pinned.
    zone: coherentZone(overrides),
  }
}

function coherentZone(overrides: Partial<LevelRoleRow>): ZoneKey | null {
  if (overrides?.zone !== undefined) return overrides.zone
  const level = overrides?.level === undefined ? 1 : overrides.level
  return level === null ? null : zoneForLevel(level)
}

// The full twelve-level architecture, for the tests that are about the zones.
const TWELVE_LEVELS = Array.from({ length: 12 }, (_, index) => ({
  level: index + 1,
  minScore: 100 - index * 8,
}))

function renderMatrix(
  rows: LevelRoleRow[],
  levels: { level: number; minScore: number }[] = LEVELS,
  groupByFamily = false,
  tracks = trackColumns(rows.filter((row) => row.level !== null))
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LevelMatrix
        levels={levels}
        rows={rows}
        tracks={tracks}
        groupByFamily={groupByFamily}
      />
    </NextIntlClientProvider>
  )
}

describe("LevelMatrix", () => {
  afterEach(() => cleanup())

  // The matrix bands by zone too, on a row of its own: there is no left column
  // wide enough to carry a zone's description beside twelve level rows.
  it("puts each zone's levels under a band row that names and counts, not describes", () => {
    renderMatrix([role({ roleId: "r1", level: 1 })], TWELVE_LEVELS)
    const content = zoneContent("en")
    for (const zone of ZONE_KEYS) {
      // A stat row: the letter as a chip, the SHORT name as the line, the span
      // as a chip, the count right-aligned. Everything identifies or
      // quantifies.
      expect(screen.getByText(zone)).toBeDefined()
      expect(screen.getByText(content.zones[zone].shortName)).toBeDefined()
      // Section 14.5's three columns opened OUT of the band: the
      // masterdokument's own full name, the character and the typical profile
      // were standing prose, two paragraphs per band, four bands deep, above a
      // ladder whose job is showing where roles sit.
      expect(screen.queryByText(content.zones[zone].name)).toBeNull()
      expect(screen.queryByText(content.zones[zone].character)).toBeNull()
      expect(screen.queryByText(content.zones[zone].typicalProfile)).toBeNull()
    }
  })

  it("collapses one band without touching the others", () => {
    renderMatrix([role({ roleId: "r1", level: 1 })], TWELVE_LEVELS)
    expect(screen.getByText("Level 1")).toBeDefined()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.levels.hideZone.replace("{zone}", "A"),
      })
    )
    expect(screen.queryByText("Level 1")).toBeNull()
    expect(screen.getByText("Level 4")).toBeDefined()
  })

  // Same rule as the ladder: the engine places, the matrix reports.
  it("draws no cell for a row the engine has not placed", () => {
    renderMatrix(
      [
        role({
          roleId: "unplaced",
          title: "Unplaced Role",
          level: 1,
          zone: null,
        }),
      ],
      TWELVE_LEVELS
    )
    expect(screen.queryByRole("link", { name: /Unplaced Role/ })).toBeNull()
  })

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
      LEVELS,
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
    const { container } = renderMatrix([], LEVELS, false, [
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
    renderMatrix([], LEVELS, false, [
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
