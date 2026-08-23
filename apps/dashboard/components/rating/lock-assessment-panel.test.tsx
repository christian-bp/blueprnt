import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { ConvexError } from "convex/values"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mockMutation, onQuery } from "@/test/convex-mocks"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { LockAssessmentPanel } from "@/components/rating/lock-assessment-panel"
import { toast } from "@/lib/toast"

const t = messages.dashboard.rating
const tToast = messages.dashboard.toast
const errors = messages.errors

const lockAssessmentMock = mockMutation("assessment.locking.lockAssessment")

function renderPanel() {
  onQuery(() => undefined)
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LockAssessmentPanel orgId="org-1" roleId={"role-1" as never} />
    </NextIntlClientProvider>
  )
}

describe("LockAssessmentPanel", () => {
  beforeEach(() => {
    lockAssessmentMock.mockReset()
    vi.mocked(toast.success).mockReset()
  })
  afterEach(() => cleanup())

  it("explains the lock action and calls lockAssessment on click, toasting success", async () => {
    lockAssessmentMock.mockResolvedValue(null)
    renderPanel()
    expect(screen.getByText(t.readyToReadExplanation)).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: t.lockCta }))
    await waitFor(() => {
      expect(lockAssessmentMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
      })
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(tToast.assessmentLocked)
    })
  })

  it("falls back to the generic lock error for an unmapped code", async () => {
    lockAssessmentMock.mockRejectedValue(
      new ConvexError({ code: "errors.notFound" })
    )
    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: t.lockCta }))
    await waitFor(() => {
      expect(screen.getByText(t.lockError)).toBeDefined()
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each([
    ["ratingsIncomplete", errors.ratingsIncomplete],
    ["motivationRequired", errors.motivationRequired],
    ["modelNotApproved", errors.modelNotApproved],
    ["assessmentLocked", errors.assessmentLocked],
  ] as const)(
    "maps the %s failure to its own inline message",
    async (code, expected) => {
      lockAssessmentMock.mockRejectedValue(
        new ConvexError({ code: `errors.${code}` })
      )
      renderPanel()
      fireEvent.click(screen.getByRole("button", { name: t.lockCta }))
      await waitFor(() => {
        expect(screen.getByText(expected)).toBeDefined()
      })
      expect(toast.success).not.toHaveBeenCalled()
    }
  )
})
