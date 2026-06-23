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

const { createUserMock, requestPasswordResetMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  requestPasswordResetMock: vi.fn(async () => ({ error: null })),
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

describe("CreateUserDialog", () => {
  beforeEach(() => {
    createUserMock.mockReset()
    requestPasswordResetMock.mockReset()
    requestPasswordResetMock.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    cleanup()
  })

  function submitButton(): HTMLButtonElement {
    // The SubmitButton wraps its label in a <span>, so query by type instead
    // of by accessible name (which can differ from the trigger button).
    return document.querySelector("button[type='submit']") as HTMLButtonElement
  }

  it("submit is disabled when name is missing", () => {
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "user@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) {
      fireEvent.change(selects[0], { target: { value: "org-1" } })
    }
    expect(submitButton().disabled).toBe(true)
  })

  it("submit is disabled when email is invalid", () => {
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "not-an-email" },
    })
    const selects = hiddenSelects()
    if (selects[0]) {
      fireEvent.change(selects[0], { target: { value: "org-1" } })
    }
    expect(submitButton().disabled).toBe(true)
  })

  it("submit is disabled when org is not chosen", () => {
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "alice@example.com" },
    })
    // No org selected: orgId stays ""
    expect(submitButton().disabled).toBe(true)
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
    // Org select (first hidden select)
    if (selects[0]) {
      fireEvent.change(selects[0], { target: { value: "org-1" } })
    }
    // Role select (second hidden select) - default is editor; set to admin
    if (selects[1]) {
      fireEvent.change(selects[1], { target: { value: "admin" } })
    }

    const form = screen
      .getByLabelText(labels.nameLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)

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
    if (selects[0]) {
      fireEvent.change(selects[0], { target: { value: "org-2" } })
    }
    // Do not change role: should default to "editor"

    const form = screen
      .getByLabelText(labels.nameLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        name: "Bob",
        email: "bob@example.com",
        orgId: "org-2",
        role: "editor",
      })
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
    if (selects[0]) {
      fireEvent.change(selects[0], { target: { value: "org-1" } })
    }

    const form = screen
      .getByLabelText(labels.nameLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
  })
})
