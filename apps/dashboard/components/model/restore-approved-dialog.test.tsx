import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "@/lib/toast"

let previewResult: unknown
const restoreMutation = vi.fn()

vi.mock("convex/react", () => ({
  useQuery: (_fn: unknown, args: unknown) =>
    args === "skip" ? undefined : previewResult,
  useMutation: () => restoreMutation,
}))

import { RestoreApprovedDialog } from "@/components/model/restore-approved-dialog"

// A criterion added since the approval (restoring removes it, with its
// ratings), one deselected since (restoring brings it back), and one whose
// weight moved. Shaped exactly like getModelRestorePreview's wire result.
const PREVIEW = {
  approvedAt: 1_700_000_000_000,
  diff: {
    changes: {
      motivation: { from: "Reviewed again.", to: "Tested, not material." },
    },
    criteria: [
      {
        libraryKey: "risk-consequence",
        name: "Risk and consequence",
        kind: "removed",
        changes: {
          selected: { from: true, to: false },
          deletedRatingCount: { from: null, to: 12 },
        },
      },
      {
        libraryKey: "autonomy-mandate",
        name: "Autonomy and mandate",
        kind: "restored",
        changes: { selected: { from: false, to: true } },
      },
      {
        libraryKey: "knowledge-breadth",
        name: "Knowledge breadth",
        kind: "changed",
        changes: {
          weightPoints: { from: 4, to: 3 },
          biasRisk: { from: "medium", to: "low" },
        },
      },
    ],
  },
}

function renderDialog(open = true) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RestoreApprovedDialog orgId="org1" open={open} onOpenChange={() => {}} />
    </NextIntlClientProvider>
  )
}

describe("RestoreApprovedDialog", () => {
  beforeEach(() => {
    previewResult = PREVIEW
    restoreMutation.mockReset()
  })
  afterEach(() => {
    cleanup()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  it("names every criterion the restore moves, with its consequence", () => {
    renderDialog()
    // The criterion added since the approval goes, and the dialog says its
    // ratings go with it rather than leaving that to be discovered.
    expect(screen.getByText("Risk and consequence")).toBeDefined()
    expect(
      screen.getByText("Removed from the model, together with 12 ratings.")
    ).toBeDefined()
    // The one coming back names the re-evaluation it costs.
    expect(screen.getByText("Autonomy and mandate")).toBeDefined()
    expect(
      screen.getByText(
        "Returns to the model. Every role has to be evaluated on it again."
      )
    ).toBeDefined()
  })

  it("renders a changed criterion as labeled before-to-after rows", () => {
    renderDialog()
    expect(screen.getByText("Knowledge breadth")).toBeDefined()
    // Labeled through the audit log's own field labels, never a raw key.
    expect(screen.getByText("Weight points")).toBeDefined()
    expect(screen.getByText("4")).toBeDefined()
    expect(screen.getByText("3")).toBeDefined()
    // A coded value resolves to its label, not the wire code.
    expect(screen.getByText("Bias risk")).toBeDefined()
    expect(screen.getByText("Medium")).toBeDefined()
    expect(screen.getByText("Low")).toBeDefined()
  })

  it("lists the model-level decisions it puts back", () => {
    renderDialog()
    expect(screen.getByText("Rules and decisions")).toBeDefined()
    expect(screen.getByText("Motivation")).toBeDefined()
    expect(screen.getByText("Tested, not material.")).toBeDefined()
  })

  it("cannot be confirmed before the change list has loaded", () => {
    previewResult = undefined
    renderDialog()
    const confirm = screen.getByRole("button", { name: "Restore" })
    expect(confirm.hasAttribute("disabled")).toBe(true)
    // Cancel stays live: a dialog that is not ready must still be dismissable.
    const cancel = screen.getByRole("button", { name: "Cancel" })
    expect(cancel.hasAttribute("disabled")).toBe(false)
  })

  it("cannot be confirmed when there is nothing to undo", () => {
    previewResult = {
      approvedAt: 1_700_000_000_000,
      diff: { criteria: [], changes: {} },
    }
    renderDialog()
    expect(
      screen.getByText(
        "The model already matches the last approved state, so restoring changes nothing."
      )
    ).toBeDefined()
    expect(
      screen.getByRole("button", { name: "Restore" }).hasAttribute("disabled")
    ).toBe(true)
  })

  it("calls restoreApprovedModel with the org and toasts success", async () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    await waitFor(() => {
      expect(restoreMutation).toHaveBeenCalledWith({ orgId: "org1" })
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Model restored")
    })
  })

  it("toasts the failure and stays open when the restore is refused", async () => {
    restoreMutation.mockRejectedValue(new Error("boom"))
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalled()
    })
    expect(screen.getByRole("button", { name: "Restore" })).toBeDefined()
  })
})
