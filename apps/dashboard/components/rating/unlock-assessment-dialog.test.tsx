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

import { UnlockAssessmentDialog } from "@/components/rating/unlock-assessment-dialog"
import { toast } from "@/lib/toast"

const t = messages.dashboard.rating
const tToast = messages.dashboard.toast

const unlockAssessmentMock = mockMutation("assessment.locking.unlockAssessment")

function renderDialog(onOpenChange = vi.fn()) {
  onQuery(() => undefined)
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <UnlockAssessmentDialog
        open
        onOpenChange={onOpenChange}
        orgId="org-1"
        roleId={"role-1" as never}
      />
    </NextIntlClientProvider>
  )
  return onOpenChange
}

describe("UnlockAssessmentDialog", () => {
  beforeEach(() => {
    unlockAssessmentMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => cleanup())

  it("confirms, calls unlockAssessment, toasts success, and closes", async () => {
    unlockAssessmentMock.mockResolvedValue(null)
    const onOpenChange = renderDialog()
    expect(screen.getByText(t.unlockDialogTitle)).toBeDefined()
    expect(screen.getByText(t.unlockDialogDescription)).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: t.unlockConfirm }))
    await waitFor(() => {
      expect(unlockAssessmentMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
      })
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(tToast.assessmentUnlocked)
    })
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("toasts an error and keeps the dialog open on failure", async () => {
    unlockAssessmentMock.mockRejectedValue(new Error("errors.notFound"))
    const onOpenChange = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: t.unlockConfirm }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(tToast.error)
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
