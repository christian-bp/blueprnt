import {
  cleanup,
  render,
  screen,
  act,
  fireEvent,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "@/lib/toast"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { CriterionComplianceDialog } from "@/components/model/criterion-compliance-dialog"
import { mockAction, mockMutation } from "@/test/convex-mocks"

// The dialog's own two mutations and its one action, by the ref paths the
// component asks for. Saving a criterion is up to three calls now (the
// sign-off rides the same submit), so the ORDER they land in is part of what
// these tests assert.
const save = mockMutation("evaluationModel.method.saveCriterionCompliance")
const setApproval = mockMutation("evaluationModel.method.setCriterionApproval")
const draftMock = mockAction("ai.draft.draftCriterionCompliance")

// The library's full definition of the criterion, as the chapter's wire
// carries it: the dialog is where it is read, because the card that opens the
// dialog carries only the one-liner.
const DEFINITION =
  "Captures the reach of the role's responsibility and the consequences of its decisions."

const TARGET = {
  criterionId: "c1" as Id<"criteria">,
  name: "Scope",
  description: DEFINITION,
  purpose: "Measure scope of impact",
  whyRelevant: "Distinguishes seniority",
  overlapNotes: null,
  biasRisk: "low" as const,
  biasComment: "Gender-neutral wording",
  biasAction: null,
  status: "documented" as const,
  decidedByName: null,
  decidedAt: null,
}

const DOCUMENTED_TARGET = {
  criterionId: "c2" as Id<"criteria">,
  name: "Scope",
  description: DEFINITION,
  purpose: "Measure scope",
  whyRelevant: "Distinguishes seniority",
  overlapNotes: null,
  biasRisk: "medium" as const,
  biasComment: "Checked",
  biasAction: null,
  status: "documented" as const,
  decidedByName: null,
  decidedAt: null,
}

// Half a form: nothing the backend would accept an approval for.
const INCOMPLETE_TARGET = {
  criterionId: "c5" as Id<"criteria">,
  name: "Scope",
  description: DEFINITION,
  purpose: "Measure scope",
  whyRelevant: "",
  overlapNotes: null,
  biasRisk: null,
  biasComment: "",
  biasAction: null,
  status: "inProgress" as const,
  decidedByName: null,
  decidedAt: null,
}

const APPROVED_TARGET = {
  criterionId: "c3" as Id<"criteria">,
  name: "Scope",
  description: DEFINITION,
  purpose: "Measure scope",
  whyRelevant: "Distinguishes seniority",
  overlapNotes: null,
  biasRisk: "low" as const,
  biasComment: "Checked",
  biasAction: null,
  status: "approved" as const,
  decidedByName: "Alex",
  decidedAt: 1700000000000,
}

function renderDialog({
  target = TARGET as Parameters<typeof CriterionComplianceDialog>[0]["target"],
  onClose = vi.fn(),
} = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CriterionComplianceDialog
        orgId="org1"
        target={target}
        onClose={onClose}
      />
    </NextIntlClientProvider>
  )
}

const m = messages.dashboard.model.method

// The sign-off checkbox, named by its own label. Base UI renders it as a span
// carrying the role, so its state is read off aria rather than off the DOM
// properties an <input> would have.
const approveBox = () => screen.getByRole("checkbox", { name: m.approveLabel })
const saveButton = () =>
  screen.getByRole("button", { name: m.saveCta }) as HTMLButtonElement

