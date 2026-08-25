import { cleanup, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { LevelLadder } from "@/components/levels/level-ladder"
import {
  type ZoneKey,
  ZONE_KEYS,
  ZONE_LEVEL_RANGES,
  zoneForLevel,
} from "@workspace/core"
import {
  levelFunction,
  zoneContent,
} from "@workspace/backend/convex/evaluationModel/zoneContent"
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

function renderLadder(
  rows: LevelRoleRow[],
  groupByFamily = false,
  levels: { level: number; minScore: number }[] = LEVELS
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LevelLadder levels={levels} rows={rows} groupByFamily={groupByFamily} />
    </NextIntlClientProvider>
  )
}

describe("LevelLadder", () => {
  afterEach(() => cleanup())

  // Twelve levels read flat are a list of numbers. The zone band is what says
  // levels 1-3 are one KIND of role, so it carries the zone's letter, its name
  // and its own description (masterdokument 14.5), not just a divider.
  // The zone is an ANNOTATION around the rows, not a section the ladder is cut
  // into: one small label at the top of its three rows. It
  // stands the letter and the SHORT name; section 14.5's three columns (the
  // masterdokument's own full name, the character, the typical profile) are
  // what the morph beside it carries.
  it("labels each zone above its levels, and describes it nowhere", () => {
    renderLadder([role({ roleId: "r1", level: 1 })], false, TWELVE_LEVELS)
    const content = zoneContent("en")
    for (const zone of ZONE_KEYS) {
      expect(screen.getByText(`Zone ${zone}`)).toBeDefined()
      expect(screen.getByText(content.zones[zone].shortName)).toBeDefined()
      expect(
        screen.getByRole("button", { name: content.zones[zone].shortName })
      ).toBeDefined()
      expect(screen.queryByText(content.zones[zone].name)).toBeNull()
      expect(screen.queryByText(content.zones[zone].character)).toBeNull()
      expect(screen.queryByText(content.zones[zone].typicalProfile)).toBeNull()
    }
  })

  // The label groups exactly its zone's levels: the grouping is structural, so
  // a reader can read the ladder flat and still see which three rungs are one
  // kind of role. Nothing else marks it, which is the owner's ruling: the
  // title is enough, and the rail that briefly sat down this edge was ours
  // rather than section 14.5.1's.
  it("groups exactly the three levels of each zone under its label", () => {
    renderLadder([], false, TWELVE_LEVELS)
    const content = zoneContent("en")
    for (const zone of ZONE_KEYS) {
      const { from, to } = ZONE_LEVEL_RANGES[zone]
      const group = screen
        .getByText(content.zones[zone].shortName)
        .closest("section") as HTMLElement
      const levels = [...group.querySelectorAll("li")].map(
        (row) => row.textContent ?? ""
      )
      expect(levels).toHaveLength(to - from + 1)
      for (let level = from; level <= to; level++) {
        expect(
          levels.some((text) => text.startsWith(`Level ${level}`)),
          `zone ${zone} groups level ${level}`
        ).toBe(true)
      }
    }
  })

  // The flat list is the shape: twelve rows, no band row between them, and no
  // control on the group. Band rows were what cost the ladder its rhythm.
  it("draws twelve level rows and no band row between them", () => {
    const { container } = renderLadder([], false, TWELVE_LEVELS)
    expect(container.querySelectorAll("li")).toHaveLength(12)
    // Only the four zone morphs; nothing to collapse.
    expect(screen.getAllByRole("button")).toHaveLength(ZONE_KEYS.length)
  })

  // THE RULE (ADR-0022): the engine places, the UI reports. This row has a
  // level but NO zone, which is what an unplaced row looks like on the wire, so
  // it belongs in no band. A ladder that derived the band from the level would
  // happily draw it in zone A, and this catches exactly that.
  //
  // The stronger case (a role whose zone and level disagree) cannot be shown
  // here, because a band only draws its own zone's lanes and such a role has no
  // lane to land in; it is pinned where it is observable, on bandRowsFor
  // (lib/zone-bands.test.ts).
  it("bands by the zone the engine gave, never by the level", () => {
    renderLadder(
      [
        role({
          roleId: "unplaced",
          title: "Unplaced Role",
          level: 1,
          zone: null,
        }),
      ],
      false,
      TWELVE_LEVELS
    )
    expect(screen.queryByRole("link", { name: /Unplaced Role/ })).toBeNull()
    // And the lane it would have landed in reads as empty rather than as
    // holding an invisible role.
    const bandA = screen
      .getByText(zoneContent("en").zones.A.shortName)
      .closest("section") as HTMLElement
    expect(
      within(bandA).getAllByRole("img", {
        name: messages.dashboard.levels.levelEmpty,
      })
    ).toHaveLength(3)
  })

  // The row stands its NUMBER and its COUNT, and nothing else. Section 14.6's
  // entry/established/upper text had its own toggle on every one of twelve
  // rows; a control that repeats twelve times has to earn it, and what a level
  // IS inside its zone is a question about the ZONE, asked once.
  it("gives a level row no control of its own", () => {
    renderLadder([], false, TWELVE_LEVELS)
    const content = zoneContent("en")
    const top = levelFunction(content, 1)
    expect(screen.queryByText(top.label)).toBeNull()
    expect(screen.queryByText(top.meaning)).toBeNull()
    const row = screen.getByText("Level 1").closest("li") as HTMLElement
    expect(within(row).queryAllByRole("button")).toHaveLength(0)
  })

  it("renders a lane per level without weighting numbers", () => {
    renderLadder([role({})])
    expect(screen.getByText("Level 1")).toBeDefined()
    expect(screen.getByText("Level 2")).toBeDefined()
    // The level weighting range is intentionally not shown.
    expect(screen.queryByText("80–100")).toBeNull()
  })

  it("places a role in its level and hatches empty levels", () => {
    renderLadder([role({ roleId: "r1", title: "CTO", level: 1 })])
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    // Level 2 is empty: a diagonal-hatch placeholder, labelled for a11y.
    expect(
      screen.getByRole("img", { name: messages.dashboard.levels.levelEmpty })
    ).toBeDefined()
  })

  it("pins the empty-level hatch to a fixed background-size (WebKit #94795 guard)", () => {
    // The hatch must keep a fixed background-size so WebKit rasterizes one small
    // tile and repeats it. Without it Safari samples the gradient across the
    // whole paint box and renders the hatch sparse and faint in tall areas;
    // Chrome is unaffected. jsdom cannot paint, so we guard the class instead.
    renderLadder([role({ roleId: "r1", level: 1 })])
    const hatch = screen.getByRole("img", {
      name: messages.dashboard.levels.levelEmpty,
    })
    expect(hatch.className).toContain("repeating-linear-gradient")
    expect(hatch.className).toContain("background-size:")
  })

  it("ignores roles without a level (they belong in the pending zone)", () => {
    renderLadder([role({ roleId: "r9", title: "Draftee", level: null })])
    expect(screen.queryByRole("link", { name: /Draftee/ })).toBeNull()
  })

  it("clusters roles by family within a level when grouping is on", () => {
    renderLadder(
      [
        role({
          roleId: "a",
          title: "CTO",
          level: 1,
          familyId: "f1",
          familyName: "Engineering",
        }),
        role({
          roleId: "b",
          title: "VP Sales",
          level: 1,
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
