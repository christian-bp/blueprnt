import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import messages from "@workspace/i18n/messages/en.json"

const renameFamilyMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "assessment.families.renameRoleFamily" ? renameFamilyMock : vi.fn(),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      families: { renameRoleFamily: "assessment.families.renameRoleFamily" },
    },
  },
}))

import { RenameFamilyDialog } from "@/components/roles/rename-family-dialog"

const labels = messages.dashboard.roles.family

function renderDialog() {
  const onOpenChange = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RenameFamilyDialog
        open
        onOpenChange={onOpenChange}
        orgId="org-1"
        familyId={"fam-1" as Id<"roleFamilies">}
        currentName="Tech"
      />
    </NextIntlClientProvider>
  )
  return { onOpenChange }
}

describe("RenameFamilyDialog", () => {
  beforeEach(() => {
    renameFamilyMock.mockReset()
  })
  afterEach(() => cleanup())

  it("save is disabled until the name changes, then renames with a trimmed name", async () => {
    renameFamilyMock.mockResolvedValue(null)
    const { onOpenChange } = renderDialog()

    // Pre-filled and unchanged: the save button is disabled (no no-op write).
    const save = screen.getByRole("button", { name: labels.saveCta })
    expect(save.hasAttribute("disabled")).toBe(true)

    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "  Teknik  " } })
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false))
    fireEvent.click(save)

    await waitFor(() => {
      expect(renameFamilyMock).toHaveBeenCalledWith({
        orgId: "org-1",
        familyId: "fam-1",
        name: "Teknik",
      })
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("shows the duplicate-name error and stays open", async () => {
    renameFamilyMock.mockRejectedValue(
      new Error("ConvexError: errors.roleFamilyExists")
    )
    renderDialog()
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Sales" },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.saveCta }))
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined())
  })
})
