import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

const EMAIL = "user@example.com"

const ACCOUNT_NO_LAST_ADMIN = {
  name: "Test User",
  email: EMAIL,
  locale: null,
  mfaMethod: "email" as const,
  lastAdminOrgs: [],
}

const ACCOUNT_WITH_LAST_ADMIN = {
  name: "Test User",
  email: EMAIL,
  locale: null,
  mfaMethod: "email" as const,
  lastAdminOrgs: [{ orgId: "org-1", name: "Acme Corp" }],
}

// --- Hoisted mocks (must be before vi.mock factories) ---
const { useQueryMock, deleteMyAccountMock, signOutMock, pushMock } = vi.hoisted(
  () => {
    const useQueryMock = vi.fn()
    const deleteMyAccountMock = vi.fn(async () => null)
    const signOutMock = vi.fn(async () => {})
    const pushMock = vi.fn()
    return { useQueryMock, deleteMyAccountMock, signOutMock, pushMock }
  }
)

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useAction: () => deleteMyAccountMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      account: {
        getMyAccount: "accounts.account.getMyAccount",
        deleteMyAccount: "accounts.account.deleteMyAccount",
      },
    },
  },
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: signOutMock,
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { DeleteAccountSection } from "./delete-account-section"

const t = en.dashboard.account.security.delete

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DeleteAccountSection />
    </NextIntlClientProvider>
  )
}

// The trigger button in the card (before the dialog opens).
function triggerButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: t.cta }) as HTMLButtonElement
}

// Opens the dialog by clicking the trigger. Returns the dialog element.
function openDialog(): HTMLElement {
  fireEvent.click(triggerButton())
  return screen.getByRole("alertdialog")
}

// The destructive submit button inside the open dialog.
// When the dialog is open there are two buttons named t.cta (trigger + submit),
// so we scope to the dialog.
function submitButton(dialog: HTMLElement): HTMLButtonElement {
  return within(dialog).getByRole("button", {
    name: t.cta,
  }) as HTMLButtonElement
}

