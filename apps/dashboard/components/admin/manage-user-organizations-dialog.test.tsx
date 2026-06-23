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

const { addMembershipMock, setMembershipRoleMock, removeMembershipMock } =
  vi.hoisted(() => ({
    addMembershipMock: vi.fn(),
    setMembershipRoleMock: vi.fn(),
    removeMembershipMock: vi.fn(),
  }))

// Two orgs; the user is already a member of org-1.
const MEMBERSHIPS = [{ orgId: "org-1", name: "Acme Corp", role: "editor" }]
const ALL_ORGS = [
  { orgId: "org-1", name: "Acme Corp", slug: "acme-corp" },
  { orgId: "org-2", name: "Beta Inc", slug: "beta-inc" },
]
// All orgs already joined — addable list will be empty.
const ALL_ORGS_ALREADY_MEMBER = [
  { orgId: "org-1", name: "Acme Corp", slug: "acme-corp" },
]

let mockAllOrgs: typeof ALL_ORGS | typeof ALL_ORGS_ALREADY_MEMBER = ALL_ORGS

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "platform.admin.addMembership") return addMembershipMock
    if (ref === "platform.admin.setMembershipRole") return setMembershipRoleMock
    if (ref === "platform.admin.removeMembership") return removeMembershipMock
    return vi.fn()
  },
  useQuery: (ref: unknown) => {
    if (ref === "platform.admin.listOrganizationsForUser") return MEMBERSHIPS
    if (ref === "platform.admin.listOrganizations") return mockAllOrgs
    return undefined
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    platform: {
      admin: {
        listOrganizationsForUser: "platform.admin.listOrganizationsForUser",
        listOrganizations: "platform.admin.listOrganizations",
        addMembership: "platform.admin.addMembership",
        setMembershipRole: "platform.admin.setMembershipRole",
        removeMembership: "platform.admin.removeMembership",
      },
    },
  },
}))

import { ManageUserOrganizationsDialog } from "@/components/admin/manage-user-organizations-dialog"

const user = { authId: "user-1", name: "Alice", email: "alice@example.com" }

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ManageUserOrganizationsDialog
        user={user}
        open={true}
        onOpenChange={() => {}}
      />
    </NextIntlClientProvider>
  )
}

describe("ManageUserOrganizationsDialog", () => {
  beforeEach(() => {
    addMembershipMock.mockReset()
    setMembershipRoleMock.mockReset()
    removeMembershipMock.mockReset()
    mockAllOrgs = ALL_ORGS
  })
  afterEach(() => {
    cleanup()
  })

  it("renders the dialog title with the user name", () => {
    renderDialog()
    expect(screen.getByText("Organizations for Alice")).toBeDefined()
  })

  it("lists current memberships", () => {
    renderDialog()
    expect(screen.getByText("Acme Corp")).toBeDefined()
  })

  it("shows noOrgsAvailable message and hides add form when user is in all orgs", () => {
    mockAllOrgs = ALL_ORGS_ALREADY_MEMBER
    renderDialog()
    expect(
      screen.getByText("There are no other organizations to add.")
    ).toBeDefined()
    expect(document.querySelector("form")).toBeNull()
  })

  it("calls addMembership with authId, orgId, and role on Add", async () => {
    addMembershipMock.mockResolvedValue(null)
    renderDialog()

    // The add section is wrapped in a <form>, which causes Radix Select to
    // render hidden native <select> elements. The membership list also has one
    // role select per row (one row here: Acme Corp). The hidden selects in the
    // form are at indices 0 (org) and 1 (role).
    // We target the form's selects directly.
    const form = document.querySelector("form") as HTMLFormElement
    const formSelects = Array.from(
      form.querySelectorAll("select")
    ) as HTMLSelectElement[]

    // formSelects[0] = org select; formSelects[1] = role select
    if (formSelects[0]) {
      fireEvent.change(formSelects[0], { target: { value: "org-2" } })
    }

    // Submit the form (the Add button is type="submit").
    fireEvent.submit(form)

    await waitFor(() => {
      expect(addMembershipMock).toHaveBeenCalledWith({
        authId: "user-1",
        orgId: "org-2",
        role: "editor",
      })
    })
  })
})
