import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The journey card (rendered first) builds its CTA/hasPreviousCompletedRun
// from the current path, same as pay-mapping-run-indicator.tsx.
vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026",
}))

// The journey card (rendered above the KPI/chart grids) calls useMutation +
// useQuery + useOrganization, so this test file needs the same mocks as
// pay-mapping-journey-card.test.tsx.
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))

import { onQuery } from "@/test/convex-mocks"
import {
  makeExcluded,
  makeGapGroup,
  makeRunDetail,
} from "@/test/pay-mapping-fixtures"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingGapResult,
  PayMappingRunDetail,
} from "./pay-mapping-gap-types"
import { PayMappingOverview } from "./pay-mapping-overview"
import { PayMappingRunProvider } from "./pay-mapping-run-context"

const m = en.dashboard.payMapping

function group(flag: GapGroup["flag"], key: string): GapGroup {
  return makeGapGroup({ key, flag })
}

function gap(
  org: Partial<PayMappingGapResult["org"]> = {}
): PayMappingGapResult {
  return {
    currency: "SEK",
    org: {
      womenCount: 3,
      menCount: 3,
      womenMeanComp: 90000,
      menMeanComp: 100000,
      gapPct: 10,
      flag: "elevated",
      ...org,
    },
    equalWork: [
      group("critical", "a"),
      group("elevated", "b"),
      group("elevated", "c"),
    ],
    excluded: makeExcluded(),
    equivalentWork: [group("ok", "d")],
    womenDominated: [],
    population: { women: 3, men: 3 },
    quartiles: [
      { women: 2, men: 0 },
      { women: 1, men: 1 },
      { women: 0, men: 1 },
      { women: 0, men: 1 },
    ],
  }
}

// The run the status + population cards (rendered inside PayMappingOverview)
// read from context. Present alongside `gap` so they render their resolved
// content; absent (undefined) together with `gap` for the loading case,
// mirroring the run shell's own undefined-until-resolved queries.
const RUN: PayMappingRunDetail = makeRunDetail()

function renderOverview(
  g: PayMappingGapResult | undefined,
  options: {
    run?: PayMappingRunDetail | undefined
    analyses?: GroupAnalysis[] | undefined
  } = {}
) {
  const run = "run" in options ? options.run : g === undefined ? undefined : RUN
  const analyses =
    "analyses" in options ? options.analyses : g === undefined ? undefined : []
  return render(
    <NextIntlClientProvider
      locale="en"
      timeZone="Europe/Stockholm"
      messages={en}
    >
      <PayMappingRunProvider
        value={{ run, gap: g, analyses, actions: [], notes: [], runsList: [] }}
      >
        <PayMappingOverview gap={g} />
      </PayMappingRunProvider>
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("PayMappingOverview", () => {
  beforeEach(() => {
    onQuery((ref) => {
      if (ref === "payMapping.runs.listPayMappingRuns") return []
      return undefined
    })
  })

  it("orders the KPI strip, then the finding, then the statistics heading and chart titles", () => {
    renderOverview(gap())
    const text = document.body.textContent ?? ""
    const populationAt = text.indexOf(m.detail.population)
    const gapAt = text.indexOf(m.overview.headlineGapLabel)
    const clockAt = text.indexOf(m.clock.label)
    const findingAt = text.indexOf(m.overview.meanComparisonTitle)
    const statsAt = text.indexOf(m.overview.statisticsHeading)
    const chartsAt = text.indexOf(m.overview.wholeSurveyTitle)

    expect(populationAt).toBeGreaterThan(-1)
    expect(gapAt).toBeGreaterThan(populationAt)
    expect(clockAt).toBeGreaterThan(gapAt)
    expect(findingAt).toBeGreaterThan(clockAt)
    expect(statsAt).toBeGreaterThan(findingAt)
    expect(chartsAt).toBeGreaterThan(statsAt)

    expect(screen.getByText(m.overview.quartileTitle)).toBeDefined()
    // Twice: the population card's headline figure and the donut's total.
    // Both report the same frozen population, from the run row and from the
    // gender tallies of the same snapshot.
    expect(screen.getAllByText("6")).toHaveLength(2)
  })

  it("carries no process readout of its own: no flag summary, no chapter breakdown", () => {
    renderOverview(gap())
    expect(screen.queryByText("Flagged groups")).toBeNull()
    expect(screen.queryByText(/need(s)? attention/)).toBeNull()
    // The per-chapter standing belongs to the analysis section's spine and
    // tab row; repeating it here was what made this page a second process
    // surface.
    expect(screen.queryByText(m.review.chapters.equalWork)).toBeNull()
    expect(screen.queryByText(m.analysis.progressLabel)).toBeNull()
  })

  it("states the org-level finding as a sentence, unsigned percent with the direction in the word, above the mean bars", () => {
    renderOverview(gap({ gapPct: 10 }))
    expect(
      screen.getByText(
        "Women earn on average 10% less than men across the whole pay mapping."
      )
    ).toBeDefined()
    expect(document.querySelectorAll('[data-testid="mean-bar"]').length).toBe(2)
  })

  it("states the reverse direction when women earn more", () => {
    renderOverview(gap({ gapPct: -8 }))
    expect(
      screen.getByText(
        "Women earn on average 8% more than men across the whole pay mapping."
      )
    ).toBeDefined()
  })

  it("states no measurable gap at a literal zero", () => {
    renderOverview(gap({ gapPct: 0 }))
    expect(
      screen.getByText(
        "There is no measurable pay gap between women and men across the whole pay mapping."
      )
    ).toBeDefined()
  })

  it("expands a chart widget into the large dialog", () => {
    renderOverview(gap())
    const expandButtons = screen.getAllByRole("button", {
      name: en.dashboard.widgetCard.expand,
    })
    // The two distribution charts are expandable; the population, gap and
    // clock tiles and the finding panel are not.
    expect(expandButtons).toHaveLength(2)
    const first = expandButtons[0]
    if (first === undefined) throw new Error("missing expand button")
    fireEvent.click(first)
    // The dialog repeats the widget title.
    expect(screen.getAllByText(m.overview.wholeSurveyTitle).length).toBe(2)
  })

  it("shows the insufficient line in the gap KPI, the clock and the finding when the org gap is insufficient", () => {
    renderOverview(
      gap({
        menCount: 0,
        menMeanComp: null,
        gapPct: null,
        flag: "insufficient",
      })
    )
    expect(screen.getAllByText(m.overview.insufficient)).toHaveLength(3)
    expect(document.querySelectorAll('[data-testid="mean-bar"]').length).toBe(0)
  })

  it("keeps widget titles and static chrome real while the gap loads", () => {
    renderOverview(undefined)
    expect(screen.getByText(m.detail.population)).toBeDefined()
    expect(screen.getByText(m.overview.headlineGapLabel)).toBeDefined()
    expect(screen.getByText(m.overview.statisticsHeading)).toBeDefined()
    expect(screen.getByText(m.overview.wholeSurveyTitle)).toBeDefined()
    expect(screen.getByText(m.overview.quartileTitle)).toBeDefined()
    // Static chrome renders real during loading: the clock's digit-box
    // frames and the colons between them, so nothing pops in or shifts when
    // the counts land.
    expect(screen.getAllByText(":")).toHaveLength(2)
  })
})
