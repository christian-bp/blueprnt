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

// --- Convex mocks (vi.hoisted so they are available before vi.mock factory runs) ---
const { clearMfaConfirmedMock, useQueryMock, generateBackupCodesMock } =
  vi.hoisted(() => {
    const clearMfaConfirmedMock = vi.fn(async () => null)
    const useQueryMock = vi.fn()
    const generateBackupCodesMock = vi.fn(
      async (_args: {
        password: string
      }): Promise<{
        data: { backupCodes: string[] } | null
        error: { message: string } | null
      }> => ({
        data: { backupCodes: ["AAAA-1111", "BBBB-2222", "CCCC-3333"] },
        error: null,
      })
    )
    return { clearMfaConfirmedMock, useQueryMock, generateBackupCodesMock }
  })

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: () => clearMfaConfirmedMock,
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      generateBackupCodes: generateBackupCodesMock,
    },
  },
}))

import { TwoFactorSection } from "./two-factor-section"

const t = en.dashboard.account.security.twoFactor
const tBackup = en.dashboard.twoFactorSetup.backup

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TwoFactorSection />
    </NextIntlClientProvider>
  )
}

describe("TwoFactorSection", () => {
  beforeEach(() => {
    useQueryMock.mockReturnValue({
      name: "Test User",
      email: "test@example.com",
      locale: null,
      mfaMethod: "totp",
      lastAdminOrgs: [],
    })
    clearMfaConfirmedMock.mockResolvedValue(null)
    generateBackupCodesMock.mockResolvedValue({
      data: { backupCodes: ["AAAA-1111", "BBBB-2222", "CCCC-3333"] },
      error: null,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders inside a Card with the section title and description", () => {
    renderSection()
    expect(screen.getByText(t.title)).toBeDefined()
    expect(screen.getByText(t.description)).toBeDefined()
  })

  it("shows the current method from the mocked query (totp)", () => {
    renderSection()
    expect(screen.getByText(t.methodTotp)).toBeDefined()
  })

  it("shows email method label when mfaMethod is email", () => {
    useQueryMock.mockReturnValue({
      name: "Test User",
      email: "test@example.com",
      locale: null,
      mfaMethod: "email",
      lastAdminOrgs: [],
    })
    renderSection()
    expect(screen.getByText(t.methodEmail)).toBeDefined()
  })

  it("shows none label when mfaMethod is null", () => {
    useQueryMock.mockReturnValue({
      name: "Test User",
      email: "test@example.com",
      locale: null,
      mfaMethod: null,
      lastAdminOrgs: [],
    })
    renderSection()
    expect(screen.getByText(t.methodNone)).toBeDefined()
  })

  it("confirming the change-method dialog calls clearMfaConfirmed", async () => {
    renderSection()

    // Open the AlertDialog
    const changeBtn = screen.getByRole("button", { name: t.changeMethod })
    fireEvent.click(changeBtn)

    // The alertdialog should be visible
    const dialog = screen.getByRole("alertdialog")
    expect(dialog).toBeDefined()
    expect(within(dialog).getByText(t.changeMethodConfirmTitle)).toBeDefined()

    // Click the confirm action
    const confirmBtn = within(dialog).getByRole("button", {
      name: t.changeMethodConfirmCta,
    })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(clearMfaConfirmedMock).toHaveBeenCalledTimes(1)
    })
  })

  it("cancelling the change-method dialog does not call clearMfaConfirmed", async () => {
    renderSection()

    const changeBtn = screen.getByRole("button", { name: t.changeMethod })
    fireEvent.click(changeBtn)

    const dialog = screen.getByRole("alertdialog")
    const cancelBtn = within(dialog).getByRole("button", { name: t.cancel })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
    })
    expect(clearMfaConfirmedMock).not.toHaveBeenCalled()
  })

  it("submitting the regenerate password calls generateBackupCodes and renders the returned codes", async () => {
    renderSection()

    // Open the regenerate form
    const regenBtn = screen.getByRole("button", { name: t.regenerate })
    fireEvent.click(regenBtn)

    // Fill in the password
    const pwInput = screen.getByLabelText(t.regeneratePasswordLabel)
    fireEvent.change(pwInput, { target: { value: "correct-password" } })
    fireEvent.blur(pwInput)

    // Submit
    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: t.regenerateCta })
      expect((submitBtn as HTMLButtonElement).disabled).toBe(false)
    })
    const submitBtn = screen.getByRole("button", { name: t.regenerateCta })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(generateBackupCodesMock).toHaveBeenCalledWith({
        password: "correct-password",
      })
    })

    // The returned codes should be rendered
    await waitFor(() => {
      expect(screen.getByText("AAAA-1111")).toBeDefined()
      expect(screen.getByText("BBBB-2222")).toBeDefined()
      expect(screen.getByText("CCCC-3333")).toBeDefined()
    })

    // The backup codes heading from twoFactorSetup.backup should also appear
    expect(screen.getByText(tBackup.heading)).toBeDefined()
  })

  it("shows the wrong-password error when generateBackupCodes returns an error", async () => {
    generateBackupCodesMock.mockResolvedValue({
      data: null,
      error: { message: "INVALID_PASSWORD" },
    })
    renderSection()

    const regenBtn = screen.getByRole("button", { name: t.regenerate })
    fireEvent.click(regenBtn)

    const pwInput = screen.getByLabelText(t.regeneratePasswordLabel)
    fireEvent.change(pwInput, { target: { value: "wrongpassword" } })
    fireEvent.blur(pwInput)

    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: t.regenerateCta })
      expect((submitBtn as HTMLButtonElement).disabled).toBe(false)
    })
    const submitBtn = screen.getByRole("button", { name: t.regenerateCta })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(t.wrongPassword)).toBeDefined()
    })

    // No codes should be shown
    expect(screen.queryByText(tBackup.heading)).toBeNull()
  })
})
