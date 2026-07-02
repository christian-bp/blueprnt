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
    const mediumBtn = screen.getByRole("radio", { name: /medium/i })
    expect(mediumBtn.getAttribute("data-state")).toBe("on")
  })

  it("renders the three bias-risk options as toggle buttons, not a combobox", () => {
    renderDialog()
    // ToggleGroup single renders each item as role=radio
    const low = screen.getByRole("radio", { name: /low/i })
    const medium = screen.getByRole("radio", { name: /medium/i })
    const high = screen.getByRole("radio", { name: /high/i })
    expect(low).toBeDefined()
    expect(medium).toBeDefined()
    expect(high).toBeDefined()
    // Must NOT be a combobox (Select)
    expect(screen.queryByRole("combobox")).toBeNull()
  })

  it("renders the footer action buttons", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /approve/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /save/i })).toBeDefined()
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
  })

  it("renders fields as editable and shows Save and Approve but no Reopen when status is documented", () => {
    renderDialog({ target: DOCUMENTED_TARGET })
    // Textareas must be enabled
    const textareas = screen.getAllByRole("textbox")
    for (const textarea of textareas) {
      expect((textarea as HTMLTextAreaElement).disabled).toBe(false)
    }
    // Save button present
    expect(screen.getByRole("button", { name: /save/i })).toBeDefined()
    // Approve button present
    expect(screen.getByRole("button", { name: /approve/i })).toBeDefined()
    // Reopen button must not be present
    expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull()
  })

  it("fills all six fields from the AI draft on a documented criterion", async () => {
    draftMock.mockResolvedValue({
      purpose: "AIP",
      whyRelevant: "AIW",
      overlapNotes: "",
      biasRisk: "medium",
      biasComment: "AIB",
      biasAction: "",
    })
    renderDialog({ target: DOCUMENTED_TARGET })
    fireEvent.click(screen.getByRole("button", { name: /Draft with AI/i }))
    await waitFor(() => expect(screen.getByDisplayValue("AIP")).toBeDefined())
    expect(screen.getByDisplayValue("AIW")).toBeDefined()
    expect(screen.getByDisplayValue("AIB")).toBeDefined()
    // The "medium" bias-risk toggle should be pressed
    const mediumBtn = screen.getByRole("radio", { name: /medium/i })
    expect(mediumBtn.getAttribute("data-state")).toBe("on")
  })

  it("shows no Draft with AI button on an approved (locked) criterion", () => {
    renderDialog({ target: APPROVED_TARGET })
    expect(screen.queryByRole("button", { name: /Draft with AI/i })).toBeNull()
  })
})
