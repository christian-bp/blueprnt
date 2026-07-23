import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({
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

import { toast } from "sonner"
import { mockMutation, onQuery } from "@/test/convex-mocks"
import { PayMappingJourneyCard } from "./pay-mapping-journey-card"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingGapResult,
  PayMappingRunDetail,
  WomenDominatedComparisonWire,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import { PayMappingRunProvider } from "./pay-mapping-run-context"

const completeMock = mockMutation("payMapping.runs.completePayMappingRun")
const reopenMock = mockMutation("payMapping.runs.reopenPayMappingRun")

const m = en.dashboard.payMapping
const tJourney = m.journey
const tDoc = m.documentation
const tToast = en.dashboard.toast

function equalWorkGroup(overrides: Partial<GapGroup> = {}): GapGroup {
  return {
    key: "a",
    roleTitle: "SWE",
    level: "Senior",
    band: 3,
    womenCount: 2,
    menCount: 2,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
    ...overrides,
  }
}

const COMPARISON: WomenDominatedComparisonWire = {
  key: "cmp-1",
  roleTitle: "Technician",
  level: "Mid",
  band: 3,
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
    level: "Senior",
    band: 3,
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
// groups): the countable chapter rows must read "Done" (nothing to do),
// never "Not started", when their total is zero.
const GAP_NOTHING_REQUIRED: PayMappingGapResult = {
  ...GAP,
  equalWork: [equalWorkGroup({ key: "c", flag: "ok" })],
  womenDominated: [womenDominatedGroup({ key: "wd-2", comparisons: [] })],
}

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
  }> = {}
) {
  const value = {
    run: "run" in overrides ? overrides.run : RUN_ACTIVE,
    gap: "gap" in overrides ? overrides.gap : GAP,
    analyses: "analyses" in overrides ? overrides.analyses : ANALYSES_PARTIAL,
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
// directly (via the <dt> label's row) sidesteps getByText's exact-match
// limitation once the row's text is a combined "state · count" string.
function chapterRowText(label: string): string {
  const dt = screen.getByText(label)
  const row = dt.closest("div")
  const dd = row?.querySelector("dd")
  if (dd === null || dd === undefined) {
    throw new Error(`missing row content for "${label}"`)
  }
  return dd.textContent ?? ""
}

describe("PayMappingJourneyCard", () => {
  beforeEach(() => {
    onQuery((ref) => {
      if (ref === "payMapping.runs.listPayMappingRuns") return []
      return undefined
    })
    completeMock.mockReset()
    reopenMock.mockReset()
    completeMock.mockResolvedValue(null)
    reopenMock.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("renders the title and the four chapter rows with their derived state", () => {
    renderCard()
    expect(screen.getByText(tJourney.title)).toBeDefined()

    expect(screen.getByText(m.review.chapters.start)).toBeDefined()
    expect(screen.getByText(m.review.chapters.praxis)).toBeDefined()
    expect(screen.getByText(m.review.chapters.equalWork)).toBeDefined()
    expect(screen.getByText(m.review.chapters.equivalentWork)).toBeDefined()

    // start: collaboration is null -> not started. praxis: 2 of 4 done -> in
    // progress. equalWork: 1 of 2 done -> in progress. equivalentWork: 0 of
    // 1 done -> not started. The start row's text is the bare state word
    // (never a count); the countable rows carry the state word plus their
    // count.
    expect(chapterRowText(m.review.chapters.start)).toBe(
      tJourney.state.notStarted
    )
    expect(chapterRowText(m.review.chapters.praxis)).toBe(
      `${tJourney.state.inProgress} · 2 of 4`
    )
    expect(chapterRowText(m.review.chapters.equalWork)).toBe(
      `${tJourney.state.inProgress} · 1 of 2`
    )
    expect(chapterRowText(m.review.chapters.equivalentWork)).toBe(
      `${tJourney.state.notStarted} · 0 of 1`
    )
  })

  it("shows a countable row's done-of-total count, but never on the start row", () => {
    renderCard()
    // equalWork: 1 of 2 done (see ANALYSES_PARTIAL comment above).
    expect(chapterRowText(m.review.chapters.equalWork)).toContain("1 of 2")
    expect(chapterRowText(m.review.chapters.start)).not.toContain("of")
  })

  it("reads a countable chapter with nothing required as done, not not-started", () => {
    renderCard({ gap: GAP_NOTHING_REQUIRED, analyses: [] })
    // start: not started, no count. praxis: 0 of 4 -> not started, with a
    // count (there IS a total to report). equalWork/equivalentWork: nothing required
    // (total 0) -> done, with no count (a "0 of 0" count would be noise).
    expect(chapterRowText(m.review.chapters.start)).toBe(
      tJourney.state.notStarted
    )
    expect(chapterRowText(m.review.chapters.praxis)).toBe(
      `${tJourney.state.notStarted} · 0 of 4`
    )
    expect(chapterRowText(m.review.chapters.equalWork)).toBe(
      tJourney.state.done
    )
    expect(chapterRowText(m.review.chapters.equivalentWork)).toBe(
      tJourney.state.done
    )
  })

  it("shows the compact continue item into the review while the gate is unmet", () => {
    renderCard()
    // The item's accessible name is the full remaining-steps sentence
    // (aria-label); visually it carries the label and the bare count.
    // 5 of 8 overall steps remain (see ANALYSES_PARTIAL comment above).
    const link = screen.getByRole("link", {
      name: "5 steps remain in the guided review.",
    })
    // The takeover wizard, not the summary: unmet steps still need the
    // guided journey.
    expect(link.getAttribute("href")).toBe("/pay-mappings/pay-2026/review")
    expect(link.textContent).toContain(m.review.continueWizard)
    expect(link.textContent).toContain("5")
    expect(screen.queryByRole("button", { name: tDoc.complete })).toBeNull()
  })

  it("enables Complete once every required step is done and fires the mutation", async () => {
    renderCard({
      run: { ...RUN_ACTIVE, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    expect(
      screen.queryByRole("link", { name: /remain in the guided review/ })
    ).toBeNull()
    const button = screen.getByRole("button", {
      name: tDoc.complete,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(false)

    fireEvent.click(button)
    await waitFor(() => {
      expect(completeMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: "run-1",
      })
    })
    expect(toast.success).toHaveBeenCalledWith(tToast.payMappingCompleted)
  })

  it("guards Complete against a double click: the mutation fires once", async () => {
    let resolveComplete: () => void = () => {}
    completeMock.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          resolveComplete = () => resolve(null)
        })
    )
    renderCard({
      run: { ...RUN_ACTIVE, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    const button = screen.getByRole("button", {
      name: tDoc.complete,
    }) as HTMLButtonElement

    fireEvent.click(button)
    await waitFor(() => expect(button.disabled).toBe(true))
    fireEvent.click(button)
    expect(completeMock).toHaveBeenCalledTimes(1)

    resolveComplete()
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(tToast.payMappingCompleted)
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("shows the completed note and reopens the run via the confirm dialog", async () => {
    renderCard({ run: RUN_COMPLETED, analyses: ANALYSES_ALL_DONE })
    expect(screen.getByText(tDoc.completedNote)).toBeDefined()
    expect(screen.queryByRole("button", { name: tDoc.complete })).toBeNull()
    expect(
      screen.queryByRole("link", { name: /remain in the guided review/ })
    ).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: tDoc.reopen }))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByText(tDoc.reopenConfirmTitle)).toBeDefined()

    fireEvent.click(
      within(dialog).getByRole("button", { name: tDoc.reopenConfirmCta })
    )
    await waitFor(() => {
      expect(reopenMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: "run-1",
      })
    })
    expect(toast.success).toHaveBeenCalledWith(tToast.payMappingReopened)
  })

  it("shows a content-shaped loading state: real title and chapter labels, skeleton state text and CTA", () => {
    renderCard({ run: undefined, gap: undefined, analyses: undefined })
    expect(screen.getByText(tJourney.title)).toBeDefined()
    expect(screen.getByText(m.review.chapters.start)).toBeDefined()
    expect(screen.getByText(m.review.chapters.praxis)).toBeDefined()
    expect(screen.getByText(m.review.chapters.equalWork)).toBeDefined()
    expect(screen.getByText(m.review.chapters.equivalentWork)).toBeDefined()
    expect(screen.queryByText(tJourney.state.notStarted)).toBeNull()
    expect(screen.queryByText(tJourney.state.inProgress)).toBeNull()
    expect(screen.queryByText(tJourney.state.done)).toBeNull()

    // The CTA's own type (Complete vs the Continue link) is itself
    // state-dependent and unknown until the queue resolves, so it renders
    // as a skeleton bar rather than a real (and possibly wrong) control.
    expect(screen.queryByRole("button", { name: tDoc.complete })).toBeNull()
    expect(
      screen.queryByRole("link", { name: /remain in the guided review/ })
    ).toBeNull()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })
})
