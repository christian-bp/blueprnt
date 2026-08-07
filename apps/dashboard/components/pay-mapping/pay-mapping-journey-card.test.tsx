import { cleanup, render, screen } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// The CTA and the "hasPreviousCompletedRun" derivation both key off the
// current path, same as pay-mapping-run-indicator.tsx and the review shell.
vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026",
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
import { PayMappingJourneyCard } from "./pay-mapping-journey-card"
import { makeExcluded, makeGapGroup } from "@/test/pay-mapping-fixtures"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingActionWire,
  PayMappingNoteWire,
  PayMappingGapResult,
  PayMappingRunDetail,
  WomenDominatedComparisonWire,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import { PayMappingRunProvider } from "./pay-mapping-run-context"

const m = en.dashboard.payMapping
const tJourney = m.journey
const tDoc = m.documentation

function equalWorkGroup(
  overrides: Parameters<typeof makeGapGroup>[0] = {}
): GapGroup {
  return makeGapGroup({ key: "a", ...overrides })
}

const COMPARISON: WomenDominatedComparisonWire = {
  key: "cmp-1",
  roleTitle: "Technician",
  seniority: "Mid",
  level: 3,
  headcount: 4,
  womenSharePct: 25,
  meanComp: 44000,
  diffPct: 10,
  diffSek: 4000,
}

function womenDominatedGroup(
  overrides: Partial<WomenDominatedGroupWire> = {}
): WomenDominatedGroupWire {
  return {
    key: "wd-1",
    roleTitle: "Nurse",
    seniority: "Senior",
    level: 3,
    headcount: 10,
    womenSharePct: 90,
    meanComp: 40000,
    comparisons: [COMPARISON],
    ...overrides,
  }
}

// 2 required equal-work groups (elevated + critical; "ok" is never
// required), 1 required women-dominated group (has a comparator), 1 without
// (never required). Combined with BASE_PRAXIS_AREA_KEYS (4 areas, no
// previous completed run in this fixture set) and the collaboration row,
// the overall queue totals 1 + 4 + 2 + 1 = 8 actionable steps.
const GAP: PayMappingGapResult = {
  currency: "SEK",
  org: {
    womenCount: 3,
    menCount: 3,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
  },
  equalWork: [
    equalWorkGroup({ key: "a", flag: "elevated" }),
    equalWorkGroup({ key: "b", flag: "critical" }),
    equalWorkGroup({ key: "c", flag: "ok" }),
  ],
  excluded: makeExcluded(),
  equivalentWork: [],
  womenDominated: [
    womenDominatedGroup({ key: "wd-1" }),
    womenDominatedGroup({ key: "wd-2", comparisons: [] }),
  ],
  population: { women: 3, men: 3 },
  quartiles: [
    { women: 0, men: 0 },
    { women: 0, men: 0 },
    { women: 0, men: 0 },
    { women: 0, men: 0 },
  ],
  age: {
    buckets: Array.from({ length: 7 }, () => ({ women: 0, men: 0 })),
    unknown: 0,
  },
}

// Nothing requiring documentation at all (no equal-work/women-dominated
function praxisDone(area: string): GroupAnalysis {
  return {
    scope: "praxis",
    groupKey: area,
    reasons: [],
    note: null,
    done: true,
    finding: "none",
  }
}

function groupDone(
  scope: "equalWork" | "equivalentWork",
  key: string
): GroupAnalysis {
  return {
    scope,
    groupKey: key,
    reasons: ["experience"],
    note: null,
    done: true,
    finding: null,
  }
}

// 2 of 4 praxis areas done (in progress), equalWork "a" done (in progress,
// 1 of 2), equivalentWork untouched (not started, 0 of 1); collaboration
// left null (not started). Overall: 0 (start) + 2 (praxis) + 1 (equalWork) +
// 0 (equivalentWork) = 3 of 8, so the gate is unmet with 5 remaining.
const ANALYSES_PARTIAL: GroupAnalysis[] = [
  praxisDone("payPolicy"),
  praxisDone("collectiveAgreements"),
  groupDone("equalWork", "a"),
]

