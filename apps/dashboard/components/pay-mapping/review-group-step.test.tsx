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
import { toast } from "@/lib/toast"
import { formatMoney } from "@/lib/currency"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingSnapshotRow,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { ReviewGroupStep } from "@/components/pay-mapping/review-group-step"
import { mockMutation } from "@/test/convex-mocks"
import { makeGapGroup } from "@/test/pay-mapping-fixtures"

const upsertMock = mockMutation("payMapping.analyses.upsertGroupAnalysis")

const t = messages.dashboard.payMapping.review
const tForm = messages.dashboard.payMapping.analysisForm
const tReasons = messages.dashboard.payMapping.reasons
const tToast = messages.dashboard.toast
const tGap = messages.dashboard.payMapping.gap
const m = messages.dashboard.payMapping

const RUN_ID = "run-1" as Id<"payMappingRuns">
const ROWS: PayMappingSnapshotRow[] = []

// Intl.NumberFormat inserts a non-breaking space between the currency code
// and the amount for "en" + "SEK"; Testing Library's default text
// normalizer collapses that (and any other whitespace run) to a single
// regular space, so the expected string needs the same collapse to compare
// equal (mirrors mean-comparison-bars.test.tsx's own moneyText helper).
function sek(value: number) {
  return formatMoney(value, "SEK", "en").replace(/\s+/g, " ")
}

const GROUP_LESS: GapGroup = makeGapGroup({
  key: "swe|3|senior",
  roleTitle: "SWE",
  seniority: "Senior",
  level: 3,
  womenCount: 2,
  menCount: 3,
  flag: "critical",
})

// Admitted on the total-comp gap alone (ADR-0015): base salaries are level,
// the men's bonuses open a 10% tcc gap.
const GROUP_TCC_DRIVEN: GapGroup = makeGapGroup({
  key: "sales|2|mid",
  roleTitle: "Sales",
  seniority: "Mid",
  level: 2,
  womenCount: 2,
  menCount: 3,
  base: { womenMean: 100_000, menMean: 100_000, gapPct: 0, gapKr: 0 },
  tcc: { womenMean: 90_000, menMean: 100_000, gapPct: 10, gapKr: 10_000 },
  tccDriven: true,
  flag: "elevated",
})

const GROUP_NONE: GapGroup = makeGapGroup({
  key: "swe|1|junior",
  roleTitle: "SWE",
  seniority: "Junior",
  level: 1,
  womenCount: 3,
  menCount: 3,
  metric: { womenMean: 100_000, menMean: 100_000, gapPct: 0, gapKr: 0 },
  flag: "ok",
})

// A shown group whose role never resolved a level (level is null in the
// grouping key): the heading must simply omit the level badge.
const GROUP_NO_LEVEL: GapGroup = makeGapGroup({
  key: "nurse|none|senior",
  roleTitle: "Nurse",
  seniority: "Senior",
  level: null,
  womenCount: 4,
  menCount: 2,
})

// A defensively masked group (all metric fields null): the component's
// null-guards must render no bars rather than crash.
const GROUP_MASKED: GapGroup = makeGapGroup({
  key: "welder|2|mid",
  roleTitle: "Welder",
  seniority: "Mid",
  level: 2,
  womenCount: 0,
  menCount: 5,
  metric: { womenMean: null, menMean: null, gapPct: null, gapKr: null },
  flag: "insufficient",
})

const WD_GROUP_ONE: WomenDominatedGroupWire = {
  key: "nurse|3|senior",
  roleTitle: "Nurse",
  seniority: "Senior",
  level: 3,
  headcount: 5,
  womenSharePct: 80,
  meanComp: 40_000,
  comparisons: [
    {
      key: "tech|2|mid",
      roleTitle: "Technician",
      seniority: "Mid",
      level: 2,
      headcount: 3,
      womenSharePct: 25,
      meanComp: 44_000,
      diffPct: 10,
      diffSek: 4_000,
    },
  ],
}

const WD_GROUP_TWO: WomenDominatedGroupWire = {
  ...WD_GROUP_ONE,
  comparisons: [
    ...WD_GROUP_ONE.comparisons,
    {
      key: "eng|2|junior",
      roleTitle: "Engineer",
      seniority: "Junior",
      level: 2,
      headcount: 2,
      womenSharePct: 30,
      meanComp: 46_000,
      diffPct: 15,
      diffSek: 6_000,
    },
  ],
}

