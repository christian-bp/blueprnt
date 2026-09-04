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

// Admitted on the base-salary gap alone (ADR-0028): total comp is level,
// the women's commission covers a 10% base gap.
const GROUP_BASE_DRIVEN: GapGroup = makeGapGroup({
  key: "sales|2|mid",
  roleTitle: "Sales",
  seniority: "Mid",
  level: 2,
  womenCount: 2,
  menCount: 3,
  base: { womenMean: 90_000, menMean: 100_000, gapPct: 10, gapKr: 10_000 },
  tcc: { womenMean: 100_000, menMean: 100_000, gapPct: 0, gapKr: 0 },
  baseDriven: true,
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
  // The equivalent-work step's per-comparison documentation rows.
  comparisonAnalyses: GroupAnalysis[]
  rows: PayMappingSnapshotRow[]
  locked: boolean
  continuationShown: boolean
  requiresDocumentation: boolean
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
        continuationShown={overrides.continuationShown ?? false}
        rows={overrides.rows ?? ROWS}
        currency="SEK"
        referenceDateMs={Date.UTC(2026, 6, 1)}
        actions={[]}
        notes={[]}
        requiresDocumentation={overrides.requiresDocumentation ?? true}
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
        comparisonAnalyses={overrides.comparisonAnalyses ?? []}
        runId={RUN_ID}
        locked={overrides.locked ?? false}
        continuationShown={overrides.continuationShown ?? false}
        rows={overrides.rows ?? ROWS}
        currency="SEK"
        referenceDateMs={Date.UTC(2026, 6, 1)}
        actions={[]}
        notes={[]}
        requiresDocumentation={overrides.requiresDocumentation ?? true}
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
      // Admitted on a 4% total-comp gap, but the 20% base gap is what makes
      // the group critical: the figures must name the measure behind the
      // flag, or the red badge sits next to a 4%.
      renderEqualWorkStep(
        makeGapGroup({
          key: "ops|2|mid",
          roleTitle: "Ops",
          seniority: "Mid",
          level: 2,
          womenCount: 2,
          menCount: 3,
          base: {
            womenMean: 80_000,
            menMean: 100_000,
            gapPct: 20,
            gapKr: 20_000,
          },
          tcc: {
            womenMean: 96_000,
            menMean: 100_000,
            gapPct: 4,
            gapKr: 4_000,
          },
          baseDriven: false,
          flag: "critical",
        })
      )
      expect(
        // Total comp is 4% apart but base salary 20% (critical), so the
        // second measure earns its badge: it is the one behind the red
        // flag.
        screen.getByText("Base")
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
      expect(screen.getByText(m.scatter.titleEqualWork)).toBeDefined()
    })

    // The chart is what this step is FOR: the gap, and whether age or tenure
    // explains it. The roster is the detail behind that, so it sits under the
    // chart behind a disclosure. Open and above the chart was tried and pushed
    // the chart, and the form under it, down the screen on every group.
    it("leads with the chart and keeps the roster behind a disclosure", () => {
      renderEqualWorkStep(GROUP_LESS)
      const chart = screen.getByText(m.scatter.titleEqualWork)
      const disclosure = screen.getByText(m.gap.groupMembers)
      expect(
        chart.compareDocumentPosition(disclosure) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      // Closed: the table and its caption are not on screen until asked for.
      expect(screen.queryByRole("table")).toBeNull()
      expect(screen.queryByText(m.detail.diffCaption)).toBeNull()
    })

    it("badges a second measure that tells a different story", () => {
      // Base salary is 10% apart while total comp is level: the women's
      // variable pay covers a gap in the fixed pay, which is exactly what
      // the documenter needs to know. The group states its figures in base
      // salary (the measure it was admitted on), and total comp earns the
      // second badge.
      renderEqualWorkStep(GROUP_BASE_DRIVEN)
      expect(screen.getByText(`-${sek(10_000)}`)).toBeDefined()
      expect(screen.getByText("Total comp")).toBeDefined()
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
      expect(screen.getByText(m.scatter.titleEqualWork)).toBeDefined()
    })

    it("renders no detail view for an equivalentWork (women-dominated) group", () => {
      renderWdStep(WD_GROUP_ONE)
      expect(screen.queryByText(m.scatter.titleEqualWork)).toBeNull()
    })
  })

  describe("women-dominated roster", () => {
    // The group's own members, matching WD_GROUP_ONE's identity.
    const NURSES: PayMappingSnapshotRow[] = [
      {
        personPublicId: "n1",
        displayName: "Nadia Nurse",
        erased: false,
        gender: "Kvinna",
        roleTitle: "Nurse",
        trackKey: "IC",
        seniority: "Senior",
        level: 3,
        basicMonthly: 40_000,
        components: [],
        currency: "SEK",
        payYear: 2026,
      },
    ]

    // Per-person actions were reachable only under equal work, so a
    // documenter who found the person to act on in THIS chapter had to go and
    // look them up in the other. The roster mirrors equal work's: behind a
    // disclosure under the plot, with each person's documentation menu.
    it("keeps the group's own members behind a disclosure under the plot, with per-person documentation", () => {
      renderWdStep(WD_GROUP_ONE, { rows: NURSES })
      const chart = screen.getByText(m.scatter.titleEquivalentWork)
      const disclosure = screen.getByText(m.gap.groupMembers)
      expect(
        chart.compareDocumentPosition(disclosure) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      // Closed: the comparator table above is on screen, the roster is not.
      expect(screen.queryByText("Nadia Nurse")).toBeNull()

      fireEvent.click(disclosure)
      const table = screen.getByText("Nadia Nurse").closest("table")
      if (table === null) throw new Error("member row outside a table")
      expect(
        within(table).getByText(m.detail.columns.documentation)
      ).toBeDefined()
      // Compared with other groups, not within itself: no in-group
      // difference column here.
      expect(within(table).queryByText(m.detail.columns.diffVsMen)).toBeNull()
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
      // figures never line up to be compared. Three rows here: the header,
      // the group itself as the baseline, and the one comparator.
      const table = screen.getByRole("table")
      expect(within(table).getAllByRole("row")).toHaveLength(3)
      expect(within(table).getByText("Technician · Mid")).toBeDefined()
      expect(within(table).getByText(`+${sek(4_000)}`)).toBeDefined()
    })

    // The group being compared against leads the table, washed in brand and
    // with both difference cells empty, so "more than what" is on screen
    // rather than in the reader's head.
    it("leads with the group itself, with no difference of its own", () => {
      renderWdStep(WD_GROUP_ONE)
      const table = screen.getByRole("table")
      const first = within(table).getAllByRole("row")[1]
      expect(first?.textContent).toContain("Nurse")
      // Nothing is a difference from itself.
      expect(first?.textContent).not.toContain("+")
    })

    it("tables every comparator, in the order the engine produced", () => {
      renderWdStep(WD_GROUP_TWO)
      const table = screen.getByRole("table")
      // Past the header AND the baseline row.
      const rows = within(table).getAllByRole("row").slice(2)
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

    // Equivalent work documents each COMPARISON, so the chips answer for the
    // selected comparator row and the group's own upsert carries only the
    // klarmarkering. A group whose comparisons are all explained is what the
    // gate now lets through.
    it("marks the group done once its comparisons are explained, with no finding field", async () => {
      const explained = WD_GROUP_ONE.comparisons.map((comparison) => ({
        scope: "equivalentWork" as const,
        groupKey: WD_GROUP_ONE.key,
        comparisonKey: comparison.key,
        reasons: ["experience" as const],
        note: null,
        done: false,
        finding: null,
      }))
      const { onNext } = renderWdStep(WD_GROUP_ONE, {
        comparisonAnalyses: explained,
      })

      fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenLastCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equivalentWork",
        groupKey: WD_GROUP_ONE.key,
        reasons: [],
        done: true,
      })
      await waitFor(() => {
        expect(onNext).toHaveBeenCalledTimes(1)
      })
    })

    // The answer belongs where the finding is: with the panel at the page's
    // bottom the reader had to carry "which row was I answering for" past a
    // chart. Selecting a row opens it in place; selecting another moves it.
    it("opens the answer inside the selected row, and only there", async () => {
      renderWdStep(WD_GROUP_ONE, { comparisonAnalyses: [] })
      const t0 = messages.dashboard.payMapping.review
      expect(screen.queryByText(t0.comparisonNoteLabel)).toBeNull()

      const first = WD_GROUP_ONE.comparisons[0]
      expect(first).toBeDefined()
      if (first === undefined) return
      // The row's own select control, named for what selecting does. Several
      // buttons carry the job title (the plot's legend among them), so match
      // the control rather than the text.
      const selectRow = screen
        .getAllByRole("button")
        .find((button) =>
          (button.getAttribute("aria-label") ?? "").includes(
            first.roleTitle ?? ""
          )
        )
      expect(selectRow).toBeDefined()
      if (selectRow === undefined) return
      fireEvent.click(selectRow)
      // The note field is the panel's own, so its presence is the panel's.
      expect(screen.getAllByText(t0.comparisonNoteLabel)).toHaveLength(1)
    })

    // Equivalent work answers per comparison, so the group-level form would be
    // an empty box there. Equal work still owns its group form.
    it("renders no group documentation form for equivalent work", () => {
      renderWdStep(WD_GROUP_ONE, { comparisonAnalyses: [] })
      expect(
        screen.queryByText(messages.dashboard.payMapping.analysisForm.noteTitle)
      ).toBeNull()
    })

    // The gate is stated in words, not only by a disabled button.
    // A written assessment counts, exactly as it does for equal work: the
    // law asks for a bedömning of each difference, not for a chip from our
    // taxonomy. Without this the reader who wrote one per row saw every row
    // answered in the table and still could not close the group.
    it("counts a written assessment as an explanation", () => {
      renderWdStep(WD_GROUP_ONE, {
        comparisonAnalyses: WD_GROUP_ONE.comparisons.map((comparison) => ({
          scope: "equivalentWork" as const,
          groupKey: WD_GROUP_ONE.key,
          comparisonKey: comparison.key,
          reasons: [],
          note: "Marknadsläget, styrkt med två rekryteringar.",
          done: false,
          finding: null,
        })),
      })
      const primary = screen.getByRole("button", {
        name: t.markDoneNext,
      }) as HTMLButtonElement
      expect(primary.disabled).toBe(false)
    })

    it("blocks klarmarkering while a comparison has no explanation, and says how many", () => {
      renderWdStep(WD_GROUP_ONE, { comparisonAnalyses: [] })
      const primary = screen.getByRole("button", {
        name: t.markDoneNext,
      }) as HTMLButtonElement
      expect(primary.disabled).toBe(true)
      expect(
        screen.getByText(
          t.comparisonsMissing
            .replace("{missing}", String(WD_GROUP_ONE.comparisons.length))
            .replace("{total}", String(WD_GROUP_ONE.comparisons.length))
        )
      ).toBeDefined()
    })
  })

  describe("undo (Ångra klarmarkering)", () => {
    it("shows the undo button when done, and undoing sends done:false with the current reasons/note without calling onNext", async () => {
      const { onNext } = renderEqualWorkStep(GROUP_LESS, {
        analysis: {
          scope: "equalWork",
          groupKey: GROUP_LESS.key,
          comparisonKey: null,
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
          comparisonKey: null,
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
          comparisonKey: null,
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
          comparisonKey: null,
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
          comparisonKey: null,
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

  // One control per destination: the section itself links on to the next
  // chapter once this one is finished, so a step that is already done drops
  // its own primary rather than putting two ways forward on one screen.
  it("drops the primary action on a done step while the section shows the continuation", () => {
    renderEqualWorkStep(GROUP_LESS, {
      continuationShown: true,
      analysis: {
        scope: "equalWork",
        groupKey: GROUP_LESS.key,
        comparisonKey: null,
        reasons: ["experience"],
        note: "Documented already.",
        done: true,
        finding: null,
      },
    })
    expect(screen.queryByRole("button", { name: t.markDoneNext })).toBeNull()
  })

  // The chapter's progress counts only the groups that owe an explanation, so
  // a group with nothing to explain can sit open and unmarked while the
  // continuation is showing. Dropping its primary there left the step with no
  // control anywhere that could mark it done.
  it("keeps the primary action on an unmarked step even while the continuation shows", () => {
    renderEqualWorkStep(GROUP_LESS, {
      continuationShown: true,
      requiresDocumentation: false,
    })
    expect(screen.getByRole("button", { name: t.markDoneNext })).toBeDefined()
  })

  it("keeps the primary action while the section is not showing the continuation", () => {
    renderEqualWorkStep(GROUP_LESS, { continuationShown: false })
    expect(screen.getByRole("button", { name: t.markDoneNext })).toBeDefined()
  })

  it("renders a plain heading with the content immediately interactive", () => {
    renderEqualWorkStep(GROUP_LESS)
    const heading = screen.getByRole("heading", { name: "SWE" })
    expect(heading.querySelector(".sr-only")).toBeNull()
    expect(
      screen.getByRole("button", { name: tReasons.experience })
    ).toBeDefined()
  })
})
