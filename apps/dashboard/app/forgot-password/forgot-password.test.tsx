import { fireEvent, render, waitFor, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
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
  const { container, unmount } = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ForgotPasswordPage />
    </NextIntlClientProvider>
  )
  return { scope: within(container), unmount }
}

describe("ForgotPasswordPage", () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    requestPasswordReset.mockClear()
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it("requests a reset with the email and redirectTo, then shows the neutral confirmation", async () => {
    const { scope, unmount } = renderPage()
    cleanup = unmount
    const input = scope.getByLabelText(emailLabel) as HTMLInputElement
    fireEvent.change(input, { target: { value: "user@example.com" } })
    fireEvent.submit(input.closest("form") as HTMLFormElement)

    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "user@example.com",
      redirectTo: "/reset-password",
    })
    await waitFor(() => {
      expect(scope.getByText(confirmation)).toBeTruthy()
    })
  })

  it("still shows the confirmation when the request throws (enumeration-safe)", async () => {
    requestPasswordReset.mockRejectedValueOnce(new Error("boom"))
    const { scope, unmount } = renderPage()
    cleanup = unmount
    const input = scope.getByLabelText(emailLabel) as HTMLInputElement
    fireEvent.change(input, { target: { value: "ghost@example.com" } })
    fireEvent.submit(input.closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(scope.getByText(confirmation)).toBeTruthy()
    })
  })
})
