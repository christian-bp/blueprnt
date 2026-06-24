import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

// next/link needs the Next router context; render it as a plain anchor.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

// vi.mock is hoisted above imports; create the spy via vi.hoisted.
const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(async () => ({ error: null })),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { requestPasswordReset },
}))

import ForgotPasswordPage from "./page"

const emailLabel = en.dashboard.auth.email
const confirmation = en.dashboard.auth.forgotPassword.confirmation

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ForgotPasswordPage />
    </NextIntlClientProvider>
  )
}

function submit() {
  const input = screen.getByLabelText(emailLabel)
  fireEvent.submit(input.closest("form") as HTMLFormElement)
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    requestPasswordReset.mockReset()
    requestPasswordReset.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    cleanup()
  })

  it("shows the invalid-email error and does not request a reset on a malformed email", async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(emailLabel), {
      target: { value: "nope" },
    })
    submit()
    await waitFor(() => {
      expect(
        screen.getByText(en.dashboard.validation.invalidEmail)
      ).toBeDefined()
      expect(requestPasswordReset).not.toHaveBeenCalled()
    })
  })

  it("requests a reset with the email and redirectTo, then shows the neutral confirmation", async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(emailLabel), {
      target: { value: "user@example.com" },
    })
    submit()
    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith({
        email: "user@example.com",
        redirectTo: "/reset-password",
      })
    })
    await waitFor(() => {
      expect(screen.getByText(confirmation)).toBeTruthy()
    })
  })

  it("still shows the confirmation when the request throws (enumeration-safe)", async () => {
    requestPasswordReset.mockRejectedValueOnce(new Error("boom"))
    renderPage()
    fireEvent.change(screen.getByLabelText(emailLabel), {
      target: { value: "ghost@example.com" },
    })
    submit()
    await waitFor(() => {
      expect(screen.getByText(confirmation)).toBeTruthy()
    })
  })
})
