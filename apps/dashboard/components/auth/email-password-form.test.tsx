import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
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

function renderForm(
  onSubmit: (v: {
    email: string
    password: string
  }) => Promise<void> = async () => {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EmailPasswordForm onSubmit={onSubmit} />
    </NextIntlClientProvider>
  )
}

function submitForm() {
  const form = screen.getByLabelText("Email").closest("form") as HTMLFormElement
  fireEvent.submit(form)
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

  it("shows the invalid-email error and does not submit on a malformed email", async () => {
    const onSubmit = vi.fn(async () => {})
    renderForm(onSubmit)
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    })
    submitForm()
    await waitFor(() => {
      expect(
        screen.getByText(en.dashboard.validation.invalidEmail)
      ).toBeDefined()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  it("shows the required error and does not submit when the password is empty", async () => {
    const onSubmit = vi.fn(async () => {})
    renderForm(onSubmit)
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    })
    // Leave the password empty.
    submitForm()
    await waitFor(() => {
      expect(screen.getByText(en.dashboard.validation.required)).toBeDefined()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  it("submits the email and password when valid", async () => {
    const onSubmit = vi.fn(async () => {})
    renderForm(onSubmit)
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    })
    submitForm()
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret",
      })
    })
  })

  it("shows the rate-limit message when sign-in is throttled (429)", async () => {
    const onSubmit = vi.fn(async () => {
      throw Object.assign(new Error("rate limited"), { status: 429 })
    })
    renderForm(onSubmit)
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    })
    submitForm()
    await waitFor(() => {
      expect(screen.getByText(en.dashboard.auth.rateLimited)).toBeDefined()
    })
  })

  it("shows the invalid-credentials message on a 401", async () => {
    const onSubmit = vi.fn(async () => {
      throw Object.assign(new Error("unauthorized"), {
        status: 401,
        code: "INVALID_EMAIL_OR_PASSWORD",
      })
    })
    renderForm(onSubmit)
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    })
    submitForm()
    await waitFor(() => {
      expect(
        screen.getByText(en.dashboard.auth.invalidCredentials)
      ).toBeDefined()
    })
  })

  it("shows the generic error for a non-rate-limit failure", async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error("nope")
    })
    renderForm(onSubmit)
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    })
    submitForm()
    await waitFor(() => {
      expect(screen.getByText(en.dashboard.auth.error)).toBeDefined()
    })
  })
})
