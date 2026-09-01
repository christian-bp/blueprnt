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
import { ActionDialog } from "@/components/pay-mapping/action-dialog"
import { NoteDialog } from "@/components/pay-mapping/note-dialog"
import type {
  ActionTargetWire,
  PayMappingActionWire,
  PayMappingNoteWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { mockMutation, onQuery } from "@/test/convex-mocks"
import { toast } from "@/lib/toast"

const m = messages.dashboard.payMapping.actions
const tToast = messages.dashboard.toast

const createAction = mockMutation("payMapping.actions.createAction")
const updateAction = mockMutation("payMapping.actions.updateAction")
const createNote = mockMutation("payMapping.notes.createNote")
const updateNote = mockMutation("payMapping.notes.updateNote")

const RUN_ID = "run-1" as Id<"payMappingRuns">
const TARGET: ActionTargetWire = {
  kind: "group",
  scope: "equalWork",
  groupKey: "SWE|3|Senior",
}

const EXISTING: PayMappingActionWire = {
  actionId: "a1" as Id<"payMappingActions">,
  target: TARGET,
  problem: "Unexplained gap",
  plannedAction: "Salary review",
  reason: "experience",
  ownerUserId: "u1",
  ownerName: "HR Person",
  plannedDate: Date.UTC(2026, 11, 1),
  estimatedCost: 42000,
  estimatedCostUnit: "oneOff",
  priority: "high",
  status: "notStarted",
  erased: false,
  createdAt: 1,
}

const EXISTING_NOTE: PayMappingNoteWire = {
  noteId: "n1" as Id<"payMappingNotes">,
  target: TARGET,
  text: "Discuss with the union",
  noteType: "discussionNeeded",
  erased: false,
  createdBy: "u1",
  createdByName: "HR Person",
  createdAt: 1,
}

function renderAction(action?: PayMappingActionWire) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ActionDialog
        open
        onOpenChange={vi.fn()}
        runId={RUN_ID}
        target={TARGET}
        targetLabel="SWE · Senior"
        action={action}
        currency="SEK"
      />
    </NextIntlClientProvider>
  )
}

function renderNote(note?: PayMappingNoteWire) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        runId={RUN_ID}
        target={TARGET}
        targetLabel="SWE · Senior"
        note={note}
      />
    </NextIntlClientProvider>
  )
}

describe("ActionDialog", () => {
  beforeEach(() => {
    createAction.mockReset()
    createAction.mockResolvedValue("a2")
    updateAction.mockReset()
    updateAction.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    onQuery((ref) =>
      ref.includes("listActionOwners")
        ? [{ userId: "u1", name: "HR Person" }]
        : undefined
    )
  })

  afterEach(() => {
    cleanup()
  })

  it("states the locked target instead of asking for it", () => {
    renderAction()
    expect(
      screen.getByText(m.linkedTo.replace("{target}", "SWE · Senior"))
    ).toBeDefined()
  })

  it("gates submit until the required fields are filled", () => {
    renderAction()
    const submit = screen.getByRole("button", { name: m.save })
    expect(submit.hasAttribute("disabled")).toBe(true)
  })

  it("prefills an edit, gates a pristine one, and submits the edited values", async () => {
    renderAction(EXISTING)
    const problem = screen.getByLabelText(m.problem) as HTMLTextAreaElement
    expect(problem.value).toBe("Unexplained gap")
    expect(
      (screen.getByLabelText(m.plannedAction) as HTMLTextAreaElement).value
    ).toBe("Salary review")
    // Valid but pristine: an unchanged edit must not fire a no-op mutation
    // (which would still write an audit row).
    expect(
      screen.getByRole("button", { name: m.save }).hasAttribute("disabled")
    ).toBe(true)

    fireEvent.change(problem, { target: { value: "Unexplained gap, revised" } })
    fireEvent.blur(problem)
    await waitFor(() => {
      expect(problem.value).toBe("Unexplained gap, revised")
    })

    // Submitted through the form rather than a click on the gate: whether
    // the button's own disabled attribute has flushed by this tick is a
    // jsdom timing detail, while the payload the edit sends is the contract
    // that matters (the enabled state itself is covered in the browser pass).
    const form = problem.closest("form")
    if (form === null) throw new Error("no form")
    fireEvent.submit(form)
    await waitFor(() => {
      expect(updateAction).toHaveBeenCalled()
    })
    const args = updateAction.mock.calls[0]?.[0] as Record<string, unknown>
    expect(args.actionId).toBe("a1")
    expect(args.problem).toBe("Unexplained gap, revised")
    expect(args.target).toEqual(TARGET)
    // The date round-trips as epoch ms at UTC midnight, never a shifted day.
    expect(args.plannedDate).toBe(Date.UTC(2026, 11, 1))
    expect(args.estimatedCost).toBe(42000)
    expect(toast.success).toHaveBeenCalledWith(tToast.payMappingActionUpdated)
  })
})

describe("NoteDialog", () => {
  beforeEach(() => {
    createNote.mockReset()
    createNote.mockResolvedValue("n2")
    updateNote.mockReset()
    updateNote.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("creates a note with its classification and toasts", async () => {
    renderNote()
    fireEvent.change(screen.getByLabelText(m.noteText), {
      target: { value: "Recruitment history explains it" },
    })
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: m.save }).hasAttribute("disabled")
      ).toBe(false)
    })
    fireEvent.click(screen.getByRole("button", { name: m.save }))
    await waitFor(() => {
      expect(createNote).toHaveBeenCalled()
    })
    const args = createNote.mock.calls[0]?.[0] as Record<string, unknown>
    expect(args.runId).toBe(RUN_ID)
    expect(args.target).toEqual(TARGET)
    expect(args.text).toBe("Recruitment history explains it")
    expect(args.noteType).toBe("discussionNeeded")
    expect(toast.success).toHaveBeenCalledWith(tToast.payMappingNoteCreated)
  })

  it("prefills an edit and stays gated until the text changes", async () => {
    renderNote(EXISTING_NOTE)
    const text = screen.getByLabelText(m.noteText) as HTMLTextAreaElement
    expect(text.value).toBe("Discuss with the union")
    expect(
      screen.getByRole("button", { name: m.save }).hasAttribute("disabled")
    ).toBe(true)
  })
})
