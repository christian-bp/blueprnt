import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { CriterionItem } from "@/components/model/criterion-item"
import { openMenu } from "@/test/menu"

const editor = messages.dashboard.model.editor

function renderItem(props: { editable?: boolean; onRemove?: () => void }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ul>
        <CriterionItem
          name="Complexity"
          description="How hard the problems are"
          importanceNode={<span>3</span>}
          editable={false}
          {...props}
        />
      </ul>
    </NextIntlClientProvider>
  )
}

describe("CriterionItem row menu", async () => {
  afterEach(() => {
    cleanup()
  })

  function openItemMenu() {
    return openMenu(
      screen.getByRole("button", { name: "Actions for Complexity" })
    )
  }

  it("renders no menu in read mode", () => {
    renderItem({ editable: false, onRemove: () => {} })
    expect(
      screen.queryByRole("button", { name: "Actions for Complexity" })
    ).toBeNull()
  })

  it("confirms removal through the alert dialog", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined)
    renderItem({ editable: true, onRemove })
    await openItemMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: editor.removeCta }))

    // The destructive action is gated behind the AlertDialog; nothing has
    // been removed yet.
    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(onRemove).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: editor.removeConfirm }))
    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledTimes(1)
    })
  })

  it("cancelling the alert dialog removes nothing", async () => {
    const onRemove = vi.fn()
    renderItem({ editable: true, onRemove })
    await openItemMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: editor.removeCta }))
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.model.change.cancel,
      })
    )
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
    })
    expect(onRemove).not.toHaveBeenCalled()
  })
})