type StepOverrides = Partial<{
  analysis: GroupAnalysis | undefined
  locked: boolean
  requiresDocumentation: boolean
  animated: boolean
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
}>

function renderEqualWorkStep(group: GapGroup, overrides: StepOverrides = {}) {
  const onNext = overrides.onNext ?? vi.fn()
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewGroupStep
        scope="equalWork"
        group={group}
        analysis={overrides.analysis}
        runId={RUN_ID}
        locked={overrides.locked ?? false}
        rows={ROWS}
        currency="SEK"
        referenceDateMs={Date.UTC(2026, 6, 1)}
        actions={[]}
        notes={[]}
        requiresDocumentation={overrides.requiresDocumentation ?? true}
        animated={overrides.animated ?? true}
        onNext={onNext}
        onPrevious={overrides.onPrevious}
        onSkip={overrides.onSkip}
      />
    </NextIntlClientProvider>
  )
  return { onNext, container }
}

function renderWdStep(
  group: WomenDominatedGroupWire,
  overrides: StepOverrides = {}
) {
  const onNext = overrides.onNext ?? vi.fn()
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewGroupStep
        scope="equivalentWork"
        group={group}
        equivalentWork={[]}
        analysis={overrides.analysis}
        runId={RUN_ID}
        locked={overrides.locked ?? false}
        rows={ROWS}
        currency="SEK"
        referenceDateMs={Date.UTC(2026, 6, 1)}
        actions={[]}
        notes={[]}
        requiresDocumentation={overrides.requiresDocumentation ?? true}
        animated={overrides.animated ?? true}
        onNext={onNext}
        onPrevious={overrides.onPrevious}
        onSkip={overrides.onSkip}
      />
    </NextIntlClientProvider>
  )
  return { onNext, container }
}

