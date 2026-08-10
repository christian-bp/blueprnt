import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { toast } from "@/lib/toast"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import messages from "@workspace/i18n/messages/en.json"
import { pickSelectOption } from "@/test/select"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const assignMock = vi.fn()
const eraseMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "people.assignments.assignPersonToRole") return assignMock
    if (ref === "people.erase.erasePersonAsOrg") return eraseMock
    return vi.fn()
  },
}))
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    people: {
      assignments: {
        assignPersonToRole: "people.assignments.assignPersonToRole",
      },
      erase: { erasePersonAsOrg: "people.erase.erasePersonAsOrg" },
      people: { updatePerson: "people.people.updatePerson" },
    },
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import { PersonActionsMenu } from "@/components/people/person-actions-menu"
import { openMenu } from "@/test/menu"

const m = messages.dashboard.people

const ROLES = [
  { roleId: "role1", title: "Software Engineer", trackKey: "IC" },
  { roleId: "role2", title: "Engineering Manager", trackKey: "M" },
]

function renderMenu(
  currentAssignment: { roleId: string; seniority: string } | null = {
    roleId: "role1",
    seniority: "IC3",
  }
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PersonActionsMenu
        person={{
          personId: "p1" as Id<"people">,
          displayName: "Alex Doe",
          gender: "Man",
          externalRef: "E-1",
          department: null,
          employmentStartDate: null,
          ftePercent: null,
        }}
        roles={ROLES}
        currentAssignment={currentAssignment}
      />
    </NextIntlClientProvider>
  )
}

function openActionsMenu() {
  return openMenu(screen.getByRole("button", { name: m.detail.actionsMenu }))
}

describe("PersonActionsMenu", () => {
  beforeEach(() => {
    assignMock.mockReset().mockResolvedValue("a1")
    eraseMock.mockReset()
    vi.mocked(toast.success).mockReset()
  })
  afterEach(() => cleanup())

  it("opens the erase dialog from the destructive item", async () => {
    renderMenu()
    await openActionsMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: m.erase.trigger }))
    expect(screen.getByRole("alertdialog")).toBeDefined()
  })

  it("edits the role: a track swap resets the seniority and saves a confirmed assignment", async () => {
    renderMenu()
    await openActionsMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: m.editPerson.title }))
    expect(screen.getByRole("dialog")).toBeDefined()

    // The dialog form.s role select, labeled by its FormLabel.
    await pickSelectOption(
      screen.getByRole("combobox", {
        name: messages.dashboard.people.detail.role,
      }),
      "Engineering Manager"
    )

    // role2 is on the M track; IC3 is invalid there, so the seniority falls
    // back to the track's first seniority and the form is dirty + valid.
    const save = screen.getByRole("button", {
      name: m.editPerson.cta,
    }) as HTMLButtonElement
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          personId: "p1",
          roleId: "role2",
          seniority: "M1",
          senioritySource: "confirmed",
        })
      )
    })
    expect(toast.success).toHaveBeenCalledWith(
      messages.dashboard.toast.personUpdated
    )
  })

  it("gates saving on a change: the pre-filled form starts disabled", async () => {
    renderMenu()
    await openActionsMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: m.editPerson.title }))
    const save = screen.getByRole("button", {
      name: m.editPerson.cta,
    }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it("assigns an unclassified person (empty form, valid after picking)", async () => {
    renderMenu(null)
    await openActionsMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: m.editPerson.title }))
    await pickSelectOption(
      screen.getByRole("combobox", {
        name: messages.dashboard.people.detail.role,
      }),
      "Software Engineer"
    )

    const save = screen.getByRole("button", {
      name: m.editPerson.cta,
    }) as HTMLButtonElement
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          roleId: "role1",
          seniority: "IC1",
          senioritySource: "confirmed",
        })
      )
    })
  })
})
