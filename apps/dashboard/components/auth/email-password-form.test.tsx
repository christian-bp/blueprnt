import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { EmailPasswordForm } from "./email-password-form"

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EmailPasswordForm onSubmit={async () => {}} />
    </NextIntlClientProvider>
  )
}

describe("EmailPasswordForm", () => {
  it("renders the sign-in fields", () => {
    renderForm()
    expect(screen.getByLabelText("Email")).toBeDefined()
    expect(screen.getByLabelText("Password")).toBeDefined()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined()
  })
})