describe("ReviewGroupStep", () => {
  beforeEach(() => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe("equal-work heading", () => {
    it("renders the title heading with the flag, seniority, and level badges beside it", () => {
      renderEqualWorkStep(GROUP_LESS)
      expect(screen.getByRole("heading", { name: "SWE" })).toBeDefined()
      expect(screen.getByText("Senior")).toBeDefined()
      expect(screen.getByText(tGap.flag.critical)).toBeDefined()
      expect(
        screen.getByText(tGap.levelLabel.replace("{level}", "3"))
      ).toBeDefined()
    })

    it("omits the level badge when the group has no level", () => {
      renderEqualWorkStep(GROUP_NO_LEVEL)
      expect(screen.queryByText(/^Level /)).toBeNull()
    })
  })

  describe("equal-work finding", () => {
    it("states a measurable gap in badges, not in a sentence", () => {
      // The badges below carry the figures, next to the plot showing the
      // same gap. A sentence restating them put one percentage on screen
      // four times.
      renderEqualWorkStep(GROUP_LESS)
      expect(screen.queryByText(/earn on average/)).toBeNull()
      expect(screen.getByText(`-${sek(10_000)}`)).toBeDefined()
    })

    it("renders the 'no measurable difference' sentence when the gap is zero", () => {
      renderEqualWorkStep(GROUP_NONE)
      expect(
        screen.getByText(
          "There is no measurable pay difference between the women and the men in this group (3 women · 3 men)."
        )
      ).toBeDefined()
    })

    it("badges the second measure only when it changes the picture", () => {
      // Admitted on a 4% base gap (elevated), but the 20% tcc gap is what
      // makes the group critical: the sentence must name the metric behind
      // the flag, or the red badge sits next to a sentence about 4%.
      renderEqualWorkStep(
        makeGapGroup({
          key: "ops|2|mid",
          roleTitle: "Ops",
          seniority: "Mid",
          level: 2,
          womenCount: 2,
          menCount: 3,
          base: {
            womenMean: 96_000,
            menMean: 100_000,
            gapPct: 4,
            gapKr: 4_000,
          },
          tcc: {
            womenMean: 80_000,
            menMean: 100_000,
            gapPct: 20,
            gapKr: 20_000,
          },
          tccDriven: false,
          flag: "critical",
        })
      )
      expect(
        // The base gap is 4% (elevated) but total comp is 20% (critical),
        // so the second measure earns its badge: it is the one behind the
        // red flag.
        screen.getByText("Total comp")
      ).toBeDefined()
    })
  })

  describe("EqualWorkDetail composition", () => {
    it("badges each series' headcount and mean, plus the gap", () => {
      renderEqualWorkStep(GROUP_LESS)
      // Each series names itself, counts itself and states its mean, so no
      // number stands alone waiting to be interpreted.
      expect(screen.getByText("Women")).toBeDefined()
      expect(screen.getByText("Men")).toBeDefined()
      expect(screen.getByText(sek(90_000))).toBeDefined()
      expect(screen.getByText(sek(100_000))).toBeDefined()
      expect(screen.getByText(`-${sek(10_000)}`)).toBeDefined()
      expect(screen.getByText(m.dotPlot.title)).toBeDefined()
      expect(screen.getByText(m.gap.groupMembers)).toBeDefined()
    })

    it("badges a second measure that tells a different story", () => {
      // Total comp is 10% apart while the base salaries are identical: the
      // difference is entirely in the variable pay, which is exactly what
      // the documenter needs to know. So this one earns its badge.
      renderEqualWorkStep(GROUP_TCC_DRIVEN)
      expect(screen.getByText(`-${sek(10_000)}`)).toBeDefined()
      expect(screen.getByText("Base")).toBeDefined()
    })

    it("leaves out a second measure that only restates the first", () => {
      // Both measures land on the same flag and the same direction, so the
      // second row would repeat one krona difference against a bigger
      // base. That is the noise the badges replace.
      renderEqualWorkStep(
        makeGapGroup({
          key: "same|2|mid",
          roleTitle: "Same",
          seniority: "Mid",
          level: 2,
          womenCount: 2,
          menCount: 3,
          base: {
            womenMean: 90_000,
            menMean: 100_000,
            gapKr: -10_000,
            gapPct: 10,
          },
          tcc: {
            womenMean: 95_000,
            menMean: 105_000,
            gapKr: -10_000,
            gapPct: 9.5,
          },
          flag: "critical",
        })
      )
      expect(screen.queryByText("Total comp")).toBeNull()
    })

    it("renders no summary lines when the means are null (defensively masked group)", () => {
      renderEqualWorkStep(GROUP_MASKED)
      expect(screen.queryByText(/Women's average/)).toBeNull()
      // The chrome still renders: no crash on an all-null metric.
      expect(screen.getByText(m.dotPlot.title)).toBeDefined()
    })

    it("renders no detail view for an equivalentWork (women-dominated) group", () => {
      renderWdStep(WD_GROUP_ONE)
      expect(screen.queryByText(m.dotPlot.title)).toBeNull()
    })
  })

  describe("women-dominated finding sentence", () => {
    it("badges the women's share instead of stating it in a sentence", () => {
      // The share is what admitted the group to this chapter, so it stays;
      // the sentence around it restated the heading and the table below.
      renderWdStep(WD_GROUP_ONE)
      expect(screen.getByText("80% women")).toBeDefined()
      expect(screen.queryByText(/is women-dominated/)).toBeNull()
    })

    it("renders the level badge (always present) but no flag badge", () => {
      renderWdStep(WD_GROUP_ONE)
      expect(
        screen.getByText(tGap.levelLabel.replace("{level}", "3"))
      ).toBeDefined()
      for (const flag of [
        "critical",
        "elevated",
        "ok",
        "insufficient",
      ] as const) {
        expect(screen.queryByText(tGap.flag[flag])).toBeNull()
      }
    })

    it("tables one comparator with a column per fact", () => {
      renderWdStep(WD_GROUP_ONE)
      // A row per comparator, not a sentence per comparator: at 16 of them
      // the same clause repeated sixteen times is unreadable, and the
      // figures never line up to be compared.
      const table = screen.getByRole("table")
      expect(within(table).getAllByRole("row")).toHaveLength(2)
      expect(within(table).getByText("Technician · Mid")).toBeDefined()
      expect(within(table).getByText(`+${sek(4_000)}`)).toBeDefined()
    })

    it("tables every comparator, in the order the engine produced", () => {
      renderWdStep(WD_GROUP_TWO)
      const table = screen.getByRole("table")
      const rows = within(table).getAllByRole("row").slice(1)
      expect(rows).toHaveLength(2)
      // The order IS the finding, so it must survive untouched: the engine
      // puts the largest difference first within a level.
      expect(rows[0]?.textContent).toContain("Technician · Mid")
      expect(rows[1]?.textContent).toContain("Engineer · Junior")
    })

    it("names every column so no figure needs interpreting", () => {
      renderWdStep(WD_GROUP_TWO)
      const table = screen.getByRole("table")
      // The column headers only: `comparators` also holds the reason
      // column's own label and the row-select hint, neither of which is a
      // heading.
      const headers = [
        m.detail.comparators.level,
        m.detail.comparators.work,
        m.detail.comparators.count,
        m.detail.comparators.womenShare,
        m.detail.comparators.mean,
        m.detail.comparators.diffPct,
        m.detail.comparators.diffSek,
      ]
      for (const header of headers) {
        expect(within(table).getByText(header)).toBeDefined()
      }
    })
  })

  describe("primary action gating", () => {
    it("disables the primary action and shows the pending hint until documented, then enables it", async () => {
      renderEqualWorkStep(GROUP_LESS)
      const primary = screen.getByRole("button", {
        name: t.markDoneNext,
      }) as HTMLButtonElement
      expect(primary.disabled).toBe(true)

      fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })

      expect(primary.disabled).toBe(false)
    })

    it("never disables the primary action when documentation is not required", () => {
      renderEqualWorkStep(GROUP_NONE, { requiresDocumentation: false })
      const primary = screen.getByRole("button", {
        name: t.markDoneNext,
      }) as HTMLButtonElement
      expect(primary.disabled).toBe(false)
    })
  })

  describe("mark done", () => {
    it("upserts done:true with the form's current reasons/note (no finding field), toasts, and calls onNext", async () => {
      const { onNext } = renderEqualWorkStep(GROUP_LESS)
      fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })

      fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(2)
      })
      expect(upsertMock).toHaveBeenLastCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: GROUP_LESS.key,
        reasons: ["experience"],
        done: true,
      })
      // Marking done is a wizard step, not a CRUD surface: the advance
      // itself is the feedback, so no toast fires.
      expect(toast.success).not.toHaveBeenCalled()
      await waitFor(() => {
        expect(onNext).toHaveBeenCalledTimes(1)
      })
    })

    it("flushes the embedded form's pending note-debounce timer on mark-done, so the done upsert is the only call and it carries the latest note", async () => {
      vi.useFakeTimers()
      renderEqualWorkStep(GROUP_LESS)
      const note = screen.getByLabelText(tForm.noteTitle)
      fireEvent.change(note, { target: { value: "Explained by market rate." } })
      // Documented via the note alone; the embedded form's own 800ms
      // note-debounce save is now scheduled, not yet fired.

      fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))
      await vi.waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenLastCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: GROUP_LESS.key,
        reasons: [],
        note: "Explained by market rate.",
        done: true,
      })

      vi.advanceTimersByTime(800)
      // No second, redundant call: handleMarkDone flushed the form's own
      // pending timer (via flushPendingNoteSave) before making its own
      // upsert, so the form's debounce never fires on its own.
      expect(upsertMock).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it("carries scope equivalentWork and the group's own key, still with no finding field", async () => {
      const { onNext } = renderWdStep(WD_GROUP_ONE)
      fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })

      fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(2)
      })
      expect(upsertMock).toHaveBeenLastCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equivalentWork",
        groupKey: WD_GROUP_ONE.key,
        reasons: ["experience"],
        done: true,
      })
      await waitFor(() => {
        expect(onNext).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("undo (Ångra klarmarkering)", () => {
    it("shows the undo button when done, and undoing sends done:false with the current reasons/note without calling onNext", async () => {
      const { onNext } = renderEqualWorkStep(GROUP_LESS, {
        analysis: {
          scope: "equalWork",
          groupKey: GROUP_LESS.key,
          reasons: ["experience"],
          note: "Documented already.",
          done: true,
          finding: null,
        },
      })

      fireEvent.click(screen.getByRole("button", { name: t.undoDone }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: GROUP_LESS.key,
        reasons: ["experience"],
        note: "Documented already.",
        done: false,
      })
      expect(toast.success).toHaveBeenCalledWith(tToast.payMappingGroupReopened)
      expect(onNext).not.toHaveBeenCalled()
    })

    it("hides the undo button when not done", () => {
      renderEqualWorkStep(GROUP_LESS)
      expect(screen.queryByRole("button", { name: t.undoDone })).toBeNull()
    })
  })

  describe("reopen on edit (the adjudicated reopen pattern)", () => {
    it("toggling a chip on a done, requiring group reopens it: sends done:false and toasts reopened", async () => {
      renderEqualWorkStep(GROUP_LESS, {
        analysis: {
          scope: "equalWork",
          groupKey: GROUP_LESS.key,
          reasons: ["experience"],
          note: "",
          done: true,
          finding: null,
        },
      })

      fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: GROUP_LESS.key,
        reasons: [],
        done: false,
      })
      expect(toast.success).toHaveBeenCalledWith(tToast.payMappingGroupReopened)
      // Reopening drops the done state, so Undo no longer applies.
      expect(screen.queryByRole("button", { name: t.undoDone })).toBeNull()
    })

    it("the same chip toggle on an undone group sends done:false unchanged, with no toast", async () => {
      renderEqualWorkStep(GROUP_LESS, {
        analysis: {
          scope: "equalWork",
          groupKey: GROUP_LESS.key,
          reasons: ["experience"],
          note: "",
          done: false,
          finding: null,
        },
      })

      fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: GROUP_LESS.key,
        reasons: [],
        done: false,
      })
      expect(toast.success).not.toHaveBeenCalled()
    })

    it("emptying the note (with no reasons) on a done group reopens it", async () => {
      renderEqualWorkStep(GROUP_LESS, {
        analysis: {
          scope: "equalWork",
          groupKey: GROUP_LESS.key,
          reasons: [],
          note: "Some analysis.",
          done: true,
          finding: null,
        },
      })

      const note = screen.getByLabelText(tForm.noteTitle)
      fireEvent.change(note, { target: { value: "" } })
      fireEvent.blur(note)

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: GROUP_LESS.key,
        reasons: [],
        done: false,
      })
      expect(toast.success).toHaveBeenCalledWith(tToast.payMappingGroupReopened)
    })
  })

  describe("locked", () => {
    it("disables the form, the undo button, and the primary action, and shows the locked hint exactly once", () => {
      renderEqualWorkStep(GROUP_LESS, {
        locked: true,
        analysis: {
          scope: "equalWork",
          groupKey: GROUP_LESS.key,
          reasons: ["experience"],
          note: "Documented already.",
          done: true,
          finding: null,
        },
      })

      expect(screen.getAllByText(tForm.lockedHint)).toHaveLength(1)
      expect(
        (
          screen.getByRole("button", {
            name: tReasons.experience,
          }) as HTMLButtonElement
        ).disabled
      ).toBe(true)
      expect(
        (screen.getByLabelText(tForm.noteTitle) as HTMLTextAreaElement).disabled
      ).toBe(true)
      // A locked run cannot be un-marked, so the undo affordance is HIDDEN
      // (mirrors ReviewStepActions hiding Previous/Skip), never just
      // disabled.
      expect(screen.queryByRole("button", { name: t.undoDone })).toBeNull()
      expect(
        (
          screen.getByRole("button", {
            name: t.markDoneNext,
          }) as HTMLButtonElement
        ).disabled
      ).toBe(true)

      fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))
      expect(upsertMock).not.toHaveBeenCalled()
    })
  })

  it("hides Previous/Skip when their callbacks are undefined", () => {
    renderEqualWorkStep(GROUP_LESS)
    expect(screen.queryByRole("button", { name: t.previous })).toBeNull()
    expect(screen.queryByRole("button", { name: t.skip })).toBeNull()
  })

  it("renders a plain heading with the content immediately interactive when animated is false (the summary pane)", () => {
    renderEqualWorkStep(GROUP_LESS, { animated: false })
    const heading = screen.getByRole("heading", { name: "SWE" })
    expect(heading.querySelector(".sr-only")).toBeNull()
    expect(
      screen.getByRole("button", { name: tReasons.experience })
    ).toBeDefined()
  })
})
