import { cleanup, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import { FamilyLevelMatrix } from "@/components/levels/family-level-matrix"
import { LEVEL_COUNT, type ZoneKey, zoneForLevel } from "@workspace/core"
import { levelRanges, type LevelRoleRow } from "@/lib/levels"
import { zoneBoundaryIndexes } from "@/lib/zone-bands"

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
    // Calibration facts: unflagged by default, so a fixture is a role nobody
    // has to look at unless a test says otherwise.
    completed: true,
    calibrated: false,
    methodDrift: false,
    profileLimited: false,
    profileFailures: null,
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

function renderMatrix(rows: LevelRoleRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamilyLevelMatrix levels={LEVELS} rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("FamilyLevelMatrix", () => {
  afterEach(() => cleanup())

  it("renders a level column per level and a row per family, name-sorted with the family-less bucket last", () => {
    renderMatrix([
      role({
        roleId: "r1",
        title: "Engineer",
        familyId: "f2",
        familyName: "Tech",
        level: 1,
      }),
      role({
        roleId: "r2",
        title: "Accountant",
        familyId: "f1",
        familyName: "Finance",
        level: 2,
      }),
      role({ roleId: "r3", title: "Advisor", level: 2 }),
    ])
    // Column headers: one per level.
    expect(screen.getByRole("columnheader", { name: "Level 1" })).toBeDefined()
    expect(screen.getByRole("columnheader", { name: "Level 2" })).toBeDefined()
    // Family labels are full-width rows (scope=colgroup, so columnheader
    // role) in order: Finance, Tech, then the family-less bucket. The zone
    // header row above the levels is a colgroup header too, so it is excluded
    // by name rather than by counting.
    const familyLabels = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent)
      .filter(
        (label) =>
          label !== null &&
          !/^Level \d+$/.test(label) &&
          !label.startsWith("Zone ")
      )
    expect(familyLabels).toEqual([
      "Finance",
      "Tech",
      messages.dashboard.roles.family.none,
    ])
  })

  // Levels are the column axis here, so the zones are a header row spanning
  // their own levels: names only, since a header three columns wide has no
  // room for a zone's description (the ladder carries that).
  it("groups the level columns under their zone", () => {
    renderMatrix([role({ roleId: "r1", level: 1 })])
    const zoneHeader = screen.getByRole("columnheader", {
      name: /^Zone A/,
    }) as HTMLTableCellElement
    expect(zoneHeader.colSpan).toBe(2)
    // This view groups the zones around the levels on the COLUMN axis
    // already, so only its label changed: the short name and the morph, like
    // the ladder's own group label, instead of the masterdokument's clause.
    expect(zoneHeader.textContent).toContain(
      zoneContent("en").zones.A.shortName
    )
    expect(zoneHeader.textContent).not.toContain(zoneContent("en").zones.A.name)
  })

  it("places each role in the cell where its family meets its level", () => {
    renderMatrix([
      role({
        roleId: "r1",
        title: "Engineer",
        familyId: "f2",
        familyName: "Tech",
        level: 1,
      }),
      role({
        roleId: "r2",
        title: "Architect",
        familyId: "f2",
        familyName: "Tech",
        level: 2,
      }),
    ])
    // The family's level cells sit in the row right below its label row.
    const labelRow = screen
      .getByRole("columnheader", { name: "Tech" })
      .closest("tr") as HTMLTableRowElement
    const cellsRow = labelRow.nextElementSibling as HTMLTableRowElement
    const cells = within(cellsRow).getAllByRole("cell")
    // Level 1 first, Level 2 second.
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
        level: 1,
      }),
      role({
        roleId: "r2",
        title: "Draft Role",
        familyId: "f2",
        familyName: "Tech",
        level: null,
      }),
    ])
    expect(screen.queryByText("Draft Role")).toBeNull()
  })

  it("renders nothing but the zone and level headers when every role is filtered away", () => {
    renderMatrix([])
    // The structural axes stay: the zone band over its levels, and the level
    // headers. What goes is every family label row.
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "")
    expect(headers.filter((label) => !label.startsWith("Zone "))).toEqual([
      "Level 1",
      "Level 2",
    ])
    expect(headers.some((label) => label.startsWith("Zone A"))).toBe(true)
  })
})

