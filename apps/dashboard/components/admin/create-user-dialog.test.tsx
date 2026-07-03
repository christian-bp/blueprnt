import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const { createUserMock, requestPasswordResetMock, toastSuccessMock } =
  vi.hoisted(() => ({
    createUserMock: vi.fn(),
    requestPasswordResetMock: vi.fn(async () => ({ error: null })),
    toastSuccessMock: vi.fn(),
  }))

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: vi.fn() },
}))

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "platform.admin.createUser") return createUserMock
    return vi.fn()
  },
  useQuery: (ref: unknown) => {
    if (ref === "platform.admin.listOrganizations") {
      return [
        { orgId: "org-1", name: "Acme Corp" },
        { orgId: "org-2", name: "Beta Inc" },
      ]
    }
    return undefined
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    platform: {
      admin: {
        createUser: "platform.admin.createUser",
        listOrganizations: "platform.admin.listOrganizations",
      },
    },
  },
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { requestPasswordReset: requestPasswordResetMock },
}))

import { CreateUserDialog } from "@/components/admin/create-user-dialog"

const labels = messages.dashboard.admin.users.create

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CreateUserDialog />
    </NextIntlClientProvider>
  )
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: labels.cta }))
}

// Radix Select renders a hidden native <select> when inside a <form>. We target
// them by querying all selects (org is first, role is second).
function hiddenSelects(): HTMLSelectElement[] {
  return Array.from(document.querySelectorAll("select"))
}

function submitForm() {
  const form = screen
    .getByLabelText(labels.nameLabel)
    .closest("form") as HTMLFormElement
  fireEvent.submit(form)
}

// Read the inline error bound to a specific field via its aria-describedby ->
// the FormMessage element id, so an assertion targets one field and is not
// confused by another field rendering the identical "required" text.
function fieldErrorText(control: HTMLElement): string | null {
  const ids = (control.getAttribute("aria-describedby") ?? "").split(" ")
  const msgId = ids.find((id) => id.endsWith("-form-item-message"))
  return msgId ? (document.getElementById(msgId)?.textContent ?? null) : null
}

describe("CreateUserDialog", () => {
  beforeEach(() => {
    createUserMock.mockReset()
    requestPasswordResetMock.mockReset()
    toastSuccessMock.mockReset()
    requestPasswordResetMock.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    cleanup()
  })

  it("keeps submit disabled until every field is valid (live, no blur needed)", async () => {
    renderDialog()
    openDialog()
    const submit = () =>
      document.querySelector("button[type='submit']") as HTMLButtonElement
    expect(submit().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "alice@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) fireEvent.change(selects[0], { target: { value: "org-1" } })
    await waitFor(() => {
      expect(submit().disabled).toBe(false)
    })
  })

  it("shows a name-scoped required error and does not submit when name is empty", async () => {
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "user@example.com" },
    })
    submitForm()
    const nameInput = screen.getByLabelText(labels.nameLabel)
    await waitFor(() => {
      // Assert the error is bound to the name field specifically (not just that
      // some "required" text exists), so other fields' identical messages
      // cannot make this pass or throw on a multiple-match.
      expect(nameInput.getAttribute("aria-invalid")).toBe("true")
      expect(fieldErrorText(nameInput)).toBe(
        messages.dashboard.validation.required
      )
      expect(createUserMock).not.toHaveBeenCalled()
    })
  })

  it("blocks submit and surfaces the required error when no org is chosen", async () => {
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "alice@example.com" },
    })
    // Deliberately leave the org Select untouched (orgId stays ""). name and
    // email are valid and role defaults to editor, so org is the only field
    // that can error here.
    submitForm()
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.validation.required)
      ).toBeDefined()
      expect(createUserMock).not.toHaveBeenCalled()
    })
  })

  it("shows the invalid-email error when the email is malformed", async () => {
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "not-an-email" },
    })
    submitForm()
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.validation.invalidEmail)
      ).toBeDefined()
      expect(createUserMock).not.toHaveBeenCalled()
    })
  })

  it("calls createUser and requestPasswordReset with name, email, orgId, role", async () => {
    createUserMock.mockResolvedValue({ authId: "user-1", created: true })
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "alice@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) fireEvent.change(selects[0], { target: { value: "org-1" } })
    if (selects[1]) fireEvent.change(selects[1], { target: { value: "admin" } })
    submitForm()
    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        name: "Alice",
        email: "alice@example.com",
        orgId: "org-1",
        role: "admin",
      })
    })
    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith({
        email: "alice@example.com",
        redirectTo: "/reset-password",
      })
    })
  })

  it("uses editor as the default role", async () => {
    createUserMock.mockResolvedValue({ authId: "user-1", created: true })
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Bob" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "bob@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) fireEvent.change(selects[0], { target: { value: "org-2" } })
    submitForm()
    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        name: "Bob",
        email: "bob@example.com",
        orgId: "org-2",
        role: "editor",
      })
    })
  })

  it("fires toast.success with userCreated on successful submission", async () => {
    createUserMock.mockResolvedValue({ authId: "user-1", created: true })
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "alice@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) fireEvent.change(selects[0], { target: { value: "org-1" } })
    submitForm()
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        messages.dashboard.toast.userCreated
      )
    })
  })

  it("shows an error alert when createUser fails", async () => {
    createUserMock.mockRejectedValue(new Error("ConvexError: notFound"))
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Carol" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "carol@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) fireEvent.change(selects[0], { target: { value: "org-1" } })
    submitForm()
    await waitFor(() => {
      // Assert via role so the a11y contract (assertive live region) the test
      // name promises is actually covered. (jest-dom is not set up here, so
      // read textContent rather than toHaveTextContent.)
      expect(screen.getByRole("alert").textContent).toBe(labels.error)
    })
  })
})
