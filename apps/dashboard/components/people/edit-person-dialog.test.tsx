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
import { FULL_TIME_HOURS_MAX } from "@workspace/constants"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("@/lib/toast", () => ({
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
  // The org's full-time hours default drives the hours field's placeholder.
  useQuery: (ref: unknown) => {
    if (ref === "accounts.organization.getOrganizationSettings") {
      return { fullTimeHoursPerMonth: 165, country: "se" }
    }
    return undefined
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      organization: {
        getOrganizationSettings:
          "accounts.organization.getOrganizationSettings",
      },
    },
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

import { toast } from "@/lib/toast"
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
  fullTimeHoursPerMonth: null,
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
        currentAssignment={{ roleId: "role1", seniority: "IC3" }}
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
        // The hours field is optional and left empty here (the fixture
        // carries no value of its own): submits null, not undefined.
        fullTimeHoursPerMonth: null,
        gestureId: expect.any(String),
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      messages.dashboard.toast.personUpdated
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
    // The unchanged role/seniority pair writes no new assignment.
    expect(assignMock).not.toHaveBeenCalled()
  })

  it("submits a typed full-time hours value", async () => {
    renderDialog()
    const input = screen.getByLabelText(fields.fullTimeHoursLabel)
    fireEvent.change(input, { target: { value: "150" } })
    await waitFor(() => {
      expect(saveButton().hasAttribute("disabled")).toBe(false)
    })
    // Submitted via the form, not a click on the button: happy-dom's native
    // step-mismatch check on a step="0.01" number input has a floating-point
    // tolerance bug that blocks a click-driven implicit submission even for
    // a value real browsers accept (150 % 0.01 rounds to ~0.01 instead of 0).
    // Dispatching the submit event directly exercises the same
    // form.handleSubmit(onSubmit) path without going through that check.
    fireEvent.submit(input.closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(updatePersonMock).toHaveBeenCalledWith(
        expect.objectContaining({ fullTimeHoursPerMonth: 150 })
      )
    })
  })

  it("blocks submit for a full-time hours value of 0 or above the max", async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(fields.fullTimeHoursLabel), {
      target: { value: "0" },
    })
    fireEvent.blur(screen.getByLabelText(fields.fullTimeHoursLabel))
    await waitFor(() => {
      expect(saveButton().hasAttribute("disabled")).toBe(true)
    })

    fireEvent.change(screen.getByLabelText(fields.fullTimeHoursLabel), {
      target: { value: "401" },
    })
    fireEvent.blur(screen.getByLabelText(fields.fullTimeHoursLabel))
    await waitFor(() => {
      expect(saveButton().hasAttribute("disabled")).toBe(true)
    })
  })

  it("enables save at exactly the max and disables it just past the max", async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(fields.fullTimeHoursLabel), {
      target: { value: String(FULL_TIME_HOURS_MAX) },
    })
    fireEvent.blur(screen.getByLabelText(fields.fullTimeHoursLabel))
    await waitFor(() => {
      expect(saveButton().hasAttribute("disabled")).toBe(false)
    })

    fireEvent.change(screen.getByLabelText(fields.fullTimeHoursLabel), {
      target: { value: String(FULL_TIME_HOURS_MAX + 0.01) },
    })
    fireEvent.blur(screen.getByLabelText(fields.fullTimeHoursLabel))
    await waitFor(() => {
      expect(saveButton().hasAttribute("disabled")).toBe(true)
    })
  })

  it("carries the org default in the hours field's placeholder", () => {
    renderDialog()
    const input = screen.getByLabelText(
      fields.fullTimeHoursLabel
    ) as HTMLInputElement
    expect(input.placeholder).toBe("Default: 165")
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
