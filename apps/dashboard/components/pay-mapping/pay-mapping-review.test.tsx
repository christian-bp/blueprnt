import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const pushMock = vi.fn()

// The takeover route is /review, not /analysis (that's the summary now); the
// exit control's own href derivation reads the slug the same way regardless
// of the trailing segment (see pay-mapping-review.tsx's analysisHref).
vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026/review",
  useRouter: () => ({ push: pushMock }),
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

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingGapResult,
  PayMappingRunDetail,
  WomenDominatedComparisonWire,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { PayMappingReview } from "@/components/pay-mapping/pay-mapping-review"
import { PayMappingRunProvider } from "@/components/pay-mapping/pay-mapping-run-context"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const upsertMock = mockMutation("payMapping.analyses.upsertGroupAnalysis")

const t = messages.dashboard.payMapping.review
const tGap = messages.dashboard.payMapping.gap
const tReasons = messages.dashboard.payMapping.reasons

function equalWorkGroup(overrides: Partial<GapGroup> = {}): GapGroup {
  return {
    key: "k",
    roleTitle: "Role",
    level: "Level",
    band: 3,
    womenCount: 2,
    menCount: 3,
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
  band: 2,
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
    key: "wd",
    roleTitle: "Nurse",
    level: "Senior",
    band: 3,
    headcount: 10,
    womenSharePct: 90,
    meanComp: 40000,
    comparisons: [],
    ...overrides,
  }
}

// SALES (critical) sorts before SWE (elevated) in the equal-work worklist
// (worst-first attention order); QA (ok flag) never enters the queue, only
// the jump menu. WD-1 has a comparator (a required queue step); WD-2 has
// none (jump-menu only, free klarmarkering).
const GAP: PayMappingGapResult = {
  currency: "SEK",
  org: {
    womenCount: 6,
    menCount: 8,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
  },
  equalWork: [
    equalWorkGroup({
      key: "swe",
      roleTitle: "SWE",
      level: "Senior",
      gapPct: 8,
      flag: "elevated",
    }),
    equalWorkGroup({
      key: "sales",
      roleTitle: "Sales",
      level: "Mid",
      gapPct: 15,
      flag: "critical",
    }),
    equalWorkGroup({
      key: "qa",
      roleTitle: "QA",
      level: "Mid",
      gapPct: 2,
      flag: "ok",
    }),
  ],
  equivalentWork: [],
  womenDominated: [
    womenDominatedGroup({
      key: "wd-1",
      roleTitle: "Nurse",
      level: "Senior",
      comparisons: [COMPARISON],
    }),
    womenDominatedGroup({
      key: "wd-2",
      roleTitle: "Receptionist",
      level: "Junior",
      comparisons: [],
    }),
  ],
  population: { women: 6, men: 8 },
  quartiles: [
    { women: 1, men: 2 },
    { women: 1, men: 2 },
    { women: 2, men: 2 },
    { women: 2, men: 2 },
  ],
  age: {
    buckets: Array.from({ length: 7 }, () => ({ women: 0, men: 0 })),
    unknown: 0,
  },
}

const RUN: PayMappingRunDetail = {
  runId: "run-1" as Id<"payMappingRuns">,
  label: "Pay mapping 2026",
  status: "active",
  referenceDate: Date.UTC(2026, 6, 1),
  rows: [],
  collaboration: null,
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

const COLLABORATION_FILLED = {
  participants: "Union reps",
  description: "Meets monthly",
}

const runsListState: { current: unknown[] } = { current: [] }

onQuery((ref) => {
  if (ref === "payMapping.runs.listPayMappingRuns") return runsListState.current
  return undefined
})

function renderShell(
  overrides: Partial<{
    run: PayMappingRunDetail | undefined
    gap: PayMappingGapResult | undefined
    analyses: GroupAnalysis[] | undefined
    runsList: unknown[]
  }> = {}
) {
  runsListState.current = overrides.runsList ?? []
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingRunProvider
        value={{
          run: "run" in overrides ? overrides.run : RUN,
          gap: "gap" in overrides ? overrides.gap : GAP,
          analyses: "analyses" in overrides ? overrides.analyses : [],
        }}
      >
        <PayMappingReview />
      </PayMappingRunProvider>
    </NextIntlClientProvider>
  )
}

function openJumpMenu() {
  fireEvent.click(screen.getByRole("button", { name: t.allSteps }))
}

afterEach(() => cleanup())

