import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

// Stub auth client and the HIBP helper so we can test client-side paths in
// isolation without real network calls.
const { changePassword, isPasswordPwned } = vi.hoisted(() => ({
  changePassword: vi.fn(
    async (): Promise<{
      error: { message: string; code?: string } | null
    }> => ({
      error: null,
    })
  ),
  isPasswordPwned: vi.fn(async (): Promise<boolean> => false),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { changePassword },
}))
vi.mock("@/lib/pwned-password", () => ({ isPasswordPwned }))

import { ChangePasswordForm } from "./change-password-form"

const t = en.dashboard.account.security.password
const tv = en.dashboard.validation

const currentLabel = t.currentLabel
const newLabel = t.newLabel
const confirmLabel = t.confirmLabel
const minLen = tv.minLength.replace("{min}", "8")

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ChangePasswordForm />
    </NextIntlClientProvider>
  )
}

function fill(
  currentValue: string,
  newValue: string,
  confirmValue: string = newValue
) {
  fireEvent.change(screen.getByLabelText(currentLabel), {
    target: { value: currentValue },
  })
  fireEvent.change(screen.getByLabelText(newLabel), {
    target: { value: newValue },
  })
  fireEvent.change(screen.getByLabelText(confirmLabel), {
    target: { value: confirmValue },
  })
}

function submit() {
  const input = screen.getByLabelText(currentLabel)
  fireEvent.submit(input.closest("form") as HTMLFormElement)
}

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    changePassword.mockReset()
    changePassword.mockResolvedValue({ error: null })
    isPasswordPwned.mockReset()
    isPasswordPwned.mockResolvedValue(false)
  })
  afterEach(() => {
    cleanup()
  })

  it("blocks submit and shows min-length error when the new password is too short", async () => {
    renderForm()
    fill("current123", "short77")
    submit()
    await waitFor(() => {
      expect(screen.getByText(minLen)).toBeDefined()
      expect(changePassword).not.toHaveBeenCalled()
    })
  })

  it("blocks submit and shows the mismatch error when confirm does not match", async () => {
    renderForm()
    fill("current123", "longeno8", "different9")
    submit()
    await waitFor(() => {
      expect(screen.getByText(tv.passwordsMatch)).toBeDefined()
      expect(changePassword).not.toHaveBeenCalled()
    })
  })

  it("calls changePassword with the correct args on a valid submit", async () => {
    renderForm()
    fill("current123", "longeno8")
    submit()
    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "current123",
        newPassword: "longeno8",
        revokeOtherSessions: true,
      })
    })
  })

  it("shows the compromised message and does not call changePassword when HIBP pre-check is breached", async () => {
    isPasswordPwned.mockResolvedValue(true)
    renderForm()
    fill("current123", "longeno8")
    submit()
    await waitFor(() => {
      expect(screen.getByText(t.compromised)).toBeDefined()
      expect(changePassword).not.toHaveBeenCalled()
    })
  })

  it("shows the wrong-password message when changePassword returns INVALID_PASSWORD", async () => {
    changePassword.mockResolvedValue({
      error: { message: "invalid", code: "INVALID_PASSWORD" },
    })
    renderForm()
    fill("wrongcurrent", "longeno8")
    submit()
    await waitFor(() => {
      expect(screen.getByText(t.wrongPassword)).toBeDefined()
    })
  })

  it("shows the saved confirmation on a successful submit", async () => {
    renderForm()
    fill("current123", "longeno8")
    submit()
    await waitFor(() => {
      expect(screen.getByText(t.saved)).toBeDefined()
    })
  })
})