// ZONE BOUNDARIES, on the axis where they mean something.
//
// The families view lays levels across, so the place one zone ends and the
// next begins is a vertical line. It gets a rule of its own, heavier than the
// rules between levels, and it REPLACES the level rule there: two rules in
// one gutter is not a stronger division, it is a smudge.
describe("FamilyLevelMatrix zone boundaries", () => {
  afterEach(() => cleanup())

  const ALL_LEVELS = Array.from({ length: LEVEL_COUNT }, (_, index) => ({
    level: index + 1,
    minScore: 100 - index * 8,
  }))

  function renderFull() {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FamilyLevelMatrix levels={ALL_LEVELS} rows={[role({ level: 1 })]} />
      </NextIntlClientProvider>
    )
    return [
      ...document.querySelectorAll("thead tr:nth-child(2) th"),
    ] as HTMLElement[]
  }

  // Derived from the engine, then stated: the derivation is what keeps the
  // test honest if the architecture ever moves a boundary, and the literal is
  // what says where they are today.
  it("puts a boundary wherever the architecture changes zone", () => {
    const boundaries = zoneBoundaryIndexes(levelRanges(ALL_LEVELS))
    expect([...boundaries].sort((a, b) => a - b)).toEqual([3, 6, 9])
  })

  // THE DISCRIMINATING CASE. With all twelve levels configured, a boundary
  // every third column and a boundary wherever the zone changes give the same
  // answer, so neither the code nor the test above can tell a derivation from
  // a count. A model that configures only some of its levels can: levels 1, 2,
  // 4 and 5 are zones A, A, B, B, so the only boundary is at index 2, and
  // counting threes would put it at 3 instead. zone-bands documents exactly
  // this partial-model case, so it is a real shape, not a contrived one.
  it("follows the zone, not the column count, on a partial model", () => {
    const partial = [1, 2, 4, 5].map((level) => ({
      level,
      minScore: 100 - level * 8,
    }))
    expect([...zoneBoundaryIndexes(levelRanges(partial))]).toEqual([2])
  })

  it("gives every boundary column the zone rule and not the level rule", () => {
    const heads = renderFull()
    expect(heads).toHaveLength(LEVEL_COUNT)
    const boundaries = zoneBoundaryIndexes(levelRanges(ALL_LEVELS))
    heads.forEach((head, index) => {
      const zoned = head.className.includes("after:bg-border")
      const levelled = head.className.includes("border-border/60")
      if (boundaries.has(index)) {
        expect({ index, zoned, levelled }).toEqual({
          index,
          zoned: true,
          levelled: false,
        })
      } else if (index > 0) {
        expect({ index, zoned, levelled }).toEqual({
          index,
          zoned: false,
          levelled: true,
        })
      }
    })
  })

  // Unchanged from the level rules: the first column has no neighbour to be
  // separated from, and it still carries the transparent border so its label
  // sits on the same inset as every other column's.
  it("leaves the first column its spacer and no rule", () => {
    const heads = renderFull()
    const first = heads[0] as HTMLElement
    expect(first.className).toContain("border-transparent")
    expect(first.className).not.toContain("after:bg-border")
    expect(first.className).not.toContain("border-border/60")
  })

  // The rule runs the grid's height, which is the half of the hierarchy that
  // ink alone could not carry, so the cells under a boundary draw it too.
  it("carries the rule down through the cells", () => {
    renderFull()
    const cells = [...document.querySelectorAll("tbody td")] as HTMLElement[]
    expect(cells).toHaveLength(LEVEL_COUNT)
    const boundaries = zoneBoundaryIndexes(levelRanges(ALL_LEVELS))
    cells.forEach((cell, index) => {
      expect({
        index,
        ruled: cell.className.includes("after:bg-border"),
      }).toEqual({ index, ruled: boundaries.has(index) })
    })
  })

  // Every zone band after the first opens on a boundary by definition, so its
  // header takes the same rule rather than the level one.
  it("opens each zone band on its own rule", () => {
    renderFull()
    const bands = [
      ...document.querySelectorAll("thead tr:first-child th"),
    ] as HTMLElement[]
    expect(bands.length).toBeGreaterThan(1)
    bands.forEach((band, index) => {
      expect({
        index,
        ruled: band.className.includes("after:bg-border"),
      }).toEqual({ index, ruled: index > 0 })
      expect(band.className).not.toContain("border-border/60")
    })
  })
})
