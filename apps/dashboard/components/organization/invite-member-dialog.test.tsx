import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const inviteMember = vi.fn(async (..._args: unknown[]) => ({
  data: {},
  error: null,
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: { inviteMember: (...a: unknown[]) => inviteMember(...a) },
  },
}))

import { InviteMemberDialog } from "./invite-member-dialog"

const t = en.dashboard.organization.invite

function renderDialog(onInvited = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <InviteMemberDialog orgId="o1" onInvited={onInvited} />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("InviteMemberDialog", () => {
  it("sends an invitation with the email, role, and org id", async () => {
    const onInvited = vi.fn()
    renderDialog(onInvited)
    fireEvent.click(screen.getByRole("button", { name: t.cta }))
    const email = await screen.findByLabelText(t.emailLabel)
    fireEvent.change(email, { target: { value: "new@acme.se" } })
    fireEvent.blur(email)
    const submit = screen.getByRole("button", { name: t.submit })
    await waitFor(() =>
      expect((submit as HTMLButtonElement).disabled).toBe(false)
    )
    fireEvent.click(submit)
    await waitFor(() =>
      expect(inviteMember).toHaveBeenCalledWith({
        email: "new@acme.se",
        role: "editor",
        organizationId: "o1",
      })
    )
    await waitFor(() => expect(onInvited).toHaveBeenCalled())
  })
})
