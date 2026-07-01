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

const createRoleMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "assessment.roles.createRole") return createRoleMock
    return vi.fn()
  },
  // The nested FamilyPicker lists families; no families needed for these tests.
  useQuery: () => [],
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      roles: { createRole: "assessment.roles.createRole" },
      families: {
        listRoleFamilies: "assessment.families.listRoleFamilies",
        createRoleFamily: "assessment.families.createRoleFamily",
      },
    },
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { CreateRoleDialog } from "@/components/roles/create-role-dialog"

const labels = messages.dashboard.roles.create

const TRACKS = [
  { key: "IC", name: "Individual contributor", order: 1 },
  { key: "M", name: "Manager", order: 2 },
] as const

function renderDialog(
  existing: { title: string; familyId: string | null }[] = []
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CreateRoleDialog
        orgId="org-1"
        tracks={[...TRACKS]}
        triggerLabel={labels.title}
        existing={existing}
      />
    </NextIntlClientProvider>
  )
}

describe("CreateRoleDialog", () => {
  beforeEach(() => {
    createRoleMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("opens on the trigger and submits the basics, then navigates", async () => {
    createRoleMock.mockResolvedValue({ roleId: "role-new", slug: "role-new" })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "Junior Developer" },
    })
    fireEvent.change(screen.getByLabelText(labels.functionLabel), {
      target: { value: "Engineering" },
    })
    fireEvent.change(screen.getByLabelText(labels.teamLabel), {
      target: { value: "Core" },
    })
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      // Exact match: with no family picked, createRole carries no familyId key.
      expect(createRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        title: "Junior Developer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
      })
    })
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/roles/role-new")
    })
  })

  it("keeps the dialog open and shows an alert when create fails", async () => {
    createRoleMock.mockRejectedValue(new Error("ConvexError: invalidInput"))
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "X" },
    })
    fireEvent.change(screen.getByLabelText(labels.functionLabel), {
      target: { value: "F" },
    })
    fireEvent.change(screen.getByLabelText(labels.teamLabel), {
      target: { value: "T" },
    })
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(screen.getByLabelText(labels.titleLabel)).toBeDefined()
  })

  it("blocks submit and shows required errors when the basics are empty", async () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(
        screen.getAllByText(messages.dashboard.validation.required).length
      ).toBeGreaterThan(0)
      expect(createRoleMock).not.toHaveBeenCalled()
    })
  })

  it("blocks a title already taken in the selected family without calling the server", async () => {
    renderDialog([{ title: "Manager", familyId: null }])
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "Manager" },
    })
    fireEvent.change(screen.getByLabelText(labels.functionLabel), {
      target: { value: "F" },
    })
    fireEvent.change(screen.getByLabelText(labels.teamLabel), {
      target: { value: "T" },
    })
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getByText(messages.errors.roleExists)).toBeDefined()
    })
    // The duplicate never reaches the server (no thrown ConvexError).
    expect(createRoleMock).not.toHaveBeenCalled()
  })

  it("creates the role in the given family and hides the family picker", async () => {
    createRoleMock.mockResolvedValue({ roleId: "role-new", slug: "role-new" })
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CreateRoleDialog
          orgId="org-1"
          tracks={[...TRACKS]}
          triggerLabel={labels.title}
          existing={[]}
          defaultFamilyId="fam-1"
        />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: labels.title }))
    // The family is fixed by context, so the picker is not rendered.
    expect(screen.queryByText(messages.model.roleFamily)).toBeNull()
    fireEvent.change(screen.getByLabelText(labels.titleLabel), {
      target: { value: "Backend Developer" },
    })
    fireEvent.change(screen.getByLabelText(labels.functionLabel), {
      target: { value: "Engineering" },
    })
    fireEvent.change(screen.getByLabelText(labels.teamLabel), {
      target: { value: "Core" },
    })
    const form = screen
      .getByLabelText(labels.titleLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        title: "Backend Developer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
        familyId: "fam-1",
      })
    })
  })
})
