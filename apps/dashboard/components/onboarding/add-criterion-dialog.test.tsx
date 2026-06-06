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

const addCriterionMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "evaluationModel.criteria.addCriterion") return addCriterionMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    evaluationModel: {
      criteria: { addCriterion: "evaluationModel.criteria.addCriterion" },
    },
  },
}))

import { AddCriterionDialog } from "@/components/onboarding/add-criterion-dialog"

const editor = messages.dashboard.model.editor

function renderDialog(orgId = "org-123") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AddCriterionDialog orgId={orgId} />
    </NextIntlClientProvider>
  )
}

describe("AddCriterionDialog", () => {
  beforeEach(() => {
    addCriterionMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders only the trigger until it is clicked", () => {
    renderDialog()
    // The trigger reuses the addCta label; the form is not mounted yet.
    expect(screen.getByRole("button", { name: editor.addCta })).toBeDefined()
    expect(screen.queryByLabelText(editor.name)).toBeNull()
  })

  it("opens the form in the dialog when the trigger is clicked", () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: editor.addCta }))
    expect(screen.getByLabelText(editor.name)).toBeDefined()
  })

  it("closes the dialog after a successful add", async () => {
    addCriterionMock.mockResolvedValue("c-new")
    renderDialog("org-dlg")

    fireEvent.click(screen.getByRole("button", { name: editor.addCta }))
    const nameInput = screen.getByLabelText(editor.name)
    fireEvent.change(nameInput, { target: { value: "Communication" } })

    const form = nameInput.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(addCriterionMock).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: "org-dlg", name: "Communication" })
      )
    })
    // onAdded closes the controlled dialog, so the form unmounts.
    await waitFor(() => {
      expect(screen.queryByLabelText(editor.name)).toBeNull()
    })
  })

  it("keeps the dialog open when the add fails", async () => {
    addCriterionMock.mockRejectedValue(new Error("ConvexError: invalidInput"))
    renderDialog()

    fireEvent.click(screen.getByRole("button", { name: editor.addCta }))
    const nameInput = screen.getByLabelText(editor.name)
    fireEvent.change(nameInput, { target: { value: "Communication" } })

    const form = nameInput.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    // The form is still mounted: the dialog did not close on failure.
    expect(screen.getByLabelText(editor.name)).toBeDefined()
  })
})
