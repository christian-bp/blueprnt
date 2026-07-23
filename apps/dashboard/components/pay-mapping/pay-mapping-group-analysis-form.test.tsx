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
import type { PayGapReason } from "@workspace/constants"
import { toast } from "sonner"
import { ConvexError } from "convex/values"
import type { GroupAnalysis } from "@/components/pay-mapping/pay-mapping-gap-types"
import { PayMappingGroupAnalysisForm } from "@/components/pay-mapping/pay-mapping-group-analysis-form"
import { mockMutation } from "@/test/convex-mocks"

const upsertMock = mockMutation("payMapping.analyses.upsertGroupAnalysis")

const t = messages.dashboard.payMapping.analysisForm
const tReasons = messages.dashboard.payMapping.reasons
const tErrors = messages.errors

const RUN_ID = "run-1" as Id<"payMappingRuns">

function renderForm(
  overrides: Partial<{
    requiresDocumentation: boolean
    locked: boolean
    analysis: GroupAnalysis | undefined
    onDocumentationChange: (payload: {
      reasons: PayGapReason[]
      note: string
      documented: boolean
    }) => void
  }> = {}
) {
  const props = {
    runId: RUN_ID,
    scope: "equalWork" as const,
    groupKey: "Engineer|1|Senior",
    requiresDocumentation: overrides.requiresDocumentation ?? true,
    locked: overrides.locked ?? false,
    analysis: overrides.analysis,
    onDocumentationChange: overrides.onDocumentationChange,
  }
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingGroupAnalysisForm {...props} />
    </NextIntlClientProvider>
  )
}

