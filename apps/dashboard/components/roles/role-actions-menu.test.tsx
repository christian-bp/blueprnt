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

function renderMenu(props: { archived?: boolean; isAdmin?: boolean } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleActionsMenu
        orgId="org-1"
        roleId={"role-1" as never}
        archived={props.archived ?? false}
        isAdmin={props.isAdmin ?? true}
      />
    </NextIntlClientProvider>
  )
}

describe("RoleActionsMenu", () => {
  beforeEach(() => {
    archiveRoleMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => cleanup())

  it("renders no trigger for a non-admin", () => {
    renderMenu({ isAdmin: false })
    expect(
      screen.queryByRole("button", { name: detail.actionsMenu })
    ).toBeNull()
  })

  it("renders no trigger for an archived role", () => {
    renderMenu({ archived: true })
    expect(
      screen.queryByRole("button", { name: detail.actionsMenu })
    ).toBeNull()
  })

  it("archives through the confirm dialog, then navigates to /roles", async () => {
    archiveRoleMock.mockResolvedValue(null)
    renderMenu()
    const trigger = screen.getByRole("button", { name: detail.actionsMenu })
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
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
