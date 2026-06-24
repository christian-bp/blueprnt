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

const { deleteUserMock } = vi.hoisted(() => ({ deleteUserMock: vi.fn() }))

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "platform.admin.deleteUser") return deleteUserMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: { platform: { admin: { deleteUser: "platform.admin.deleteUser" } } },
}))

import { DeleteUserDialog } from "@/components/admin/delete-user-dialog"

const labels = messages.dashboard.admin.users.delete
const EMAIL = "alice@example.com"

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DeleteUserDialog
        authId="user-1"
        name="Alice"
        email={EMAIL}
        open={true}
        onOpenChange={() => {}}
      />
    </NextIntlClientProvider>
  )
}

function confirmButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: labels.confirm,
  }) as HTMLButtonElement
}

describe("DeleteUserDialog", () => {
  beforeEach(() => {
    deleteUserMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("keeps the confirm action disabled until the email is typed exactly", async () => {
    renderDialog()
    expect(confirmButton().disabled).toBe(true)

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "wrong@example.com" },
    })
    await waitFor(() => {
      expect(confirmButton().disabled).toBe(true)
    })
    // A partial/non-matching value must NOT flag the field as invalid: this is a
    // confirm gate, not a nagging validated field.
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).not.toBe(
      "true"
    )

    fireEvent.change(screen.getByRole("textbox"), { target: { value: EMAIL } })
    await waitFor(() => {
      expect(confirmButton().disabled).toBe(false)
    })
  })

  it("deletes the user when confirmed", async () => {
    deleteUserMock.mockResolvedValue(undefined)
    renderDialog()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: EMAIL } })
    await waitFor(() => {
      expect(confirmButton().disabled).toBe(false)
    })
    fireEvent.click(confirmButton())
    await waitFor(() => {
      expect(deleteUserMock).toHaveBeenCalledWith({ authId: "user-1" })
    })
  })

  it("shows an error alert when the delete fails", async () => {
    deleteUserMock.mockRejectedValue(new Error("ConvexError: notFound"))
    renderDialog()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: EMAIL } })
    await waitFor(() => {
      expect(confirmButton().disabled).toBe(false)
    })
    fireEvent.click(confirmButton())
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(labels.error)
    })
  })
})
