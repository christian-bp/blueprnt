import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

import { ConvexError } from "convex/values"
import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"
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
import {
  PayMappingRunProvider,
  type PayMappingRunSummary,
} from "./pay-mapping-run-context"

const m = en.dashboard.payMapping
const tJourney = m.journey
const tDoc = m.documentation
const tReview = m.review
const tToast = en.dashboard.toast
const tErrors = en.errors

const completeMock = mockMutation("payMapping.runs.completePayMappingRun")

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

function renderCard(
  overrides: Partial<{
    run: PayMappingRunDetail | undefined
    gap: PayMappingGapResult | undefined
    analyses: GroupAnalysis[] | undefined
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    runsList: PayMappingRunSummary[]
  }> = {}
) {
  const value = {
    run: "run" in overrides ? overrides.run : RUN_ACTIVE,
    gap: "gap" in overrides ? overrides.gap : GAP,
    analyses: "analyses" in overrides ? overrides.analyses : ANALYSES_PARTIAL,
    actions: "actions" in overrides ? overrides.actions : [],
    notes: "notes" in overrides ? overrides.notes : [],
    runsList: overrides.runsList ?? [],
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

// The run's process card, and since the analysis section lost its index
// page, the reliable home for finishing the run: the completion panel is
// mounted here rather than only appearing at the end of a chapter's steps.
describe("PayMappingJourneyCard", () => {
  beforeEach(() => {
    completeMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("shows the overall progress and one way into the analysis", () => {
    renderCard()
    expect(screen.getByText(tJourney.title)).toBeDefined()
    // Several "N of M" pairs render: the overall figure on the progress
    // line, and the completion panel's per-chapter breakdown below it.
    // Pick the overall one by the line it sits on. The exact pair is the
    // queue's business, so match the shape rather than restate arithmetic.
    const overall = screen
      .getAllByText(/^\d+ of \d+$/)
      .find((node) =>
        node.closest("p")?.textContent?.startsWith(m.analysis.progressLabel)
      )
    expect(overall).toBeDefined()
    const link = screen.getByRole("link", { name: m.analysis.openAnalysis })
    // Straight to the first chapter. The section's own path is only a
    // redirect there, and routing through it would cost a round trip.
    expect(link.getAttribute("href")).toBe(
      "/pay-mappings/pay-2026/analysis/start"
    )
  })

  it("owns the run's completion controls", () => {
    // They used to live only inside the analysis section, on an index page
    // that listed no steps. That page is gone, so finishing needs a home
    // that does not depend on being mid-flow.
    renderCard({ analyses: ANALYSES_ALL_DONE })
    expect(screen.getByRole("button", { name: tDoc.complete })).toBeDefined()
  })

  it("breaks the standing down per chapter", () => {
    renderCard()
    for (const chapter of [
      tReview.chapters.start,
      tReview.chapters.praxis,
      tReview.chapters.equalWork,
      tReview.chapters.equivalentWork,
    ]) {
      expect(screen.getByText(chapter)).toBeDefined()
    }
  })

  it("disables Complete with the remaining-count hint while the gate is unmet", () => {
    renderCard()
    const button = screen.getByRole("button", {
      name: tDoc.complete,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/5 steps remain/)).toBeDefined()
    expect(screen.getByText(tReview.finishActionsNote)).toBeDefined()
  })

  it("enables Complete and fires the mutation + toast once the gate is met", async () => {
    renderCard({
      run: { ...RUN_ACTIVE, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    const button = screen.getByRole("button", {
      name: tDoc.complete,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(false)

    fireEvent.click(button)
    await vi.waitFor(() => {
      expect(completeMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: "run-1",
      })
    })
    expect(toast.success).toHaveBeenCalledWith(tToast.payMappingCompleted)
  })

  it("shows the statutory gate-unmet error distinctly from a generic failure", async () => {
    completeMock.mockRejectedValueOnce(
      new ConvexError({ code: "errors.payMappingGateUnmet" })
    )
    renderCard({
      run: { ...RUN_ACTIVE, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    fireEvent.click(screen.getByRole("button", { name: tDoc.complete }))
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(tErrors.payMappingGateUnmet)
    })
  })

  it("shows the completed note and Reopen instead of the Complete action", () => {
    renderCard({ run: RUN_COMPLETED, analyses: ANALYSES_ALL_DONE })
    expect(screen.getByText(tDoc.completedNote)).toBeDefined()
    expect(screen.queryByRole("button", { name: tDoc.complete })).toBeNull()
    expect(screen.getByRole("button", { name: tDoc.reopen })).toBeDefined()
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
