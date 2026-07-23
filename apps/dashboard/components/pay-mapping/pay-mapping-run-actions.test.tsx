import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const deleteRunMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "payMapping.runs.deletePayMappingRun") return deleteRunMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    payMapping: {
      runs: {
        deletePayMappingRun: "payMapping.runs.deletePayMappingRun",
      },
    },
  },
}))

import { PayMappingRunActions } from "@/components/pay-mapping/pay-mapping-run-actions"

const labels = messages.dashboard.payMapping.table

function renderActions(label = "Lonekartlaggning 2026") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingRunActions
        orgId="org-1"
        runId={"run-1" as Id<"payMappingRuns">}
        label={label}
      />
    </NextIntlClientProvider>
  )
}

function openMenu(label = "Lonekartlaggning 2026") {
  const trigger = screen.getByRole("button", {
    name: labels.rowActionsLabel.replace("{label}", label),
  })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
}

describe("PayMappingRunActions", () => {
  beforeEach(() => {
    deleteRunMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => cleanup())

  it("opens the delete confirmation dialog from the destructive item, without calling the mutation yet", () => {
    renderActions()
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.deleteCta }))

    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(
      screen.getByText(
        labels.deleteDialogTitle.replace("{label}", "Lonekartlaggning 2026")
      )
    ).toBeDefined()
    expect(deleteRunMock).not.toHaveBeenCalled()
  })

  it("confirming deletes the run and shows the success toast", async () => {
    deleteRunMock.mockResolvedValue(null)
    renderActions()
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.deleteCta }))
    fireEvent.click(screen.getByRole("button", { name: labels.deleteConfirm }))

    await waitFor(() => {
      expect(deleteRunMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: "run-1",
      })
    })
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      messages.dashboard.toast.payMappingDeleted
    )
  })

  it("cancel closes the dialog without deleting", () => {
    renderActions()
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.deleteCta }))
    fireEvent.click(screen.getByRole("button", { name: labels.deleteCancel }))

    expect(deleteRunMock).not.toHaveBeenCalled()
  })

  it("shows an error toast when the mutation rejects, and keeps the dialog open", async () => {
    deleteRunMock.mockRejectedValue(new Error("boom"))
    renderActions()
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.deleteCta }))
    fireEvent.click(screen.getByRole("button", { name: labels.deleteConfirm }))

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages.dashboard.toast.error
      )
    })
    // The failed delete must not close the dialog: the user can retry
    // without re-opening it from the row menu.
    expect(screen.getByRole("alertdialog")).toBeDefined()
  })
})