const ANALYSES_ALL_DONE: GroupAnalysis[] = [
  praxisDone("payPolicy"),
  praxisDone("collectiveAgreements"),
  praxisDone("benefits"),
  praxisDone("payPractices"),
  groupDone("equalWork", "a"),
  groupDone("equalWork", "b"),
  groupDone("equivalentWork", "wd-1"),
]

const COLLABORATION_FILLED = {
  participants: "Union reps",
  description: "Meets monthly",
}

const RUN_ACTIVE: PayMappingRunDetail = {
  runId: "run-1" as PayMappingRunDetail["runId"],
  label: "Pay mapping 2026",
  status: "active",
  referenceDate: Date.UTC(2026, 6, 1),
  rows: [],
  collaboration: null,
}

const RUN_COMPLETED: PayMappingRunDetail = {
  ...RUN_ACTIVE,
  collaboration: COLLABORATION_FILLED,
  status: "completed",
}

const runsListState: { current: unknown[] } = { current: [] }

onQuery((ref) => {
  if (ref === "payMapping.runs.listPayMappingRuns") return runsListState.current
  return undefined
})

function renderCard(
  overrides: Partial<{
    run: PayMappingRunDetail | undefined
    gap: PayMappingGapResult | undefined
    analyses: GroupAnalysis[] | undefined
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
  }> = {}
) {
  const value = {
    run: "run" in overrides ? overrides.run : RUN_ACTIVE,
    gap: "gap" in overrides ? overrides.gap : GAP,
    analyses: "analyses" in overrides ? overrides.analyses : ANALYSES_PARTIAL,
    actions: "actions" in overrides ? overrides.actions : [],
    notes: "notes" in overrides ? overrides.notes : [],
  }
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PayMappingRunProvider value={value}>
        <PayMappingJourneyCard />
      </PayMappingRunProvider>
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

// The chapter row's state text and count share one <dd>; querying it

describe("PayMappingJourneyCard", () => {
  beforeEach(() => {
    runsListState.current = []
  })

  // Demoted in Iteration 3 (decision 3): the chapter breakdown and the
  // Complete/Reopen controls moved to the Analysis tab's completion panel,
  // so exactly one surface answers "where do I stand" and owns finishing.
  it("shows the overall progress and one way into the analysis", () => {
    renderCard()
    expect(screen.getByText(tJourney.title)).toBeDefined()
    // Three of the partial fixture's rows are done out of the queue's own
    // required total; the exact pair is the queue's business, so match the
    // shape rather than restate its arithmetic.
    expect(screen.getByText(/^\d+ of \d+$/)).toBeDefined()
    const link = screen.getByRole("link", { name: m.analysis.openAnalysis })
    expect(link.getAttribute("href")).toBe("/pay-mappings/pay-2026/analysis")
  })

  it("owns no completion controls: they live on the analysis tab", () => {
    renderCard({ analyses: ANALYSES_ALL_DONE })
    expect(screen.queryByRole("button", { name: tDoc.complete })).toBeNull()
    expect(screen.queryByRole("button", { name: tDoc.reopen })).toBeNull()
  })

  it("states that a completed run is locked, still without the controls", () => {
    renderCard({ run: RUN_COMPLETED, analyses: ANALYSES_ALL_DONE })
    expect(screen.getByText(tDoc.completedNote)).toBeDefined()
    expect(screen.queryByRole("button", { name: tDoc.reopen })).toBeNull()
  })

  it("renders its real chrome while the queue is still loading", () => {
    renderCard({ gap: undefined })
    // The title and the CTA are static i18n text; only the unknown count
    // and its bar stand in.
    expect(screen.getByText(tJourney.title)).toBeDefined()
    expect(
      screen.getByRole("link", { name: m.analysis.openAnalysis })
    ).toBeDefined()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })
})
