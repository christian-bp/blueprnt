import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const deleteSalaryMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: () => deleteSalaryMock,
}))
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    people: { pay: { deleteSalary: "people.pay.deleteSalary" } },
  },
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import { SalaryRowActions } from "@/components/people/salary-row-actions"

const m = messages.dashboard.people.detail

function renderActions() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SalaryRowActions
        payRecordId={"pr-1" as Id<"payRecords">}
        payYear={2026}
      />
    </NextIntlClientProvider>
  )
}

function openMenu() {
  const trigger = screen.getByRole("button", { name: m.salaryRowActions })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
}

describe("SalaryRowActions", () => {
  beforeEach(() => {
    deleteSalaryMock.mockReset().mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
  })
  afterEach(() => cleanup())

  it("deletes the record after the confirm dialog and toasts", async () => {
    renderActions()
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: m.deleteSalaryCta }))
    // The AlertDialog confirms the destructive action first.
    expect(deleteSalaryMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: m.deleteSalaryConfirm }))
    await waitFor(() => {
      expect(deleteSalaryMock).toHaveBeenCalledWith({
        orgId: "org-1",
        payRecordId: "pr-1",
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      messages.dashboard.toast.salaryDeleted
    )
  })

  it("cancel closes the dialog without deleting", async () => {
    renderActions()
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: m.deleteSalaryCta }))
    fireEvent.click(screen.getByRole("button", { name: m.deleteSalaryCancel }))
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
    })
    expect(deleteSalaryMock).not.toHaveBeenCalled()
  })
})
