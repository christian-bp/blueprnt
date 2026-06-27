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

function ctaButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: t.cta }) as HTMLButtonElement
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

  // --- Last-admin branch ---

  it("shows the support note and no delete button when lastAdminOrgs is non-empty", () => {
    useQueryMock.mockReturnValue(ACCOUNT_WITH_LAST_ADMIN)
    renderSection()
    // The lastAdmin message includes the org name
    expect(screen.getByText(/Acme Corp/)).toBeDefined()
    expect(screen.queryByRole("button", { name: t.cta })).toBeNull()
  })

  // --- Empty-email loading guard ---

  it("keeps the delete button disabled while account is still loading (email empty)", async () => {
    // Simulate useQuery returning undefined (query in-flight)
    useQueryMock.mockReturnValue(undefined)
    renderSection()

    // The password field may not exist yet (lastAdminOrgs guard), but if the
    // card renders, the button must be disabled regardless of what is typed.
    // When account is undefined the component falls through to the card because
    // lastAdminOrgs defaults to [] so the card is shown but email is "".
    const btn = ctaButton()
    expect(btn.disabled).toBe(true)

    // Type any non-empty password: button must STILL be disabled because the
    // email confirm field can never match "" without also being empty.
    fireEvent.change(screen.getByLabelText(t.passwordLabel), {
      target: { value: "somepassword" },
    })
    await waitFor(() => {
      expect(ctaButton().disabled).toBe(true)
    })
  })

  // --- Delete gate ---

  it("renders the danger zone card when lastAdminOrgs is empty", () => {
    renderSection()
    expect(screen.getByText(t.title)).toBeDefined()
    expect(screen.getByText(t.body)).toBeDefined()
  })

  it("keeps the delete button disabled until the email matches and password is filled", async () => {
    renderSection()
    const btn = ctaButton()
    expect(btn.disabled).toBe(true)

    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    // Type correct email only
    fireEvent.change(screen.getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    await waitFor(() => {
      // Still disabled: password not filled
      expect(ctaButton().disabled).toBe(true)
    })

    // Fill password only (start fresh)
    fireEvent.change(screen.getByLabelText(confirmLabel), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText(t.passwordLabel), {
      target: { value: "mypassword" },
    })
    await waitFor(() => {
      // Still disabled: email not matching
      expect(ctaButton().disabled).toBe(true)
    })

    // Fill both correctly
    fireEvent.change(screen.getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    await waitFor(() => {
      expect(ctaButton().disabled).toBe(false)
    })
  })

  it("the confirm input does not have aria-invalid while partially typed", async () => {
    renderSection()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)
    const input = screen.getByLabelText(confirmLabel)
    fireEvent.change(input, { target: { value: "wrong@example.com" } })
    await waitFor(() => {
      expect(input.getAttribute("aria-invalid")).not.toBe("true")
    })
  })

  // --- Submission ---

  it("calls deleteMyAccount with the password, then signOut and push('/') on success", async () => {
    renderSection()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    fireEvent.change(screen.getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    fireEvent.change(screen.getByLabelText(t.passwordLabel), {
      target: { value: "correct-pass" },
    })

    await waitFor(() => {
      expect(ctaButton().disabled).toBe(false)
    })

    fireEvent.click(ctaButton())

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

  it("shows the wrong-password error on invalidInput and does not sign out", async () => {
    deleteMyAccountMock.mockRejectedValue(
      new Error("ConvexError: errors.invalidInput")
    )
    renderSection()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    fireEvent.change(screen.getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    fireEvent.change(screen.getByLabelText(t.passwordLabel), {
      target: { value: "wrong-pass" },
    })

    await waitFor(() => {
      expect(ctaButton().disabled).toBe(false)
    })

    fireEvent.click(ctaButton())

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(t.wrongPassword)
    })
    expect(signOutMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("shows the lastAdmin support note on a race-condition lastAdmin error", async () => {
    deleteMyAccountMock.mockRejectedValue(
      new Error("ConvexError: errors.lastAdmin")
    )
    renderSection()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    fireEvent.change(screen.getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    fireEvent.change(screen.getByLabelText(t.passwordLabel), {
      target: { value: "some-pass" },
    })

    await waitFor(() => {
      expect(ctaButton().disabled).toBe(false)
    })

    fireEvent.click(ctaButton())

    await waitFor(() => {
      // The component switches to the lastAdmin note (no button visible)
      expect(screen.queryByRole("button", { name: t.cta })).toBeNull()
    })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it("shows the generic error on an unexpected error", async () => {
    deleteMyAccountMock.mockRejectedValue(new Error("network failure"))
    renderSection()
    const confirmLabel = t.confirmLabel.replace("{email}", EMAIL)

    fireEvent.change(screen.getByLabelText(confirmLabel), {
      target: { value: EMAIL },
    })
    fireEvent.change(screen.getByLabelText(t.passwordLabel), {
      target: { value: "some-pass" },
    })

    await waitFor(() => {
      expect(ctaButton().disabled).toBe(false)
    })

    fireEvent.click(ctaButton())

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(t.error)
    })
    expect(signOutMock).not.toHaveBeenCalled()
  })
})
