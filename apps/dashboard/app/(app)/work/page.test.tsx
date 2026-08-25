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
import { PAGE_CONTENT_MAX_W } from "@/components/app-shell"
import { RoleSheetProvider } from "@/components/role-sheet"

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
    // Calibration facts: unflagged by default, so a fixture is a role nobody
    // has to look at unless a test says otherwise.
    completed: true,
    calibrated: false,
    methodDrift: false,
    profileLimited: false,
    profileFailures: null,
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

  // THE LIST IS GONE. Masterdokument 14.8 asks for the kalibrering-krävs flag
  // and the calibration act, never a section listing them: the flag lives on
  // the role's own chip here, the act in the sheet that chip opens, and the
  // aggregate on the home to-do. A drift pin, because a "Placements to review"
  // section is exactly the thing a future surface would grow back.
  it("carries no placements-to-review section", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([levelRow({ profileLimited: true })])
        : undefined
    )
    renderPage()
    // The ACT is not here either: it lives in the sheet the chip opens, so a
    // rebuilt list with confirm buttons on this page fails this line.
    expect(
      screen.queryByText(messages.dashboard.levels.calibration.confirmCta)
    ).toBeNull()
    // The flag itself is on the role, where the reader is already looking.
    expect(
      screen.getByText(messages.dashboard.levels.calibration.cappedMarker)
    ).toBeDefined()
  })

  // A LIVE BUG, pinned: /work busy-looped after the calibration redesign. The
  // page painted and then never reached idle, so the browser never settled,
  // chip clicks were swallowed by the thrash, and every injection timed out on
  // this route alone.
  //
  // A render counter rather than a timing assertion: a loop is unbounded, so
  // any small bound catches it and no bound is flaky. The probe wraps the page
  // so it counts the page's own renders, not the harness's.
  it("settles instead of re-rendering itself forever", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([
            levelRow({ methodDrift: true }),
            levelRow({ roleId: "r2", title: "CFO", profileLimited: true }),
            levelRow({
              roleId: "r3",
              title: "COO",
              level: 3,
              anchor: { expectedLevel: 5, status: "active" },
            }),
          ])
        : undefined
    )
    let renders = 0
    function Probe() {
      renders++
      if (renders > 50) throw new Error(`render loop: ${renders} renders`)
      return <WorkOverviewPage />
    }
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RoleSheetProvider>
          <Probe />
        </RoleSheetProvider>
      </NextIntlClientProvider>
    )
    expect(screen.getByText("CTO")).toBeDefined()
    expect(renders).toBeLessThan(5)
  })

  // And the click the thrash was swallowing.
  it("opens the sheet when a chip is clicked", async () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([levelRow({})])
        : ref === "assessment.roles.getRole"
          ? null
          : undefined
    )
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RoleSheetProvider>
          <WorkOverviewPage />
        </RoleSheetProvider>
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: /CTO/ }))
    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="sheet-content"]')
      ).not.toBeNull()
    })
  })
})

// THE CHROME DOES NOT MOVE.
//
// The families grid takes the region's width because it is strongly
// horizontal; everything above it keeps the reading column it shares with
// every other page. If the tab row moved when the third tab was picked,
// switching views would read as navigating to a different page, so the
// chrome's container is rendered ONCE, outside every per-tab branch, and its
// class set is the pin: jsdom measures no boxes, but a container that never
// varies with the active tab cannot render at two different X positions.
describe("WorkOverviewPage width", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([levelRow({ familyId: "f1", familyName: "Engineering" })])
        : undefined
    )
  })
  afterEach(() => cleanup())

  const TABS = ["viewLadder", "viewMatrix", "viewFamilies"] as const

  // The reading column's cap, from the shell. Read rather than restated, so a
  // change to the shell's width moves this pin with it instead of failing it.
  const READING_COLUMN = PAGE_CONTENT_MAX_W

  function chrome() {
    const list = screen.getByRole("tablist")
    // The chrome column: the tab row's nearest ancestor carrying the cap.
    return list.closest(`[class*="max-w-"]`) as HTMLElement
  }

  function panelFor(tab: (typeof TABS)[number]) {
    const trigger = screen.getByRole("tab", {
      name: messages.dashboard.levels[tab],
    })
    fireEvent.click(trigger)
    return screen.getByRole("tabpanel")
  }

  it("keeps one chrome container, identical on every tab", async () => {
    renderPage()
    const seen = new Set<string>()
    for (const tab of TABS) {
      fireEvent.click(
        screen.getByRole("tab", { name: messages.dashboard.levels[tab] })
      )
      await waitFor(() => {
        expect(screen.getByRole("tabpanel")).toBeDefined()
      })
      const box = chrome()
      expect(box).not.toBeNull()
      seen.add(box.className)
    }
    // ONE class string across all three tabs, and it is the reading column.
    expect(seen.size).toBe(1)
    for (const token of READING_COLUMN.split(" ")) {
      expect([...seen][0]).toContain(token)
    }
  })

  // And the breadcrumbs ride in that same container, so the page's whole top
  // edge holds its position rather than only the tabs.
  it("holds the breadcrumbs in the chrome container too", () => {
    renderPage()
    const box = chrome()
    expect(box.querySelector("nav, [aria-label]")).not.toBeNull()
    expect(box.textContent).toContain(messages.dashboard.nav.overview)
  })

  it("leaves the ladder and the matrix in the reading column", async () => {
    renderPage()
    for (const tab of ["viewLadder", "viewMatrix"] as const) {
      const panel = panelFor(tab)
      await waitFor(() => expect(panel.isConnected).toBe(true))
      for (const token of READING_COLUMN.split(" ")) {
        expect(panel.className).toContain(token)
      }
    }
  })

  it("gives the families grid the whole region", async () => {
    renderPage()
    const panel = panelFor("viewFamilies")
    await waitFor(() => expect(panel.isConnected).toBe(true))
    expect(panel.className).toContain("w-full")
    // No cap and no centering: the panel IS the region.
    expect(panel.className).not.toMatch(/max-w-/)
    expect(panel.className).not.toContain("mx-auto")
  })

  // Full width is the REGION's width, not more than it. The grid scrolls
  // inside its own wrapper (the table law), so nothing hands a horizontal
  // scrollbar to the page.
  it("never lets the page scroll sideways", async () => {
    renderPage()
    const panel = panelFor("viewFamilies")
    await waitFor(() => expect(panel.isConnected).toBe(true))
    for (const node of [panel, ...panel.querySelectorAll("*")]) {
      const className = (node as HTMLElement).className
      if (typeof className !== "string") continue
      expect(className).not.toContain("overflow-x-visible")
    }
    // The scroller is the matrix's own wrapper, inside the panel.
    expect(panel.querySelector('[class*="overflow-auto"]')).not.toBeNull()
  })
})
