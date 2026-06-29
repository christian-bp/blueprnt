import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { drainOtpMountTimers } from "@/test/otp-timers"

const verifyTotp = vi.fn()
const sendOtp = vi.fn()
const verifyOtp = vi.fn()
const verifyBackupCode = vi.fn()
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      verifyTotp: (...a: unknown[]) => verifyTotp(...a),
      sendOtp: (...a: unknown[]) => sendOtp(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      verifyBackupCode: (...a: unknown[]) => verifyBackupCode(...a),
    },
  },
}))

import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge"

function renderChallenge(onVerified = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TwoFactorChallenge onVerified={onVerified} />
    </NextIntlClientProvider>
  )
}

afterEach(async () => {
  cleanup()
  await drainOtpMountTimers()
  verifyTotp.mockReset()
  sendOtp.mockReset()
  verifyOtp.mockReset()
  verifyBackupCode.mockReset()
  // Clear the method hint so tests start from a clean state.
  window.localStorage.removeItem("blueprnt.2fa.method")
})

describe("TwoFactorChallenge", () => {
  it("verifies a TOTP code and calls onVerified", async () => {
    verifyTotp.mockResolvedValue({ data: {}, error: null })
    const onVerified = vi.fn()
    const { container } = renderChallenge(onVerified)
    const inputs = screen.getAllByRole("textbox")
    const otpInput =
      inputs.length > 0 ? inputs[0] : container.querySelector("input")
    if (!otpInput) throw new Error("OTP input not found")
    fireEvent.change(otpInput, { target: { value: "123456" } })
    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" })
      expect(onVerified).toHaveBeenCalled()
    })
  })

  it("switches to email, sends a code, and verifies it", async () => {
    sendOtp.mockResolvedValue({ data: {}, error: null })
    verifyOtp.mockResolvedValue({ data: {}, error: null })
    const onVerified = vi.fn()
    const { container } = renderChallenge(onVerified)
    fireEvent.click(
      screen.getByText(messages.dashboard.auth.twoFactor.useEmail)
    )
    await waitFor(() => expect(sendOtp).toHaveBeenCalled())
    const inputs = screen.getAllByRole("textbox")
    const otpInput =
      inputs.length > 0 ? inputs[0] : container.querySelector("input")
    if (!otpInput) throw new Error("OTP input not found")
    fireEvent.change(otpInput, { target: { value: "654321" } })
    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith({ code: "654321" })
      expect(onVerified).toHaveBeenCalled()
    })
  })

  it("shows an error on a bad code without calling onVerified", async () => {
    verifyTotp.mockResolvedValue({ data: null, error: { message: "bad" } })
    const onVerified = vi.fn()
    const { container } = renderChallenge(onVerified)
    const inputs = screen.getAllByRole("textbox")
    const otpInput =
      inputs.length > 0 ? inputs[0] : container.querySelector("input")
    if (!otpInput) throw new Error("OTP input not found")
    fireEvent.change(otpInput, { target: { value: "000000" } })
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.auth.twoFactor.error)
      ).toBeDefined()
      expect(onVerified).not.toHaveBeenCalled()
    })
  })

  it("redeems a backup code through the separate text input", async () => {
    verifyBackupCode.mockResolvedValue({ data: {}, error: null })
    const onVerified = vi.fn()
    renderChallenge(onVerified)
    fireEvent.click(
      screen.getByText(messages.dashboard.auth.twoFactor.useBackupCode)
    )
    const input = screen.getByLabelText(
      messages.dashboard.auth.twoFactor.backupLabel
    )
    fireEvent.change(input, { target: { value: "UYols-9RDpX" } })
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.auth.twoFactor.verify,
      })
    )
    await waitFor(() => {
      expect(verifyBackupCode).toHaveBeenCalledWith({ code: "UYols-9RDpX" })
      expect(onVerified).toHaveBeenCalled()
    })
  })

  it("hides the authenticator option when the device enrolled email", () => {
    window.localStorage.setItem("blueprnt.2fa.method", "email")
    renderChallenge()
    // Starts in email mode and offers no authenticator switch (an email-enrolled
    // user has no scanned authenticator).
    expect(
      screen.getByText(messages.dashboard.auth.twoFactor.emailPrompt)
    ).toBeDefined()
    expect(
      screen.queryByText(messages.dashboard.auth.twoFactor.useAuthenticator)
    ).toBeNull()
  })

  it("shows the spinner and verifying label while a code is verifying", async () => {
    let resolveVerify: (result: { data: object; error: null }) => void =
      () => {}
    verifyTotp.mockReturnValue(
      new Promise((resolve) => {
        resolveVerify = resolve
      })
    )
    const onVerified = vi.fn()
    const { container } = renderChallenge(onVerified)
    const inputs = screen.getAllByRole("textbox")
    const otpInput =
      inputs.length > 0 ? inputs[0] : container.querySelector("input")
    if (!otpInput) throw new Error("OTP input not found")
    fireEvent.change(otpInput, { target: { value: "123456" } })
    // While verification is in flight: the spinner and the "Verifying..." label
    // are shown, and onVerified has not fired yet.
    await waitFor(() => expect(screen.getByRole("status")).toBeDefined())
    expect(screen.getByText(messages.dashboard.auth.verifying)).toBeDefined()
    expect(onVerified).not.toHaveBeenCalled()
    // Completing verification clears the loader and proceeds.
    resolveVerify({ data: {}, error: null })
    await waitFor(() => expect(onVerified).toHaveBeenCalled())
  })
})
