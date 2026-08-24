import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
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
  it("groups the levels into their zone band, named and described", () => {
    renderLadder([role({ roleId: "r1", level: 1 })], false, TWELVE_LEVELS)
    const content = zoneContent("en")
    for (const zone of ZONE_KEYS) {
      expect(screen.getByText(`Zone ${zone}`)).toBeDefined()
      expect(screen.getByText(content.zones[zone].name)).toBeDefined()
      expect(screen.getByText(content.zones[zone].character)).toBeDefined()
    }
  })

  it("states each band's level span from the engine's own ranges", () => {
    renderLadder([], false, TWELVE_LEVELS)
    for (const zone of ZONE_KEYS) {
      const { from, to } = ZONE_LEVEL_RANGES[zone]
      expect(
        screen.getByText(
          messages.dashboard.levels.zoneSpan
            .replace("{from}", String(from))
            .replace("{to}", String(to))
        )
      ).toBeDefined()
    }
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
      .getByText(zoneContent("en").zones.A.name)
      .closest("section") as HTMLElement
    expect(
      within(bandA).getAllByRole("img", {
        name: messages.dashboard.levels.levelEmpty,
      })
    ).toHaveLength(3)
  })

  it("collapses a band and opens it again, its levels with it", () => {
    renderLadder([role({ roleId: "r1", level: 1 })], false, TWELVE_LEVELS)
    expect(screen.getByText("Level 1")).toBeDefined()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.levels.hideZone.replace("{zone}", "A"),
      })
    )
    expect(screen.queryByText("Level 1")).toBeNull()
    // Level 4 belongs to zone B and is untouched: bands fold one at a time.
    expect(screen.getByText("Level 4")).toBeDefined()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.levels.showZone.replace("{zone}", "A"),
      })
    )
    expect(screen.getByText("Level 1")).toBeDefined()
  })

  // What a level IS inside its zone (14.6): entry, established middle, or top.
  // Behind a press, so twelve standing paragraphs never bury the roles.
  it("reveals a level's function text on request", () => {
    renderLadder([], false, TWELVE_LEVELS)
    const content = zoneContent("en")
    const top = levelFunction(content, 1)
    expect(screen.queryByText(top.meaning)).toBeNull()
    fireEvent.click(screen.getAllByText(top.label)[0] as HTMLElement)
    expect(screen.getByText(top.meaning)).toBeDefined()
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
