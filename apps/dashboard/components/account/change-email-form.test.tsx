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

// Stub the auth client: useSession returns a fixed user; changeEmail is a spy.
const { changeEmail, useSession } = vi.hoisted(() => ({
  changeEmail: vi.fn(
    async (): Promise<{ error: { message: string } | null }> => ({
      error: null,
    })
  ),
  useSession: vi.fn(() => ({
    data: { user: { email: "old@x.com", name: "Test User" } },
  })),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { changeEmail, useSession },
}))

import { ChangeEmailForm } from "./change-email-form"

const cardTitle = en.dashboard.account.email.title
const newLabel = en.dashboard.account.email.newLabel
const changeBtn = en.dashboard.account.email.change
const confirmTitle = en.dashboard.account.email.confirmationTitle
const errorMsg = en.dashboard.account.email.error
const emailUnchanged = en.dashboard.validation.emailUnchanged

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ChangeEmailForm />
    </NextIntlClientProvider>
  )
}

function submit(form: HTMLFormElement) {
  fireEvent.submit(form)
}

describe("ChangeEmailForm", () => {
  beforeEach(() => {
    changeEmail.mockReset()
    changeEmail.mockResolvedValue({ error: null })
    useSession.mockReset()
    useSession.mockReturnValue({
      data: { user: { email: "old@x.com", name: "Test User" } },
    })
  })
  afterEach(() => {
    cleanup()
  })

  it("renders the card title as the section heading", () => {
    renderForm()
    expect(screen.getByText(cardTitle)).toBeDefined()
  })

  it("renders the current email as a read-only value", () => {
    renderForm()
    expect(screen.getByText("old@x.com")).toBeDefined()
  })

  it("calls changeEmail with the new address and callbackURL on valid submit", async () => {
    renderForm()
    const input = screen.getByLabelText(newLabel)
    fireEvent.change(input, { target: { value: "new@example.com" } })
    const form = input.closest("form") as HTMLFormElement
    submit(form)
    await waitFor(() => {
      expect(changeEmail).toHaveBeenCalledWith({
        newEmail: "new@example.com",
        callbackURL: "/account/email-verified",
      })
    })
  })

  it("shows the confirmation copy after a successful submit", async () => {
    renderForm()
    const input = screen.getByLabelText(newLabel)
    fireEvent.change(input, { target: { value: "new@example.com" } })
    const form = input.closest("form") as HTMLFormElement
    submit(form)
    await waitFor(() => {
      expect(screen.getByText(confirmTitle)).toBeDefined()
    })
  })

  it("blocks submit when the new email matches the current email", async () => {
    renderForm()
    const input = screen.getByLabelText(newLabel)
    // Same email as the mocked current; Zod refine should block it.
    fireEvent.change(input, { target: { value: "old@x.com" } })
    fireEvent.blur(input)
    await waitFor(() => {
      expect(screen.getByText(emailUnchanged)).toBeDefined()
    })
    const btn = screen.getByRole("button", { name: changeBtn })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect(changeEmail).not.toHaveBeenCalled()
  })

  it("shows the error alert when changeEmail returns an error", async () => {
    changeEmail.mockResolvedValue({ error: { message: "failed" } })
    renderForm()
    const input = screen.getByLabelText(newLabel)
    fireEvent.change(input, { target: { value: "new@example.com" } })
    const form = input.closest("form") as HTMLFormElement
    submit(form)
    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeDefined()
    })
    expect(screen.queryByText(confirmTitle)).toBeNull()
  })
})
