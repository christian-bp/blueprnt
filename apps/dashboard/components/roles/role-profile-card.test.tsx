import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { useState } from "react"
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

// Edit mode is controlled by the parent (the role actions menu owns the Edit
// trigger). This harness stands in for that parent: a button enters edit mode,
// mirroring the menu's Edit item.
function ControlledCard({ role }: { role: RoleProfile }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setEditing(true)}>
        start-edit
      </button>
      <RoleProfileCard
        orgId="org-1"
        role={role}
        editing={editing}
        onEditingChange={setEditing}
      />
    </>
  )
}

function renderCard(role: RoleProfile) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ControlledCard role={role} />
    </NextIntlClientProvider>
  )
}

function startEditing() {
  fireEvent.click(screen.getByText("start-edit"))
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
    // The card no longer owns an Edit button; editing is entered from the menu.
    expect(screen.queryByRole("button", { name: labels.editCta })).toBeNull()
  })

  it("saves only the changed fields and exits edit mode", async () => {
    updateRoleMock.mockResolvedValue(null)
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
    // Exits edit mode: the Save control is gone and the field is read-only again.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: labels.saveCta })).toBeNull()
    })
    expect(
      screen.queryByRole("textbox", { name: roleLabels.purpose })
    ).toBeNull()
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

  it("an archived role cannot enter edit mode (no Save control)", () => {
    renderCard(makeRole({ archived: true }))
    // Even if the parent opens edit mode, a locked role stays read-only.
    startEditing()
    expect(screen.queryByRole("button", { name: labels.saveCta })).toBeNull()
    expect(
      screen.queryByRole("textbox", { name: roleLabels.purpose })
    ).toBeNull()
  })
})
