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

const archiveRoleMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "assessment.roles.archiveRole" ? archiveRoleMock : vi.fn(),
}))
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: { roles: { archiveRole: "assessment.roles.archiveRole" } },
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))

import { RoleActionsMenu } from "@/components/roles/role-actions-menu"

const detail = messages.dashboard.roles.detail
const archive = messages.dashboard.roles.archive

function renderMenu(
  props: {
    archived?: boolean
    isAdmin?: boolean
    editing?: boolean
    onEdit?: () => void
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleActionsMenu
        orgId="org-1"
        roleId={"role-1" as never}
        archived={props.archived ?? false}
        isAdmin={props.isAdmin ?? true}
        editing={props.editing ?? false}
        onEdit={props.onEdit ?? (() => {})}
      />
    </NextIntlClientProvider>
  )
}

function openMenu() {
  const trigger = screen.getByRole("button", { name: detail.actionsMenu })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
}

describe("RoleActionsMenu", () => {
  beforeEach(() => {
    archiveRoleMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => cleanup())

  it("shows Edit but not Archive for a non-admin, and triggers onEdit", () => {
    const onEdit = vi.fn()
    renderMenu({ isAdmin: false, onEdit })
    openMenu()
    expect(screen.getByRole("menuitem", { name: detail.editCta })).toBeDefined()
    expect(screen.queryByRole("menuitem", { name: archive.cta })).toBeNull()
    fireEvent.click(screen.getByRole("menuitem", { name: detail.editCta }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it("renders no trigger for an archived role", () => {
    renderMenu({ archived: true })
    expect(
      screen.queryByRole("button", { name: detail.actionsMenu })
    ).toBeNull()
  })

  it("renders no trigger for a non-admin while editing", () => {
    renderMenu({ isAdmin: false, editing: true })
    expect(
      screen.queryByRole("button", { name: detail.actionsMenu })
    ).toBeNull()
  })

  it("shows both Edit and Archive for an admin and archives via the confirm dialog", async () => {
    archiveRoleMock.mockResolvedValue(null)
    renderMenu()
    openMenu()
    expect(screen.getByRole("menuitem", { name: detail.editCta })).toBeDefined()
    fireEvent.click(screen.getByRole("menuitem", { name: archive.cta }))

    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(archiveRoleMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: archive.confirm }))
    await waitFor(() => {
      expect(archiveRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
      })
    })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/roles"))
  })
})