describe("DeleteAccountSection", () => {
  beforeEach(() => {
    useQueryMock.mockReturnValue(ACCOUNT_NO_LAST_ADMIN)
    deleteMyAccountMock.mockResolvedValue(null)
    signOutMock.mockResolvedValue(undefined)
    pushMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // --- Card structure ---

  it("renders inside a destructive Card with the section title and description", () => {
    renderSection()
    expect(screen.getByText(t.title)).toBeDefined()
    expect(screen.getByText(t.description)).toBeDefined()
  })

  // --- Last-admin branch ---

  it("shows the support note and no delete trigger button when lastAdminOrgs is non-empty", () => {
    useQueryMock.mockReturnValue(ACCOUNT_WITH_LAST_ADMIN)
    renderSection()
    // The lastAdmin message includes the org name
    expect(screen.getByText(/Acme Corp/)).toBeDefined()
    expect(screen.queryByRole("button", { name: t.cta })).toBeNull()
  })

  // --- Trigger opens the dialog ---

  it("renders a trigger button that opens the AlertDialog", () => {
    renderSection()
    expect(triggerButton()).toBeDefined()
    expect(screen.queryByRole("alertdialog")).toBeNull()

    const dialog = openDialog()
    expect(dialog).toBeDefined()
    expect(within(dialog).getByText(t.title)).toBeDefined()
    expect(within(dialog).getByText(t.description)).toBeDefined()
  })

  // --- Empty-email loading guard ---

  it("keeps the dialog submit disabled while account is still loading (email empty)", async () => {
    // Simulate useQuery returning undefined (query in-flight).
    // lastAdminOrgs defaults to [] so the card renders (with trigger), but email is "".
    useQueryMock.mockReturnValue(undefined)
    renderSection()

    const dialog = openDialog()
    const btn = submitButton(dialog)
    expect(btn.disabled).toBe(true)

    // Type any non-empty password: submit must STILL be disabled because the
    // email confirm field can never match "" without also being empty.
    fireEvent.change(within(dialog).getByLabelText(t.passwordLabel), {
      target: { value: "somepassword" },
    })
    await waitFor(() => {
      expect(submitButton(dialog).disabled).toBe(true)
    })
  })

  // --- Delete gate ---

  it("renders the danger zone card when lastAdminOrgs is empty", () => {
    renderSection()
    expect(screen.getByText(t.title)).toBeDefined()
    expect(screen.getByText(t.description)).toBeDefined()
  })

  it("keeps the dialog submit disabled until the email matches AND password is filled", async () => {
    renderSection()
    const dialog = openDialog()
    const btn = submitButton(dialog)
    expect(btn.disabled).toBe(true)

    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    // Type correct email only
    fireEvent.change(within(dialog).getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    await waitFor(() => {
      // Still disabled: password not filled
      expect(submitButton(dialog).disabled).toBe(true)
    })

    // Fill password only (start fresh)
    fireEvent.change(within(dialog).getByLabelText(confirmLabel), {
      target: { value: "" },
    })
    fireEvent.change(within(dialog).getByLabelText(t.passwordLabel), {
      target: { value: "mypassword" },
    })
    await waitFor(() => {
      // Still disabled: email not matching
      expect(submitButton(dialog).disabled).toBe(true)
    })

    // Fill both correctly
    fireEvent.change(within(dialog).getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    await waitFor(() => {
      expect(submitButton(dialog).disabled).toBe(false)
    })
  })

  it("the confirm input does not have aria-invalid while partially typed", async () => {
    renderSection()
    const dialog = openDialog()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)
    const input = within(dialog).getByLabelText(confirmLabel)
    fireEvent.change(input, { target: { value: "wrong@example.com" } })
    await waitFor(() => {
      expect(input.getAttribute("aria-invalid")).not.toBe("true")
    })
  })

  it("cancel resets the form and clears error state so reopening starts clean", async () => {
    deleteMyAccountMock.mockRejectedValue(
      new Error("ConvexError: errors.invalidInput")
    )
    renderSection()

    // Open, fill, submit to get an error.
    const dialog = openDialog()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)
    fireEvent.change(within(dialog).getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    fireEvent.change(within(dialog).getByLabelText(t.passwordLabel), {
      target: { value: "wrong-pass" },
    })
    await waitFor(() => {
      expect(submitButton(dialog).disabled).toBe(false)
    })
    fireEvent.click(submitButton(dialog))
    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toBeDefined()
    })

    // Cancel the dialog.
    const cancelBtn = within(dialog).getByRole("button", { name: t.cancel })
    fireEvent.click(cancelBtn)
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
    })

    // Reopen: no error, inputs are empty.
    const dialog2 = openDialog()
    expect(within(dialog2).queryByRole("alert")).toBeNull()
    const confirmInput = within(dialog2).getByLabelText(confirmLabel)
    expect((confirmInput as HTMLInputElement).value).toBe("")
  })

  // --- Submission ---

  it("calls deleteMyAccount with the password, then signOut and push('/') on success", async () => {
    renderSection()
    const dialog = openDialog()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    fireEvent.change(within(dialog).getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    fireEvent.change(within(dialog).getByLabelText(t.passwordLabel), {
      target: { value: "correct-pass" },
    })

    await waitFor(() => {
      expect(submitButton(dialog).disabled).toBe(false)
    })

    fireEvent.click(submitButton(dialog))

    await waitFor(() => {
      expect(deleteMyAccountMock).toHaveBeenCalledWith({
        password: "correct-pass",
      })
    })
    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1)
      expect(pushMock).toHaveBeenCalledWith("/")
    })
  })

  // --- Error cases ---

  it("shows the wrong-password error inside the dialog on invalidInput and does not sign out", async () => {
    deleteMyAccountMock.mockRejectedValue(
      new Error("ConvexError: errors.invalidInput")
    )
    renderSection()
    const dialog = openDialog()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    fireEvent.change(within(dialog).getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    fireEvent.change(within(dialog).getByLabelText(t.passwordLabel), {
      target: { value: "wrong-pass" },
    })

    await waitFor(() => {
      expect(submitButton(dialog).disabled).toBe(false)
    })

    fireEvent.click(submitButton(dialog))

    await waitFor(() => {
      expect(within(dialog).getByRole("alert").textContent).toBe(
        t.wrongPassword
      )
    })
    // Dialog remains open.
    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(signOutMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("shows the lastAdmin support note on a race-condition lastAdmin error", async () => {
    deleteMyAccountMock.mockRejectedValue(
      new Error("ConvexError: errors.lastAdmin")
    )
    renderSection()
    const dialog = openDialog()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    fireEvent.change(within(dialog).getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    fireEvent.change(within(dialog).getByLabelText(t.passwordLabel), {
      target: { value: "some-pass" },
    })

    await waitFor(() => {
      expect(submitButton(dialog).disabled).toBe(false)
    })

    fireEvent.click(submitButton(dialog))

    await waitFor(() => {
      // Dialog closes; the card switches to the lastAdmin note (no trigger button).
      expect(screen.queryByRole("alertdialog")).toBeNull()
      expect(screen.queryByRole("button", { name: t.cta })).toBeNull()
    })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it("shows the generic error inside the dialog on an unexpected error", async () => {
    deleteMyAccountMock.mockRejectedValue(new Error("network failure"))
    renderSection()
    const dialog = openDialog()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    fireEvent.change(within(dialog).getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    fireEvent.change(within(dialog).getByLabelText(t.passwordLabel), {
      target: { value: "some-pass" },
    })

    await waitFor(() => {
      expect(submitButton(dialog).disabled).toBe(false)
    })

    fireEvent.click(submitButton(dialog))

    await waitFor(() => {
      expect(within(dialog).getByRole("alert").textContent).toBe(t.error)
    })
    // Dialog remains open.
    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(signOutMock).not.toHaveBeenCalled()
  })
})
