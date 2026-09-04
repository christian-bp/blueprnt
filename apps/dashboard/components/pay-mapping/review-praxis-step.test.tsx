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
import { ConvexError } from "convex/values"
import { toast } from "@/lib/toast"
import type {
  GroupAnalysis,
  PayMappingActionWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { ReviewPraxisStep } from "@/components/pay-mapping/review-praxis-step"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const upsertMock = mockMutation("payMapping.analyses.upsertGroupAnalysis")

const t = messages.dashboard.payMapping.review
const tForm = messages.dashboard.payMapping.analysisForm
const tToast = messages.dashboard.toast
const tErrors = messages.errors

const RUN_ID = "run-1" as Id<"payMappingRuns">
const AREA = "payPolicy" as const

function renderStep(
  overrides: Partial<{
    analysis: GroupAnalysis | undefined
    actions: PayMappingActionWire[] | undefined
    locked: boolean
    continuationShown: boolean
    onNext: () => void
    onPrevious: () => void
    onSkip: () => void
  }> = {}
) {
  const onNext = overrides.onNext ?? vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewPraxisStep
        area={AREA}
        analysis={overrides.analysis}
        actions={"actions" in overrides ? overrides.actions : []}
        currency="SEK"
        runId={RUN_ID}
        locked={overrides.locked ?? false}
        continuationShown={overrides.continuationShown ?? false}
        onNext={onNext}
        onPrevious={overrides.onPrevious}
        onSkip={overrides.onSkip}
      />
    </NextIntlClientProvider>
  )
  return { onNext }
}

