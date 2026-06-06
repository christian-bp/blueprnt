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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { FamilyHeader } from "@/components/roles/family-header"

const labels = messages.dashboard.roles.family

function renderHeader(name = "Tech") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamilyHeader orgId="org-1" familyId="fam-1" name={name} />
    </NextIntlClientProvider>
  )
}

describe("FamilyHeader", () => {
  beforeEach(() => {
    renameFamilyMock.mockReset()
    removeFamilyMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("rename flow calls renameRoleFamily with trimmed name and exits edit mode", async () => {
    renameFamilyMock.mockResolvedValue(null)
    renderHeader("Tech")

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: labels.renameCta }))

    // The input appears pre-filled with the current name
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "  Teknik  " } })

    // Click save
    fireEvent.click(screen.getByRole("button", { name: labels.saveCta }))

    await waitFor(() => {
      expect(renameFamilyMock).toHaveBeenCalledWith({
        orgId: "org-1",
        familyId: "fam-1",
        name: "Teknik",
      })
    })

    // Exits edit mode: the rename button is visible again
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: labels.renameCta })
      ).toBeDefined()
    })
  })

  it("duplicate rejection shows the translated alert and stays editing", async () => {
    renameFamilyMock.mockRejectedValue(
      new Error("ConvexError: errors.roleFamilyExists")
    )
    renderHeader("Tech")

    fireEvent.click(screen.getByRole("button", { name: labels.renameCta }))

    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "Sales" } })
    fireEvent.click(screen.getByRole("button", { name: labels.saveCta }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })

    // Still in edit mode: input is still visible
    expect(screen.getByRole("textbox")).toBeDefined()
  })

  it("remove confirm calls removeRoleFamily and navigates to /roles", async () => {
    removeFamilyMock.mockResolvedValue(null)
    renderHeader("Tech")

    // Click the label-variant trigger (its visible name is the button text)
    fireEvent.click(screen.getByRole("button", { name: labels.removeCta }))

    // The armed confirm button appears
    const confirmBtn = await screen.findByRole("button", {
      name: labels.removeConfirm,
    })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(removeFamilyMock).toHaveBeenCalledWith({
        orgId: "org-1",
        familyId: "fam-1",
      })
    })

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/roles")
    })
  })
})
