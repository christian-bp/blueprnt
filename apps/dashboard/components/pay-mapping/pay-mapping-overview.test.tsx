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
vi.mock("sonner", () => ({
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
  return {
    key,
    roleTitle: "SWE",
    level: "Senior",
    band: 3,
    womenCount: 2,
    menCount: 2,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag,
  }
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
    equivalentWork: [group("ok", "d")],
    womenDominated: [],
    population: { women: 3, men: 3 },
    quartiles: [
      { women: 2, men: 0 },
      { women: 1, men: 1 },
      { women: 0, men: 1 },
      { women: 0, men: 1 },
    ],
    age: {
      buckets: [
        { women: 0, men: 0 },
        { women: 1, men: 0 },
        { women: 2, men: 2 },
        { women: 0, men: 1 },
        { women: 0, men: 0 },
        { women: 0, men: 0 },
        { women: 0, men: 0 },
      ],
      unknown: 1,
    },
  }
}

// The run the journey card (rendered inside PayMappingOverview) reads from
// context. Present alongside `gap` so the card renders its resolved
// content; absent (undefined) together with `gap` for the loading case,
// mirroring the run shell's own undefined-until-resolved queries.
const RUN: PayMappingRunDetail = {
  runId: "run-1" as PayMappingRunDetail["runId"],
  label: "Pay mapping 2026",
  status: "active",
  referenceDate: Date.UTC(2026, 6, 1),
  rows: [],
  collaboration: null,
}

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
      <PayMappingRunProvider value={{ run, gap: g, analyses }}>
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

  it("orders the journey card, then the sentence-led gap + clock, then the statistics heading and chart titles", () => {
    renderOverview(gap())
    const text = document.body.textContent ?? ""
    const journeyAt = text.indexOf(m.journey.title)
    const gapAt = text.indexOf(m.overview.headlineGapLabel)
    const clockAt = text.indexOf(m.clock.label)
    const statsAt = text.indexOf(m.overview.statisticsHeading)
    const chartsAt = text.indexOf(m.overview.wholeSurveyTitle)

    expect(journeyAt).toBeGreaterThan(-1)
    expect(gapAt).toBeGreaterThan(journeyAt)
    expect(clockAt).toBeGreaterThan(gapAt)
    expect(statsAt).toBeGreaterThan(clockAt)
    expect(chartsAt).toBeGreaterThan(statsAt)

    expect(screen.getByText(m.overview.quartileTitle)).toBeDefined()
    expect(screen.getByText(m.overview.ageTitle)).toBeDefined()
    expect(screen.getByText("6")).toBeDefined()
    expect(screen.getByText(/1 person without a birth date/)).toBeDefined()
  })

  it("no longer renders the flag-summary widget: the journey card's rows carry that count instead", () => {
    renderOverview(gap())
    expect(screen.queryByText("Flagged groups")).toBeNull()
    expect(screen.queryByText(/need(s)? attention/)).toBeNull()
    expect(screen.queryByText("Open the analysis")).toBeNull()
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
    // The three distribution charts are expandable; the journey card and the
    // gap/clock KPI cards are not.
    expect(expandButtons).toHaveLength(3)
    const first = expandButtons[0]
    if (first === undefined) throw new Error("missing expand button")
    fireEvent.click(first)
    // The dialog repeats the widget title.
    expect(screen.getAllByText(m.overview.wholeSurveyTitle).length).toBe(2)
  })

  it("shows the insufficient line in the gap and clock widgets when the org gap is insufficient", () => {
    renderOverview(
      gap({
        menCount: 0,
        menMeanComp: null,
        gapPct: null,
        flag: "insufficient",
      })
    )
    expect(screen.getAllByText(m.overview.insufficient)).toHaveLength(2)
    expect(document.querySelectorAll('[data-testid="mean-bar"]').length).toBe(0)
  })

  it("keeps widget titles and static chrome real while the gap loads", () => {
    renderOverview(undefined)
    expect(screen.getByText(m.journey.title)).toBeDefined()
    expect(screen.getByText(m.overview.headlineGapLabel)).toBeDefined()
    expect(screen.getByText(m.overview.statisticsHeading)).toBeDefined()
    expect(screen.getByText(m.overview.wholeSurveyTitle)).toBeDefined()
    expect(screen.getByText(m.overview.quartileTitle)).toBeDefined()
    // Static chrome renders real during loading: the clock's unit labels and
    // colons (its href derives from the URL), so nothing pops in or shifts
    // when the counts land.
    expect(screen.getByText(m.clock.hours)).toBeDefined()
    expect(screen.getAllByText(":")).toHaveLength(2)
  })
})
