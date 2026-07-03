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

const renameFamilyMock = vi.fn()
const removeFamilyMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "assessment.families.renameRoleFamily") return renameFamilyMock
    if (ref === "assessment.families.removeRoleFamily") return removeFamilyMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      families: {
        renameRoleFamily: "assessment.families.renameRoleFamily",
        removeRoleFamily: "assessment.families.removeRoleFamily",
      },
    },
  },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))

import { FamilyActionsMenu } from "@/components/roles/family-actions-menu"

const labels = messages.dashboard.roles.family

function renderMenu(roleTitles = ["Senior Engineer", "Staff Engineer"]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamilyActionsMenu
        orgId="org-1"
        familyId={"fam-1" as Id<"roleFamilies">}
        name="Tech"
        roleTitles={roleTitles}
      />
    </NextIntlClientProvider>
  )
}

function openMenu() {
  const trigger = screen.getByRole("button", { name: labels.actionsMenu })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
}

describe("FamilyActionsMenu", () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
    renameFamilyMock.mockReset()
    removeFamilyMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => cleanup())

  it("opens the rename dialog from the menu", () => {
    renderMenu()
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.renameCta }))
    expect(screen.getByRole("dialog")).toBeDefined()
    expect(screen.getByText(labels.renameDialogTitle)).toBeDefined()
  })

  it("delete lists the affected roles and removes on confirm, then navigates", async () => {
    removeFamilyMock.mockResolvedValue(null)
    renderMenu(["Senior Engineer", "Staff Engineer"])
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.removeCta }))

    // The affected roles are listed; nothing removed yet.
    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(screen.getByText(labels.removeListLabel)).toBeDefined()
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    expect(screen.getByText("Staff Engineer")).toBeDefined()
    expect(removeFamilyMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: labels.removeConfirm }))
    await waitFor(() => {
      expect(removeFamilyMock).toHaveBeenCalledWith({
        orgId: "org-1",
        familyId: "fam-1",
      })
    })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/roles"))
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      messages.dashboard.toast.familyDeleted
    )
  })

  it("omits the affected-roles list for an empty family", () => {
    renderMenu([])
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.removeCta }))
    expect(screen.queryByText(labels.removeListLabel)).toBeNull()
  })
})
