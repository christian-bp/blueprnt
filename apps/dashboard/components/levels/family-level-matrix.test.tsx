import { cleanup, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import { FamilyLevelMatrix } from "@/components/levels/family-level-matrix"
import { type ZoneKey, zoneForLevel } from "@workspace/core"
import type { LevelRoleRow } from "@/lib/levels"

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
