import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

function renderDialog(onConfirm = vi.fn()) {
  const onOpenChange = vi.fn()
  render(
    <ConfirmDeleteDialog
      open
      onOpenChange={onOpenChange}
      title="Delete this family?"
      description="Its roles will be unfiled."
      confirmLabel="Yes, remove"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
    >
      <p>Senior Engineer</p>
    </ConfirmDeleteDialog>
  )
  return { onConfirm, onOpenChange }
}

describe("ConfirmDeleteDialog", () => {
  afterEach(() => cleanup())

  it("renders the title, description, and children", () => {
    renderDialog()
    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(screen.getByText("Delete this family?")).toBeDefined()
    expect(screen.getByText("Senior Engineer")).toBeDefined()
  })

  it("calls onConfirm and closes on confirm", async () => {
    const { onConfirm, onOpenChange } = renderDialog(
      vi.fn().mockResolvedValue(undefined)
    )
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("does not call onConfirm on cancel", () => {
    const { onConfirm } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
