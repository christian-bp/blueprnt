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

// The page reads the reset token from the URL and talks to the auth client;
// stub both so we can exercise the client-side validation in isolation.
const { resetPassword, push } = vi.hoisted(() => ({
  resetPassword: vi.fn(
    async (): Promise<{
      error: { message: string; code?: string } | null
    }> => ({
      error: null,
    })
  ),
  push: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("token=tok"),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { resetPassword },
}))

import ResetPasswordPage from "./page"

const passwordLabel = en.dashboard.auth.resetPassword.passwordLabel
const confirmLabel = en.dashboard.auth.resetPassword.confirmLabel
const minLen = en.dashboard.validation.minLength.replace("{min}", "8")

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ResetPasswordPage />
    </NextIntlClientProvider>
  )
}

// The form gates on a matching confirm field, so fill both.
function fillPasswords(value: string) {
  fireEvent.change(screen.getByLabelText(passwordLabel), { target: { value } })
  fireEvent.change(screen.getByLabelText(confirmLabel), { target: { value } })
}

function submit() {
  const input = screen.getByLabelText(passwordLabel)
  fireEvent.submit(input.closest("form") as HTMLFormElement)
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    resetPassword.mockReset()
    resetPassword.mockResolvedValue({ error: null })
    push.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("shows the min-length error and does not call reset when the password is too short", async () => {
    renderPage()
    fillPasswords("short77")
    submit()
    await waitFor(() => {
      expect(screen.getByText(minLen)).toBeDefined()
      expect(resetPassword).not.toHaveBeenCalled()
    })
  })

  it("resets the password and navigates home when long enough", async () => {
    renderPage()
    fillPasswords("longeno8")
    submit()
    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        newPassword: "longeno8",
        token: "tok",
      })
    })
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/")
    })
  })

  it("shows the error alert when reset returns an error", async () => {
    resetPassword.mockResolvedValue({ error: { message: "bad" } })
    renderPage()
    fillPasswords("longeno8")
    submit()
    await waitFor(() => {
      expect(
        screen.getByText(en.dashboard.auth.resetPassword.error)
      ).toBeDefined()
      expect(push).not.toHaveBeenCalled()
    })
  })

  it("shows the compromised-password message when the password is breached", async () => {
    resetPassword.mockResolvedValue({
      error: { message: "compromised", code: "PASSWORD_COMPROMISED" },
    })
    renderPage()
    fillPasswords("longeno8")
    submit()
    await waitFor(() => {
      expect(
        screen.getByText(en.dashboard.auth.resetPassword.compromised)
      ).toBeDefined()
      expect(push).not.toHaveBeenCalled()
    })
  })
})
