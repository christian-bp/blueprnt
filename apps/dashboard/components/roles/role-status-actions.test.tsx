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

const setRoleStatusMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: () => setRoleStatusMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: { roles: { setRoleStatus: "assessment.roles.setRoleStatus" } },
  },
}))

const orgMock = { orgId: "org-1", name: "Acme", role: "admin" }
vi.mock("@/components/org-context", () => ({
  useOrganization: () => orgMock,
}))

import { RoleStatusActions } from "@/components/roles/role-status-actions"

const labels = messages.dashboard.roles.status

function renderActions(status: string, canComplete = true) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleStatusActions
        orgId="org-1"
        roleId={"role-1" as never}
        status={status}
        canComplete={canComplete}
      />
    </NextIntlClientProvider>
  )
}

describe("RoleStatusActions", () => {
  beforeEach(() => {
    setRoleStatusMock.mockReset()
    orgMock.role = "admin"
  })
  afterEach(() => {
    cleanup()
  })

  it("offers submit and admin approve on a complete draft", async () => {
    setRoleStatusMock.mockResolvedValue(null)
    renderActions("draft")
    fireEvent.click(screen.getByRole("button", { name: labels.approveCta }))
    await waitFor(() => {
      expect(setRoleStatusMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        to: "approved",
      })
    })
    expect(screen.getByRole("button", { name: labels.submitCta })).toBeDefined()
  })

  it("disables forward actions and shows the hint when incomplete", () => {
    renderActions("draft", false)
    const submit = screen.getByRole("button", { name: labels.submitCta })
    expect(submit.hasAttribute("disabled")).toBe(true)
    expect(screen.getByText(labels.incompleteHint)).toBeDefined()
  })

  it("hides approve from editors", () => {
    orgMock.role = "editor"
    renderActions("inReview")
    expect(screen.queryByRole("button", { name: labels.approveCta })).toBeNull()
    expect(
      screen.getByRole("button", { name: labels.withdrawCta })
    ).toBeDefined()
  })

  it("shows the locked hint and a reopen trigger on approved roles", () => {
    renderActions("approved")
    expect(screen.getByText(labels.lockedHint)).toBeDefined()
    expect(screen.getByRole("button", { name: labels.reopenCta })).toBeDefined()
  })
})
