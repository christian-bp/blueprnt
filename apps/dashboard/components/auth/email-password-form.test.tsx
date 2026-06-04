import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { EmailPasswordForm } from "./email-password-form"

function renderForm(mode: "signIn" | "signUp") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EmailPasswordForm mode={mode} onSubmit={async () => {}} />
    </NextIntlClientProvider>
  )
}

describe("EmailPasswordForm", () => {
  it("renders email and password fields for sign-in", () => {
    renderForm("signIn")
    expect(screen.getByLabelText("Email")).toBeDefined()
    expect(screen.getByLabelText("Password")).toBeDefined()
    expect(screen.queryByLabelText("Name")).toBeNull()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined()
  })

  it("adds the name field for sign-up", () => {
    renderForm("signUp")
    expect(screen.getByLabelText("Name")).toBeDefined()
  })
})
