import { cleanup, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { FamilyLevelMatrix } from "@/components/levels/family-level-matrix"
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
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
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
    // role) in order: Finance, Tech, then the family-less bucket.
    const familyLabels = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent)
      .filter((label) => label !== null && !/^Level \d+$/.test(label))
    expect(familyLabels).toEqual([
      "Finance",
      "Tech",
      messages.dashboard.roles.family.none,
    ])
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

  it("renders nothing but level headers when every role is filtered away", () => {
    renderMatrix([])
    // Only the two level headers remain: no family label rows.
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent)
    ).toEqual(["Level 1", "Level 2"])
  })
})
