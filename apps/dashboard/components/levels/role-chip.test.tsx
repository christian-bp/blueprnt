import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { RoleChip } from "@/components/levels/role-chip"
import { RoleSheetProvider } from "@/components/role-sheet"
import type { LevelRoleRow } from "@/lib/levels"

function row(overrides: Partial<LevelRoleRow>): LevelRoleRow {
  return {
    roleId: "r1",
    slug: "r1",
    title: "Staff Engineer",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: 78,
    level: 3,
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
    zone: "A",
    ...overrides,
  }
}

function renderChip(r: LevelRoleRow) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleChip role={r} />
    </NextIntlClientProvider>
  )
}

describe("RoleChip", () => {
  afterEach(() => cleanup())

  it("links to the role and shows the title, not a weighting number", () => {
    renderChip(row({}))
    const link = screen.getByRole("link", { name: /Staff Engineer/ })
    expect(link.getAttribute("href")).toBe("/roles/r1")
    // Weighting numbers are intentionally not shown on the Overview.
    expect(screen.queryByText("78")).toBeNull()
    // The track renders as the short key, not the full name.
    expect(screen.getByText("IC")).toBeDefined()
    expect(screen.queryByText("Individual contributor")).toBeNull()
  })

  it("opens the sheet (renders a button, not a link) inside a provider", () => {
    // With a RoleSheetProvider in the tree the chip opens the quick-look sheet
    // instead of navigating, so it is a button. The link fallback above proves
    // the no-provider case.
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RoleSheetProvider>
          <RoleChip role={row({})} />
        </RoleSheetProvider>
      </NextIntlClientProvider>
    )
    expect(screen.getByRole("button", { name: /Staff Engineer/ })).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Staff Engineer/ })).toBeNull()
  })

  it("flags an anchor whose computed level deviates from the agreed level", () => {
    renderChip(
      row({ level: 3, anchor: { expectedLevel: 2, status: "active" } })
    )
    const expected = messages.dashboard.levels.deviation.replace("{level}", "2")
    expect(screen.getByText(expected)).toBeDefined()
  })

  it("shows no deviation flag when the computed level matches the agreed level", () => {
    renderChip(
      row({ level: 2, anchor: { expectedLevel: 2, status: "active" } })
    )
    const expected = messages.dashboard.levels.deviation.replace("{level}", "2")
    expect(screen.queryByText(expected)).toBeNull()
  })
})

// THE FLAG, on the role (masterdokument 14.8). It used to live in a list on
// the same page, which meant a reader had to find the role twice: once on the
// ladder they were reading, once in a section below it.
describe("RoleChip calibration marking", () => {
  afterEach(() => cleanup())

  const cal = messages.dashboard.levels.calibration

  function chipOf(overrides: Partial<LevelRoleRow>) {
    const { container } = renderChip(row(overrides))
    return container.firstElementChild as HTMLElement
  }

  it("leaves an unflagged role unmarked", () => {
    const chip = chipOf({})
    expect(chip.className).not.toContain("amber")
    expect(screen.queryByText(cal.cappedMarker)).toBeNull()
  })

  // Never colour alone: the border is the fast channel, the text marker is the
  // one that survives greyscale, print, and a reader who cannot separate two
  // hues.
  it.each([
    [
      "capped placement",
      { profileLimited: true } as Partial<LevelRoleRow>,
      cal.cappedMarker,
    ],
    [
      "stale method",
      { methodDrift: true } as Partial<LevelRoleRow>,
      messages.dashboard.roles.detail.methodDriftBadge,
    ],
    [
      "anchor deviation",
      {
        level: 3,
        anchor: { expectedLevel: 5, status: "active" },
      } as Partial<LevelRoleRow>,
      messages.dashboard.levels.deviation.replace("{level}", "5"),
    ],
  ])("marks a %s with a border AND a word", (_name, overrides, marker) => {
    const chip = chipOf(overrides)
    expect(chip.className).toContain("amber")
    expect(screen.getByText(marker)).toBeDefined()
  })

  // One role, one question: the fold answers with the first condition that
  // holds, so a role raising three does not wear three markers.
  it("shows one marker for a role that could raise three questions", () => {
    chipOf({
      profileLimited: true,
      methodDrift: true,
      level: 3,
      anchor: { expectedLevel: 5, status: "active" },
    })
    expect(screen.getByText(cal.cappedMarker)).toBeDefined()
    expect(
      screen.queryByText(messages.dashboard.roles.detail.methodDriftBadge)
    ).toBeNull()
  })

  // Completing is the reveal: an assessment still open has no placement for
  // anyone to have an opinion about.
  it("marks nothing on an assessment that is not completed", () => {
    const chip = chipOf({ completed: false, profileLimited: true })
    expect(chip.className).not.toContain("amber")
    expect(screen.queryByText(cal.cappedMarker)).toBeNull()
  })
})
