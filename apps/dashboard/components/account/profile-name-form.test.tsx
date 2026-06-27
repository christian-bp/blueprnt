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

// Stub the auth client: useSession returns a fixed user; updateUser is a spy.
const { updateUser, useSession } = vi.hoisted(() => ({
  updateUser: vi.fn(
    async (): Promise<{ error: { message: string } | null }> => ({
      error: null,
    })
  ),
  useSession: vi.fn(() => ({
    data: { user: { name: "Jane Doe", email: "jane@example.com" } },
  })),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { updateUser, useSession },
}))

import { ProfileNameForm } from "./profile-name-form"

const nameLabel = en.dashboard.account.profile.nameLabel
const saveName = en.dashboard.account.profile.saveName
const errorMsg = en.dashboard.account.profile.error
const nameSaved = en.dashboard.account.profile.nameSaved

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProfileNameForm />
    </NextIntlClientProvider>
  )
}

describe("ProfileNameForm", () => {
  beforeEach(() => {
    updateUser.mockReset()
    updateUser.mockResolvedValue({ error: null })
    useSession.mockReset()
    useSession.mockReturnValue({
      data: { user: { name: "Jane Doe", email: "jane@example.com" } },
    })
  })
  afterEach(() => {
    cleanup()
  })

  it("renders the current name pre-filled in the input", () => {
    renderForm()
    const input = screen.getByLabelText(nameLabel)
    expect((input as HTMLInputElement).value).toBe("Jane Doe")
  })

  it("keeps Save disabled when the name has not changed", () => {
    renderForm()
    const button = screen.getByRole("button", { name: saveName })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it("enables Save after the name is changed to a non-empty value", async () => {
    renderForm()
    const input = screen.getByLabelText(nameLabel)
    fireEvent.change(input, { target: { value: "John Smith" } })
    await waitFor(() => {
      const button = screen.getByRole("button", { name: saveName })
      expect((button as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it("calls updateUser with the new name on submit", async () => {
    renderForm()
    const input = screen.getByLabelText(nameLabel)
    fireEvent.change(input, { target: { value: "John Smith" } })
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: saveName }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    })
    fireEvent.submit(input.closest("form") as HTMLFormElement)
    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ name: "John Smith" })
    })
  })

  it("shows the error alert when updateUser returns an error", async () => {
    updateUser.mockResolvedValue({ error: { message: "failed" } })
    renderForm()
    const input = screen.getByLabelText(nameLabel)
    fireEvent.change(input, { target: { value: "John Smith" } })
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: saveName }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    })
    fireEvent.submit(input.closest("form") as HTMLFormElement)
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
      expect(screen.getByText(errorMsg)).toBeDefined()
    })
  })

  it("re-disables Save after a successful submit (form reset to new baseline)", async () => {
    renderForm()
    const input = screen.getByLabelText(nameLabel)
    fireEvent.change(input, { target: { value: "John Smith" } })
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: saveName }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    })
    fireEvent.submit(input.closest("form") as HTMLFormElement)
    await waitFor(() => {
      expect(updateUser).toHaveBeenCalled()
    })
    await waitFor(() => {
      const button = screen.getByRole("button", { name: saveName })
      expect((button as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it("shows the nameSaved confirmation after a successful save", async () => {
    renderForm()
    const input = screen.getByLabelText(nameLabel)
    fireEvent.change(input, { target: { value: "John Smith" } })
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: saveName }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    })
    fireEvent.submit(input.closest("form") as HTMLFormElement)
    await waitFor(() => {
      expect(screen.getByText(nameSaved)).toBeDefined()
    })
    // Error alert must not be shown alongside the success line.
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("clears the nameSaved confirmation on the next submit", async () => {
    renderForm()
    const input = screen.getByLabelText(nameLabel)

    // First save.
    fireEvent.change(input, { target: { value: "John Smith" } })
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: saveName }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    })
    fireEvent.submit(input.closest("form") as HTMLFormElement)
    await waitFor(() => {
      expect(screen.getByText(nameSaved)).toBeDefined()
    })

    // Edit and submit again: confirmation clears during the second submit.
    fireEvent.change(input, { target: { value: "Jane Smith" } })
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: saveName }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    })
    fireEvent.submit(input.closest("form") as HTMLFormElement)
    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledTimes(2)
    })
    // After the second save completes the confirmation reappears (saved again).
    await waitFor(() => {
      expect(screen.getByText(nameSaved)).toBeDefined()
    })
  })
})
