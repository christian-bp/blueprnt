import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026/analysis",
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
// NumberFlow's custom element never upgrades in jsdom, so its
// getSnapshotBeforeUpdate throws the moment a rendered value changes. Stand
// it in with the plain number it animates, which is also what the spine's
// assertions want to read.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { ConvexError } from "convex/values"
import { toast } from "@/lib/toast"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { makeExcluded, makeGapGroup } from "@/test/pay-mapping-fixtures"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingActionWire,
  PayMappingGapResult,
  PayMappingNoteWire,
  PayMappingRunDetail,
  WomenDominatedComparisonWire,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { PayMappingAnalysis } from "@/components/pay-mapping/pay-mapping-analysis"
import {
  PayMappingRunProvider,
  type PayMappingRunSummary,
} from "@/components/pay-mapping/pay-mapping-run-context"
import { mockMutation } from "@/test/convex-mocks"

const upsertMock = mockMutation("payMapping.analyses.upsertGroupAnalysis")
const completeMock = mockMutation("payMapping.runs.completePayMappingRun")

const t = messages.dashboard.payMapping.review
const tForm = messages.dashboard.payMapping.analysisForm
const tDoc = messages.dashboard.payMapping.documentation
const tGap = messages.dashboard.payMapping.gap
const tJourney = messages.dashboard.payMapping.journey
const tAnalysis = messages.dashboard.payMapping.analysis
const tToast = messages.dashboard.toast
const tErrors = messages.errors

function equalWorkGroup(
  overrides: Parameters<typeof makeGapGroup>[0] = {}
): GapGroup {
  return makeGapGroup({
    key: "k",
    roleTitle: "Role",
    seniority: "Seniority",
    womenCount: 2,
    menCount: 3,
    ...overrides,
  })
}

const COMPARISON: WomenDominatedComparisonWire = {
  key: "cmp-1",
  roleTitle: "Technician",
  seniority: "Mid",
  level: 2,
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
    seniority: "Senior",
    level: 3,
    headcount: 10,
    womenSharePct: 90,
    meanComp: 40000,
    comparisons: [],
    ...overrides,
  }
}

