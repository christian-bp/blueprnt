import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import {
  OverviewCharts,
  OverviewWidgets,
} from "@/components/overview/overview-widgets"
import type { PayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
import type { PayGapPoint } from "@/lib/pay-gap-trend"
import type { HeadcountPoint } from "@/lib/headcount-trend"
import type { LevelOverview } from "@/lib/level-overview"
import type { OverviewStats } from "@/lib/todo"

const t = messages.dashboard.overview.widgets

const ALL_DONE: OverviewStats = {
  totalPeople: 5,
  unclassifiedCount: 0,
  describeCount: 0,
  evaluateCount: 0,
  documentCount: 0,
  approveCount: 0,
}

const LEVELS: LevelOverview = {
  totalRoles: 4,
  levelCount: 2,
  levelCounts: [
    { level: 1, count: 1 },
    { level: 2, count: 3 },
    { level: 3, count: 0 },
  ],
}

const HEADLINE: PayMappingHeadline = {
  slug: "pay-2026",
  label: "Pay mapping 2026",
  status: "active",
  gapPct: 4.2,
  flag: "elevated",
}

// Each argument defaults to its RESOLVED state (the loaded dashboard); a
// test passes `undefined` explicitly to exercise a loading branch, so an
// omitted key never silently means "still loading".
function renderStrip(
  options: {
    stats?: OverviewStats | undefined
    levelOverview?: LevelOverview | undefined | null
    payMappingHeadline?: PayMappingHeadline | undefined | null
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OverviewWidgets
        stats={"stats" in options ? options.stats : ALL_DONE}
        levelOverview={
          "levelOverview" in options ? options.levelOverview : LEVELS
        }
        payMappingHeadline={
          "payMappingHeadline" in options ? options.payMappingHeadline : null
        }
      />
    </NextIntlClientProvider>
  )
}

const GAP_TREND: PayGapPoint[] = [
  {
    date: Date.UTC(2025, 0, 1),
    runLabel: "2025",
    gapPct: 5.2,
    flag: "elevated",
  },
  {
    date: Date.UTC(2026, 0, 1),
    runLabel: "2026",
    gapPct: 4.1,
    flag: "ok",
  },
]

function renderCharts(
  options: {
    stats?: OverviewStats | undefined
    headcountTrend?: HeadcountPoint[] | undefined | null
    gapTrend?: PayGapPoint[] | undefined | null
  } = {}
) {
  return render(
    <NextIntlClientProvider
      locale="en"
      timeZone="Europe/Stockholm"
      messages={messages}
    >
      <OverviewCharts
        stats={"stats" in options ? options.stats : ALL_DONE}
        headcountTrend={
          "headcountTrend" in options ? options.headcountTrend : null
        }
        gapTrend={"gapTrend" in options ? options.gapTrend : GAP_TREND}
      />
    </NextIntlClientProvider>
  )
}

const TWO_RUNS: HeadcountPoint[] = [
  { date: 1, runLabel: "Pay mapping 2025", women: 3, men: 4 },
  { date: 2, runLabel: "Pay mapping 2026", women: 5, men: 5 },
]

afterEach(cleanup)

describe("OverviewWidgets", () => {
  it("renders four labelled figures, each linking to its own surface", () => {
    renderStrip()
    for (const [label, href] of [
      [t.workforce.label, "/people"],
      [t.roles.label, "/roles"],
      [t.gap.label, "/pay-mappings"],
      [t.levels.label, "/work"],
    ] as const) {
      expect(screen.getByText(label)).toBeDefined()
      expect(
        screen.getByRole("link", { name: label }).getAttribute("href")
      ).toBe(href)
    }
  })

  // A tile is one number: the charts moved to the panels below, so nothing
  // in the strip mounts a chart.
  it("carries no charts", () => {
    const { container } = renderStrip()
    expect(container.querySelectorAll('[data-slot="chart"]')).toHaveLength(0)
  })

  it("shows the headcount with its unclassified caption", () => {
    renderStrip({
      stats: { ...ALL_DONE, totalPeople: 10, unclassifiedCount: 3 },
    })
    expect(screen.getByText("10")).toBeDefined()
    expect(screen.getByText("3 unclassified")).toBeDefined()
  })

  it("prompts for an import when there are no people yet", () => {
    renderStrip({ stats: { ...ALL_DONE, totalPeople: 0 } })
    expect(screen.getByText(t.workforce.importPrompt)).toBeDefined()
  })

  it("splits roles and levels into their own figures", () => {
    renderStrip()
    expect(screen.getByText("4")).toBeDefined() // roles
    expect(screen.getByText("2")).toBeDefined() // levels
    expect(screen.getByText("across 2 levels")).toBeDefined()
    expect(screen.getByText("4 roles placed")).toBeDefined()
  })

  it("shows the empty level state, and a zero figure, with no level overview", () => {
    renderStrip({ levelOverview: null })
    expect(screen.getByText(t.levels.empty)).toBeDefined()
    expect(screen.getByText(t.roles.empty)).toBeDefined()
  })

  it("shows the gap percent and its run label once a run's gap is measurable", () => {
    renderStrip({ payMappingHeadline: HEADLINE })
    expect(screen.getByText("4.2%")).toBeDefined()
    expect(screen.getByText(HEADLINE.label)).toBeDefined()
    expect(
      screen.getByRole("link", { name: t.gap.label }).getAttribute("href")
    ).toBe("/pay-mappings/pay-2026")
  })

  it("shows the insufficient-data value, not not-started, when a run exists but its gap is not measurable", () => {
    renderStrip({
      payMappingHeadline: { ...HEADLINE, gapPct: null, flag: "insufficient" },
    })
    expect(screen.getByText(t.gap.insufficientValue)).toBeDefined()
    expect(screen.queryByText(t.gap.notStarted)).toBeNull()
  })

  it("shows not-started with its prompt when no run exists", () => {
    renderStrip({ payMappingHeadline: null })
    expect(screen.getByText(t.gap.notStarted)).toBeDefined()
    expect(screen.getByText(t.gap.prompt)).toBeDefined()
  })

  // Titles and links are static chrome and render real; only the figures
  // and their captions wait.
  it("keeps every tile's title and link real while its figure loads", () => {
    const { container } = renderStrip({
      stats: undefined,
      levelOverview: undefined,
      payMappingHeadline: undefined,
    })
    expect(screen.getByText(t.workforce.label)).toBeDefined()
    expect(screen.getByText(t.gap.label)).toBeDefined()
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText("4.2%")).toBeNull()
    expect(
      screen.getByRole("link", { name: t.workforce.label }).getAttribute("href")
    ).toBe("/people")
  })
})

