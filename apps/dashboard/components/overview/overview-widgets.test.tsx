import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { OverviewWidgets } from "@/components/overview/overview-widgets"
import type { PayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
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

// Deliberately NOT default-destructured: a default parameter kicks in
// whenever the property is `undefined`, which would silently swallow the
// loading test's explicit `stats: undefined`. `in` tells "key omitted" (use
// the fixture) apart from "key explicitly undefined" (the loading state
// under test).
function renderWidgets(
  options: {
    stats?: OverviewStats | undefined
    levelOverview?: LevelOverview | undefined | null
    payMappingHeadline?: PayMappingHeadline | undefined | null
    headcountTrend?: HeadcountPoint[] | undefined | null
  } = {}
) {
  const stats = "stats" in options ? options.stats : ALL_DONE
  const levelOverview =
    "levelOverview" in options ? options.levelOverview : null
  const payMappingHeadline =
    "payMappingHeadline" in options ? options.payMappingHeadline : null
  const headcountTrend =
    "headcountTrend" in options ? options.headcountTrend : null
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OverviewWidgets
        stats={stats}
        levelOverview={levelOverview}
        payMappingHeadline={payMappingHeadline}
        headcountTrend={headcountTrend}
      />
    </NextIntlClientProvider>
  )
}

describe("OverviewWidgets", () => {
  afterEach(cleanup)

  it("renders exactly three cards", () => {
    renderWidgets()
    expect(screen.getByText(t.workforce.label)).toBeDefined()
    expect(screen.getByText(t.levels.label)).toBeDefined()
    expect(screen.getByText(t.gap.label)).toBeDefined()
  })

  it("shows the workforce card's headcount, its trend chart, and a link to /people", () => {
    renderWidgets({
      stats: { ...ALL_DONE, totalPeople: 10, unclassifiedCount: 3 },
      headcountTrend: [
        { date: 1, runLabel: "Pay mapping 2025", women: 3, men: 4 },
        { date: 2, runLabel: "Pay mapping 2026", women: 5, men: 5 },
      ],
    })
    expect(screen.getByText("10 people today")).toBeDefined()
    expect(screen.getByText("3 unclassified")).toBeDefined()
    const workforceCard = screen
      .getByText(t.workforce.label)
      .closest('[data-slot="card"]')
    expect(workforceCard?.querySelector('[data-slot="chart"]')).not.toBeNull()
    const action = screen.getByRole("link", { name: t.workforce.view })
    expect(action.getAttribute("href")).toBe("/people")
  })

  it("shows no chart for a single pay-mapping run (one dot is not a trend)", () => {
    renderWidgets({
      stats: { ...ALL_DONE, totalPeople: 10 },
      headcountTrend: [
        { date: 1, runLabel: "Pay mapping 2026", women: 5, men: 5 },
      ],
    })
    const workforceCard = screen
      .getByText(t.workforce.label)
      .closest('[data-slot="card"]')
    expect(workforceCard?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows no chart in the workforce card while its own headcount trend is still loading", () => {
    renderWidgets({
      stats: { ...ALL_DONE, totalPeople: 10 },
      headcountTrend: undefined,
    })
    const workforceCard = screen
      .getByText(t.workforce.label)
      .closest('[data-slot="card"]')
    expect(workforceCard?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows no chart in the workforce card when there is no pay-mapping run yet", () => {
    renderWidgets({
      stats: { ...ALL_DONE, totalPeople: 10 },
      headcountTrend: null,
    })
    const workforceCard = screen
      .getByText(t.workforce.label)
      .closest('[data-slot="card"]')
    expect(workforceCard?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows no chart in the workforce card when every run's headcount is zero", () => {
    renderWidgets({
      stats: { ...ALL_DONE, totalPeople: 10 },
      headcountTrend: [
        { date: 1, runLabel: "Pay mapping 2026", women: 0, men: 0 },
      ],
    })
    const workforceCard = screen
      .getByText(t.workforce.label)
      .closest('[data-slot="card"]')
    expect(workforceCard?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows the workforce card's all-classified line when nothing is unclassified", () => {
    renderWidgets({ stats: { ...ALL_DONE, totalPeople: 5 } })
    expect(screen.getByText(t.workforce.allClassified)).toBeDefined()
  })

  it("shows no chart when there are no people yet, even if a trend already exists", () => {
    renderWidgets({
      stats: { ...ALL_DONE, totalPeople: 0 },
      headcountTrend: [
        { date: 1, runLabel: "Pay mapping 2026", women: 2, men: 3 },
      ],
    })
    const workforceCard = screen
      .getByText(t.workforce.label)
      .closest('[data-slot="card"]')
    expect(workforceCard?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows the workforce card's import prompt and no chart when there are no people yet", () => {
    renderWidgets({ stats: { ...ALL_DONE, totalPeople: 0 } })
    expect(screen.getByText(t.workforce.importPrompt)).toBeDefined()
    const workforceCard = screen
      .getByText(t.workforce.label)
      .closest('[data-slot="card"]')
    expect(workforceCard?.querySelector('[data-slot="chart"]')).toBeNull()
  })

  it("shows the level card's role/level headline, its bars, and a link to /work", () => {
    const levelOverview: LevelOverview = {
      totalRoles: 4,
      levelCount: 2,
      levelCounts: [
        { level: 1, count: 1 },
        { level: 2, count: 3 },
        { level: 3, count: 0 },
      ],
    }
    renderWidgets({ levelOverview })
    expect(screen.getByText("4 roles across 2 levels")).toBeDefined()
    const levelCard = screen
      .getByText(t.levels.label)
      .closest('[data-slot="card"]')
    expect(levelCard?.querySelector('[data-slot="chart"]')).not.toBeNull()
    const action = screen.getByRole("link", { name: t.levels.view })
    expect(action.getAttribute("href")).toBe("/work")
  })

  it("shows the level card's empty line, with the chart still at its usual height, when there is no level overview", () => {
    renderWidgets({ levelOverview: null })
    expect(screen.getByText(t.levels.empty)).toBeDefined()
    const levelCard = screen
      .getByText(t.levels.label)
      .closest('[data-slot="card"]')
    expect(levelCard?.querySelector('[data-slot="chart"]')).not.toBeNull()
  })

  it("upgrades the pay-gap card to the percent and quartile bars once a run's gap is measurable", () => {
    const payMappingHeadline: PayMappingHeadline = {
      slug: "pay-2026",
      label: "Pay 2026",
      status: "completed",
      gapPct: 4.2,
      flag: "elevated",
      quartiles: [
        { women: 3, men: 1 },
        { women: 2, men: 2 },
        { women: 1, men: 3 },
        { women: 0, men: 4 },
      ],
    }
    renderWidgets({ payMappingHeadline })
    expect(screen.getByText("4.2%")).toBeDefined()
    // The severity badge belongs to the run page, not this card: on the
    // overview it added a second colour system to a card whose own number
    // already carries the state.
    expect(
      screen.queryByText(messages.dashboard.payMapping.gap.flag.elevated)
    ).toBeNull()
    const gapCard = screen.getByText(t.gap.label).closest('[data-slot="card"]')
    expect(gapCard?.querySelector('[data-slot="chart"]')).not.toBeNull()
    const action = screen.getByRole("link", { name: t.gap.view })
    expect(action.getAttribute("href")).toBe("/pay-mappings/pay-2026")
  })

  it("shows the pay-gap card's not-started state and a link to /pay-mappings when there is no headline", () => {
    renderWidgets({ payMappingHeadline: null })
    expect(screen.getByText(t.gap.notStarted)).toBeDefined()
    expect(screen.getByText(t.gap.prompt)).toBeDefined()
    const action = screen.getByRole("link", { name: t.gap.view })
    expect(action.getAttribute("href")).toBe("/pay-mappings")
  })

  it("shows the insufficient-data state, not not-started, when a run exists but its gap is not measurable", () => {
    renderWidgets({
      payMappingHeadline: {
        slug: "pay-2026",
        label: "Pay 2026",
        status: "completed",
        gapPct: null,
        flag: "insufficient",
        quartiles: [
          { women: 0, men: 0 },
          { women: 0, men: 0 },
          { women: 0, men: 0 },
          { women: 0, men: 0 },
        ],
      },
    })
    // The value states "Not enough data" once; the run label gives context.
    // No flag badge here (it would just repeat the value wording); the badge
    // stays in the measurable-gap state where the flag color carries meaning.
    expect(screen.getByText(t.gap.insufficientValue)).toBeDefined()
    expect(screen.getByText("Pay 2026")).toBeDefined()
    const gapCard = screen.getByText(t.gap.label).closest('[data-slot="card"]')
    expect(gapCard?.querySelector('[data-flag="insufficient"]')).toBeNull()
    expect(gapCard?.querySelector('[data-slot="chart"]')).not.toBeNull()
    expect(screen.queryByText(t.gap.notStarted)).toBeNull()
    const action = screen.getByRole("link", { name: t.gap.view })
    expect(action.getAttribute("href")).toBe("/pay-mappings/pay-2026")
  })

  it("shows a skeleton headline, an empty viz (no chart, no viz skeleton), and not the empty state, while levelOverview is still loading", () => {
    renderWidgets({ levelOverview: undefined })
    const levelCard = screen
      .getByText(t.levels.label)
      .closest('[data-slot="card"]')
    expect(levelCard).not.toBeNull()
    // Only the headline skeleton remains; the chart area itself is empty
    // (no shimmer, no chart) until its own data resolves.
    expect(levelCard?.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      1
    )
    expect(levelCard?.querySelector('[data-slot="chart"]')).toBeNull()
    expect(screen.queryByText(t.levels.empty)).toBeNull()
    const action = screen.getByRole("link", { name: t.levels.view })
    expect(action.getAttribute("href")).toBe("/work")
  })

  it("shows a skeleton headline, an empty viz (no chart, no viz skeleton), and not the not-started state, while payMappingHeadline is still loading", () => {
    renderWidgets({
      stats: ALL_DONE,
      payMappingHeadline: undefined,
    })
    const gapCard = screen.getByText(t.gap.label).closest('[data-slot="card"]')
    expect(gapCard).not.toBeNull()
    expect(gapCard?.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1)
    expect(gapCard?.querySelector('[data-slot="chart"]')).toBeNull()
    expect(screen.queryByText(t.gap.notStarted)).toBeNull()
    const action = screen.getByRole("link", { name: t.gap.view })
    expect(action.getAttribute("href")).toBe("/pay-mappings")
  })

  it("renders three skeleton cards with real titles, empty (not shimmering) viz areas, and no data values while loading", () => {
    const { container } = renderWidgets({ stats: undefined })
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    // No chart mounts anywhere yet: every viz area is a plain empty div.
    expect(container.querySelectorAll('[data-slot="chart"]')).toHaveLength(0)
    expect(screen.getByText(t.workforce.label)).toBeDefined()
    expect(screen.getByText(t.levels.label)).toBeDefined()
    expect(screen.getByText(t.gap.label)).toBeDefined()
    expect(screen.queryByText("10 people today")).toBeNull()
    expect(screen.queryByText("4.2%")).toBeNull()
    const peopleLink = screen.getByRole("link", { name: t.workforce.view })
    expect(peopleLink.getAttribute("href")).toBe("/people")
  })
})