// SALES (critical) and SWE (elevated) both require documentation and sit in
// the queue; QA (ok flag) never does, checklist/finish only. WD-1 has a
// comparator (a required queue step); WD-2 has none (checklist-only, free
// klarmarkering). Flat checklist order (see pay-mapping-analysis.tsx's own
// flatRows): start, payPolicy, collectiveAgreements, benefits, payPractices,
// SWE, Sales, QA, Nurse (wd-1), Receptionist (wd-2).
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
      seniority: "Senior",
      metric: { gapPct: 8 },
      flag: "elevated",
    }),
    equalWorkGroup({
      key: "sales",
      roleTitle: "Sales",
      seniority: "Mid",
      metric: { gapPct: 15 },
      flag: "critical",
    }),
    equalWorkGroup({
      key: "qa",
      roleTitle: "QA",
      seniority: "Mid",
      metric: { gapPct: 2 },
      flag: "ok",
    }),
  ],
  excluded: makeExcluded(),
  equivalentWork: [],
  womenDominated: [
    womenDominatedGroup({
      key: "wd-1",
      roleTitle: "Nurse",
      seniority: "Senior",
      comparisons: [COMPARISON],
    }),
    womenDominatedGroup({
      key: "wd-2",
      roleTitle: "Receptionist",
      seniority: "Junior",
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

const ANALYSES_ALL_DONE: GroupAnalysis[] = [
  praxisDone("payPolicy"),
  praxisDone("collectiveAgreements"),
  praxisDone("benefits"),
  praxisDone("payPractices"),
  groupDone("equalWork", "sales"),
  groupDone("equalWork", "swe"),
  groupDone("equivalentWork", "wd-1"),
]

// Everything in the checklist's own flat order is done except the very LAST
// row (Receptionist / wd-2): marking that one done via "mark done and
// continue" has nothing left to advance to, so it must land back on the
// gate panel.
const ANALYSES_ALL_DONE_EXCEPT_LAST: GroupAnalysis[] = [
  ...ANALYSES_ALL_DONE,
  groupDone("equalWork", "qa"),
]

// Every checklist row done, the two free-klarmarkering rows included: the
// landing default then falls through to the gate panel (nothing remains).
const ANALYSES_EVERYTHING_DONE: GroupAnalysis[] = [
  ...ANALYSES_ALL_DONE_EXCEPT_LAST,
  groupDone("equivalentWork", "wd-2"),
]

function renderSummary(
  overrides: Partial<{
    run: PayMappingRunDetail | undefined
    gap: PayMappingGapResult | undefined
    analyses: GroupAnalysis[] | undefined
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    runsList: PayMappingRunSummary[]
  }> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingRunProvider
        value={{
          run: "run" in overrides ? overrides.run : RUN,
          gap: "gap" in overrides ? overrides.gap : GAP,
          analyses: "analyses" in overrides ? overrides.analyses : [],
          actions: "actions" in overrides ? overrides.actions : [],
          notes: "notes" in overrides ? overrides.notes : [],
          runsList: overrides.runsList ?? [],
        }}
      >
        <PayMappingAnalysis />
      </PayMappingRunProvider>
    </NextIntlClientProvider>
  )
}

// AnimatePresence mode="wait" defers mounting the incoming pane content
// until the outgoing side's own exit transition finishes, so the pane's
// content changes one render "tick" after the click; finishActionsNote only
// ever renders on the gate panel (the pane's null-selection landing state),
// making it a reliable "we are on the gate panel" signal, whether that
// happened via the checklist's own completion row or an advance that found
// nothing left to open.
async function expectGatePanel() {
  await screen.findByText(t.finishActionsNote)
}

// A checklist row button by its label: the same label often also renders
// inside the opened card (a group card's heading, the start card's own
// collaboration heading), so resolve through the button ancestor that only
// checklist rows have.
function checklistRowFor(label: string) {
  return screen
    .getAllByText(label)
    .map((node) => node.closest("button"))
    .find((button) => button !== null)
}

// A chapter's accordion trigger by its title: the trigger renders the title
// and the "x of y" meta as separate spans (AccordionSection's anatomy), so
// name-based role queries no longer see one "title · count" string.
function chapterTrigger(title: string) {
  return screen
    .getAllByRole("button")
    .find(
      (button) =>
        button.getAttribute("data-slot") === "accordion-trigger" &&
        (button.textContent ?? "").startsWith(title)
    )
}

// The checklist opens ONE chapter at a time (Iteration 3, rung 1), and it
// follows the open or next step until the user opens another. A test that
// reaches into a different chapter opens it first, exactly as a user does.
function openChapter(title: string) {
  const trigger = chapterTrigger(title)
  if (trigger !== undefined && trigger.getAttribute("aria-expanded") !== "true")
    fireEvent.click(trigger)
}

// The checklist's last row: the always-reachable way back out of an opened
// step and onto the gate panel, on every screen size.
async function openCompletion() {
  const row = screen
    .getAllByText(tAnalysis.completeRow)
    .map((node) => node.closest("button"))
    .find((button) => button !== null)
  fireEvent.click(row as HTMLElement)
  await expectGatePanel()
}

afterEach(() => cleanup())

describe("PayMappingAnalysis", () => {
  beforeEach(() => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue(null)
    completeMock.mockReset()
    completeMock.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("renders a real heading with skeleton placeholders while loading", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PayMappingRunProvider
          value={{
            run: undefined,
            gap: undefined,
            analyses: undefined,
            actions: undefined,
            runsList: undefined,
            notes: undefined,
          }}
        >
          <PayMappingAnalysis />
        </PayMappingRunProvider>
      </NextIntlClientProvider>
    )
    // The spine's own chrome is real while loading (its heading and its lead
    // are static i18n text); only the unknown count is a bar.
    expect(screen.getByText(tAnalysis.progressLabel)).toBeDefined()
    expect(screen.getByText(tAnalysis.lead)).toBeDefined()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(t.collaborationTitle)).toBeNull()
  })

  it("shows the empty-currency state with no ladder when the mapping has no salaries", () => {
    renderSummary({ gap: { ...GAP, currency: null } })
    expect(screen.getByText(tGap.empty)).toBeDefined()
    expect(screen.queryByText(tAnalysis.lead)).toBeNull()
  })

  it("hides the continue item on a non-active run even while steps remain", () => {
    renderSummary({ run: { ...RUN, status: "paused" } })
    expect(
      screen.queryByRole("link", { name: /remain in the guided review/ })
    ).toBeNull()
  })

  it("renders each countable chapter trigger with the journey card's own done/total count as its meta", () => {
    renderSummary()
    expect(chapterTrigger(t.chapters.praxis)?.textContent).toContain(
      tJourney.count.replace("{done}", "0").replace("{total}", "4")
    )
    expect(chapterTrigger(t.chapters.equalWork)?.textContent).toContain(
      tJourney.count.replace("{done}", "0").replace("{total}", "2")
    )
    expect(chapterTrigger(t.chapters.equivalentWork)?.textContent).toContain(
      tJourney.count.replace("{done}", "0").replace("{total}", "1")
    )
  })

  it("advances each countable chapter's count as its own queue steps are marked done", () => {
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    expect(chapterTrigger(t.chapters.praxis)?.textContent).toContain(
      tJourney.count.replace("{done}", "4").replace("{total}", "4")
    )
    expect(chapterTrigger(t.chapters.equalWork)?.textContent).toContain(
      tJourney.count.replace("{done}", "2").replace("{total}", "2")
    )
    expect(chapterTrigger(t.chapters.equivalentWork)?.textContent).toContain(
      tJourney.count.replace("{done}", "1").replace("{total}", "1")
    )
  })

  it("lands on the next-step panel, not on an opened step, and opens it on demand", async () => {
    renderSummary()
    // Start (collaboration) is the first undone row, so the landing names
    // it. Nothing heavier renders until the user asks: no step heading, no
    // form, no gate panel.
    expect(
      await screen.findByText(
        tAnalysis.nextStepLabel.replace("{label}", t.collaborationTitle)
      )
    ).toBeDefined()
    expect(screen.getByText(tAnalysis.nextAction.start)).toBeDefined()
    expect(screen.queryByRole("heading", { name: t.introTitle })).toBeNull()
    expect(screen.queryByText(t.finishActionsNote)).toBeNull()
    // The landing is implicit: the small-screen context bar only renders
    // for an explicit selection (the checklist must stay reachable).
    expect(
      screen.queryByRole("button", { name: tAnalysis.stepsSheet })
    ).toBeNull()
    // And it never steals focus on page load.
    expect(document.activeElement).toBe(document.body)

    fireEvent.click(screen.getByRole("button", { name: tAnalysis.openStep }))
    expect(await screen.findByText(t.introTitle)).toBeDefined()
    const row = checklistRowFor(t.collaborationTitle)
    expect(row?.getAttribute("aria-current")).toBe("true")
  })

  it("lands on the completion panel once the gate is met, never on the next-step panel", async () => {
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    await expectGatePanel()
    expect(
      screen.queryByRole("button", { name: tAnalysis.openStep })
    ).toBeNull()
  })

  it("pre-selects the checklist row a ?step= deep link names", async () => {
    // The actions overview's "linked to" links land here with the record's
    // own group in the query string.
    window.history.pushState({}, "", "/analysis?step=equalWork:sales")
    try {
      renderSummary()
      await vi.waitFor(() => {
        const row = checklistRowFor("Sales · Mid")
        expect(row?.getAttribute("aria-current")).toBe("true")
      })
    } finally {
      window.history.pushState({}, "", "/")
    }
  })

  it("ignores a ?step= deep link whose group no longer exists", async () => {
    window.history.pushState({}, "", "/analysis?step=equalWork:gone")
    try {
      renderSummary()
      // Falls back to the implicit landing (the next-step panel).
      expect(
        await screen.findByText(
          tAnalysis.nextStepLabel.replace("{label}", t.collaborationTitle)
        )
      ).toBeDefined()
    } finally {
      window.history.pushState({}, "", "/")
    }
  })

  it("renders the opened step's own heading as an h4 (the pane sits under the page's h2 and this summary's own h3)", async () => {
    renderSummary()
    fireEvent.click(
      await screen.findByRole("button", { name: tAnalysis.openStep })
    )
    expect(
      await screen.findByRole("heading", { name: t.introTitle, level: 4 })
    ).toBeDefined()
    expect(
      screen.queryByRole("heading", { name: t.introTitle, level: 1 })
    ).toBeNull()
  })

  it("lands on the gate panel on a completed run even when free-klarmarkering rows were left undone", async () => {
    renderSummary({
      run: { ...RUN, status: "completed", collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    await expectGatePanel()
    expect(screen.getByText(tDoc.completedNote)).toBeDefined()
  })

  it("lands on the gate panel on an ACTIVE run once the gate is met, even with the free-klarmarkering rows (QA, Receptionist) untouched", async () => {
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    await expectGatePanel()
    const button = screen.getByRole("button", {
      name: tDoc.complete,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })

  it("selects the start row: opens the collaboration step, marks it aria-current, and returns via the completion row", async () => {
    // A fixture where start is NOT the landing default (collaboration
    // filled), so the click below is a real transition.
    renderSummary({ run: { ...RUN, collaboration: COLLABORATION_FILLED } })
    // Start is done here, so the landing opens the praxis chapter; reach
    // back into start the way a user does.
    openChapter(t.chapters.start)
    const row = checklistRowFor(t.collaborationTitle)
    expect(row).toBeDefined()
    fireEvent.click(row as HTMLElement)
    expect(await screen.findByText(t.introTitle)).toBeDefined()
    expect(row?.getAttribute("aria-current")).toBe("true")

    await openCompletion()
    expect(checklistRowFor(t.collaborationTitle)).toBeDefined()
    expect(screen.queryByText(t.introTitle)).toBeNull()
  })

  it("selects a praxis row: opens it and marks it aria-current", async () => {
    renderSummary()
    openChapter(t.chapters.praxis)
    const row = screen.getByText(t.praxis.payPolicy.title).closest("button")
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    expect(await screen.findByText(t.praxis.payPolicy.question)).toBeDefined()
    expect(row?.getAttribute("aria-current")).toBe("true")
  })

  it("selects a queue equal-work group row (requiring documentation)", async () => {
    renderSummary()
    openChapter(t.chapters.equalWork)
    fireEvent.click(screen.getByText("Sales · Mid"))
    expect(
      await screen.findByRole("button", { name: t.markDoneNext })
    ).toBeDefined()
  })

  it("selects a non-queue equal-work group with free klarmarkering (primary enabled without documentation)", async () => {
    renderSummary()
    openChapter(t.chapters.equalWork)
    fireEvent.click(screen.getByText("QA · Mid"))
    const primary = (await screen.findByRole("button", {
      name: t.markDoneNext,
    })) as HTMLButtonElement
    expect(primary.disabled).toBe(false)
  })

  it("selects a queue equivalent-work group row (with a comparator)", async () => {
    renderSummary()
    openChapter(t.chapters.equivalentWork)
    fireEvent.click(screen.getByText("Nurse · Senior"))
    expect(
      await screen.findByRole("button", { name: t.markDoneNext })
    ).toBeDefined()
  })

  it("selects a non-queue equivalent-work group with free klarmarkering (primary enabled without documentation)", async () => {
    renderSummary()
    openChapter(t.chapters.equivalentWork)
    fireEvent.click(screen.getByText("Receptionist · Junior"))
    const primary = (await screen.findByRole("button", {
      name: t.markDoneNext,
    })) as HTMLButtonElement
    expect(primary.disabled).toBe(false)
  })

  it("advances the pane to the next remaining step after marking one done, skipping an already-done row", async () => {
    renderSummary({
      analyses: [praxisDone("collectiveAgreements")],
    })
    openChapter(t.chapters.praxis)
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    await screen.findByText(t.praxis.payPolicy.question)

    fireEvent.click(screen.getByRole("button", { name: t.findingNone }))
    fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))

    await vi.waitFor(() => {
      expect(upsertMock).toHaveBeenCalled()
    })
    // collectiveAgreements is already done in the fixture: the advance
    // skips straight past it to benefits, the next REMAINING row.
    expect(await screen.findByText(t.praxis.benefits.question)).toBeDefined()
    expect(screen.queryByText(t.praxis.payPolicy.question)).toBeNull()
  })

  it("advances INTO a non-queue row (extraGroup path), moving aria-current and focus with it", async () => {
    // Everything before Sales in the flat order is done; Sales carries an
    // undone analysis WITH documentation (so its primary is enabled), and
    // the next remaining row after it is QA, a non-queue "ok"-flag group:
    // the advance must resolve QA's extraGroup OpenStep, not just the
    // click path.
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: [
        praxisDone("payPolicy"),
        praxisDone("collectiveAgreements"),
        praxisDone("benefits"),
        praxisDone("payPractices"),
        groupDone("equalWork", "swe"),
        {
          scope: "equalWork",
          groupKey: "sales",
          reasons: ["experience"],
          note: null,
          done: false,
          finding: null,
        },
      ],
    })
    // Sales is also the landing default here (first undone), so its label
    // renders in both the row and the already-open card.
    openChapter(t.chapters.equalWork)
    fireEvent.click(checklistRowFor("Sales · Mid") as HTMLElement)
    const primary = await screen.findByRole("button", { name: t.markDoneNext })
    fireEvent.click(primary)

    await vi.waitFor(() => {
      expect(upsertMock).toHaveBeenCalled()
    })
    // The QA card is now open (its heading is the bare role title; the
    // checklist row keeps the full label), Sales only as its own row.
    expect(await screen.findByRole("heading", { name: "QA" })).toBeDefined()
    expect(screen.getAllByText("Sales · Mid")).toHaveLength(1)
    // aria-current follows the advance onto the (non-queue) group row.
    const qaRow = screen
      .getAllByText("QA · Mid")
      .map((node) => node.closest("button"))
      .find((button) => button?.getAttribute("aria-current") === "true")
    expect(qaRow).toBeDefined()
    // Focus lands in the pane on an advance, same as on a select.
    const paneContainer = screen
      .getByRole("button", { name: t.markDoneNext })
      .closest('[tabindex="-1"]')
    expect(paneContainer).not.toBeNull()
    expect(document.activeElement).toBe(paneContainer)
  })

  it("lands on the gate panel once marking the last remaining step leaves nothing to advance to", async () => {
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE_EXCEPT_LAST,
    })
    // The gate is already met here (QA and Receptionist sit outside the
    // queue), so the pane already shows the gate panel before this click;
    // select Receptionist explicitly to mark it done, which still has
    // nothing left to advance to.
    openChapter(t.chapters.equivalentWork)
    fireEvent.click(checklistRowFor("Receptionist · Junior") as HTMLElement)
    const primary = await screen.findByRole("button", {
      name: t.markDoneNext,
    })
    fireEvent.click(primary)

    await vi.waitFor(() => {
      expect(upsertMock).toHaveBeenCalled()
    })
    await expectGatePanel()
    expect(
      screen
        .queryByText("Receptionist · Junior")
        ?.closest("button")
        ?.getAttribute("aria-current")
    ).not.toBe("true")
  })

  it("moves focus onto the pane on every explicit selection, including the completion row", async () => {
    renderSummary()
    openChapter(t.chapters.praxis)
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    const question = await screen.findByText(t.praxis.payPolicy.question)
    const paneContainer = question.closest('[tabindex="-1"]')
    expect(paneContainer).not.toBeNull()
    expect(document.activeElement).toBe(paneContainer)

    await openCompletion()
    const gate = screen
      .getByText(t.finishActionsNote)
      .closest('[tabindex="-1"]')
    expect(gate).not.toBeNull()
    expect(document.activeElement).toBe(gate)
  })

  it("never focuses or scrolls the pane on arrival, including when a late query re-keys the landing", async () => {
    // The run's queries resolve independently, so the landing pane re-keys
    // as each one lands. A mount-count guard let the SECOND mount focus,
    // which scrolled a freshly opened page down past the spine.
    const { rerender } = renderSummary({ analyses: [] })
    await screen.findByText(tAnalysis.nextAction.start)
    expect(document.activeElement).toBe(document.body)

    // The analyses query lands: start is now done, so the landing moves to
    // the next chapter and the pane re-keys.
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PayMappingRunProvider
          value={{
            run: { ...RUN, collaboration: COLLABORATION_FILLED },
            gap: GAP,
            analyses: ANALYSES_ALL_DONE,
            actions: [],
            notes: [],
            runsList: [],
          }}
        >
          <PayMappingAnalysis />
        </PayMappingRunProvider>
      </NextIntlClientProvider>
    )
    // The pane re-keyed: its landing no longer points at the start step.
    await waitFor(() => {
      expect(screen.queryByText(tAnalysis.nextAction.start)).toBeNull()
    })
    expect(document.activeElement).toBe(document.body)
  })

  it("below lg, an opened step says where it sits and opens the whole list in a sheet", async () => {
    renderSummary()
    openChapter(t.chapters.praxis)
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    await screen.findByText(t.praxis.payPolicy.question)
    // Pay policy is the second row of the checklist's flat order (start
    // comes first), out of ten.
    expect(
      screen.getByText(
        tAnalysis.stepPosition
          .replace("{position}", "2")
          .replace("{total}", "10")
          .replace("{chapter}", t.chapters.praxis)
      )
    ).toBeDefined()
    // The sheet carries the same checklist, so the phone can never drift
    // from the desktop column: opening it duplicates every row.
    const before = screen.getAllByText(tAnalysis.completeRow).length
    fireEvent.click(screen.getByRole("button", { name: tAnalysis.stepsSheet }))
    await waitFor(() => {
      expect(screen.getAllByText(tAnalysis.completeRow).length).toBe(before + 1)
    })
  })

  it("renders the opened card read-only on a locked (completed) run", async () => {
    renderSummary({
      run: { ...RUN, status: "completed", collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    openChapter(t.chapters.praxis)
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    expect(await screen.findByText(tForm.lockedHint)).toBeDefined()
  })

  it("disables Complete with the remaining-count hint while the gate is unmet", async () => {
    renderSummary()
    // With steps remaining the landing default is a step card; reach the
    // gate panel the way a small screen does (explicit open, then back).
    openChapter(t.chapters.praxis)
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    await screen.findByText(t.praxis.payPolicy.question)
    await openCompletion()
    const button = screen.getByRole("button", {
      name: tDoc.complete,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(
      screen.getByText("8 steps remain before the pay mapping can be completed")
    ).toBeDefined()
  })

  it("enables Complete and fires the mutation + toast once the gate is met", async () => {
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_EVERYTHING_DONE,
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
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_EVERYTHING_DONE,
    })
    fireEvent.click(screen.getByRole("button", { name: tDoc.complete }))

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(tErrors.payMappingGateUnmet)
    })
  })

  it("shows the completed note and Reopen instead of the Complete action", () => {
    renderSummary({
      run: { ...RUN, status: "completed" },
      analyses: ANALYSES_ALL_DONE,
    })
    expect(screen.getByText(tDoc.completedNote)).toBeDefined()
    expect(screen.queryByRole("button", { name: tDoc.complete })).toBeNull()
    // Reopen moved here with the rest of the completion controls: one
    // surface owns the end of the ladder.
    expect(screen.getByRole("button", { name: tDoc.reopen })).toBeDefined()
  })

  it("lists every group as an icon + label row, with the state as sr-only text and no visible status", () => {
    renderSummary()
    // One chapter at a time, so each is opened in turn; every group is
    // still reachable, which is what this pins.
    openChapter(t.chapters.equalWork)
    for (const label of ["SWE · Senior", "Sales · Mid", "QA · Mid"]) {
      expect(checklistRowFor(label)).toBeDefined()
    }
    openChapter(t.chapters.equivalentWork)
    for (const label of ["Nurse · Senior", "Receptionist · Junior"]) {
      expect(checklistRowFor(label)).toBeDefined()
    }
    openChapter(t.chapters.equalWork)
    // The gap/status details live in the opened card, never in the row: the
    // row's text is exactly the label + the sr-only done/remaining state,
    // nothing else.
    expect(checklistRowFor("SWE · Senior")?.textContent).toBe(
      `SWE · Senior${t.status.toReview}`
    )
  })

  it("shows the actions note on the gate panel once nothing remains", () => {
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_EVERYTHING_DONE,
    })
    expect(screen.getByText(t.finishActionsNote)).toBeDefined()
  })

  it("filters the checklist by label while searching, flattening the chapters", () => {
    renderSummary()
    openChapter(t.chapters.equalWork)
    const search = screen.getByRole("textbox", { name: t.searchSteps })
    fireEvent.change(search, { target: { value: "sales" } })
    expect(checklistRowFor("Sales · Mid")).toBeDefined()
    expect(screen.queryByText("QA · Mid")).toBeNull()
    expect(screen.queryByText(t.praxis.payPolicy.title)).toBeNull()

    // Clearing the query returns to the single-open chapter list, on the
    // chapter that was open before the search.
    fireEvent.change(search, { target: { value: "" } })
    expect(screen.getByText("QA · Mid")).toBeDefined()
    openChapter(t.chapters.praxis)
    expect(screen.getByText(t.praxis.payPolicy.title)).toBeDefined()
  })

  // The invariant that makes a group disappearing from the UI a test
  // failure rather than a silent loss: every group the engine produced is
  // reachable somewhere on this surface, and the ones that never reach a
  // comparison are accounted for in words.
  it("renders every group the engine produced, or accounts for it in words", () => {
    renderSummary({
      gap: {
        ...GAP,
        excluded: makeExcluded({
          singletonCount: 42,
          reverse: [equalWorkGroup({ key: "rev", roleTitle: "Ops" })],
          genderPure: [
            {
              key: "Lead|1|Staff",
              roleTitle: "Lead",
              seniority: "Staff",
              level: 1,
              gender: "Man",
              count: 3,
            },
          ],
        }),
      },
    })
    // The three shown equal-work groups and the two women-dominated ones
    // are all reachable from the checklist.
    openChapter(t.chapters.equalWork)
    for (const label of ["SWE · Senior", "Sales · Mid", "QA · Mid"]) {
      expect(checklistRowFor(label)).toBeDefined()
    }
    openChapter(t.chapters.equivalentWork)
    for (const label of ["Nurse · Senior", "Receptionist · Junior"]) {
      expect(checklistRowFor(label)).toBeDefined()
    }
    // Everything the entry conditions kept out is counted in the drawer.
    const drawer = messages.dashboard.payMapping.supplementary
    const meta = (title: string) =>
      screen
        .getAllByRole("button")
        .find((button) => (button.textContent ?? "").startsWith(title))
        ?.textContent
    expect(meta(drawer.items.singletons)).toContain("42")
    expect(meta(drawer.items.womenAhead)).toContain("1")
    expect(meta(drawer.items.genderPure)).toContain("1")
  })

  it("opens a chapter's whole worklist past the inline cap, with every group in it", async () => {
    // Nine women-dominated groups: past the eight-row cap, so the column
    // offers the table instead of becoming a scroll.
    const many = Array.from({ length: 9 }, (_, index) =>
      womenDominatedGroup({
        key: `wd-${index}`,
        roleTitle: `Group ${index}`,
        seniority: "Mid",
        comparisons: index === 0 ? [COMPARISON] : [],
      })
    )
    renderSummary({ gap: { ...GAP, womenDominated: many } })
    openChapter(t.chapters.equivalentWork)
    const showAll = screen.getByRole("button", {
      name: tAnalysis.worklist.showAll.replace("{count}", "9"),
    })
    fireEvent.click(showAll)
    // The pane swaps through AnimatePresence, so the table lands a tick later.
    const table = await screen.findByRole("table")
    // Every group is a row, including the eight that carry no duty.
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 9)
    expect(
      within(table).getAllByText(tAnalysis.worklist.status.noDuty)
    ).toHaveLength(8)
    expect(
      within(table).getAllByText(tAnalysis.worklist.status.needsDocumenting)
    ).toHaveLength(1)
  })

  it("opens one chapter at a time, closing the one that was open", () => {
    renderSummary()
    // The landing opens the chapter holding the next undone step (start).
    expect(screen.getByText(t.collaborationTitle)).toBeDefined()
    expect(screen.queryByText(t.praxis.payPolicy.title)).toBeNull()

    const praxis = chapterTrigger(t.chapters.praxis) as HTMLElement
    fireEvent.click(praxis)
    expect(screen.getByText(t.praxis.payPolicy.title)).toBeDefined()
    expect(screen.queryByText(t.collaborationTitle)).toBeNull()

    // Collapsing the open one leaves every chapter closed, and each still
    // reports its own count so nothing is hidden.
    fireEvent.click(praxis)
    expect(screen.queryByText(t.praxis.payPolicy.title)).toBeNull()
    expect(chapterTrigger(t.chapters.praxis)?.textContent).toContain(
      tJourney.count.replace("{done}", "0").replace("{total}", "4")
    )
  })

  it("filters the checklist to remaining rows on demand, all by default", () => {
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: [praxisDone("payPolicy")],
    })
    openChapter(t.chapters.praxis)
    // All by default: the documented rows ARE the evidence record.
    expect(screen.getByText(t.praxis.payPolicy.title)).toBeDefined()
    fireEvent.click(
      screen.getByRole("button", { name: tAnalysis.filterRemaining })
    )
    expect(screen.queryByText(t.praxis.payPolicy.title)).toBeNull()
    expect(screen.getByText(t.praxis.benefits.title)).toBeDefined()
  })

  it("always offers the completion row, stating what is left", async () => {
    renderSummary()
    const row = screen
      .getAllByRole("button")
      .find((button) =>
        (button.textContent ?? "").startsWith(tAnalysis.completeRow)
      )
    expect(row?.textContent).toContain(
      tAnalysis.completeLocked.replace("{count}", "8")
    )
    fireEvent.click(row as HTMLElement)
    await expectGatePanel()
  })
})