describe("OverviewCharts", () => {
  it("renders each chart in its own titled panel with a way out to its surface", () => {
    renderCharts({ headcountTrend: TWO_RUNS })
    for (const [title, action, href] of [
      [t.workforce.trendTitle, t.workforce.action, "/people"],
      [t.gapTrend.title, t.gapTrend.action, "/pay-mappings"],
    ] as const) {
      expect(screen.getByText(title)).toBeDefined()
      expect(
        screen.getByRole("link", { name: action }).getAttribute("href")
      ).toBe(href)
    }
  })

  it("plots the workforce trend once two runs exist", () => {
    renderCharts({
      stats: { ...ALL_DONE, totalPeople: 10 },
      headcountTrend: TWO_RUNS,
    })
    const panel = screen
      .getByText(t.workforce.trendTitle)
      .closest('[data-slot="card"]')
    expect(panel?.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  // One run is a dot, not a trend; the panel holds its reserved height
  // empty rather than drawing a single point.
  it.each([
    ["a single run", [TWO_RUNS[0]] as HeadcountPoint[]],
    ["a still-loading trend", undefined],
    ["no run at all", null],
    [
      "runs whose headcount is zero",
      [
        { date: 1, runLabel: "a", women: 0, men: 0 },
        { date: 2, runLabel: "b", women: 0, men: 0 },
      ] as HeadcountPoint[],
    ],
  ])("draws no workforce trend for %s", (_case, headcountTrend) => {
    renderCharts({
      stats: { ...ALL_DONE, totalPeople: 10 },
      headcountTrend,
    })
    const panel = screen
      .getByText(t.workforce.trendTitle)
      .closest('[data-slot="card"]')
    expect(panel?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  // An empty frame tells a reader nothing; the panel says why it is blank
  // and what would fill it.
  it("says what a trend needs instead of leaving the panel empty", () => {
    renderCharts({ headcountTrend: null, gapTrend: null })
    expect(screen.getAllByText(t.trendEmpty)).toHaveLength(2)
  })

  it("drops the empty line once a trend can be drawn", () => {
    renderCharts({
      stats: { ...ALL_DONE, totalPeople: 10 },
      headcountTrend: TWO_RUNS,
    })
    // The gap trend still has its own line: this fixture gives it points.
    expect(screen.queryAllByText(t.trendEmpty)).toHaveLength(0)
  })

  it("draws no workforce trend when there are no people yet, even if a trend exists", () => {
    renderCharts({
      stats: { ...ALL_DONE, totalPeople: 0 },
      headcountTrend: TWO_RUNS,
    })
    const panel = screen
      .getByText(t.workforce.trendTitle)
      .closest('[data-slot="card"]')
    expect(panel?.querySelector('[data-slot="chart"]')).toBeNull()
  })
})
