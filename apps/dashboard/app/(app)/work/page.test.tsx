import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { onQuery } from "@/test/convex-mocks"

const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import { type ZoneKey, ZONE_KEYS, zoneForLevel } from "@workspace/core"
import WorkOverviewPage from "@/app/(app)/work/page"

function levelRow(overrides: Record<string, unknown>) {
  return {
    roleId: "r1",
    title: "CTO",
    trackKey: "M",
    trackName: "Manager",
    status: "approved",
    complete: true,
    ratedCount: 9,
    totalCriteria: 9,
    score: 90,
    level: 1,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
    // The zone the engine placed the role in. Coherent with the level by
    // default so a test that moves a role does not have to move its zone too;
    // a test that wants the two to DISAGREE says so explicitly.
    zone: coherentZone(overrides),
  }
}

function coherentZone(overrides: Record<string, unknown>): ZoneKey | null {
  if (overrides.zone !== undefined) return overrides.zone as ZoneKey | null
  const level = overrides.level === undefined ? 1 : overrides.level
  return typeof level === "number" ? zoneForLevel(level) : null
}

function results(rows: Array<Record<string, unknown>>) {
  return {
    rows,
    levels: [
      { level: 1, minScore: 80 },
      { level: 2, minScore: 0 },
    ],
  }
}

function page() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkOverviewPage />
    </NextIntlClientProvider>
  )
}

function renderPage() {
  return render(page())
}

describe("WorkOverviewPage", () => {
  beforeEach(() => useQueryMock.mockReset())
  afterEach(() => cleanup())

  it("shows the empty state when there are no roles", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults" ? results([]) : undefined
    )
    renderPage()
    expect(screen.getByText(messages.dashboard.levels.empty)).toBeDefined()
    expect(
      document.querySelector('[data-slot="empty-icon"] svg')
    ).not.toBeNull()
  })

  it("renders the ladder with both view toggles when roles exist", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([levelRow({})])
        : undefined
    )
    renderPage()
    expect(screen.getByText(messages.dashboard.levels.viewLadder)).toBeDefined()
    expect(screen.getByText(messages.dashboard.levels.viewMatrix)).toBeDefined()
    // Ladder is the default view: the role chip is on screen.
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    expect(screen.getByText("Level 1")).toBeDefined()
  })

  it("keeps the ladder view selected when the results arrive after loading", () => {
    // Loading first: the page renders its real tabs over the skeleton. The
    // Tabs instance persists across the branch swap (same tree position), so
    // the selection must survive it or the loaded page shows no view at all.
    useQueryMock.mockImplementation(() => undefined)
    const { rerender } = renderPage()
    expect(screen.getByText(messages.dashboard.levels.viewLadder)).toBeDefined()

    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([levelRow({})])
        : undefined
    )
    rerender(page())
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    expect(screen.getByText("Level 1")).toBeDefined()
  })

  // The skeleton law: a surface waiting on its own data shows the SHAPE it is
  // about to become. The ladder is banded by zone now, so a flat list of level
  // rows would re-shape into four bands the moment the results land.
  it("shapes the loading ladder into the four zone bands", () => {
    useQueryMock.mockImplementation(() => undefined)
    renderPage()
    for (const zone of ZONE_KEYS) {
      expect(screen.getByText(`Zone ${zone}`)).toBeDefined()
    }
    // The letters and the level numbers are structural law, not data, so the
    // skeleton states them for real rather than standing bars in for them.
    expect(screen.getByText("Level 1")).toBeDefined()
    expect(screen.getByText("Level 12")).toBeDefined()
  })

  it("the families view shows family rows with roles in level columns and hides the group toggle", async () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([
            levelRow({ familyId: "f1", familyName: "Engineering" }),
            levelRow({
              roleId: "r2",
              title: "Analyst",
              level: 2,
              familyId: null,
              familyName: null,
            }),
          ])
        : undefined
    )
    renderPage()
    // The toggle exists on the ladder view...
    expect(
      screen.getByText(messages.dashboard.levels.groupByFamily)
    ).toBeDefined()

    fireEvent.click(
      screen.getByRole("tab", { name: messages.dashboard.levels.viewFamilies })
    )
    // ...and hides on the families view, where family IS the row axis.
    await waitFor(() => {
      expect(
        screen.queryByText(messages.dashboard.levels.groupByFamily)
      ).toBeNull()
    })
    // One label row per family (the family-less bucket included), roles as
    // chips beneath (the full-width label th maps to the columnheader role).
    expect(
      screen.getByRole("columnheader", { name: "Engineering" })
    ).toBeDefined()
    expect(
      screen.getByRole("columnheader", {
        name: messages.dashboard.roles.family.none,
      })
    ).toBeDefined()
    expect(screen.getByRole("columnheader", { name: "Level 1" })).toBeDefined()
    expect(screen.getAllByRole("link", { name: /CTO/ }).length).toBeGreaterThan(
      0
    )
  })

  it("offers a group-by-family toggle when roles have families", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([levelRow({ familyId: "f1", familyName: "Engineering" })])
        : undefined
    )
    renderPage()
    expect(
      screen.getByText(messages.dashboard.levels.groupByFamily)
    ).toBeDefined()
  })
})
