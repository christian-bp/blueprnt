import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { PendingRoles } from "@/components/levels/pending-roles"
import { type ZoneKey, zoneForLevel } from "@workspace/core"
import type { LevelRoleRow } from "@/lib/levels"

function role(overrides: Partial<LevelRoleRow>): LevelRoleRow {
  return {
    roleId: "r1",
    slug: "r1",
    title: "Data Analyst",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: null,
    level: null,
    ratedCount: 3,
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

function renderPending(rows: LevelRoleRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PendingRoles rows={rows} />
    </NextIntlClientProvider>
  )
}

// The chips ship COLLAPSED behind the panel's own count, so a test about a
// chip opens it first. The panel is last on /work and least urgent: a standing
// block of chips for work not yet started, on a surface whose subject is where
// the finished work landed.
function openPending(count = 1) {
  // By its COUNT label, not by aria-expanded: the panel's help popover carries
  // aria-expanded too, and a blanket match found two buttons.
  fireEvent.click(
    screen.getByRole("button", {
      name: count === 1 ? "1 role" : `${count} roles`,
    })
  )
}

describe("PendingRoles", () => {
  afterEach(() => cleanup())

  it("stays collapsed until asked, behind its own count", () => {
    renderPending([role({}), role({ roleId: "r2", title: "Second" })])
    expect(
      screen.getByText(messages.dashboard.levels.pendingHeading)
    ).toBeDefined()
    expect(screen.queryByRole("link", { name: /Data Analyst/ })).toBeNull()
    expect(screen.getByText("2 roles")).toBeDefined()
  })

  it("lists roles without a level and a link, with no rating count", () => {
    renderPending([role({})])
    openPending()
    expect(
      screen.getByText(messages.dashboard.levels.pendingHeading)
    ).toBeDefined()
    // The per-role rating count is intentionally not shown.
    expect(screen.queryByText("3/9 rated")).toBeNull()
    expect(
      screen.getByRole("link", { name: /Data Analyst/ }).getAttribute("href")
    ).toBe("/roles/r1")
  })

  it("badges a rated-but-uncompleted role as ready to complete", () => {
    renderPending([
      role({ roleId: "r3", title: "Ready Role", readyToComplete: true }),
    ])
    openPending()
    expect(
      screen.getByText(messages.dashboard.levels.readyToComplete)
    ).toBeDefined()
  })

  it("does not badge a role that is merely still being rated", () => {
    renderPending([role({})])
    expect(
      screen.queryByText(messages.dashboard.levels.readyToComplete)
    ).toBeNull()
  })

  it("ignores roles that already have a level", () => {
    renderPending([
      role({ roleId: "r2", title: "Engineer", level: 5, score: 58 }),
    ])
    expect(
      screen.queryByText(messages.dashboard.levels.pendingHeading)
    ).toBeNull()
  })

  it("renders nothing when there are no pending roles", () => {
    const { container } = renderPending([])
    expect(container.firstChild).toBeNull()
  })
})
