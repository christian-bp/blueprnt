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

const updateRoleMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: () => updateRoleMock,
  // The nested FamilyPicker lists families; none needed for these tests.
  useQuery: () => [],
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      roles: { updateRole: "assessment.roles.updateRole" },
      families: {
        listRoleFamilies: "assessment.families.listRoleFamilies",
        createRoleFamily: "assessment.families.createRoleFamily",
      },
    },
  },
}))

import {
  RoleProfileCard,
  type RoleProfile,
} from "@/components/roles/role-profile-card"

const labels = messages.dashboard.roles.detail
const roleLabels = messages.assessment.role
const familyLabels = messages.dashboard.roles.family

function makeRole(overrides?: Partial<RoleProfile>): RoleProfile {
  return {
    roleId: "role-1" as never,
    title: "Developer",
    function: "Engineering",
    team: "Core",
    trackName: "Individual contributor",
    familyId: null,
    familyName: null,
    purpose: "Builds the product",
    responsibilities: "Implementation",
    archived: false,
    ...overrides,
  }
}

function renderCard(role: RoleProfile) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleProfileCard orgId="org-1" role={role} />
    </NextIntlClientProvider>
  )
}

describe("RoleProfileCard", () => {
  beforeEach(() => {
    updateRoleMock.mockReset()
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

  it("saves only the changed fields and exits edit mode", async () => {
    updateRoleMock.mockResolvedValue(null)
    renderCard(makeRole())
    fireEvent.click(screen.getByRole("button", { name: labels.editCta }))
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
    await waitFor(() => {
      expect(screen.getByRole("button", { name: labels.editCta })).toBeDefined()
    })
  })

  it("stays in edit mode with an alert when the save fails", async () => {
    updateRoleMock.mockRejectedValue(new Error("ConvexError: roleLocked"))
    renderCard(makeRole())
    fireEvent.click(screen.getByRole("button", { name: labels.editCta }))
    fireEvent.change(screen.getByRole("textbox", { name: roleLabels.team }), {
      target: { value: "Other" },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.saveCta }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(screen.getByRole("textbox", { name: roleLabels.team })).toBeDefined()
  })

  it("shows the family name in read mode, or the none label when unset", () => {
    renderCard(makeRole({ familyId: "f-tech", familyName: "Tech" }))
    expect(screen.getByText("Tech")).toBeDefined()
    cleanup()
    renderCard(makeRole())
    expect(screen.getByText(familyLabels.none)).toBeDefined()
  })

  it("leaves the family untouched when only a text field changes", async () => {
    updateRoleMock.mockResolvedValue(null)
    renderCard(makeRole({ familyId: "f-tech", familyName: "Tech" }))
    fireEvent.click(screen.getByRole("button", { name: labels.editCta }))
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

  it("hides the edit button for archived roles", () => {
    renderCard(makeRole({ archived: true }))
    expect(screen.queryByRole("button", { name: labels.editCta })).toBeNull()
  })
})
