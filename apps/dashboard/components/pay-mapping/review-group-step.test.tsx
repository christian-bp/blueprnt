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

vi.mock("sonner", () => ({
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
import { toast } from "sonner"
import { formatMoney } from "@/lib/currency"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingSnapshotRow,
  WomenDominatedGroupWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { ReviewGroupStep } from "@/components/pay-mapping/review-group-step"
import { mockMutation } from "@/test/convex-mocks"

const upsertMock = mockMutation("payMapping.analyses.upsertGroupAnalysis")

const t = messages.dashboard.payMapping.review
const tForm = messages.dashboard.payMapping.analysisForm
const tReasons = messages.dashboard.payMapping.reasons
const tToast = messages.dashboard.toast
const tGap = messages.dashboard.payMapping.gap

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

const GROUP_LESS: GapGroup = {
  key: "swe|3|senior",
  roleTitle: "SWE",
  level: "Senior",
  band: 3,
  womenCount: 2,
  menCount: 3,
  womenMeanComp: 90_000,
  menMeanComp: 100_000,
  gapPct: 10,
  flag: "critical",
}

const GROUP_MORE: GapGroup = {
  ...GROUP_LESS,
  key: "swe|2|mid",
  band: 2,
  womenCount: 1,
  menCount: 4,
  gapPct: -8,
  flag: "elevated",
}

const GROUP_NONE: GapGroup = {
  ...GROUP_LESS,
  key: "swe|1|junior",
  band: 1,
  womenCount: 3,
  menCount: 3,
  womenMeanComp: 100_000,
  menMeanComp: 100_000,
  gapPct: 0,
  flag: "ok",
}

const GROUP_ONLY_WOMEN: GapGroup = {
  key: "nurse|3|senior",
  roleTitle: "Nurse",
  level: "Senior",
  band: null,
  womenCount: 4,
  menCount: 0,
  womenMeanComp: 80_000,
  menMeanComp: null,
  gapPct: null,
  flag: "insufficient",
}

const GROUP_ONLY_MEN: GapGroup = {
  key: "welder|2|mid",
  roleTitle: "Welder",
  level: "Mid",
  band: 2,
  womenCount: 0,
  menCount: 5,
  womenMeanComp: null,
  menMeanComp: 95_000,
  gapPct: null,
  flag: "insufficient",
}

const WD_GROUP_ONE: WomenDominatedGroupWire = {
  key: "nurse|3|senior",
  roleTitle: "Nurse",
  level: "Senior",
  band: 3,
  headcount: 5,
  womenSharePct: 80,
  meanComp: 40_000,
  comparisons: [
    {
      key: "tech|2|mid",
      roleTitle: "Technician",
      level: "Mid",
      band: 2,
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
      level: "Junior",
      band: 2,
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
    it("renders the title heading with the flag, level, and band badges beside it", () => {
      renderEqualWorkStep(GROUP_LESS)
      expect(screen.getByRole("heading", { name: "SWE" })).toBeDefined()
      expect(screen.getByText("Senior")).toBeDefined()
      expect(screen.getByText(tGap.flag.critical)).toBeDefined()
      expect(
        screen.getByText(tGap.bandLabel.replace("{band}", "3"))
      ).toBeDefined()
    })

    it("omits the band badge when the group has no band", () => {
      renderEqualWorkStep(GROUP_ONLY_WOMEN)
      expect(screen.queryByText(/^Band /)).toBeNull()
    })
  })

  describe("equal-work finding sentence", () => {
    it("renders the 'earn less' sentence when women earn less on average", () => {
      renderEqualWorkStep(GROUP_LESS)
      expect(
        screen.getByText(
          "The women in this group earn on average 10% less than the men (2 women · 3 men)."
        )
      ).toBeDefined()
    })

    it("renders the 'earn more' sentence when women earn more on average", () => {
      renderEqualWorkStep(GROUP_MORE)
      expect(
        screen.getByText(
          "The women in this group earn on average 8% more than the men (1 women · 4 men)."
        )
      ).toBeDefined()
    })

    it("renders the 'no measurable difference' sentence when the gap is zero", () => {
      renderEqualWorkStep(GROUP_NONE)
      expect(
        screen.getByText(
          "There is no measurable pay difference between the women and the men in this group (3 women · 3 men)."
        )
      ).toBeDefined()
    })

    it("renders the only-women sentence when the group has no men", () => {
      renderEqualWorkStep(GROUP_ONLY_WOMEN)
      expect(
        screen.getByText(
          "This group has only women (4 people), so there is no woman-man comparison to make. Explain why the group looks this way."
        )
      ).toBeDefined()
    })

    it("renders the only-men sentence (mirrored) when the group has no women", () => {
      renderEqualWorkStep(GROUP_ONLY_MEN)
      expect(
        screen.getByText(
          "This group has only men (5 people), so there is no woman-man comparison to make. Explain why the group looks this way."
        )
      ).toBeDefined()
    })
  })

  describe("MeanComparisonBars", () => {
    it("renders both bars for a mixed equal-work group with both means known", () => {
      const { container } = renderEqualWorkStep(GROUP_LESS)
      expect(
        container.querySelectorAll('[data-testid="mean-bar"]')
      ).toHaveLength(2)
    })

    it("renders no bars when a mean is null (only-women group)", () => {
      const { container } = renderEqualWorkStep(GROUP_ONLY_WOMEN)
      expect(
        container.querySelectorAll('[data-testid="mean-bar"]')
      ).toHaveLength(0)
    })

    it("renders no bars for an equivalentWork (women-dominated) group", () => {
      const { container } = renderWdStep(WD_GROUP_ONE)
      expect(
        container.querySelectorAll('[data-testid="mean-bar"]')
      ).toHaveLength(0)
    })
  })

  describe("women-dominated finding sentence", () => {
    it("renders the lead sentence with the group's label and women share", () => {
      renderWdStep(WD_GROUP_ONE)
      expect(
        screen.getByText("Nurse · Senior is women-dominated (80% women).")
      ).toBeDefined()
    })

    it("renders the band badge (always present) but no flag badge", () => {
      renderWdStep(WD_GROUP_ONE)
      expect(
        screen.getByText(tGap.bandLabel.replace("{band}", "3"))
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

    it("renders the singular comparisons sentence and one comparator line", () => {
      renderWdStep(WD_GROUP_ONE)
      expect(
        screen.getByText(
          "One equally or lower valued job earns more on average."
        )
      ).toBeDefined()
      expect(
        screen.getByText(
          `Technician · Mid (band 2) earns ${sek(4_000)} more per month on average.`
        )
      ).toBeDefined()
    })

    it("renders the plural comparisons sentence and every comparator line", () => {
      renderWdStep(WD_GROUP_TWO)
      expect(
        screen.getByText("2 equally or lower valued jobs earn more on average.")
      ).toBeDefined()
      expect(
        screen.getByText(
          `Technician · Mid (band 2) earns ${sek(4_000)} more per month on average.`
        )
      ).toBeDefined()
      expect(
        screen.getByText(
          `Engineer · Junior (band 2) earns ${sek(6_000)} more per month on average.`
        )
      ).toBeDefined()
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