describe("CriterionComplianceDialog", () => {
  beforeEach(() => {
    draftMock.mockReset()
    save.mockReset()
    save.mockResolvedValue(null)
    setApproval.mockReset()
    setApproval.mockResolvedValue(null)
  })

  afterEach(() => {
    cleanup()
  })

  it("seeds form fields with saved values when reopening a documented criterion", () => {
    // Start with dialog closed (target=null, the mounted state in the panel),
    // then open with a criterion that has saved values — this is the exact bug
    // scenario: useForm was initialized with empty defaults at mount time.
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CriterionComplianceDialog
          orgId="org1"
          target={null}
          onClose={vi.fn()}
        />
      </NextIntlClientProvider>
    )
    act(() => {
      rerender(
        <NextIntlClientProvider locale="en" messages={messages}>
          <CriterionComplianceDialog
            orgId="org1"
            target={DOCUMENTED_TARGET}
            onClose={vi.fn()}
          />
        </NextIntlClientProvider>
      )
    })
    // Textarea values should reflect the saved data, not the empty mount-time state
    expect(screen.getByDisplayValue("Measure scope")).toBeDefined()
    expect(screen.getByDisplayValue("Distinguishes seniority")).toBeDefined()
    expect(screen.getByDisplayValue("Checked")).toBeDefined()
    // The "medium" bias-risk toggle should be pressed
    const mediumBtn = screen.getByRole("button", { name: /medium/i })
    expect(mediumBtn.getAttribute("aria-pressed")).toBe("true")
  })

  it("renders the three bias-risk options as toggle buttons, not a combobox", () => {
    renderDialog()
    // Base UI ToggleGroup items render as toggle buttons (aria-pressed).
    const low = screen.getByRole("button", { name: /low/i })
    const medium = screen.getByRole("button", { name: /medium/i })
    const high = screen.getByRole("button", { name: /high/i })
    expect(low).toBeDefined()
    expect(medium).toBeDefined()
    expect(high).toBeDefined()
    // Must NOT be a combobox (Select)
    expect(screen.queryByRole("combobox")).toBeNull()
  })

  // Approving used to be a second act after saving, reachable only once the
  // documentation was already stored: finishing a criterion took two trips
  // through this dialog. The sign-off is a field of the form now, and the save
  // carries it.
  it("offers one way out, with the sign-off as a field of the form", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined()
    expect(saveButton()).toBeDefined()
    expect(approveBox()).toBeDefined()
    // No standalone approve or reopen control anywhere.
    expect(screen.queryByRole("button", { name: /^approve/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull()
  })

  // A standing sign-off locks the text (the backend refuses to write over
  // approved documentation), and clearing the box lifts the lock in place, so
  // a correction is one act rather than a separate reopen trip.
  it("opens an approved criterion signed off and locked, and unlocks in place", () => {
    renderDialog({ target: APPROVED_TARGET })
    expect(approveBox().getAttribute("aria-checked")).toBe("true")
    for (const field of screen.getAllByRole("textbox")) {
      expect((field as HTMLTextAreaElement).disabled).toBe(true)
    }
    fireEvent.click(approveBox())
    for (const field of screen.getAllByRole("textbox")) {
      expect((field as HTMLTextAreaElement).disabled).toBe(false)
    }
  })

  it("opens an unapproved criterion with the sign-off clear and its fields open", () => {
    renderDialog({ target: DOCUMENTED_TARGET })
    expect(approveBox().getAttribute("aria-checked")).toBe("false")
    for (const field of screen.getAllByRole("textbox")) {
      expect((field as HTMLTextAreaElement).disabled).toBe(false)
    }
  })

  // Nothing to post: a reader who opens a finished criterion and changes
  // nothing must not be able to write an audit row by pressing save.
  it("keeps the save shut until the text or the sign-off changes", () => {
    renderDialog({ target: DOCUMENTED_TARGET })
    expect(saveButton().disabled).toBe(true)
    fireEvent.click(approveBox())
    expect(saveButton().disabled).toBe(false)
  })

  // One act: the text lands first, then the sign-off, because the backend
  // refuses an approval its stored row does not yet support.
  it("saves the documentation and then approves it, in that order", async () => {
    renderDialog({ target: DOCUMENTED_TARGET })
    fireEvent.change(screen.getByDisplayValue("Measure scope"), {
      target: { value: "Measure the scope of impact" },
    })
    fireEvent.click(approveBox())
    fireEvent.click(saveButton())
    await waitFor(() => {
      expect(setApproval).toHaveBeenCalledWith({
        orgId: "org1",
        criterionId: "c2",
        approved: true,
        gestureId: expect.any(String),
      })
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(setApproval).toHaveBeenCalledTimes(1)
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(
      setApproval.mock.invocationCallOrder[0] as number
    )
  })

  // The full three-call branch, which is the one worth pinning: a signed-off
  // criterion corrected and signed off again in a single act. The order is the
  // backend's own requirement (it refuses a write while approved, and refuses
  // an approval its stored row does not yet support), so it is asserted rather
  // than assumed.
  it("un-approves, saves, then re-approves when an approved criterion is corrected", async () => {
    renderDialog({ target: APPROVED_TARGET })
    fireEvent.click(approveBox())
    fireEvent.change(screen.getByDisplayValue("Measure scope"), {
      target: { value: "Measure the scope of impact" },
    })
    fireEvent.click(approveBox())
    fireEvent.click(saveButton())
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1)
    })
    expect(
      setApproval.mock.calls.map(([args]) => ({
        orgId: args.orgId,
        criterionId: args.criterionId,
        approved: args.approved,
      }))
    ).toEqual([
      { orgId: "org1", criterionId: "c3", approved: false },
      { orgId: "org1", criterionId: "c3", approved: true },
    ])
    const [unapprove, reapprove] = setApproval.mock.invocationCallOrder
    const [write] = save.mock.invocationCallOrder
    expect(unapprove as number).toBeLessThan(write as number)
    expect(write as number).toBeLessThan(reapprove as number)

    // One press, one story: all three mutations carry the SAME gesture id, so
    // the three audit rows they write group into one line in the log instead
    // of scattering as three unrelated-looking changes.
    const ids = [
      ...setApproval.mock.calls.map(([args]) => args.gestureId),
      ...save.mock.calls.map(([args]) => args.gestureId),
    ]
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(1)
    expect(typeof ids[0]).toBe("string")
    expect(ids[0]).not.toBe("")
  })

  // Re-checking the box mid-edit locks the edited text again, which is the
  // intended reading rather than a state to escape: declaring the
  // documentation approved freezes what is being declared. The edit is not
  // lost, and clearing the box hands it back.
  it("re-locks the edited fields when the sign-off is checked again", () => {
    renderDialog({ target: APPROVED_TARGET })
    fireEvent.click(approveBox())
    const field = screen.getByDisplayValue(
      "Measure scope"
    ) as HTMLTextAreaElement
    fireEvent.change(field, {
      target: { value: "Measure the scope of impact" },
    })
    fireEvent.click(approveBox())
    for (const textbox of screen.getAllByRole("textbox")) {
      expect((textbox as HTMLTextAreaElement).disabled).toBe(true)
    }
    // Frozen, not discarded.
    expect(
      screen.getByDisplayValue("Measure the scope of impact")
    ).toBeDefined()
    // And handed back on clearing it again.
    fireEvent.click(approveBox())
    expect(
      (
        screen.getByDisplayValue(
          "Measure the scope of impact"
        ) as HTMLTextAreaElement
      ).disabled
    ).toBe(false)
  })

  // Clearing a standing sign-off is how a correction begins, and it reopens
  // the MODEL's approval on the backend (the engine's blocker rule): this is
  // the call that carries that consequence, so it is pinned here.
  it("un-approves when the sign-off is cleared on an approved criterion", async () => {
    renderDialog({ target: APPROVED_TARGET })
    fireEvent.click(approveBox())
    fireEvent.click(saveButton())
    await waitFor(() => {
      expect(setApproval).toHaveBeenCalledWith({
        orgId: "org1",
        criterionId: "c3",
        approved: false,
        gestureId: expect.any(String),
      })
    })
    // Nothing else: the text was never touched, so there is nothing to write
    // and no second approval call to make.
    expect(setApproval).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
  })

  // A documented draft nobody has signed off is a legitimate state of the
  // model: the approval gate counts it as outstanding, and saving it writes no
  // approval at all.
  it("saves a draft without a sign-off, touching the approval not at all", async () => {
    renderDialog({ target: DOCUMENTED_TARGET })
    fireEvent.change(screen.getByDisplayValue("Measure scope"), {
      target: { value: "Measure the scope of impact" },
    })
    fireEvent.click(saveButton())
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1)
    })
    expect(setApproval).not.toHaveBeenCalled()
  })

  // The backend refuses an approval the stored row does not support, so a box
  // that could be checked against half a form would be a trap; the reason sits
  // beside it rather than leaving a dead control.
  it("offers the sign-off only against complete documentation", () => {
    renderDialog({ target: INCOMPLETE_TARGET })
    expect(approveBox().getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByText(m.approveHint)).toBeDefined()
  })

  it("renders the section headings for Rationale and Bias review", () => {
    renderDialog()
    expect(screen.getByText("Rationale")).toBeDefined()
    expect(screen.getByText("Bias review")).toBeDefined()
  })

  it("renders inline field descriptions instead of per-field help icons", () => {
    renderDialog()
    // Each field shows its help text as a FormDescription (inline, no popover
    // button). Read the copy from en.json rather than repeating it: the point
    // of the assertion is WHICH help text lands on WHICH field, not its exact
    // wording, and a hardcoded literal turns every copy edit into a failure.
    const help = messages.dashboard.help
    expect(screen.getByText(help.methodPurposeBody)).toBeDefined()
    expect(screen.getByText(help.methodWhyRelevantBody)).toBeDefined()
    expect(screen.getByText(help.methodBiasRiskBody)).toBeDefined()
  })

  it("renders nothing when target is null", () => {
    renderDialog({ target: null })
    expect(screen.queryByText("Rationale")).toBeNull()
  })

  it("fills all six fields from the AI draft and gates the save on the acknowledgement", async () => {
    draftMock.mockResolvedValue({
      purpose: "AIP",
      whyRelevant: "AIW",
      overlapNotes: "",
      biasRisk: "medium",
      biasComment: "AIB",
      biasAction: "",
    })
    renderDialog({ target: DOCUMENTED_TARGET })
    // The Fill using AI button is in the dialog header
    fireEvent.click(screen.getByRole("button", { name: /Fill using AI/i }))
    await waitFor(() => expect(screen.getByDisplayValue("AIP")).toBeDefined())
    expect(screen.getByDisplayValue("AIW")).toBeDefined()
    expect(screen.getByDisplayValue("AIB")).toBeDefined()
    // The "medium" bias-risk toggle should be pressed
    const mediumBtn = screen.getByRole("button", { name: /medium/i })
    expect(mediumBtn.getAttribute("aria-pressed")).toBe("true")
    // The form is dirty, so there is something to post.
    expect(saveButton().disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox", { name: m.aiAckLabel }))
    expect(saveButton().disabled).toBe(false)
  })

  it("requires acknowledging the AI draft before Save is enabled", async () => {
    draftMock.mockResolvedValue({
      purpose: "AIP",
      whyRelevant: "AIW",
      overlapNotes: "",
      biasRisk: "medium",
      biasComment: "AIB",
      biasAction: "",
    })
    renderDialog({ target: DOCUMENTED_TARGET })
    fireEvent.click(screen.getByRole("button", { name: /Fill using AI/i }))
    await waitFor(() => expect(screen.getByDisplayValue("AIP")).toBeDefined())
    // Save is present but disabled until the AI acknowledgement is checked.
    expect(saveButton().disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox", { name: m.aiAckLabel }))
    expect(saveButton().disabled).toBe(false)
  })

  it("shows no Fill using AI button on an approved (locked) criterion", () => {
    renderDialog({ target: APPROVED_TARGET })
    expect(screen.queryByRole("button", { name: /Fill using AI/i })).toBeNull()
  })

  it("fires toast.success with complianceSaved key after a successful save", async () => {
    // Use an inProgress target so the form is editable and Save appears once dirty
    const inProgressTarget = {
      criterionId: "c4" as Id<"criteria">,
      name: "Scope",
      description: DEFINITION,
      purpose: "Existing purpose",
      whyRelevant: "Existing relevance",
      overlapNotes: null,
      biasRisk: "low" as const,
      biasComment: "Checked",
      biasAction: null,
      status: "inProgress" as const,
      decidedByName: null,
      decidedAt: null,
    }
    vi.mocked(toast.success).mockClear()
    renderDialog({ target: inProgressTarget })
    // Dirty a field to reveal the Save button
    const purpose = screen.getByDisplayValue("Existing purpose")
    fireEvent.change(purpose, { target: { value: "Updated purpose" } })
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save/i })).toBeDefined()
    )
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        messages.dashboard.toast.complianceSaved
      )
    )
  })
})
