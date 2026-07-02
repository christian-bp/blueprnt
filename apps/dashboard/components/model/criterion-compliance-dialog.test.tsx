import { cleanup, render, screen } from "@testing-library/react"
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

describe("CriterionComplianceDialog", () => {
  afterEach(() => {
    cleanup()
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
