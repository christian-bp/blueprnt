import { cleanup, render, screen, act } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}))

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

function renderDialog(
  target: typeof TARGET | null = TARGET,
  onClose = vi.fn()
) {
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

describe("CriterionComplianceDialog", () => {
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

  it("renders nothing when target is null", () => {
    renderDialog(null)
    expect(screen.queryByText("Rationale")).toBeNull()
  })
})
