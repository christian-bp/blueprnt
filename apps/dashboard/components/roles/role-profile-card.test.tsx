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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const updateRoleMock = vi.fn()
const archiveRoleMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "assessment.roles.archiveRole" ? archiveRoleMock : updateRoleMock,
  // The AI panel uses useAction; return a no-op so it never fires in card tests.
  useAction: () => vi.fn(),
  // The nested FamilyPicker lists families; none needed for these tests.
  useQuery: () => [],
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      roles: {
        updateRole: "assessment.roles.updateRole",
        archiveRole: "assessment.roles.archiveRole",
      },
      families: {
        listRoleFamilies: "assessment.families.listRoleFamilies",
        createRoleFamily: "assessment.families.createRoleFamily",
      },
    },
  },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))

import { toast } from "sonner"
import {
  RoleProfileCard,
  type RoleProfile,
} from "@/components/roles/role-profile-card"

const labels = messages.dashboard.roles.detail
const roleLabels = messages.assessment.role
const familyLabels = messages.dashboard.roles.family
const archiveLabels = messages.dashboard.roles.archive

function makeRole(overrides?: Partial<RoleProfile>): RoleProfile {
  return {
    roleId: "role-1" as never,
    title: "Developer",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    trackName: "Individual contributor",
    familyId: null,
    familyName: null,
    familySlug: null,
    purpose: "Builds the product",
    responsibilities: "Implementation",
    archived: false,
    ...overrides,
  }
}

function renderCard(
  role: RoleProfile,
  isAdmin = true,
  tracks: { key: string; name: string }[] = []
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleProfileCard
        orgId="org-1"
        role={role}
        isAdmin={isAdmin}
        tracks={tracks}
      />
    </NextIntlClientProvider>
  )
}

function openManageMenu() {
  const trigger = screen.getByRole("button", { name: labels.manageCta })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
}

// Read mode -> manage menu -> Edit -> edit mode (fields become inputs).
function startEditing() {
  openManageMenu()
  fireEvent.click(screen.getByRole("menuitem", { name: labels.editCta }))
}

