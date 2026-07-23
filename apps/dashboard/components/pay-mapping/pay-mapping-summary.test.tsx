import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({
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

import { ConvexError } from "convex/values"
import { toast } from "sonner"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingGapResult,
  PayMappingRunDetail,
  WomenDominatedComparisonWire,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { PayMappingSummary } from "@/components/pay-mapping/pay-mapping-summary"
import { PayMappingRunProvider } from "@/components/pay-mapping/pay-mapping-run-context"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const upsertMock = mockMutation("payMapping.analyses.upsertGroupAnalysis")
const completeMock = mockMutation("payMapping.runs.completePayMappingRun")

const t = messages.dashboard.payMapping.review
const tForm = messages.dashboard.payMapping.analysisForm
const tDoc = messages.dashboard.payMapping.documentation
const tTabs = messages.dashboard.payMapping.tabs
const tGap = messages.dashboard.payMapping.gap
const tJourney = messages.dashboard.payMapping.journey
const tToast = messages.dashboard.toast
const tErrors = messages.errors

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

// SALES (critical) and SWE (elevated) both require documentation and sit in
// the queue; QA (ok flag) never does, checklist/finish only. WD-1 has a
// comparator (a required queue step); WD-2 has none (checklist-only, free
// klarmarkering). Flat checklist order (see pay-mapping-summary.tsx's own
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

const runsListState: { current: unknown[] } = { current: [] }

onQuery((ref) => {
  if (ref === "payMapping.runs.listPayMappingRuns") return runsListState.current
  return undefined
})

function renderSummary(
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
        <PayMappingSummary />
      </PayMappingRunProvider>
    </NextIntlClientProvider>
  )
}

// AnimatePresence mode="wait" defers mounting the incoming pane content
// until the outgoing side's own exit transition finishes, so the pane's
// content changes one render "tick" after the click; finishActionsNote only
// ever renders on the gate panel (the pane's null-selection landing state),
// making it a reliable "we are back on the gate panel" signal, whether that
// happened via the small-screen backToSummary control or an advance that
// found nothing left to open.
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

async function backToSummary() {
  fireEvent.click(screen.getByRole("button", { name: t.backToSummary }))
  await expectGatePanel()
}

afterEach(() => cleanup())

describe("PayMappingSummary", () => {
  beforeEach(() => {
    runsListState.current = []
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
          value={{ run: undefined, gap: undefined, analyses: undefined }}
        >
          <PayMappingSummary />
        </PayMappingRunProvider>
      </NextIntlClientProvider>
    )
    expect(screen.getByText(t.summaryTitle)).toBeDefined()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(t.collaborationTitle)).toBeNull()
  })

  it("shows the empty-currency text with no heading when the mapping has no salaries", () => {
    renderSummary({ gap: { ...GAP, currency: null } })
    expect(screen.getByText(tGap.empty)).toBeDefined()
    expect(screen.queryByText(t.summaryTitle)).toBeNull()
  })

  it("shows the continue item (label, brand count, review link) while steps remain on an active run", () => {
    renderSummary()
    // The item's accessible name is the full remaining-steps sentence
    // (aria-label); visually it carries the label and the bare count.
    const link = screen.getByRole("link", {
      name: "8 steps remain in the guided review.",
    })
    expect(link.getAttribute("href")).toBe("/pay-mappings/pay-2026/review")
    expect(link.textContent).toContain(t.continueWizard)
    expect(link.textContent).toContain("8")
  })

  it("hides the continue item once every actionable step is done", () => {
    renderSummary({
      run: { ...RUN, collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    expect(
      screen.queryByRole("link", { name: /remain in the guided review/ })
    ).toBeNull()
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

  it("lands on the first remaining step as the implicit default: card open, row current, no back control", async () => {
    renderSummary()
    // Start (collaboration) is the first undone row, so its card is already
    // open without any click.
    expect(await screen.findByText(t.introTitle)).toBeDefined()
    expect(screen.queryByText(t.finishActionsNote)).toBeNull()
    const row = checklistRowFor(t.collaborationTitle)
    expect(row?.getAttribute("aria-current")).toBe("true")
    // The landing is implicit: the small-screen back control only renders
    // for an explicit selection (the checklist must stay reachable).
    expect(screen.queryByRole("button", { name: t.backToSummary })).toBeNull()
    // And it never steals focus on page load.
    expect(document.activeElement).toBe(document.body)
  })

  it("renders the opened step's own heading as an h4 (the pane sits under the page's h2 and this summary's own h3)", async () => {
    renderSummary()
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

  it("selects the start row: opens the collaboration step, marks it aria-current, and returns via backToSummary", async () => {
    // A fixture where start is NOT the landing default (collaboration
    // filled), so the click below is a real transition.
    renderSummary({ run: { ...RUN, collaboration: COLLABORATION_FILLED } })
    const row = checklistRowFor(t.collaborationTitle)
    expect(row).toBeDefined()
    fireEvent.click(row as HTMLElement)
    expect(await screen.findByText(t.introTitle)).toBeDefined()
    expect(row?.getAttribute("aria-current")).toBe("true")

    await backToSummary()
    expect(checklistRowFor(t.collaborationTitle)).toBeDefined()
    expect(screen.queryByText(t.introTitle)).toBeNull()
  })

  it("selects a praxis row: opens it and marks it aria-current", async () => {
    renderSummary()
    const row = screen.getByText(t.praxis.payPolicy.title).closest("button")
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    expect(await screen.findByText(t.praxis.payPolicy.question)).toBeDefined()
    expect(row?.getAttribute("aria-current")).toBe("true")
  })

  it("selects a queue equal-work group row (requiring documentation)", async () => {
    renderSummary()
    fireEvent.click(screen.getByText("Sales · Mid"))
    expect(
      await screen.findByRole("button", { name: t.markDoneNext })
    ).toBeDefined()
  })

  it("selects a non-queue equal-work group with free klarmarkering (primary enabled without documentation)", async () => {
    renderSummary()
    fireEvent.click(screen.getByText("QA · Mid"))
    const primary = (await screen.findByRole("button", {
      name: t.markDoneNext,
    })) as HTMLButtonElement
    expect(primary.disabled).toBe(false)
  })

  it("selects a queue equivalent-work group row (with a comparator)", async () => {
    renderSummary()
    fireEvent.click(screen.getByText("Nurse · Senior"))
    expect(
      await screen.findByRole("button", { name: t.markDoneNext })
    ).toBeDefined()
  })

  it("selects a non-queue equivalent-work group with free klarmarkering (primary enabled without documentation)", async () => {
    renderSummary()
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

  it("moves focus onto the opened pane, and back onto the summary heading, on select/backToSummary", async () => {
    renderSummary()
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    const question = await screen.findByText(t.praxis.payPolicy.question)
    const paneContainer = question.closest('[tabindex="-1"]')
    expect(paneContainer).not.toBeNull()
    expect(document.activeElement).toBe(paneContainer)

    fireEvent.click(screen.getByRole("button", { name: t.backToSummary }))
    const heading = await screen.findByText(t.summaryTitle)
    expect(document.activeElement).toBe(heading)
  })

  it("renders the opened card read-only on a locked (completed) run", async () => {
    renderSummary({
      run: { ...RUN, status: "completed", collaboration: COLLABORATION_FILLED },
      analyses: ANALYSES_ALL_DONE,
    })
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    expect(await screen.findByText(tForm.lockedHint)).toBeDefined()
  })

  it("disables Complete with the remaining-count hint while the gate is unmet", async () => {
    renderSummary()
    // With steps remaining the landing default is a step card; reach the
    // gate panel the way a small screen does (explicit open, then back).
    fireEvent.click(screen.getByText(t.praxis.payPolicy.title))
    await screen.findByText(t.praxis.payPolicy.question)
    await backToSummary()
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

  it("shows the completed note and a link to the overview instead of the Complete action", () => {
    renderSummary({
      run: { ...RUN, status: "completed" },
      analyses: ANALYSES_ALL_DONE,
    })
    expect(screen.getByText(tDoc.completedNote)).toBeDefined()
    expect(screen.queryByRole("button", { name: tDoc.complete })).toBeNull()

    const link = screen.getByRole("link", { name: tTabs.overview })
    expect(link.getAttribute("href")).toBe("/pay-mappings/pay-2026")
  })

  it("lists every group as an icon + label row, with the state as sr-only text and no visible status", () => {
    renderSummary()
    for (const label of [
      "SWE · Senior",
      "Sales · Mid",
      "QA · Mid",
      "Nurse · Senior",
      "Receptionist · Junior",
    ]) {
      expect(checklistRowFor(label)).toBeDefined()
    }
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
    const search = screen.getByRole("textbox", { name: t.searchSteps })
    fireEvent.change(search, { target: { value: "sales" } })
    expect(checklistRowFor("Sales · Mid")).toBeDefined()
    expect(screen.queryByText("QA · Mid")).toBeNull()
    expect(screen.queryByText(t.praxis.payPolicy.title)).toBeNull()

    fireEvent.change(search, { target: { value: "" } })
    expect(screen.getByText("QA · Mid")).toBeDefined()
    expect(screen.getByText(t.praxis.payPolicy.title)).toBeDefined()
  })

  it("collapses and re-expands a chapter from its heading", () => {
    renderSummary()
    const trigger = chapterTrigger(t.chapters.praxis) as HTMLElement
    fireEvent.click(trigger)
    expect(screen.queryByText(t.praxis.payPolicy.title)).toBeNull()

    fireEvent.click(trigger)
    expect(screen.getByText(t.praxis.payPolicy.title)).toBeDefined()
  })
})
