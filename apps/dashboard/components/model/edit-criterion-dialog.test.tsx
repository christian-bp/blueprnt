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

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import {
  EditCriterionDialog,
  type EditCriterionTarget,
} from "@/components/model/edit-criterion-dialog"
import { mockMutation } from "@/test/convex-mocks"

const editor = messages.dashboard.model.editor
const updateMock = mockMutation("evaluationModel.criteria.updateCriterion")

const TARGET: EditCriterionTarget = {
  criterionId: "crit-1" as never,
  name: "Scope",
  description: "How broad the role is.",
  helpText: "Judge against the anchors.",
  anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
}

function renderDialog(target: EditCriterionTarget | null, onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <EditCriterionDialog orgId="org-1" target={target} onClose={onClose} />
    </NextIntlClientProvider>
  )
  return onClose
}

describe("EditCriterionDialog", () => {
  beforeEach(() => {
    updateMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("renders closed without a target", () => {
    renderDialog(null)
    expect(screen.queryByText(editor.editDialogTitle)).toBeNull()
  })

  it("prefills the criterion and saves the changed texts", async () => {
    updateMock.mockResolvedValue(null)
    const onClose = renderDialog(TARGET)

    expect(screen.getByText(editor.editDialogTitle)).toBeDefined()
    const nameInput = screen.getByLabelText(editor.name) as HTMLInputElement
    expect(nameInput.value).toBe("Scope")

    fireEvent.change(nameInput, { target: { value: "Adapted scope" } })
    fireEvent.click(screen.getByRole("button", { name: editor.editSaveCta }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        criterionId: "crit-1",
        name: "Adapted scope",
        description: TARGET.description,
        helpText: TARGET.helpText,
        anchors: TARGET.anchors,
      })
    })
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it("closes from the footer cancel without saving", () => {
    const onClose = renderDialog(TARGET)
    fireEvent.click(screen.getByRole("button", { name: editor.cancelCta }))
    expect(onClose).toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })
})
