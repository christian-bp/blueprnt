import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { OverviewWidgets } from "@/components/overview/overview-widgets"
import type { PayMappingHeadline } from "@/hooks/use-pay-mapping-headline"
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

  // A tile is one number: the trend charts live in the assistant now, so
  // nothing in the strip mounts a chart.
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
    // Capitalized: the caption is the footer's STATEMENT line now, not a
    // muted trailing fragment, so it starts a sentence.
    expect(screen.getByText("Across 2 levels")).toBeDefined()
    expect(screen.getByText("4 roles placed")).toBeDefined()
  })

  // Every tile carries two lines: the statement, then what the figure counts.
  it("says what each figure counts under its statement", () => {
    renderStrip()
    expect(screen.getByText(t.workforce.note)).toBeDefined()
    expect(screen.getByText(t.roles.note)).toBeDefined()
    expect(screen.getByText(t.gap.note)).toBeDefined()
    expect(screen.getByText(t.levels.note)).toBeDefined()
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

  // Every waiting slot goes through StatBar, whose strut holds the line box
  // the loaded type will make (see widget-card.test.tsx). Hand-rolled wrappers
  // left the strip 25px short of its loaded height and dropped the trend
  // panels when the figures arrived.
  it("stands every loading bar in its line box, so the strip does not grow on arrival", () => {
    const { container } = renderStrip({
      stats: undefined,
      levelOverview: undefined,
      payMappingHeadline: undefined,
    })
    const bars = container.querySelectorAll('[data-slot="skeleton"]')
    expect(bars.length).toBeGreaterThan(0)
    for (const bar of bars) {
      expect(bar.previousElementSibling?.className).toContain("w-0")
    }
  })
})
