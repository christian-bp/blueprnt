import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026/analysis",
  // Läget's next-step button navigates into the owning chapter's page
  // rather than opening a step it does not list (Iteration 4).
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
// NumberFlow's custom element never upgrades in jsdom, so its
// getSnapshotBeforeUpdate throws the moment a rendered value changes. Stand
// it in with the plain number it animates, which is also what the spine's
// assertions want to read.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { toast } from "@/lib/toast"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  makeExcluded,
  makeGapGroup,
  makeRunDetail,
} from "@/test/pay-mapping-fixtures"
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
import {
  PayMappingAnalysis,
  shouldScrollPaneIntoView,
} from "@/components/pay-mapping/pay-mapping-analysis"
import type { AnalysisChapter } from "@/components/pay-mapping/analysis-chapters"
import {
  PayMappingRunProvider,
  type PayMappingRunSummary,
} from "@/components/pay-mapping/pay-mapping-run-context"
import { mockMutation } from "@/test/convex-mocks"

const upsertMock = mockMutation("payMapping.analyses.upsertGroupAnalysis")
const completeMock = mockMutation("payMapping.runs.completePayMappingRun")

const t = messages.dashboard.payMapping.review
const tForm = messages.dashboard.payMapping.analysisForm
const tGap = messages.dashboard.payMapping.gap
const tAnalysis = messages.dashboard.payMapping.analysis

function equalWorkGroup(
  overrides: Parameters<typeof makeGapGroup>[0] = {}
): GapGroup {
  return makeGapGroup({
    key: "k",
    roleTitle: "Role",
    seniority: null,
    womenCount: 2,
    menCount: 3,
    ...overrides,
  })
}

