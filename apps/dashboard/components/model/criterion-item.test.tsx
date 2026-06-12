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

const editor = messages.dashboard.model.editor

function renderItem(props: {
  anchors?: { level: number; text: string }[]
  editable?: boolean
  onEdit?: () => void
  onRemove?: () => void
}) {
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

describe("CriterionItem anchor scale section", () => {
  afterEach(() => {
    cleanup()
  })

  const ANCHORS = [
    { level: 0, text: "Not present" },
    { level: 1, text: "Follows instructions" },
    { level: 2, text: "Works independently" },
    { level: 3, text: "Guides others" },
    { level: 4, text: "Shapes the area" },
    { level: 5, text: "Defines the field" },
  ]

  it("renders no trigger without anchors", () => {
    renderItem({})
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.model.editor.anchors,
      })
    ).toBeNull()
  })

  it("expands to show the anchor texts", async () => {
    renderItem({ anchors: ANCHORS })
    const trigger = screen.getByRole("button", {
      name: messages.dashboard.model.editor.anchors,
    })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText("Follows instructions")).toBeNull()

    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(await screen.findByText("Follows instructions")).toBeDefined()
    expect(screen.getByText("Defines the field")).toBeDefined()
  })
})

describe("CriterionItem row menu", () => {
  afterEach(() => {
    cleanup()
  })

  function openMenu() {
    const trigger = screen.getByRole("button", {
      name: "Actions for Complexity",
    })
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
  }

  it("renders no menu in read mode", () => {
    renderItem({ editable: false, onEdit: () => {}, onRemove: () => {} })
    expect(
      screen.queryByRole("button", { name: "Actions for Complexity" })
    ).toBeNull()
  })

  it("forwards Edit from the menu", () => {
    const onEdit = vi.fn()
    renderItem({ editable: true, onEdit })
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: editor.editCta }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it("confirms removal through the alert dialog", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined)
    renderItem({ editable: true, onRemove })
    openMenu()
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
    openMenu()
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
