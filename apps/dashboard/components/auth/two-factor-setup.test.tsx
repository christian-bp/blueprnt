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

const enable = vi.fn()
const verifyTotp = vi.fn()
const sendOtp = vi.fn()
const verifyOtp = vi.fn()
const confirmMfaSetup = vi.fn()
const activeOrg = { data: { id: "o1", name: "Acme" } }

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      enable: (...a: unknown[]) => enable(...a),
      verifyTotp: (...a: unknown[]) => verifyTotp(...a),
      sendOtp: (...a: unknown[]) => sendOtp(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    },
    useActiveOrganization: () => activeOrg,
    useSession: () => ({ data: { user: { email: "hr@acme.se" } } }),
  },
}))
vi.mock("convex/react", () => ({
  useMutation: () => confirmMfaSetup,
}))
// qrcode touches the DOM canvas; stub it to a data URL.
vi.mock("qrcode", () => ({
  default: { toDataURL: async () => "data:image/png;base64,stub" },
}))

import { TwoFactorSetup } from "@/components/auth/two-factor-setup"

function renderSetup(onConfirmed = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TwoFactorSetup onConfirmed={onConfirmed} />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  enable.mockReset()
  verifyTotp.mockReset()
  sendOtp.mockReset()
  verifyOtp.mockReset()
  confirmMfaSetup.mockReset()
})

describe("TwoFactorSetup", () => {
  it("offers both methods on the first screen", () => {
    renderSetup()
    expect(
      screen.getByText(messages.dashboard.twoFactorSetup.methodTotp.label)
    ).toBeDefined()
    expect(
      screen.getByText(messages.dashboard.twoFactorSetup.methodEmail.label)
    ).toBeDefined()
  })

  it("enables and confirms via authenticator, then calls onConfirmed", async () => {
    enable.mockResolvedValue({
      data: { totpURI: "otpauth://totp/blueprnt:hr@acme.se?secret=ABC" },
      error: null,
    })
    verifyTotp.mockResolvedValue({ data: {}, error: null })
    confirmMfaSetup.mockResolvedValue(null)
    const onConfirmed = vi.fn()
    const { container } = renderSetup(onConfirmed)

    // 1. choose authenticator
    fireEvent.click(
      screen.getByText(messages.dashboard.twoFactorSetup.methodTotp.label)
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.twoFactorSetup.continue,
      })
    )
    // 2. confirm password -> enable()
    const pwInput = screen.getByLabelText(
      messages.dashboard.twoFactorSetup.password.label
    )
    fireEvent.change(pwInput, { target: { value: "secret123" } })
    fireEvent.blur(pwInput)
    // Submit the form directly so jsdom doesn't drop the synthetic click->submit chain.
    const form = pwInput.closest("form")
    if (!form) throw new Error("Password form not found")
    fireEvent.submit(form)
    await waitFor(() =>
      expect(enable).toHaveBeenCalledWith({ password: "secret123" })
    )
    // 3. enter the TOTP code -> verifyTotp() + confirmMfaSetup()
    const inputs = await screen.findAllByRole("textbox")
    const otpInput =
      inputs.length > 0 ? inputs[0] : container.querySelector("input")
    if (!otpInput) throw new Error("OTP input not found")
    fireEvent.change(otpInput, { target: { value: "123456" } })
    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" })
      expect(confirmMfaSetup).toHaveBeenCalledWith({ method: "totp" })
      expect(onConfirmed).toHaveBeenCalled()
    })
  })

  it("sends and verifies an email code when the email method is chosen", async () => {
    enable.mockResolvedValue({ data: { totpURI: "otpauth://x" }, error: null })
    sendOtp.mockResolvedValue({ data: {}, error: null })
    verifyOtp.mockResolvedValue({ data: {}, error: null })
    confirmMfaSetup.mockResolvedValue(null)
    const onConfirmed = vi.fn()
    const { container } = renderSetup(onConfirmed)

    fireEvent.click(
      screen.getByText(messages.dashboard.twoFactorSetup.methodEmail.label)
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.twoFactorSetup.continue,
      })
    )
    const pwInput2 = screen.getByLabelText(
      messages.dashboard.twoFactorSetup.password.label
    )
    fireEvent.change(pwInput2, { target: { value: "secret123" } })
    fireEvent.blur(pwInput2)
    const form2 = pwInput2.closest("form")
    if (!form2) throw new Error("Password form not found")
    fireEvent.submit(form2)
    await waitFor(() => expect(sendOtp).toHaveBeenCalled())
    const inputs = await screen.findAllByRole("textbox")
    const otpInput =
      inputs.length > 0 ? inputs[0] : container.querySelector("input")
    if (!otpInput) throw new Error("OTP input not found")
    fireEvent.change(otpInput, { target: { value: "654321" } })
    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith({ code: "654321" })
      expect(confirmMfaSetup).toHaveBeenCalledWith({ method: "email" })
      expect(onConfirmed).toHaveBeenCalled()
    })
  })
})