describe("RoleProfileCard", () => {
  beforeEach(() => {
    updateRoleMock.mockReset()
    archiveRoleMock.mockReset()
    pushMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("renders read mode with the purpose text and responsibilities list, no inputs", () => {
    renderCard(makeRole())
    expect(screen.getByText("Builds the product")).toBeDefined()
    // Responsibilities render as a bulleted list (one item per line), not a
    // paragraph.
    const items = screen.getAllByRole("listitem")
    expect(items.map((li) => li.textContent)).toContain("Implementation")
    // No textbox inputs in read mode.
    expect(
      screen.queryByRole("textbox", { name: roleLabels.purpose })
    ).toBeNull()
  })

  it("opens the manage menu, edits, saves only the changed fields, and exits edit mode", async () => {
    updateRoleMock.mockResolvedValue({ levelsReset: 0 })
    renderCard(makeRole())
    startEditing()
    fireEvent.change(
      screen.getByRole("textbox", { name: roleLabels.purpose }),
      {
        target: { value: "New purpose" },
      }
    )
    fireEvent.click(screen.getByRole("button", { name: labels.saveCta }))
    await waitFor(() => {
      expect(updateRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        purpose: "New purpose",
      })
    })
    // Back to read mode: the manage trigger returns.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: labels.manageCta })
      ).toBeDefined()
    })
  })

  it("stays in edit mode with an alert when the save fails", async () => {
    updateRoleMock.mockRejectedValue(new Error("ConvexError: roleLocked"))
    renderCard(makeRole())
    startEditing()
    fireEvent.change(screen.getByRole("textbox", { name: roleLabels.team }), {
      target: { value: "Other" },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.saveCta }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(screen.getByRole("textbox", { name: roleLabels.team })).toBeDefined()
  })

  it("links to the family in read mode, or shows the none label when unset", () => {
    renderCard(
      makeRole({ familyId: "f-tech", familyName: "Tech", familySlug: "tech" })
    )
    expect(
      screen.getByRole("link", { name: "Tech" }).getAttribute("href")
    ).toBe("/roles/families/tech")
    cleanup()
    renderCard(makeRole())
    expect(screen.getByText(familyLabels.none)).toBeDefined()
  })

  it("leaves the family untouched when only a text field changes", async () => {
    updateRoleMock.mockResolvedValue({ levelsReset: 0 })
    renderCard(makeRole({ familyId: "f-tech", familyName: "Tech" }))
    startEditing()
    fireEvent.change(
      screen.getByRole("textbox", { name: roleLabels.purpose }),
      {
        target: { value: "New purpose" },
      }
    )
    fireEvent.click(screen.getByRole("button", { name: labels.saveCta }))
    await waitFor(() => {
      // The family did not change, so no familyId key is sent.
      expect(updateRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        purpose: "New purpose",
      })
    })
  })

  it("offers Edit and Archive in the manage menu for an admin", () => {
    renderCard(makeRole())
    openManageMenu()
    expect(screen.getByRole("menuitem", { name: labels.editCta })).toBeDefined()
    expect(
      screen.getByRole("menuitem", { name: archiveLabels.cta })
    ).toBeDefined()
  })

  it("hides Archive in the manage menu for a non-admin", () => {
    renderCard(makeRole(), false)
    openManageMenu()
    expect(screen.getByRole("menuitem", { name: labels.editCta })).toBeDefined()
    expect(
      screen.queryByRole("menuitem", { name: archiveLabels.cta })
    ).toBeNull()
  })

  it("archives through the confirm dialog, then navigates to /roles", async () => {
    archiveRoleMock.mockResolvedValue(null)
    renderCard(makeRole())
    openManageMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: archiveLabels.cta }))

    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(archiveRoleMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: archiveLabels.confirm }))
    await waitFor(() => {
      expect(archiveRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
      })
    })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/roles"))
  })

  it("hides the manage menu entirely for archived roles", () => {
    renderCard(makeRole({ archived: true }))
    expect(screen.queryByRole("button", { name: labels.manageCta })).toBeNull()
  })

  it("hides the AI draft button in read mode and shows it in edit mode", () => {
    renderCard(makeRole())
    // The AI draft trigger is inside the edit-mode branch; read mode shows
    // only the manage menu trigger, not the AI button.
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.ai.fillCta,
      })
    ).toBeNull()
    // Once in edit mode the AI draft trigger becomes visible.
    startEditing()
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.ai.fillCta,
      })
    ).toBeDefined()
  })

  it("cancel discards edits and returns to read mode", () => {
    renderCard(makeRole())
    startEditing()
    // Edit mode: update the purpose textarea.
    fireEvent.change(
      screen.getByRole("textbox", { name: roleLabels.purpose }),
      { target: { value: "Discarded draft" } }
    )
    // Cancel without saving.
    fireEvent.click(screen.getByRole("button", { name: labels.cancelCta }))
    // Back in read mode: the manage trigger returns, no inputs remain.
    expect(screen.getByRole("button", { name: labels.manageCta })).toBeDefined()
    expect(
      screen.queryByRole("textbox", { name: roleLabels.purpose })
    ).toBeNull()
    // The original value is shown unchanged.
    expect(screen.getByText("Builds the product")).toBeDefined()
    // The mutation was never called.
    expect(updateRoleMock).not.toHaveBeenCalled()
  })

  it("edits the track and toasts the reset count", async () => {
    updateRoleMock.mockResolvedValueOnce({ levelsReset: 2 })
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        {/* The form wrapper makes Base UI render the track Select's hidden
            native input, the only way to drive a Select under happy-dom
            (its portal opens only on real pointer events). Same pattern as
            the family-picker and industry-select tests. */}
        <form>
          <RoleProfileCard
            orgId="org-1"
            isAdmin
            role={makeRole({ trackKey: "IC", trackName: "IC" })}
            tracks={[
              { key: "IC", name: "IC" },
              { key: "Lead", name: "Lead" },
            ]}
          />
        </form>
      </NextIntlClientProvider>
    )
    startEditing()
    // The track Select carries name="trackKey" so its hidden input is
    // unambiguous among the card's other Base UI selects (e.g. the family
    // picker's, which has no name).
    const hidden = document.querySelector(
      'input[name="trackKey"]'
    ) as HTMLInputElement
    fireEvent.change(hidden, { target: { value: "Lead" } })
    // The change handler resolves through a microtask; wait for the
    // controlled trigger to reflect it before saving.
    await waitFor(() => {
      expect(document.getElementById("profile-track")?.textContent).toContain(
        "Lead"
      )
    })
    fireEvent.click(screen.getByRole("button", { name: labels.saveCta }))
    await waitFor(() => {
      expect(updateRoleMock).toHaveBeenCalledWith(
        expect.objectContaining({ roleId: "role-1", trackKey: "Lead" })
      )
    })
    // The reset count surfaces as a toast; next-intl renders the ICU plural:
    // 2 -> "2 people's levels need re-confirming.".
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        "Track changed. 2 people's levels need re-confirming."
      )
    })
  })
})
