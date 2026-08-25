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
// The families view lays levels across, so where one zone ends and the next
// begins is a vertical line. It gets a COLUMN of its own rather than a class
// on the column after it: the zones have to read as separated groups, and the
// air that separates them has to sit outside the cells' own visible boxes.
// Every row type emits that column from one shared list, which is what keeps
// the line continuous and every cell above and below it aligned.
describe("FamilyLevelMatrix zone boundaries", () => {
  afterEach(() => cleanup())

  const ALL_LEVELS = Array.from({ length: LEVEL_COUNT }, (_, index) => ({
    level: index + 1,
    minScore: 100 - index * 8,
  }))

  const zoneRules = () => [
    ...document.querySelectorAll('[data-slot="zone-rule"]'),
  ]
  const isLevelRuled = (el: Element) =>
    el.className.includes("after:bg-border/60")
  // By slot, not by class: "w-3" is a substring of "min-w-32", so a class
  // match counts every cell in the grid as a boundary and passes on a matrix
  // that draws none.
  const isGap = (el: Element) => el.getAttribute("data-slot") === "zone-gap"

  function renderFull(familyName: string | null = null) {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FamilyLevelMatrix
          levels={ALL_LEVELS}
          rows={[
            role({
              level: 1,
              familyId: familyName === null ? null : "f1",
              familyName,
            }),
          ]}
        />
      </NextIntlClientProvider>
    )
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

  // THE BOUNDARY IS A COLUMN. Padding could not buy the air: a body cell IS
  // its visible box, so padding widens the box and pushes its chips
  // off-centre instead of moving the boxes apart.
  it("gives the boundary a column of its own", () => {
    renderFull()
    const heads = [
      ...document.querySelectorAll(
        "thead tr:nth-child(2) th, thead tr:nth-child(2) td"
      ),
    ] as HTMLElement[]
    // Twelve levels plus three boundaries.
    expect(heads).toHaveLength(LEVEL_COUNT + 3)
    const gaps = heads.filter(isGap)
    expect(gaps).toHaveLength(3)
    // And a gap column holds nothing but the air.
    for (const gap of gaps) {
      expect(gap.tagName).toBe("TD")
      expect(gap.textContent).toBe("")
      expect(gap.getAttribute("aria-hidden")).toBe("true")
      // THE AIR IS CONTENT, not a class. Auto table layout treats a width on
      // an empty cell as a suggestion and collapses the column to 0px, which
      // is what it did; only a child with a real width gives the column a
      // min-content the algorithm has to honour. jsdom measures nothing, so
      // the mechanism is what gets pinned.
      const spacer = gap.firstElementChild as HTMLElement | null
      expect(spacer).not.toBeNull()
      expect(spacer?.className).toContain("w-[11px]")
    }
  })

  // ONE LINE PER BOUNDARY, not one segment per row. A dashed gradient
  // restarts its phase in every box it paints, and no row here is a multiple
  // of the 7px period, so segments would break the pattern at every joint.
  it("draws one line per boundary, spanning the whole table", () => {
    renderFull("Engineering")
    const rules = zoneRules()
    // Three boundaries, three lines. Eighteen rows, still three lines.
    expect(rules).toHaveLength(3)
    for (const rule of rules) {
      // Each one lives in a gap cell of the FIRST row, and reaches the
      // table's height from there.
      const cell = rule.closest("td") as HTMLElement
      expect(isGap(cell)).toBe(true)
      expect(cell.closest("tr")).toBe(document.querySelector("thead tr"))
      expect(rule.className).toContain("absolute")
      expect(rule.className).toContain("top-0")
      expect(rule.className).toContain("bottom-0")
      // Dashed, in the app's reference-line rhythm.
      expect((rule as HTMLElement).style.backgroundImage).toContain(
        "repeating-linear-gradient"
      )
    }
    // The height resolves against a positioned wrapper around the table, not
    // against the cell it sits in: a cell-bound line would be 32px tall.
    const wrapper = rules[0]?.closest("table")?.parentElement as HTMLElement
    expect(wrapper.className).toContain("relative")
    expect(wrapper.className).toContain("w-max")
  })

  // The level rule is a different order of division and keeps its own
  // gutters: it never appears where the zone rule already divides, and never
  // to the left of the first column, which has no neighbour.
  it("keeps the level rule out of the boundary gutters", () => {
    renderFull()
    const cells = [
      ...document.querySelectorAll(
        "thead tr:nth-child(2) th, thead tr:nth-child(2) td"
      ),
    ] as HTMLElement[]
    const levelled = cells
      .map((cell, position) => (isLevelRuled(cell) ? position : null))
      .filter((position) => position !== null)
    // Positions in the rendered sequence: every level column except the first
    // and the three that open a zone (each of which is preceded by a gap).
    expect(levelled).toEqual([1, 2, 5, 6, 9, 10, 13, 14])
    expect(cells.filter((c) => isGap(c) && isLevelRuled(c))).toHaveLength(0)
  })

  // THE COLUMN IS UNBROKEN. Every row type the grid has emits the boundary
  // column at the same COLUMN index: the zone band header, the level header,
  // the family label rows, and the cell rows. The line spans them all from
  // the first, so a row that skipped its gap cell would knock every row below
  // it sideways and leave the line running through the wrong column.
  it("carries the boundary column through every row type", () => {
    renderFull("Engineering")
    const rows = [
      ...document.querySelectorAll("thead tr, tbody tr"),
    ] as HTMLElement[]
    // band header + level header + label row + cell row.
    expect(rows).toHaveLength(4)
    // COLUMN indexes, not cell positions. The band header spans three levels
    // per cell, so counting cells says nothing about which column a gap
    // lands in: this row once carried a colSpan that swallowed the boundary
    // column beside it, putting its rule three columns off, and a
    // position-based assertion passed the whole time.
    const gapColumns = (row: HTMLElement) => {
      const found: number[] = []
      let column = 0
      for (const cell of row.querySelectorAll("th, td")) {
        if (isGap(cell)) found.push(column)
        column += (cell as HTMLTableCellElement).colSpan
      }
      return found
    }
    // Every row agrees, and the grid is twelve levels plus three boundaries.
    for (const row of rows) {
      expect(gapColumns(row)).toEqual([3, 7, 11])
      expect(
        [...row.querySelectorAll("th, td")].reduce(
          (total, cell) => total + (cell as HTMLTableCellElement).colSpan,
          0
        )
      ).toBe(LEVEL_COUNT + 3)
    }
  })

  // The first column has no neighbour on its left to be divided from, and it
  // still carries the transparent inset so its label sits where every other
  // column's does.
  it("leaves the first column its inset and no rule", () => {
    renderFull()
    const first = document.querySelector(
      "thead tr:nth-child(2) th"
    ) as HTMLElement
    expect(first.className).toContain("border-transparent")
    expect(isGap(first)).toBe(false)
    expect(isLevelRuled(first)).toBe(false)
  })

  // The name still heads its row, and still by name: positioning it out of
  // flow is what stops it setting the first column's width for the whole
  // grid, and it must not cost the row its accessible heading.
  it("keeps the family name as the label row's columnheader", () => {
    renderFull("Engineering")
    const heading = screen.getByRole("columnheader", { name: "Engineering" })
    const labelRow = heading.closest("tr") as HTMLElement
    expect(labelRow.querySelectorAll("th")).toHaveLength(1)
    expect(labelRow.querySelectorAll("td")).toHaveLength(LEVEL_COUNT + 2)
    // OUT OF FLOW, which is the whole reason the row could be split into
    // cells at all: in flow the name would be the widest thing in the first
    // column and would set that column's width for the entire grid. jsdom
    // measures nothing, so the mechanism is what gets pinned.
    const name = screen.getByText("Engineering")
    expect(name.className).toContain("absolute")
    expect(name.className).toContain("whitespace-nowrap")
    // And the row's height is reserved by the cells, since nothing in it is
    // in flow to give it one.
    expect(heading.className).toContain("h-7")
  })

  // The body cells carry no rule of their own: the level rule hangs from the
  // header, and the zone rule lives in the boundary column beside them. A
  // rule on the cell would draw inside its own rounded border.
  it("leaves the cells' own boxes unruled", () => {
    renderFull("Engineering")
    const cellRow = [...document.querySelectorAll("tbody tr")].at(
      -1
    ) as HTMLElement
    const boxes = [...cellRow.querySelectorAll("td")].filter(
      (cell) => !isGap(cell)
    )
    expect(boxes).toHaveLength(LEVEL_COUNT)
    for (const box of boxes) {
      expect(box.querySelector('[data-slot="zone-rule"]')).toBeNull()
      expect(isLevelRuled(box)).toBe(false)
    }
  })
})