describe("PayMappingGroupAnalysisForm", () => {
  beforeEach(() => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders all 7 reasons under their 3 group headings", () => {
    renderForm()
    expect(screen.getByText(tReasons.groups.market)).toBeDefined()
    expect(screen.getByText(tReasons.groups.individual)).toBeDefined()
    expect(screen.getByText(tReasons.groups.work)).toBeDefined()

    for (const key of [
      "alternativeLabourMarket",
      "recruitmentPayLevel",
      "experience",
      "historicalPay",
      "competence",
      "performance",
      "responsibility",
    ] as const) {
      expect(screen.getByRole("button", { name: tReasons[key] })).toBeDefined()
    }
  })

  it("fires the upsert with the toggled reasons array when a chip is clicked", async () => {
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })
    expect(upsertMock).toHaveBeenCalledWith({
      orgId: "org-1",
      runId: RUN_ID,
      scope: "equalWork",
      groupKey: "Engineer|1|Senior",
      reasons: ["experience"],
      done: false,
    })
    // Chip reflects the active state via aria-pressed.
    expect(
      screen
        .getByRole("button", { name: tReasons.experience })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })

  it("renders no switch (the done-toggle lives in the wizard's own group step)", () => {
    renderForm({ requiresDocumentation: true })
    expect(screen.queryByRole("switch")).toBeNull()
  })

  it("fires onDocumentationChange once on mount with the initial state, and again with documented flipping false -> true when a chip toggles", async () => {
    const onDocumentationChange = vi.fn()
    renderForm({ requiresDocumentation: true, onDocumentationChange })

    expect(onDocumentationChange).toHaveBeenCalledTimes(1)
    expect(onDocumentationChange).toHaveBeenCalledWith({
      reasons: [],
      note: "",
      documented: false,
    })

    fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    expect(onDocumentationChange).toHaveBeenLastCalledWith({
      reasons: ["experience"],
      note: "",
      documented: true,
    })
  })

  it("shows the documentation-required message as a belt-and-braces fallback when a toggle's upsert is rejected with that code", async () => {
    // The reopen logic below now proactively sends done:false whenever this
    // exact toggle (unchecking the last reason on a done, requiring group)
    // would otherwise violate the gate, so the backend no longer rejects
    // THIS specific case in the normal flow. This test still exercises the
    // generic catch/rollback path via a forced rejection (e.g. simulating a
    // concurrent edit from another tab), same as the form's own
    // isDocumentationRequiredError belt-and-braces doc comment describes.
    upsertMock.mockRejectedValue(
      new ConvexError({ code: "errors.payMappingDocumentationRequired" })
    )
    renderForm({
      analysis: {
        scope: "equalWork",
        groupKey: "Engineer|1|Senior",
        reasons: ["experience"],
        note: null,
        done: true,
        finding: null,
      },
    })

    fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        tErrors.payMappingDocumentationRequired
      )
    })
    // The optimistic toggle is rolled back on rejection.
    expect(
      screen
        .getByRole("button", { name: tReasons.experience })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })

  describe("the adjudicated reopen pattern", () => {
    function doneAnalysis(
      overrides: Partial<{ reasons: PayGapReason[]; note: string | null }> = {}
    ) {
      return {
        scope: "equalWork" as const,
        groupKey: "Engineer|1|Senior",
        reasons: overrides.reasons ?? ["experience"],
        note: overrides.note ?? null,
        done: true,
        finding: null,
      }
    }

    it("reopens (sends done:false, toasts) when toggling off the last reason empties the documentation", async () => {
      renderForm({ analysis: doneAnalysis({ reasons: ["experience"] }) })

      fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: "Engineer|1|Senior",
        reasons: [],
        done: false,
      })
      expect(toast.success).toHaveBeenCalledWith(
        messages.dashboard.toast.payMappingGroupReopened
      )
    })

    it("keeps done:true (no toast) when a toggle on a done group leaves another reason active", async () => {
      renderForm({
        analysis: doneAnalysis({ reasons: ["experience", "performance"] }),
      })

      fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: "Engineer|1|Senior",
        reasons: ["performance"],
        done: true,
      })
      expect(toast.success).not.toHaveBeenCalled()
    })

    it("sends done:false unchanged (no toast) when the same emptying toggle happens on an undone group", async () => {
      renderForm({
        analysis: {
          scope: "equalWork",
          groupKey: "Engineer|1|Senior",
          reasons: ["experience"],
          note: null,
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
        groupKey: "Engineer|1|Senior",
        reasons: [],
        done: false,
      })
      expect(toast.success).not.toHaveBeenCalled()
    })

    it("reopens when clearing the note empties the documentation (no reason active)", async () => {
      renderForm({
        analysis: doneAnalysis({ reasons: [], note: "Some analysis." }),
      })

      const note = screen.getByLabelText(t.noteTitle)
      fireEvent.change(note, { target: { value: "" } })
      fireEvent.blur(note)

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: "Engineer|1|Senior",
        reasons: [],
        done: false,
      })
      expect(toast.success).toHaveBeenCalledWith(
        messages.dashboard.toast.payMappingGroupReopened
      )
    })

    it("keeps done:true (no toast) when clearing the note but a reason is still active", async () => {
      renderForm({
        analysis: doneAnalysis({
          reasons: ["experience"],
          note: "Some analysis.",
        }),
      })

      const note = screen.getByLabelText(t.noteTitle)
      fireEvent.change(note, { target: { value: "" } })
      fireEvent.blur(note)

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: "Engineer|1|Senior",
        reasons: ["experience"],
        done: true,
      })
      expect(toast.success).not.toHaveBeenCalled()
    })

    it("keeps done:true (no toast) when the note changes to another non-empty value on a done group", async () => {
      renderForm({
        analysis: doneAnalysis({ reasons: [], note: "Old analysis." }),
      })

      const note = screen.getByLabelText(t.noteTitle)
      fireEvent.change(note, { target: { value: "New analysis." } })
      fireEvent.blur(note)

      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: "Engineer|1|Senior",
        reasons: [],
        note: "New analysis.",
        done: true,
      })
      expect(toast.success).not.toHaveBeenCalled()
    })

    it("never reopens when requiresDocumentation is false, even if the edit empties the documentation", async () => {
      renderForm({
        requiresDocumentation: false,
        analysis: doneAnalysis({ reasons: ["experience"] }),
      })

      fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
      await waitFor(() => {
        expect(upsertMock).toHaveBeenCalledTimes(1)
      })
      expect(upsertMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: RUN_ID,
        scope: "equalWork",
        groupKey: "Engineer|1|Senior",
        reasons: [],
        done: true,
      })
      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  it("falls back to the generic error toast for an unrecognized rejection", async () => {
    upsertMock.mockRejectedValue(new Error("network error"))
    renderForm()

    fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(messages.dashboard.toast.error)
    })
  })

  it("disables everything and shows the locked hint when locked", () => {
    renderForm({
      locked: true,
      analysis: {
        scope: "equalWork",
        groupKey: "Engineer|1|Senior",
        reasons: ["experience"],
        note: "Documented.",
        done: true,
        finding: null,
      },
    })
    expect(screen.getByText(t.lockedHint)).toBeDefined()
    expect(
      (
        screen.getByRole("button", {
          name: tReasons.experience,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      (screen.getByLabelText(t.noteTitle) as HTMLTextAreaElement).disabled
    ).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: tReasons.experience }))
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("does not save the note on every keystroke, only on blur", async () => {
    renderForm()
    const note = screen.getByLabelText(t.noteTitle)

    fireEvent.change(note, { target: { value: "Explained by market rate." } })
    expect(upsertMock).not.toHaveBeenCalled()

    fireEvent.blur(note)
    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })
    expect(upsertMock).toHaveBeenCalledWith({
      orgId: "org-1",
      runId: RUN_ID,
      scope: "equalWork",
      groupKey: "Engineer|1|Senior",
      reasons: [],
      note: "Explained by market rate.",
      done: false,
    })
  })

  it("saves once on blur; a second blur without further edits fires no second mutation", async () => {
    renderForm()
    const note = screen.getByLabelText(t.noteTitle) as HTMLTextAreaElement

    fireEvent.change(note, { target: { value: "Explained by market rate." } })
    fireEvent.blur(note)
    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.focus(note)
    fireEvent.blur(note)
    expect(upsertMock).toHaveBeenCalledTimes(1)
  })

  it("keeps the newer local text when a prop refresh lands while the textarea is focused mid-edit", () => {
    const baseAnalysis: GroupAnalysis = {
      scope: "equalWork",
      groupKey: "Engineer|1|Senior",
      reasons: [],
      note: "",
      done: false,
      finding: null,
    }
    const tree = (analysis: GroupAnalysis) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <PayMappingGroupAnalysisForm
          runId={RUN_ID}
          scope="equalWork"
          groupKey="Engineer|1|Senior"
          requiresDocumentation={true}
          locked={false}
          analysis={analysis}
        />
      </NextIntlClientProvider>
    )

    const { rerender } = render(tree(baseAnalysis))
    const note = screen.getByLabelText(t.noteTitle) as HTMLTextAreaElement

    note.focus()
    fireEvent.change(note, { target: { value: "Draft one" } })
    fireEvent.change(note, { target: { value: "Draft one continued" } })

    // The subscription echoes back an earlier snapshot of the note (e.g. the
    // debounce fired mid-typing) while the textarea is still focused and the
    // local text has since moved on: the resumed edit must survive.
    rerender(tree({ ...baseAnalysis, note: "Draft one" }))

    expect(note.value).toBe("Draft one continued")
  })
})
