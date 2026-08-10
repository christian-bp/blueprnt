import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/lib/toast", () => ({
  toast: { success: toastSuccess, error: toastError },
}))

const roster = [
  { userId: "u1", name: "Admin One", email: "a@x.se", role: "admin" },
  { userId: "u2", name: "Editor Two", email: "e@x.se", role: "editor" },
]
const invites = [
  {
    id: "inv1",
    email: "pending@x.se",
    role: "editor",
    status: "pending",
    expiresAt: "2099-01-01T00:00:00.000Z",
  },
]

const {
  useQueryMock,
  updateRole,
  removeMember,
  listInvitations,
  cancelInvitation,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  updateRole: vi.fn(async () => null),
  removeMember: vi.fn(async () => null),
  listInvitations: vi.fn(async (..._args: unknown[]) => ({
    data: invites,
    error: null,
  })),
  cancelInvitation: vi.fn(async (..._args: unknown[]) => ({ error: null })),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      organization: {
        listOrgMembers: "accounts.organization.listOrgMembers",
        updateMemberRole: "accounts.organization.updateMemberRole",
        removeMember: "accounts.organization.removeMember",
      },
    },
  },
}))
vi.mock("convex/react", () => ({
  useQuery: (...a: unknown[]) => useQueryMock(...a),
  useMutation: (ref: unknown) =>
    ref === "accounts.organization.updateMemberRole"
      ? updateRole
      : removeMember,
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "o1", name: "Acme", role: "admin" }),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "u1" } } }),
    organization: {
      listInvitations: (...a: unknown[]) => listInvitations(...a),
      cancelInvitation: (...a: unknown[]) => cancelInvitation(...a),
    },
  },
}))

import { OrganizationMembersSection } from "./organization-members-section"

const t = en.dashboard.organization.members
const ti = en.dashboard.organization.invitations

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <OrganizationMembersSection refreshKey={0} />
    </NextIntlClientProvider>
  )
}

// Opening a Base UI menu is a gesture, and the gesture can land before React
// has finished wiring the trigger up. The invitation row arrives from a
// promise, so findByRole resolves on the DOM mutation and a pointerDown fired
// at that instant opens nothing, leaving the test to time out on an item that
// was never rendered: that row is the only one here that does not come from the
// synchronous roster, and it is the only test that failed on CI, where a loaded
// machine widens the gap. Retrying until the item is on screen covers it
// without having to know which tick was too early, and the data-popup-open
// guard keeps a retry from toggling an already-open menu shut.
async function openMenu(trigger: HTMLElement, itemText: string) {
  await waitFor(() => {
    if (!trigger.hasAttribute("data-popup-open")) {
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
      fireEvent.click(trigger)
    }
    expect(screen.getByText(itemText)).toBeDefined()
  })
}

async function openRowMenu(name: string, itemText: string) {
  await openMenu(
    screen.getByRole("button", {
      name: t.memberActions.replace("{name}", name),
    }),
    itemText
  )
}

beforeEach(() => useQueryMock.mockReturnValue(roster))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("OrganizationMembersSection", () => {
  it("renders the Empty state with an icon when there are no members and no pending invitations", async () => {
    useQueryMock.mockReturnValue([])
    listInvitations.mockResolvedValueOnce({ data: [], error: null })
    renderSection()
    expect(await screen.findByText(t.empty)).toBeDefined()
    // The empty state's title is the page's nav label (organization.tabs.members).
    expect(
      screen.getByText(en.dashboard.organization.tabs.members)
    ).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
    expect(
      document.querySelector('[data-slot="empty-icon"] svg')
    ).not.toBeNull()
  })

  it("renders members and pending invitations in one table", async () => {
    renderSection()
    expect(screen.getByText("Admin One")).toBeDefined()
    expect(screen.getByText("Editor Two")).toBeDefined()
    // The invitation row loads asynchronously from the Better Auth client and
    // is marked with the Pending badge.
    expect(await screen.findByText("pending@x.se")).toBeDefined()
    expect(screen.getByText(t.pending)).toBeDefined()
  })

  it("removing an editor confirms then calls removeMember and fires memberRemoved toast", async () => {
    renderSection()
    await openRowMenu("Editor Two", t.remove)
    fireEvent.click(screen.getByText(t.remove))
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(
      within(dialog).getByRole("button", { name: t.removeConfirmCta })
    )
    await waitFor(() =>
      expect(removeMember).toHaveBeenCalledWith({ orgId: "o1", userId: "u2" })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        en.dashboard.toast.memberRemoved
      )
    )
  })

  it("disables removing the sole admin", async () => {
    renderSection()
    await openRowMenu("Admin One", t.remove)
    const removeItem = screen.getByText(t.remove)
    expect(
      removeItem.closest("[role=menuitem]")?.getAttribute("aria-disabled")
    ).toBe("true")
  })

  it("revoking a pending invitation calls cancelInvitation and fires invitationRevoked toast", async () => {
    renderSection()
    const trigger = await screen.findByRole("button", {
      name: ti.invitationActions.replace("{email}", "pending@x.se"),
    })
    await openMenu(trigger, ti.revoke)
    fireEvent.click(screen.getByText(ti.revoke))
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(
      within(dialog).getByRole("button", { name: ti.revokeConfirmCta })
    )
    await waitFor(() =>
      expect(cancelInvitation).toHaveBeenCalledWith({ invitationId: "inv1" })
    )
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        en.dashboard.toast.invitationRevoked
      )
    )
  })
})
