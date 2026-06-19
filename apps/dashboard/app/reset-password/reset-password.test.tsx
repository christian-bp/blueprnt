import { fireEvent, render, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

// The page reads the reset token from the URL and talks to the auth client;
// stub both so we can exercise the client-side min-length gate in isolation.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("token=tok"),
}))

// vi.mock is hoisted above imports, so the spy must be created via vi.hoisted
// to exist when the factory runs.
const { resetPassword } = vi.hoisted(() => ({
  resetPassword: vi.fn(async () => ({ error: null })),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { resetPassword },
}))

import ResetPasswordPage from "./page"

// No global RTL auto-cleanup is configured in this repo, so scope queries to
// each render's container and unmount between tests.
function renderPage() {
  const { container, unmount } = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ResetPasswordPage />
    </NextIntlClientProvider>
  )
  return { scope: within(container), unmount }
}

const passwordLabel = en.dashboard.auth.resetPassword.passwordLabel

describe("ResetPasswordPage", () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    resetPassword.mockClear()
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it("disables submit until the password reaches the minimum length", () => {
    const { scope, unmount } = renderPage()
    cleanup = unmount
    const button = scope.getByRole("button") as HTMLButtonElement
    const input = scope.getByLabelText(passwordLabel) as HTMLInputElement

    // Empty: disabled.
    expect(button.disabled).toBe(true)

    // 7 chars (below the minimum of 8): still disabled.
    fireEvent.change(input, { target: { value: "short77" } })
    expect(button.disabled).toBe(true)

    // 8 chars: enabled.
    fireEvent.change(input, { target: { value: "longeno8" } })
    expect(button.disabled).toBe(false)
  })

  it("does not call the auth client when the password is too short", () => {
    const { scope, unmount } = renderPage()
    cleanup = unmount
    const input = scope.getByLabelText(passwordLabel) as HTMLInputElement
    const form = input.closest("form") as HTMLFormElement

    fireEvent.change(input, { target: { value: "short77" } })
    fireEvent.submit(form)
    expect(resetPassword).not.toHaveBeenCalled()
  })
})