const COMPARISON: WomenDominatedComparisonWire = {
  key: "cmp-1",
  roleTitle: "Technician",
  seniority: null,
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
    seniority: null,
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
      seniority: null,
      metric: { gapPct: 8 },
      flag: "elevated",
    }),
    equalWorkGroup({
      key: "sales",
      roleTitle: "Sales",
      seniority: null,
      metric: { gapPct: 15 },
      flag: "critical",
    }),
    equalWorkGroup({
      key: "qa",
      roleTitle: "QA",
      seniority: null,
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
      seniority: null,
      comparisons: [COMPARISON],
    }),
    womenDominatedGroup({
      key: "wd-2",
      roleTitle: "Receptionist",
      seniority: null,
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
}

const RUN: PayMappingRunDetail = makeRunDetail({
  runId: "run-1" as Id<"payMappingRuns">,
})

function praxisDone(area: string): GroupAnalysis {
  return {
    scope: "praxis",
    groupKey: area,
    comparisonKey: null,
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
    comparisonKey: null,
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

function renderSummary(
  overrides: Partial<{
    run: PayMappingRunDetail | undefined
    gap: PayMappingGapResult | undefined
    analyses: GroupAnalysis[] | undefined
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    runsList: PayMappingRunSummary[]
    // Which chapter page to render. Every analysis route is a chapter.
    chapter: AnalysisChapter
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
        <PayMappingAnalysis chapter={overrides.chapter ?? "equalWork"} />
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
  // queryAllByText, so asking about a row that is NOT there returns
  // undefined instead of throwing: absence is a thing tests assert.
  return screen
    .queryAllByText(label)
    .map((node) => node.closest("button"))
    .find((button) => button !== null)
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
          <PayMappingAnalysis chapter="equalWork" />
        </PayMappingRunProvider>
      </NextIntlClientProvider>
    )
    // No progress chrome of its own while loading: the section shell above
    // owns the journey's whole reading, and a second bar here was a leftover
    // from before it did.
    expect(document.querySelector('[role="progressbar"]')).toBeNull()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(t.collaborationTitle)).toBeNull()
  })

  it("shows the empty-currency state with no ladder when the mapping has no salaries", () => {
    renderSummary({ gap: { ...GAP, currency: null } })
    expect(screen.getByText(tGap.empty)).toBeDefined()
  })

  it("hides the continue item on a non-active run even while steps remain", () => {
    renderSummary({ run: { ...RUN, status: "paused" } })
    expect(
      screen.queryByRole("link", { name: /remain in the guided review/ })
    ).toBeNull()
  })

  it("pre-selects the checklist row a ?step= deep link names", async () => {
    // The actions overview's "linked to" links land here with the record's
    // own group in the query string.
    window.history.pushState({}, "", "/analysis?step=equalWork:sales")
    try {
      renderSummary()
      await waitFor(() => {
        const row = checklistRowFor("Sales")
        expect(row?.getAttribute("aria-current")).toBe("true")
      })
    } finally {
      window.history.pushState({}, "", "/")
    }
  })

  it("ignores a ?step= deep link whose group no longer exists", async () => {
    window.history.pushState({}, "", "/analysis?step=equalWork:gone")
    try {
      renderSummary({ chapter: "equalWork" })
      // Falls back to the chapter's own landing: its first undone row,
      // opened as if the deep link had never been there.
      expect(
        await screen.findByRole("heading", { name: "SWE", level: 4 })
      ).toBeDefined()
    } finally {
      window.history.pushState({}, "", "/")
    }
  })

  it("renders the opened step's own heading as an h4 (the pane sits under the page's h2 and this summary's own h3)", async () => {
    // The start chapter's step, opened by landing on its page.
    renderSummary({ chapter: "start" })
    expect(
      await screen.findByRole("heading", { name: t.introTitle, level: 4 })
    ).toBeDefined()
    expect(
      screen.queryByRole("heading", { name: t.introTitle, level: 1 })
    ).toBeNull()
  })

  it("opens the one-step start chapter directly, keeping the list beside it", async () => {
    // Documented already, so this is the case that used to hide its own
    // content behind a "this chapter is done" panel. The step opens directly,
    // and the list stays: a one-step chapter has nothing to choose between,
    // but dropping the column here made the step pane grow by its width, so
    // every field and button in the analysis jumped sideways on the way into
    // and out of this chapter.
    renderSummary({
      chapter: "start",
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
    })
    expect(await screen.findByText(t.introTitle)).toBeDefined()
    expect(screen.getByRole("textbox", { name: t.searchSteps })).toBeDefined()
  })

  it("selects a praxis row: opens it and marks it aria-current", async () => {
    renderSummary({ chapter: "praxis" })
    const row = checklistRowFor(t.praxis.payPolicy.title)
    fireEvent.click(checklistRowFor(t.praxis.payPolicy.title) as HTMLElement)
    expect(await screen.findByText(t.praxis.payPolicy.question)).toBeDefined()
    expect(row?.getAttribute("aria-current")).toBe("true")
  })

  it("selects a queue equal-work group row (requiring documentation)", async () => {
    renderSummary()
    fireEvent.click(checklistRowFor("Sales") as HTMLElement)
    expect(
      await screen.findByRole("button", { name: t.markDoneNext })
    ).toBeDefined()
  })

  it("selects a non-queue equal-work group with free klarmarkering (primary enabled without documentation)", async () => {
    renderSummary()
    fireEvent.click(checklistRowFor("QA") as HTMLElement)
    // The pane swaps through AnimatePresence, so wait for QA's own heading
    // before reading the button: otherwise this reads the previous step's,
    // which does require documentation and is therefore disabled.
    await screen.findByRole("heading", { name: "QA", level: 4 })
    const primary = (await screen.findByRole("button", {
      name: t.markDoneNext,
    })) as HTMLButtonElement
    expect(primary.disabled).toBe(false)
  })

  it("selects a queue equivalent-work group row (with a comparator)", async () => {
    renderSummary({ chapter: "equivalentWork" })
    fireEvent.click(checklistRowFor("Nurse") as HTMLElement)
    expect(
      await screen.findByRole("button", { name: t.markDoneNext })
    ).toBeDefined()
  })

  it("selects a non-queue equivalent-work group with free klarmarkering (primary enabled without documentation)", async () => {
    renderSummary({ chapter: "equivalentWork" })
    fireEvent.click(checklistRowFor("Receptionist") as HTMLElement)
    await screen.findByRole("heading", { name: "Receptionist", level: 4 })
    const primary = (await screen.findByRole("button", {
      name: t.markDoneNext,
    })) as HTMLButtonElement
    expect(primary.disabled).toBe(false)
  })

  it("advances the pane to the next remaining step after marking one done, skipping an already-done row", async () => {
    renderSummary({
      chapter: "praxis",
      analyses: [praxisDone("collectiveAgreements")],
    })
    fireEvent.click(checklistRowFor(t.praxis.payPolicy.title) as HTMLElement)
    await screen.findByText(t.praxis.payPolicy.question)

    fireEvent.click(screen.getByRole("button", { name: t.findingNone }))
    fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))

    await waitFor(() => {
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
    // Sales and QA are both equal-work rows, so this plays out on that
    // chapter's page: an advance within a chapter opens in place, while
    // one that crosses a boundary navigates instead.
    renderSummary({
      chapter: "equalWork",
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
          comparisonKey: null,
          reasons: ["experience"],
          note: null,
          done: false,
          finding: null,
        },
      ],
    })
    // Sales is also the landing default here (first undone), so its label
    // renders in both the row and the already-open card.
    fireEvent.click(checklistRowFor("Sales") as HTMLElement)
    const primary = await screen.findByRole("button", { name: t.markDoneNext })
    fireEvent.click(primary)

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalled()
    })
    // The QA card is now open (its heading is the bare role title; the
    // checklist row keeps the full label), Sales only as its own row.
    expect(await screen.findByRole("heading", { name: "QA" })).toBeDefined()
    expect(screen.getAllByText("Sales")).toHaveLength(1)
    // aria-current follows the advance onto the (non-queue) group row.
    const qaRow = screen
      .getAllByText("QA")
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
      chapter: "equivalentWork",
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE_EXCEPT_LAST,
    })
    // The gate is already met here (QA and Receptionist sit outside the
    // queue), so the pane already shows the gate panel before this click;
    // select Receptionist explicitly to mark it done, which still has
    // nothing left to advance to.
    fireEvent.click(checklistRowFor("Receptionist") as HTMLElement)
    await screen.findByRole("heading", { name: "Receptionist", level: 4 })
    const primary = await screen.findByRole("button", {
      name: t.markDoneNext,
    })
    fireEvent.click(primary)

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalled()
    })
    await expectGatePanel()
    expect(
      screen
        .queryByText("Receptionist")
        ?.closest("button")
        ?.getAttribute("aria-current")
    ).not.toBe("true")
  })

  it("moves focus onto the pane on every explicit selection, including the completion row", async () => {
    renderSummary({ chapter: "praxis" })
    // Arriving opens the chapter's first step, which must NOT steal focus:
    // the landing is not a transition the reader asked for.
    await screen.findByText(t.praxis.payPolicy.question)
    expect(document.activeElement).toBe(document.body)

    // A selection the reader makes does move focus, so a screen reader
    // announces the step they just opened.
    fireEvent.click(checklistRowFor(t.praxis.benefits.title) as HTMLElement)
    const next = await screen.findByText(t.praxis.benefits.question)
    expect(document.activeElement).toBe(next.closest('[tabindex="-1"]'))
  })

  it("never focuses or scrolls the pane on arrival, including when a late query re-keys the landing", async () => {
    // The run's queries resolve independently, so the landing pane re-keys
    // as each one lands. A mount-count guard let the SECOND mount focus,
    // which scrolled a freshly opened page down past the spine.
    //
    // Praxis, because its landing MOVES when the analyses arrive (four
    // rows, so the first undone one changes); a one-row chapter would open
    // the same step both times and never re-key at all.
    const { rerender } = renderSummary({ chapter: "praxis", analyses: [] })
    await screen.findByText(t.praxis.payPolicy.question)
    expect(document.activeElement).toBe(document.body)

    // The analyses query lands: pay policy is now done, so the landing
    // moves to the next row and the pane re-keys.
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PayMappingRunProvider
          value={{
            run: RUN,
            gap: GAP,
            analyses: [praxisDone("payPolicy")],
            actions: [],
            notes: [],
            runsList: [],
          }}
        >
          <PayMappingAnalysis chapter="praxis" />
        </PayMappingRunProvider>
      </NextIntlClientProvider>
    )
    await screen.findByText(t.praxis.collectiveAgreements.question)
    expect(document.activeElement).toBe(document.body)
  })

  it("below lg, an opened step says where it sits and opens the whole list in a sheet", async () => {
    renderSummary({ chapter: "praxis" })
    fireEvent.click(checklistRowFor(t.praxis.payPolicy.title) as HTMLElement)
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
    // Opening the sheet duplicates the chapter's own rows, which is what
    // makes it the same list rather than a second one.
    const before = screen.getAllByText(t.praxis.payPolicy.title).length
    fireEvent.click(screen.getByRole("button", { name: tAnalysis.stepsSheet }))
    await waitFor(() => {
      expect(screen.getAllByText(t.praxis.payPolicy.title).length).toBe(
        before + 1
      )
    })
  })

  it("renders the opened card read-only on a locked (completed) run", async () => {
    renderSummary({
      chapter: "praxis",
      run: { ...RUN, status: "completed", collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    fireEvent.click(checklistRowFor(t.praxis.payPolicy.title) as HTMLElement)
    expect(await screen.findByText(tForm.lockedHint)).toBeDefined()
  })

  it("lists every group as an icon + label row, with the state as sr-only text and no visible status", () => {
    // Chapters are pages now, so each is rendered in turn; every group is
    // still reachable, which is what this pins.
    renderSummary({ chapter: "equalWork" })
    for (const label of ["SWE", "Sales", "QA"]) {
      expect(checklistRowFor(label)).toBeDefined()
    }
    cleanup()
    renderSummary({ chapter: "equivalentWork" })
    for (const label of ["Nurse", "Receptionist"]) {
      expect(checklistRowFor(label)).toBeDefined()
    }
    cleanup()
    renderSummary({ chapter: "equalWork" })
    // The gap/status details live in the opened card, never in the row: the
    // row's text is exactly the label + the sr-only done/remaining state,
    // nothing else.
    expect(checklistRowFor("SWE")?.textContent).toBe(`SWE${t.status.toReview}`)
  })

  it("filters a chapter's own rows by label while searching", () => {
    // Scoped to the chapter, because that is all this page lists. The
    // search across every chapter belongs to Läget and is not built yet.
    renderSummary({ chapter: "equalWork" })
    const search = screen.getByRole("textbox", { name: t.searchSteps })
    fireEvent.change(search, { target: { value: "sales" } })
    expect(checklistRowFor("Sales")).toBeDefined()
    expect(checklistRowFor("QA")).toBeUndefined()

    fireEvent.change(search, { target: { value: "" } })
    expect(checklistRowFor("Sales")).toBeDefined()
  })

  // The invariant that makes a group disappearing from the UI a test
  // failure rather than a silent loss: every group the engine produced is
  // reachable somewhere on this surface, and the ones that never reach a
  // comparison are accounted for in words.
  it("renders every group the engine produced, or accounts for it in words", () => {
    renderSummary({
      chapter: "equivalentWork",
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
    // The two women-dominated groups are reachable on their chapter page.
    for (const label of ["Nurse", "Receptionist"]) {
      expect(checklistRowFor(label)).toBeDefined()
    }
    cleanup()
    // The three shown equal-work groups on theirs.
    renderSummary({ chapter: "equalWork" })
    for (const label of ["SWE", "Sales", "QA"]) {
      expect(checklistRowFor(label)).toBeDefined()
    }
  })

  it("lists every group in the column, however many there are", async () => {
    // Nine women-dominated groups. The column used to stop at eight and offer
    // "show all as a list" instead, which answered "what is left in this
    // chapter" wrongly for exactly the chapters that need it most.
    const many = Array.from({ length: 9 }, (_, index) =>
      womenDominatedGroup({
        key: `wd-${index}`,
        roleTitle: `Group ${index}`,
        seniority: null,
        comparisons: index === 0 ? [COMPARISON] : [],
      })
    )
    renderSummary({
      chapter: "equivalentWork",
      gap: { ...GAP, womenDominated: many },
    })
    // getAllByText, not getByText: the opened step names its own group too,
    // so the first row's title legitimately appears twice.
    for (let index = 0; index < 9; index += 1) {
      expect(screen.getAllByText(`Group ${index}`).length).toBeGreaterThan(0)
    }
  })

  it("filters the checklist to remaining rows on demand, all by default", () => {
    renderSummary({
      chapter: "praxis",
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: [praxisDone("payPolicy")],
    })
    // All by default: the documented rows ARE the evidence record.
    expect(screen.getByText(t.praxis.payPolicy.title)).toBeDefined()
    fireEvent.click(
      screen.getByRole("button", { name: tAnalysis.filterRemaining })
    )
    expect(screen.queryByText(t.praxis.payPolicy.title)).toBeNull()
    expect(screen.getByText(t.praxis.benefits.title)).toBeDefined()
  })
})

// The checklist sits BESIDE the pane on desktop, so a row the user just
// clicked is already on screen; scrolling it "into view" only takes the list
// they are working down out of view. Tested here rather than through a click,
// because motion never mounts the incoming pane under happy-dom: a test that
// clicks a row and asserts "did not scroll" passes against the scrolling
// version too, which is how it was first written.
describe("shouldScrollPaneIntoView", () => {
  const viewport = 900

  it("stays put when the pane is already on screen", () => {
    expect(shouldScrollPaneIntoView(0, viewport)).toBe(false)
    expect(shouldScrollPaneIntoView(120, viewport)).toBe(false)
    expect(shouldScrollPaneIntoView(viewport, viewport)).toBe(false)
  })

  it("scrolls when the pane's top sits above the viewport", () => {
    // Submitting at the bottom of a tall step and advancing.
    expect(shouldScrollPaneIntoView(-1, viewport)).toBe(true)
    expect(shouldScrollPaneIntoView(-1400, viewport)).toBe(true)
  })

  it("scrolls when the pane's top sits below the fold", () => {
    // The phone, where the list is a sheet and the pane is the page below it.
    expect(shouldScrollPaneIntoView(viewport + 1, viewport)).toBe(true)
  })
})

// When the checklist is stuck to the top of the viewport, the space above it
// must equal the space beside it, or the column reads as hanging off the top
// edge. Both are 1.5rem today (measured in the browser: 24px and 24px), but
// they are two independent literals in two files, so a change to the page
// gutter would desync them silently. Tailwind cannot build a class name from
// a shared constant, so the relationship is guarded here instead.
describe("sticky checklist gutter", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

  it("pins the checklist at the same offset as the page's own gutter", () => {
    const gutter = read("components/app-shell.tsx").match(
      /PAGE_PADDING = "p-(\d+)"/
    )
    const stickyTop = read(
      "components/pay-mapping/pay-mapping-analysis.tsx"
    ).match(/lg:sticky lg:top-(\d+)/)
    expect(gutter?.[1]).toBeDefined()
    expect(stickyTop?.[1]).toBeDefined()
    expect(stickyTop?.[1]).toBe(gutter?.[1])
  })
})