describe("PayMappingReview", () => {
  beforeEach(() => {
    runsListState.current = []
    upsertMock.mockReset()
    upsertMock.mockResolvedValue(null)
    pushMock.mockReset()
  })

  it("renders the WizardShell chrome: an exit control and the jump trigger in the header", () => {
    renderShell()
    expect(screen.getByRole("button", { name: t.exit })).toBeDefined()
    expect(screen.getByRole("button", { name: t.allSteps })).toBeDefined()
  })

  it("exits to the run's summary (the analysis route) with no confirm dialog: everything autosaves", () => {
    renderShell()
    fireEvent.click(screen.getByRole("button", { name: t.exit }))
    expect(pushMock).toHaveBeenCalledWith("/pay-mappings/pay-2026/analysis")
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("shows the done count and a completion bar in the footer, outside the step card", () => {
    renderShell()
    // Nothing marked done yet in the default fixture: "0 of 8 done".
    expect(
      screen.getByText(
        t.progressDone.replace("{done}", "0").replace("{total}", "8")
      )
    ).toBeDefined()
  })

  // Every navigation (resume-on-mount, Continue/Previous/Skip, a jump, an
  // extra-group open/close) swaps the AnimatePresence key. mode="wait"
  // (per docs/ui-animation.md / the task brief) waits for the OUTGOING
  // card's exit transition to finish before mounting the incoming one, so
  // the new content is never present synchronously right after the state
  // change: every assertion on the step AFTER a transition awaits it via
  // findBy*, mirroring the onboarding wizard's own tests.
  it("resumes on the first undone actionable step, not always the start", async () => {
    renderShell({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: [praxisDone("payPolicy")],
    })
    // payPolicy is done; collectiveAgreements is the first undone step.
    expect(
      await screen.findByText(t.praxis.collectiveAgreements.question)
    ).toBeDefined()
    expect(screen.queryByText(t.introTitle)).toBeNull()
  })

  it("moves forward on Continue, back on Previous, and forward again on Skip", async () => {
    renderShell()
    // resumeIndex is 0 here, so the mount effect is a no-op: the start
    // step's own initial mount (initial={false}) never transitions.
    expect(screen.getByText(t.introTitle)).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: t.continue }))
    expect(await screen.findByText(t.praxis.payPolicy.question)).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: t.previous }))
    expect(await screen.findByText(t.introTitle)).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: t.continue }))
    await screen.findByText(t.praxis.payPolicy.question)
    fireEvent.click(screen.getByRole("button", { name: t.skip }))
    expect(
      await screen.findByText(t.praxis.collectiveAgreements.question)
    ).toBeDefined()
  })

  it("focuses the new step container after a Continue transition, and announces the chapter/position via the live region", async () => {
    renderShell()
    fireEvent.click(screen.getByRole("button", { name: t.continue }))

    const heading = await screen.findByText(t.praxis.payPolicy.question)
    const container = heading.closest('[tabindex="-1"]')
    expect(container).not.toBeNull()
    expect(document.activeElement).toBe(container)

    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe(
      `${t.chapters.praxis} · ${t.progressDone
        .replace("{done}", "0")
        .replace("{total}", "8")}`
    )
  })

  it("never steals focus onto the step container on the wizard's own initial mount", () => {
    renderShell()
    const heading = screen.getByText(t.introTitle)
    const container = heading.closest('[tabindex="-1"]')
    expect(container).not.toBeNull()
    expect(document.activeElement).not.toBe(container)
  })

  it("marks a group step done through the real wiring and advances to the next group", async () => {
    renderShell({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: [
        praxisDone("payPolicy"),
        praxisDone("collectiveAgreements"),
        praxisDone("benefits"),
        praxisDone("payPractices"),
      ],
    })
    // Resume lands on "sales" (critical, first in attention order).
    expect(await screen.findByRole("heading", { name: "Sales" })).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
    await vi.waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))
    await vi.waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(2)
    })
    expect(upsertMock).toHaveBeenLastCalledWith({
      orgId: "org-1",
      runId: RUN.runId,
      scope: "equalWork",
      groupKey: "sales",
      reasons: ["experience"],
      done: true,
    })

    expect(await screen.findByRole("heading", { name: "SWE" })).toBeDefined()
  })

  it("jumps to a praxis step via the jump menu and renders it", async () => {
    renderShell()
    openJumpMenu()
    fireEvent.click(screen.getByText(t.praxis.collectiveAgreements.title))
    expect(
      await screen.findByText(t.praxis.collectiveAgreements.question)
    ).toBeDefined()
    expect(screen.queryByPlaceholderText(t.searchSteps)).toBeNull()
  })

  it("opens a non-queue group with free klarmarkering and returns to the current step", async () => {
    renderShell()
    expect(screen.getByText(t.introTitle)).toBeDefined()

    openJumpMenu()
    // The jump-menu row keeps the full "title · level" label; the opened
    // card's heading is the bare role title.
    fireEvent.click(screen.getByText("QA · Mid"))

    expect(await screen.findByRole("heading", { name: "QA" })).toBeDefined()
    const primary = screen.getByRole("button", {
      name: t.markDoneNext,
    }) as HTMLButtonElement
    // "ok" flag groups never require documentation: the primary is never
    // gated, unlike a real queue step.
    expect(primary.disabled).toBe(false)

    fireEvent.click(screen.getByRole("button", { name: t.backToJourney }))
    expect(await screen.findByText(t.introTitle)).toBeDefined()
    expect(screen.queryByText("QA · Mid")).toBeNull()
  })

  it("reaches the finish step once every actionable step is done", async () => {
    renderShell({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: [
        praxisDone("payPolicy"),
        praxisDone("collectiveAgreements"),
        praxisDone("benefits"),
        praxisDone("payPractices"),
        groupDone("equalWork", "sales"),
        groupDone("equalWork", "swe"),
        groupDone("equivalentWork", "wd-1"),
      ],
    })
    expect(await screen.findByText(t.finish.title)).toBeDefined()
  })

  it("renders real progress chrome with skeleton placeholders while loading", () => {
    renderShell({ run: undefined, gap: undefined, analyses: undefined })
    expect(screen.getByText(t.allSteps)).toBeDefined()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(t.introTitle)).toBeNull()
  })

  it("shows the empty-currency text with no progress chrome when the mapping has no salaries, but keeps the exit control", () => {
    renderShell({ gap: { ...GAP, currency: null } })
    expect(screen.getByText(tGap.empty)).toBeDefined()
    expect(screen.queryByText(t.introTitle)).toBeNull()
    expect(screen.queryByText(t.allSteps)).toBeNull()
    // Never trap the user in the takeover: even with nothing to review yet,
    // there is still a way out.
    expect(screen.getByRole("button", { name: t.exit })).toBeDefined()
  })
})
