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

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"

// Module-level variable: useAction returns a closure over this so the
// component always calls the current mock. The describe-level beforeEach
// reassigns it to a fresh vi.fn() so each test starts from a clean identity.
// (bun correlates rejected Promises to a specific vi.fn() instance; a fresh
// identity per test prevents spurious unhandledRejection events when the
// error test runs after a success test.)
let draftMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useAction: () => draftMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => {
  function pathProxy(path: string): unknown {
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (
            prop === Symbol.toPrimitive ||
            prop === "toString" ||
            prop === "valueOf"
          )
            return () => path
          if (typeof prop !== "string") return undefined
          return pathProxy(path === "" ? prop : `${path}.${prop}`)
        },
      }
    )
  }
  return { api: pathProxy("") }
})

import { CriterionComplianceDialog } from "@/components/model/criterion-compliance-dialog"

const TARGET = {
  criterionId: "c1" as Id<"criteria">,
  name: "Scope",
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

const APPROVED_TARGET = {
  criterionId: "c3" as Id<"criteria">,
  name: "Scope",
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

describe("CriterionComplianceDialog", () => {
  beforeEach(() => {
    draftMock = vi.fn()
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

  it("renders Cancel and Approve (not Save) for a documented, untouched criterion", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined()
    // Undirty documented target: Approve is shown, Save is not
    expect(screen.getByRole("button", { name: /approve/i })).toBeDefined()
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull()
  })

  it("renders the section headings for Rationale and Bias review", () => {
    renderDialog()
    expect(screen.getByText("Rationale")).toBeDefined()
    expect(screen.getByText("Bias review")).toBeDefined()
  })

  it("renders inline field descriptions instead of per-field help icons", () => {
    renderDialog()
    // Each field shows its help text as a FormDescription (inline, no popover button)
    expect(
      screen.getByText(
        "What this criterion measures and the outcome it captures."
      )
    ).toBeDefined()
    expect(
      screen.getByText(
        "Why this criterion is relevant to the work's value, and why it is gender-neutral."
      )
    ).toBeDefined()
    expect(
      screen.getByText(
        "The risk that this criterion over- or under-values gender-coded work, for example favouring visible mandate or budget size over actual complexity and responsibility."
      )
    ).toBeDefined()
  })

  it("renders nothing when target is null", () => {
    renderDialog({ target: null })
    expect(screen.queryByText("Rationale")).toBeNull()
  })

  it("renders fields as disabled and shows Reopen but no Save when status is approved", () => {
    renderDialog({ target: APPROVED_TARGET })
    // All textareas must be disabled
    const textareas = screen.getAllByRole("textbox")
    for (const textarea of textareas) {
      expect((textarea as HTMLTextAreaElement).disabled).toBe(true)
    }
    // Save button must not be present
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull()
    // Approve button must not be present
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull()
    // Reopen button must be present
    expect(screen.getByRole("button", { name: /reopen/i })).toBeDefined()
    // Cancel button present
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined()
    // No Fill using AI button on a locked criterion
    expect(screen.queryByRole("button", { name: /Fill using AI/i })).toBeNull()
  })

  it("renders fields as editable and shows Approve but no Save or Reopen when documented and untouched", () => {
    renderDialog({ target: DOCUMENTED_TARGET })
    // Textareas must be enabled
    const textareas = screen.getAllByRole("textbox")
    for (const textarea of textareas) {
      expect((textarea as HTMLTextAreaElement).disabled).toBe(false)
    }
    // Approve is present (untouched documented target)
    expect(screen.getByRole("button", { name: /approve/i })).toBeDefined()
    // Save is NOT present (only shown when dirty)
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull()
    // Reopen button must not be present
    expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull()
  })

  it("fills all six fields from the AI draft, hides Approve, and shows Save when dirty", async () => {
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
    // Form is now dirty: Save is shown, Approve is not
    expect(screen.getByRole("button", { name: /save/i })).toBeDefined()
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull()
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
    const save = screen.getByRole("button", { name: /save/i })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox"))
    expect((save as HTMLButtonElement).disabled).toBe(false)
  })

  it("requires acknowledging the documentation before Approve is enabled", () => {
    // Documented + untouched: Approve is shown but gated on an explicit
    // sign-off. The only checkbox on screen here is that acknowledgement
    // (the AI-draft checkbox appears only after an AI fill, which makes the
    // form dirty and swaps Approve for Save).
    renderDialog({ target: DOCUMENTED_TARGET })
    const approve = screen.getByRole("button", { name: /approve/i })
    expect((approve as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox"))
    expect((approve as HTMLButtonElement).disabled).toBe(false)
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
