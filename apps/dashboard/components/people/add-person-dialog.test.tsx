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
import { pickSelectOption } from "@/test/select"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const createPersonMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "people.people.createPerson") return createPersonMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    people: {
      people: { createPerson: "people.people.createPerson" },
    },
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import { toast } from "sonner"
import { AddPersonDialog } from "@/components/people/add-person-dialog"

const labels = messages.dashboard.people.addPerson
const gender = messages.dashboard.people.gender

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AddPersonDialog />
    </NextIntlClientProvider>
  )
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: labels.title }))
}

function submitButton() {
  return screen.getByRole("button", { name: labels.cta })
}

// isValid updates async after the last change; wait for the gate to open
// before clicking, or the click lands on a still-disabled button.
async function clickSubmit() {
  await waitFor(() => {
    expect(submitButton().hasAttribute("disabled")).toBe(false)
  })
  fireEvent.click(submitButton())
}

async function fillRequired(name = "Anna Svensson") {
  fireEvent.change(screen.getByLabelText(labels.nameLabel), {
    target: { value: name },
  })
  await pickSelectOption(
    screen.getByRole("combobox", { name: labels.genderLabel }),
    gender.Kvinna
  )
}

describe("AddPersonDialog", () => {
  beforeEach(() => {
    createPersonMock.mockReset()
    pushMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("gates submit on name and gender, then submits the minimal payload and navigates", async () => {
    createPersonMock.mockResolvedValue({
      personId: "person-new",
      publicId: "abc12345",
    })
    renderDialog()
    openDialog()

    expect(submitButton().hasAttribute("disabled")).toBe(true)
    await fillRequired()
    await waitFor(() => {
      expect(submitButton().hasAttribute("disabled")).toBe(false)
    })

    fireEvent.click(submitButton())
    await waitFor(() => {
      // Exact match: empty optionals are omitted, never sent as "".
      expect(createPersonMock).toHaveBeenCalledWith({
        orgId: "org-1",
        displayName: "Anna Svensson",
        gender: "Kvinna",
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      messages.dashboard.toast.personCreated
    )
    expect(pushMock).toHaveBeenCalledWith("/people/abc12345")
  })

  it("includes the optional fields when filled", async () => {
    createPersonMock.mockResolvedValue({
      personId: "person-new",
      publicId: "abc12345",
    })
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.externalRefLabel), {
      target: { value: "1001" },
    })
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "Controller" },
    })
    fireEvent.change(screen.getByLabelText(labels.departmentLabel), {
      target: { value: "Finance" },
    })
    // The start date goes through the shadcn calendar picker: open it and
    // click day 15 of the displayed (current) month. Only the current
    // month's 15th is on the grid (outside days only pad the edge weeks),
    // so the text match is unambiguous. Picked BEFORE the gender select:
    // happy-dom leaves a picked select's popup open, and the lingering
    // popup swallows the next click (see test/select.ts).
    fireEvent.click(screen.getByRole("button", { name: labels.startDateLabel }))
    const dayButton = await waitFor(() => {
      const button = screen
        .getAllByRole("button")
        .find((candidate) => candidate.textContent === "15")
      expect(button).toBeDefined()
      return button as HTMLElement
    })
    fireEvent.click(dayButton)
    const today = new Date()
    const expectedIso = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-15`
    fireEvent.change(screen.getByLabelText(labels.fteLabel), {
      target: { value: "80" },
    })
    await fillRequired()

    await clickSubmit()
    await waitFor(() => {
      expect(createPersonMock).toHaveBeenCalledWith({
        orgId: "org-1",
        displayName: "Anna Svensson",
        gender: "Kvinna",
        externalRef: "1001",
        title: "Controller",
        department: "Finance",
        employmentStartDate: expectedIso,
        ftePercent: 80,
      })
    })
  })

  it("surfaces a taken employee number inline on its field and stays open", async () => {
    createPersonMock.mockRejectedValue(new Error("errors.personRefExists"))
    renderDialog()
    openDialog()
    await fillRequired()
    fireEvent.change(screen.getByLabelText(labels.externalRefLabel), {
      target: { value: "1001" },
    })

    await clickSubmit()
    await waitFor(() => {
      expect(screen.getByText(messages.errors.personRefExists)).toBeDefined()
    })
    expect(pushMock).not.toHaveBeenCalled()
    // The dialog stays open with the form intact for a correction.
    expect(screen.getByLabelText(labels.nameLabel)).toBeDefined()
  })

  it("shows the generic failure line on other errors", async () => {
    createPersonMock.mockRejectedValue(new Error("network"))
    renderDialog()
    openDialog()
    await fillRequired()

    await clickSubmit()
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(labels.error)
    })
    expect(pushMock).not.toHaveBeenCalled()
  })
})
