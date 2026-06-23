import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { EmailPasswordForm } from "./email-password-form"

// next/link needs the Next router context; render it as a plain anchor.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EmailPasswordForm onSubmit={async () => {}} />
    </NextIntlClientProvider>
  )
}

// No global RTL auto-cleanup is configured in this repo; clean up between
// tests so the two renders do not both match document-wide queries.
afterEach(() => {
  cleanup()
})

describe("EmailPasswordForm", () => {
  it("renders the sign-in fields", () => {
    renderForm()
    expect(screen.getByLabelText("Email")).toBeDefined()
    expect(screen.getByLabelText("Password")).toBeDefined()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined()
  })

  it("renders a forgot-password link pointing to /forgot-password", () => {
    renderForm()
    const link = screen.getByRole("link", {
      name: en.dashboard.auth.forgotPasswordLink,
    }) as HTMLAnchorElement
    expect(link.getAttribute("href")).toBe("/forgot-password")
  })
})