describe("ReviewPraxisStep", () => {
  beforeEach(() => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
    // The action dialog's owner select reads listActionOwners.
    onQuery(() => [])
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the area's title, question and helper, plus the two choices", () => {
    renderStep()
    const area = t.praxis.payPolicy
    expect(screen.getByText(area.title)).toBeDefined()
    expect(screen.getByText(area.question)).toBeDefined()
    expect(screen.getByText(area.helper)).toBeDefined()
    expect(screen.getByRole("button", { name: t.findingNone })).toBeDefined()
    expect(screen.getByRole("button", { name: t.findingFound })).toBeDefined()
  })

  // The note sits ABOVE the step's action row, and the vendored Textarea
  // auto-sizes on field-sizing-content, so without a fixed height the box
  // grows as the reader types and shrinks again on a step whose note is
  // empty, moving the primary button under the cursor either way.
  it("gives the note a fixed height so typing never moves the actions", () => {
    renderStep()
    const note = screen.getByLabelText(t.praxisNoteLabel)
    expect(note.className).toContain("field-sizing-fixed")
    expect(note.className).toMatch(/(^|\s)h-\d/)
  })

  it("gates the primary action until a choice is made", async () => {
    renderStep()
    const primary = screen.getByRole("button", {
      name: t.markDoneNext,
    }) as HTMLButtonElement
    expect(primary.disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: t.findingNone }))
    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    expect(primary.disabled).toBe(false)
  })

  it("requires a non-empty note when 'found' is chosen before enabling the primary action", async () => {
    renderStep()
    fireEvent.click(screen.getByRole("button", { name: t.findingFound }))
    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    const primary = screen.getByRole("button", {
      name: t.markDoneNext,
    }) as HTMLButtonElement
    expect(primary.disabled).toBe(true)

    const note = screen.getByLabelText(t.praxisNoteLabel)
    fireEvent.change(note, { target: { value: "Found a gap in benefits." } })

    expect(primary.disabled).toBe(false)
  })

  it("saves the choice immediately with the exact payload (reasons empty, current note/done carried through)", async () => {
    renderStep()
    fireEvent.click(screen.getByRole("button", { name: t.findingNone }))

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })
    expect(upsertMock).toHaveBeenCalledWith({
      orgId: "org-1",
      runId: RUN_ID,
      scope: "praxis",
      groupKey: AREA,
      reasons: [],
      done: false,
      finding: "none",
    })
  })

  it("reflects the active choice via aria-pressed, and marks the OTHER choice not pressed", async () => {
    renderStep()
    const noneButton = screen.getByRole("button", { name: t.findingNone })
    const foundButton = screen.getByRole("button", { name: t.findingFound })
    fireEvent.click(noneButton)

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })
    expect(noneButton.getAttribute("aria-pressed")).toBe("true")
    expect(foundButton.getAttribute("aria-pressed")).toBe("false")
  })

  it("upserts done: true carrying the finding and note, toasts, then fires onNext", async () => {
    const { onNext } = renderStep()
    fireEvent.click(screen.getByRole("button", { name: t.findingFound }))
    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    const note = screen.getByLabelText(t.praxisNoteLabel)
    fireEvent.change(note, { target: { value: "Found a gap in benefits." } })

    fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(2)
    })
    expect(upsertMock).toHaveBeenLastCalledWith({
      orgId: "org-1",
      runId: RUN_ID,
      scope: "praxis",
      groupKey: AREA,
      reasons: [],
      note: "Found a gap in benefits.",
      done: true,
      finding: "found",
    })
    // Marking done is a wizard step, not a CRUD surface: the advance itself
    // is the feedback, so no toast fires.
    expect(toast.success).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  it("clears a pending note-debounce timer on mark-done, so no redundant trailing save fires", async () => {
    vi.useFakeTimers()
    renderStep()
    fireEvent.click(screen.getByRole("button", { name: t.findingFound }))
    await vi.waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    const note = screen.getByLabelText(t.praxisNoteLabel)
    fireEvent.change(note, { target: { value: "Found a gap in benefits." } })
    // The 800ms note-debounce save is now pending, not yet fired.

    fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))
    await vi.waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(2)
    })

    vi.advanceTimersByTime(800)
    // No third, redundant call: handleMarkDone cleared the pending timer.
    expect(upsertMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("shows Undo when already done, and undoing upserts done: false while keeping finding/note", async () => {
    const { onNext } = renderStep({
      analysis: {
        scope: "praxis",
        groupKey: AREA,
        comparisonKey: null,
        reasons: [],
        note: "Documented already.",
        done: true,
        finding: "found",
      },
    })

    const undo = screen.getByRole("button", { name: t.undoDone })
    fireEvent.click(undo)

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })
    expect(upsertMock).toHaveBeenCalledWith({
      orgId: "org-1",
      runId: RUN_ID,
      scope: "praxis",
      groupKey: AREA,
      reasons: [],
      note: "Documented already.",
      done: false,
      finding: "found",
    })
    expect(toast.success).toHaveBeenCalledWith(tToast.payMappingGroupReopened)
    expect(onNext).not.toHaveBeenCalled()
  })

  it("reopens a done step (sends done:false + toasts) when switching the finding", async () => {
    renderStep({
      analysis: {
        scope: "praxis",
        groupKey: AREA,
        comparisonKey: null,
        reasons: [],
        note: "Documented already.",
        done: true,
        finding: "found",
      },
    })

    fireEvent.click(screen.getByRole("button", { name: t.findingNone }))

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })
    expect(upsertMock).toHaveBeenCalledWith({
      orgId: "org-1",
      runId: RUN_ID,
      scope: "praxis",
      groupKey: AREA,
      reasons: [],
      note: "Documented already.",
      done: false,
      finding: "none",
    })
    expect(toast.success).toHaveBeenCalledWith(tToast.payMappingGroupReopened)
    // Reopening drops the done state, so Undo no longer applies.
    expect(screen.queryByRole("button", { name: t.undoDone })).toBeNull()
  })

  it("reopens a done 'found' step (sends done:false + toasts) when the note is cleared", async () => {
    renderStep({
      analysis: {
        scope: "praxis",
        groupKey: AREA,
        comparisonKey: null,
        reasons: [],
        note: "Documented already.",
        done: true,
        finding: "found",
      },
    })

    const note = screen.getByLabelText(t.praxisNoteLabel)
    fireEvent.change(note, { target: { value: "" } })
    fireEvent.blur(note)

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })
    expect(upsertMock).toHaveBeenCalledWith({
      orgId: "org-1",
      runId: RUN_ID,
      scope: "praxis",
      groupKey: AREA,
      reasons: [],
      done: false,
      finding: "found",
    })
    expect(toast.success).toHaveBeenCalledWith(tToast.payMappingGroupReopened)
  })

  it("keeps done:true (no reopen toast) when a done step's note is edited to another non-empty value", async () => {
    renderStep({
      analysis: {
        scope: "praxis",
        groupKey: AREA,
        comparisonKey: null,
        reasons: [],
        note: "Documented already.",
        done: true,
        finding: "found",
      },
    })

    const note = screen.getByLabelText(t.praxisNoteLabel)
    fireEvent.change(note, { target: { value: "Documented, updated." } })
    fireEvent.blur(note)

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })
    expect(upsertMock).toHaveBeenCalledWith({
      orgId: "org-1",
      runId: RUN_ID,
      scope: "praxis",
      groupKey: AREA,
      reasons: [],
      note: "Documented, updated.",
      done: true,
      finding: "found",
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("shows the documentation-required message as a belt-and-braces fallback when the done upsert is rejected with that code", async () => {
    renderStep()
    fireEvent.click(screen.getByRole("button", { name: t.findingFound }))
    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    const note = screen.getByLabelText(t.praxisNoteLabel)
    fireEvent.change(note, { target: { value: "Found a gap in benefits." } })

    upsertMock.mockRejectedValueOnce(
      new ConvexError({ code: "errors.payMappingDocumentationRequired" })
    )
    fireEvent.click(screen.getByRole("button", { name: t.markDoneNext }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        tErrors.payMappingDocumentationRequired
      )
    })
  })

  it("disables everything and shows the locked hint when locked; no calls fire", () => {
    renderStep({
      locked: true,
      analysis: {
        scope: "praxis",
        groupKey: AREA,
        comparisonKey: null,
        reasons: [],
        note: "Documented already.",
        done: true,
        finding: "found",
      },
    })
    expect(screen.getByText(tForm.lockedHint)).toBeDefined()
    expect(
      (screen.getByRole("button", { name: t.findingNone }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole("button", {
          name: t.findingFound,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (screen.getByLabelText(t.praxisNoteLabel) as HTMLTextAreaElement).disabled
    ).toBe(true)
    // A locked run cannot be un-marked, so the undo affordance is HIDDEN
    // (mirrors ReviewStepActions hiding Previous/Skip), never just disabled.
    expect(screen.queryByRole("button", { name: t.undoDone })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: t.findingNone }))
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("hides Previous/Skip when their callbacks are undefined", () => {
    renderStep()
    expect(screen.queryByRole("button", { name: t.previous })).toBeNull()
    expect(screen.queryByRole("button", { name: t.skip })).toBeNull()
  })

  // One control per destination: the section itself links on to the next
  // chapter once this one is finished, so a step that is already done drops
  // its own primary rather than putting two ways forward on one screen. An
  // unmarked step keeps it, or the reader is left with no way to mark it.
  it("drops the primary action on a done step while the section shows the continuation", () => {
    renderStep({
      continuationShown: true,
      analysis: {
        scope: "praxis",
        groupKey: AREA,
        comparisonKey: null,
        reasons: [],
        note: "Documented already.",
        done: true,
        finding: "found",
      },
    })
    expect(screen.queryByRole("button", { name: t.markDoneNext })).toBeNull()
  })

  it("keeps the primary action on an unmarked step even while the continuation shows", () => {
    renderStep({ continuationShown: true })
    expect(screen.getByRole("button", { name: t.markDoneNext })).toBeDefined()
  })

  it("keeps the primary action while the section is not showing the continuation", () => {
    renderStep({ continuationShown: false })
    expect(screen.getByRole("button", { name: t.markDoneNext })).toBeDefined()
  })

  it("renders a plain heading with the content immediately interactive", () => {
    renderStep()
    const heading = screen.getByRole("heading", {
      name: t.praxis.payPolicy.question,
    })
    expect(heading.querySelector(".sr-only")).toBeNull()
    expect(screen.getByRole("button", { name: t.findingNone })).toBeDefined()
  })

  const found: GroupAnalysis = {
    scope: "praxis",
    groupKey: AREA,
    comparisonKey: null,
    reasons: [],
    note: "Criteria are unclear",
    done: false,
    finding: "found",
  }

  it("offers an action only when the area's finding is found", () => {
    renderStep({ analysis: { ...found, finding: "none" } })
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    ).toBeNull()
    cleanup()
    renderStep({ analysis: found })
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    ).toBeDefined()
  })

  // The actions query has not landed yet, so whether the area already has an
  // action is unknown: offering Create here would offer a duplicate.
  it("offers no action while the run's actions are still loading", () => {
    renderStep({ analysis: found, actions: undefined })
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    ).toBeNull()
  })

  it("opens the action dialog preset to the practice area", async () => {
    renderStep({ analysis: found })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    )
    expect(await screen.findByRole("dialog")).toBeDefined()
    expect(
      screen.getByText(
        messages.dashboard.payMapping.actions.linkedTo.replace(
          "{target}",
          t.praxis.payPolicy.title
        )
      )
    ).toBeDefined()
  })

  it("cites an existing praxis action and offers to edit it, never a second create", () => {
    renderStep({
      analysis: found,
      actions: [
        {
          actionId: "a3" as Id<"payMappingActions">,
          number: 3,
          target: { kind: "praxis", area: AREA },
          problem: "Managers read the policy differently",
          plannedAction: "Rewrite the pay policy",
          reason: null,
          ownerUserId: "u1",
          ownerName: "HR Person",
          plannedDate: Date.UTC(2026, 11, 1),
          estimatedCost: null,
          estimatedCostUnit: null,
          priority: "medium",
          status: "notStarted",
          erased: false,
          createdAt: 1,
        },
      ],
    })
    // The linked record as a panel, not a sentence: the number chip, the
    // planned measure, the owner/date meta and the follow-up status.
    expect(screen.getByText("#3")).toBeDefined()
    expect(screen.getByText("Rewrite the pay policy")).toBeDefined()
    expect(
      screen.getByText(
        t.praxisActionMeta
          .replace("{owner}", "HR Person")
          .replace("{date}", "Dec 1, 2026")
      )
    ).toBeDefined()
    expect(
      screen.getByText(messages.dashboard.payMapping.actions.status.notStarted)
    ).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.payMapping.actions.editTitle,
      })
    ).toBeDefined()
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    ).toBeNull()
  })

  it("hides the action button on a locked run", () => {
    renderStep({ analysis: found, locked: true })
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.payMapping.actions.createTitle,
      })
    ).toBeNull()
  })
})
