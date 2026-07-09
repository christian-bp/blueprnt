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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const updatePersonMock = vi.fn()

const assignMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "people.people.updatePerson") return updatePersonMock
    if (ref === "people.assignments.assignPersonToRole") return assignMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    people: {
      assignments: {
        assignPersonToRole: "people.assignments.assignPersonToRole",
      },
      people: { updatePerson: "people.people.updatePerson" },
    },
  },
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import { toast } from "sonner"
import {
  type EditablePerson,
  EditPersonDialog,
} from "@/components/people/edit-person-dialog"

const labels = messages.dashboard.people.editPerson
const fields = messages.dashboard.people.personForm

const PERSON: EditablePerson = {
  personId: "p1" as Id<"people">,
  displayName: "Anna Svensson",
  gender: "Kvinna",
  externalRef: "1001",
  department: "Engineering",
  employmentStartDate: "2024-03-01",
  ftePercent: 100,
}

const ROLES = [
  { roleId: "role1", title: "Software Engineer", trackKey: "IC" },
  { roleId: "role2", title: "Engineering Manager", trackKey: "M" },
]

function renderDialog(onOpenChange = vi.fn(), person = PERSON) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <EditPersonDialog
        open
        onOpenChange={onOpenChange}
        person={person}
        roles={ROLES}
        currentAssignment={{ roleId: "role1", level: "IC3" }}
      />
    </NextIntlClientProvider>
  )
  return onOpenChange
}

function saveButton() {
  return screen.getByRole("button", { name: labels.cta })
}

describe("EditPersonDialog", () => {
  beforeEach(() => {
    updatePersonMock.mockReset().mockResolvedValue(null)
    assignMock.mockReset().mockResolvedValue("a1")
    vi.mocked(toast.success).mockReset()
  })
  afterEach(() => cleanup())

  it("prefills the person's values and gates save on dirty", async () => {
    renderDialog()
    expect(
      (screen.getByLabelText(fields.nameLabel) as HTMLInputElement).value
    ).toBe("Anna Svensson")
    expect(
      (screen.getByLabelText(fields.departmentLabel) as HTMLInputElement).value
    ).toBe("Engineering")
    // Pristine: valid but unchanged, so save stays disabled (no no-op write).
    expect(saveButton().hasAttribute("disabled")).toBe(true)

    fireEvent.change(screen.getByLabelText(fields.departmentLabel), {
      target: { value: "Finance" },
    })
    await waitFor(() => {
      expect(saveButton().hasAttribute("disabled")).toBe(false)
    })
  })

  it("saves all fields (cleared ones as empty), toasts, and closes", async () => {
    const onOpenChange = renderDialog()
    fireEvent.change(screen.getByLabelText(fields.departmentLabel), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText(fields.fteLabel), {
      target: { value: "" },
    })
    await waitFor(() => {
      expect(saveButton().hasAttribute("disabled")).toBe(false)
    })
    fireEvent.click(saveButton())

    await waitFor(() => {
      expect(updatePersonMock).toHaveBeenCalledWith({
        orgId: "org-1",
        personId: "p1",
        displayName: "Anna Svensson",
        gender: "Kvinna",
        externalRef: "1001",
        department: "",
        employmentStartDate: "2024-03-01",
        ftePercent: null,
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      messages.dashboard.toast.personUpdated
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
    // The unchanged role/level pair writes no new assignment.
    expect(assignMock).not.toHaveBeenCalled()
  })

  it("surfaces a taken employee number inline and stays open", async () => {
    updatePersonMock.mockRejectedValue(new Error("errors.personRefExists"))
    const onOpenChange = renderDialog()
    fireEvent.change(screen.getByLabelText(fields.externalRefLabel), {
      target: { value: "2002" },
    })
    await waitFor(() => {
      expect(saveButton().hasAttribute("disabled")).toBe(false)
    })
    fireEvent.click(saveButton())

    await waitFor(() => {
      expect(screen.getByText(messages.errors.personRefExists)).toBeDefined()
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
