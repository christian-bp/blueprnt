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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

import { RenamePayMappingDialog } from "@/components/pay-mapping/rename-pay-mapping-dialog"
import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"

const t = messages.dashboard.payMapping.table
const renameRunMock = mockMutation("payMapping.runs.renamePayMappingRun")

function renderDialog(label = "Pay 2026") {
  const onOpenChange = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RenamePayMappingDialog
        orgId="org-1"
        runId={"run-1" as Id<"payMappingRuns">}
        label={label}
        open
        onOpenChange={onOpenChange}
      />
    </NextIntlClientProvider>
  )
  return { onOpenChange }
}

describe("RenamePayMappingDialog", () => {
  beforeEach(() => {
    renameRunMock.mockReset()
  })
  afterEach(() => cleanup())

  it("is prefilled with the run's label and disables save while unchanged", () => {
    renderDialog("Pay 2026")
    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.value).toBe("Pay 2026")
    const save = screen.getByRole("button", { name: t.renameSave })
    expect(save.hasAttribute("disabled")).toBe(true)
  })

  // The save button must ENABLE once the label is edited: formState is a
  // proxy that only tracks accessed fields, and this component once read it
  // inline behind a short-circuit, which left the button disabled forever.
  it("enables save after editing and submits the rename on click", async () => {
    renameRunMock.mockResolvedValue(null)
    const { onOpenChange } = renderDialog("Pay 2026")

    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "Pay 2027" } })
    fireEvent.blur(input)
    const save = screen.getByRole("button", { name: t.renameSave })
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false))
    // A plain click must reach the mutation: the button must be a real
    // submit button, not the vendor default type="button".
    fireEvent.click(save)

    await waitFor(() => {
      expect(renameRunMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: "run-1",
        label: "Pay 2027",
      })
    })
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      messages.dashboard.toast.payMappingRenamed
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("blocks submit on an empty label", async () => {
    renderDialog("Pay 2026")
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "" } })
    fireEvent.blur(input)
    const save = screen.getByRole("button", { name: t.renameSave })
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(true))
    expect(renameRunMock).not.toHaveBeenCalled()
  })

  it("toasts an error and keeps the dialog open on failure", async () => {
    renameRunMock.mockRejectedValue(new Error("boom"))
    const { onOpenChange } = renderDialog("Pay 2026")

    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "Pay 2027" } })
    fireEvent.blur(input)
    const save = screen.getByRole("button", { name: t.renameSave })
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false))
    fireEvent.click(save)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages.dashboard.toast.error
      )
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
