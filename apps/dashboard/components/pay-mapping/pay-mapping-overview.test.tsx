import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The overview reads the current path to build its in-run links, same as
// the run sidebar (run-sidebar.tsx).
vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026",
}))

// The KPI tiles and panels reach for useMutation + useQuery +
// useOrganization, so the whole Convex surface is mocked here.
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
  makeRunSummary,
} from "@/test/pay-mapping-fixtures"
import { quartileBarRadius } from "./pay-mapping-overview"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingGapResult,
  PayMappingRunDetail,
} from "./pay-mapping-gap-types"
import { PayMappingOverview } from "./pay-mapping-overview"
import {
  PayMappingRunProvider,
  type PayMappingRunSummary,
} from "./pay-mapping-run-context"

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
    // The org's earlier mappings, which is what the gap tile trends against.
    runsList?: PayMappingRunSummary[] | undefined
  } = {}
) {
  const run = "run" in options ? options.run : g === undefined ? undefined : RUN
  const analyses =
    "analyses" in options ? options.analyses : g === undefined ? undefined : []
  const runsList = "runsList" in options ? options.runsList : []
  return render(
    <NextIntlClientProvider
      locale="en"
      timeZone="Europe/Stockholm"
      messages={en}
    >
      <PayMappingRunProvider
        value={{ run, gap: g, analyses, actions: [], notes: [], runsList }}
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

  it("orders the KPI strip, then the finding, then the chart titles", () => {
    renderOverview(gap())
    const text = document.body.textContent ?? ""
    const populationAt = text.indexOf(m.detail.population)
    const gapAt = text.indexOf(m.overview.headlineGapLabel)
    const clockAt = text.indexOf(m.clock.label)
    const findingAt = text.indexOf(m.overview.meanComparisonTitle)
    const chartsAt = text.indexOf(m.overview.wholeSurveyTitle)

    expect(populationAt).toBeGreaterThan(-1)
    expect(gapAt).toBeGreaterThan(populationAt)
    expect(clockAt).toBeGreaterThan(gapAt)
    expect(findingAt).toBeGreaterThan(clockAt)
    expect(chartsAt).toBeGreaterThan(findingAt)

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
    expect(screen.getByText(m.overview.wholeSurveyTitle)).toBeDefined()
    expect(screen.getByText(m.overview.quartileTitle)).toBeDefined()
    // Static chrome renders real during loading: the clock's digit-box
    // frames and the colons between them, so nothing pops in or shifts when
    // the counts land.
    expect(screen.getAllByText(":")).toHaveLength(2)
  })

  // The finding is ONE sentence across the full width of the page, so its
  // placeholder is one line. Reserving two made the panel taller than its
  // loaded self and collapsed the page upward by 18px when the aggregate
  // landed, which is the same defect as coming up short, read backwards.
  it("holds one sentence line, not two, while the finding loads", () => {
    const { container } = renderOverview(undefined)
    // The panel is the app's frame anatomy now: a muted ground carrying one
    // white panel, so the enclosing element is the frame, not a card.
    const panel = screen
      .getByText(m.overview.meanComparisonTitle)
      .closest('[data-slot="frame"]')
    const bars = panel?.querySelectorAll('[data-slot="skeleton"]') ?? []
    // One sentence bar over the two mean-comparison rows.
    expect(bars).toHaveLength(3)
    expect(container.querySelectorAll('[data-testid="mean-bar"]')).toHaveLength(
      0
    )
  })

  // The gap tile's statement line: how the gap moved since the mapping before
  // it, quoted from that mapping's own frozen gap. A bare point difference
  // ("0.6") means nothing without both ends of it.
  describe("gap trend", () => {
    // RUN's reference date is 2026; an earlier mapping is what it trends
    // against. Its headcount differs from RUN's on purpose: the population
    // and gap tiles share the "unchanged" wording, so a matching headcount
    // would put the same sentence in two cards and make the assertions below
    // ambiguous rather than wrong.
    const earlier = (orgGapPct: number | null) =>
      makeRunSummary({
        label: "2025",
        referenceDate: Date.UTC(2025, 0, 1),
        populationCount: 4,
        orgGapPct,
      })

    // The movement is a step in POINTS on the tile's own line, with the
    // mapping it is measured against named in the same breath: as a chip in
    // the corner the amount and its other end sat in two places that only
    // meant something together.
    it("states the movement in points when the gap came down", () => {
      renderOverview(gap({ gapPct: 10 }), { runsList: [earlier(14)] })
      expect(screen.getByText("Down 4 pp since the last one")).toBeDefined()
    })

    it("states the movement in points when the gap widened", () => {
      renderOverview(gap({ gapPct: 10 }), { runsList: [earlier(6)] })
      expect(screen.getByText("Up 4 pp since the last one")).toBeDefined()
    })

    it("distinguishes an unchanged gap from having nothing to compare", () => {
      renderOverview(gap({ gapPct: 10 }), { runsList: [earlier(10)] })
      expect(screen.getByText(m.overview.deltaUnchanged)).toBeDefined()
      expect(screen.queryByText(m.overview.gapNoComparison)).toBeNull()
    })

    it("says there is nothing to compare on the org's first mapping", () => {
      renderOverview(gap({ gapPct: 10 }), { runsList: [] })
      expect(screen.getByText(m.overview.gapNoComparison)).toBeDefined()
    })

    // An earlier mapping whose own gap could not be measured is part of the
    // history but is not a second end for this comparison.
    it("says there is nothing to compare when the earlier gap was unmeasurable", () => {
      renderOverview(gap({ gapPct: 10 }), { runsList: [earlier(null)] })
      expect(screen.getByText(m.overview.gapNoComparison)).toBeDefined()
    })

    // The standing explainers of what each figure covers are gone from the
    // tiles: a tile is its name, its figure and the one live line.
    it("carries no standing explainer under either figure", () => {
      const { container } = renderOverview(gap({ gapPct: 10 }), {
        runsList: [earlier(14)],
      })
      expect(container.textContent).not.toContain("Average pay difference")
      expect(container.textContent).not.toContain("8-hour working day")
    })

    // Two orgs with mirrored gaps must not read identically, and the clock's
    // full sentence is read only by assistive tech.
    it("says which gender the clock is counting", () => {
      renderOverview(gap({ gapPct: 10 }), { runsList: [] })
      expect(screen.getByText(m.clock.womenBehindShort)).toBeDefined()
    })
  })
})

describe("quartileBarRadius", () => {
  // A stacked bar rounds only the end its own series owns, so the seam
  // between the two genders stays square.
  it("rounds only its own end while both genders are present", () => {
    expect(quartileBarRadius("men", false)).toEqual([6, 0, 0, 6])
    expect(quartileBarRadius("women", false)).toEqual([0, 6, 6, 0])
  })

  // A quartile holding one gender has no second segment to round the far
  // end, so the segment that is there rounds the whole bar.
  it("rounds both ends when the row holds a single gender", () => {
    expect(quartileBarRadius("women", true)).toEqual([6, 6, 6, 6])
    expect(quartileBarRadius("men", true)).toEqual([6, 6, 6, 6])
  })
})
