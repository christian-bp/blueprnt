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

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

let orgRole = "admin"
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: orgRole }),
}))

import { WorkingConditionsSection } from "@/components/model/working-conditions-section"
import { toast } from "@/lib/toast"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const m = messages.dashboard.model.method.workingConditions

const setDecision = mockMutation(
  "evaluationModel.approval.setWorkingConditionsDecision"
)

let checksResult: unknown = {
  checks: [],
  approval: null,
  workingConditions: null,
}

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkingConditionsSection orgId="org-1" />
    </NextIntlClientProvider>
  )
}

describe("WorkingConditionsSection", () => {
  beforeEach(() => {
    orgRole = "admin"
    setDecision.mockReset().mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    checksResult = { checks: [], approval: null, workingConditions: null }
    onQuery((ref) =>
      ref === "evaluationModel.approval.getMethodChecks"
        ? checksResult
        : undefined
    )
  })
  afterEach(() => cleanup())

  it("states the decision and explains the concept in place", () => {
    renderSection()
    expect(screen.getByText(m.heading)).toBeDefined()
    expect(screen.getByText(m.description)).toBeDefined()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.help.workingConditionsDecisionLabel,
      })
    ).toBeDefined()
  })

  // A pre-filled decision opens valid, so the save gates on dirty as well:
  // an unchanged form must not fire a mutation that would still write an audit
  // row and reopen the model's approval.
  it("opens on the stored decision with the save gated until something changes", () => {
    checksResult = {
      checks: [],
      approval: null,
      workingConditions: {
        status: "testedNotMaterial",
        motivation: "Tested and found not material.",
        decidedBy: "auth-1",
        decidedAt: 1,
      },
    }
    renderSection()
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Tested and found not material."
    )
    expect(
      (screen.getByRole("button", { name: m.saveCta }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })

  it("saves the decision and says so", async () => {
    renderSection()
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Standby duty is a recurring requirement." },
    })
    fireEvent.blur(screen.getByRole("textbox"))
    const save = () =>
      screen.getByRole("button", { name: m.saveCta }) as HTMLButtonElement
    await waitFor(() => {
      expect(save().disabled).toBe(false)
    })
    fireEvent.click(save())
    await waitFor(() => {
      expect(setDecision).toHaveBeenCalledWith({
        orgId: "org-1",
        status: "active",
        motivation: "Standby duty is a recurring requirement.",
      })
    })
    expect(vi.mocked(toast.success)).toHaveBeenCalled()
  })

  // Saving is an adminMutation, so an editor is not offered the form at all:
  // the same split the approval card draws, unchanged by the move here.
  it("offers an editor nothing", () => {
    orgRole = "editor"
    const { container } = renderSection()
    expect(container.textContent).toBe("")
  })

  it("renders nothing when the org has no model yet", () => {
    checksResult = null
    const { container } = renderSection()
    expect(container.textContent).toBe("")
  })

  // Content-shaped: the heading, its help and the description are static i18n
  // text and render for real; only the decision itself is unknown.
  it("keeps its own chrome real while the decision loads", () => {
    checksResult = undefined
    const { container } = renderSection()
    expect(screen.getByText(m.heading)).toBeDefined()
    expect(screen.getByText(m.description)).toBeDefined()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })
})
