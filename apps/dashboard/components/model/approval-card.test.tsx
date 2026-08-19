import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "@/lib/toast"

const ALL_GREEN_CHECKS = [
  { key: "dimensionCoverage", level: "blocker", ok: true },
  { key: "workingConditionsTested", level: "blocker", ok: true },
  { key: "criterionCount", level: "blocker", ok: true },
  { key: "dimensionCaps", level: "blocker", ok: true },
  { key: "anchorsComplete", level: "blocker", ok: true },
  { key: "documentationComplete", level: "blocker", ok: true },
  { key: "weightBudget", level: "blocker", ok: true },
  { key: "levelRulesValid", level: "blocker", ok: true },
  { key: "zoneProfileMonotonic", level: "blocker", ok: true },
  { key: "dimensionWeightBalance", level: "warning", ok: true },
  { key: "peopleLeadershipWeight", level: "warning", ok: true },
  { key: "overlapPairs", level: "warning", ok: true },
] as const

let queryResult: unknown

vi.mock("convex/react", () => ({
  useQuery: () => queryResult,
  useMutation: () => vi.fn(),
}))

import { ApprovalCard } from "@/components/model/approval-card"

function renderCard(orgId = "org1") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ApprovalCard orgId={orgId} />
    </NextIntlClientProvider>
  )
}

describe("ApprovalCard", () => {
  afterEach(() => {
    cleanup()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it("shows the draft state and an enabled Approve button when every blocker passes", () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS,
      approval: null,
      workingConditions: null,
    }
    renderCard()
    expect(screen.getByText("Not yet approved")).toBeDefined()
    const approveButton = screen.getByRole("button", { name: "Approve model" })
    expect(approveButton.hasAttribute("disabled")).toBe(false)
    // Every check row rendered with its localized label.
    expect(
      screen.getByText(
        "Competence, effort, and responsibility are each covered"
      )
    ).toBeDefined()
    expect(screen.getByText("Overlapping criteria are reviewed")).toBeDefined()
  })

  it("disables the Approve button while a blocker fails", () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS.map((check) =>
        check.key === "documentationComplete" ? { ...check, ok: false } : check
      ),
      approval: null,
      workingConditions: null,
    }
    renderCard()
    const approveButton = screen.getByRole("button", { name: "Approve model" })
    expect(approveButton.hasAttribute("disabled")).toBe(true)
  })

  it("does not disable on a failing warning (only blockers gate)", () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS.map((check) =>
        check.key === "overlapPairs" ? { ...check, ok: false } : check
      ),
      approval: null,
      workingConditions: null,
    }
    renderCard()
    const approveButton = screen.getByRole("button", { name: "Approve model" })
    expect(approveButton.hasAttribute("disabled")).toBe(false)
  })

  it("shows the approved state and hides the Approve button once approved", () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS,
      approval: {
        approvedBy: "auth-1",
        approvedByName: "Alex",
        approvedAt: 1_700_000_000_000,
      },
      workingConditions: {
        status: "active",
        motivation: "Standby duty is a recurring requirement.",
        decidedBy: "auth-1",
        decidedAt: 1_700_000_000_000,
      },
    }
    renderCard()
    expect(screen.getByText(/Approved by Alex on/)).toBeDefined()
    expect(screen.queryByRole("button", { name: "Approve model" })).toBeNull()
  })

  it("calls approveModel and toasts success on click", async () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS,
      approval: null,
      workingConditions: null,
    }
    renderCard()
    fireEvent.click(screen.getByRole("button", { name: "Approve model" }))
    await vi.waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Model approved")
    })
  })

  it("renders a content-shaped skeleton while loading", () => {
    queryResult = undefined
    renderCard()
    expect(screen.getByText("Approval")).toBeDefined()
    expect(
      screen.getByText(
        "The model must pass every required check below before roles can be rated."
      )
    ).toBeDefined()
  })

  it("renders nothing when the org has no model yet", () => {
    queryResult = null
    const { container } = renderCard()
    expect(container.textContent).toBe("")
  })
})
