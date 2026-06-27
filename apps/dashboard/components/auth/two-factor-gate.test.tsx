import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))
// Stub the wizard as a button that fires onConfirmed (its completion handoff).
vi.mock("@/components/auth/two-factor-setup", () => ({
  TwoFactorSetup: ({ onConfirmed }: { onConfirmed: () => void }) => (
    <button type="button" data-testid="setup" onClick={onConfirmed}>
      setup
    </button>
  ),
}))

import { TwoFactorGate } from "@/components/auth/two-factor-gate"

function renderGate() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TwoFactorGate>
        <div data-testid="children" />
      </TwoFactorGate>
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("TwoFactorGate", () => {
  it("shows a spinner while the status query is loading", () => {
    useQueryMock.mockReturnValue(undefined)
    renderGate()
    expect(screen.queryByTestId("children")).toBeNull()
    expect(screen.queryByTestId("setup")).toBeNull()
  })

  it("shows the setup wizard when 2FA is not confirmed", () => {
    useQueryMock.mockReturnValue({ confirmed: false, method: null })
    renderGate()
    expect(screen.getByTestId("setup")).toBeDefined()
    expect(screen.queryByTestId("children")).toBeNull()
  })

  it("renders children when 2FA is confirmed", () => {
    useQueryMock.mockReturnValue({ confirmed: true, method: "totp" })
    renderGate()
    expect(screen.getByTestId("children")).toBeDefined()
    expect(screen.queryByTestId("setup")).toBeNull()
  })

  it("keeps the wizard mounted across a transient status reload (the enable() auth blip)", () => {
    // twoFactor.enable() changes the session's 2FA state, so the Convex auth
    // token refreshes and getMyMfaStatus briefly reloads to undefined. The
    // wizard must stay mounted, not flip back to the spinner, or its step state
    // resets and the user is bounced to the method-choice screen.
    useQueryMock.mockReturnValue({ confirmed: false, method: null })
    const { rerender } = renderGate()
    expect(screen.getByTestId("setup")).toBeDefined()

    useQueryMock.mockReturnValue(undefined)
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorGate>
          <div data-testid="children" />
        </TwoFactorGate>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("setup")).toBeDefined()
  })

  it("keeps the wizard mounted when the status query returns null (token-refresh blip)", () => {
    // getMyMfaStatus returns null (not a throw) while the auth identity is
    // momentarily absent during the enable() token refresh. The latched wizard
    // must stay mounted, never flip to the spinner or children.
    useQueryMock.mockReturnValue({ confirmed: false, method: null })
    const { rerender } = renderGate()
    expect(screen.getByTestId("setup")).toBeDefined()

    useQueryMock.mockReturnValue(null)
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorGate>
          <div data-testid="children" />
        </TwoFactorGate>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("setup")).toBeDefined()
    expect(screen.queryByTestId("children")).toBeNull()
  })

  it("enters the app once the wizard signals completion", () => {
    useQueryMock.mockReturnValue({ confirmed: false, method: null })
    renderGate()
    // Continuing from the wizard's completion screen calls onConfirmed.
    fireEvent.click(screen.getByTestId("setup"))
    expect(screen.getByTestId("children")).toBeDefined()
    expect(screen.queryByTestId("setup")).toBeNull()
  })

  it("keeps the wizard until completion even when status flips to confirmed mid-setup", () => {
    // After the code verifies, confirmMfaSetup flips status to confirmed
    // server-side. The gate must keep showing the wizard (its completion screen)
    // rather than jumping straight to the app.
    useQueryMock.mockReturnValue({ confirmed: false, method: null })
    const { rerender } = renderGate()
    expect(screen.getByTestId("setup")).toBeDefined()

    useQueryMock.mockReturnValue({ confirmed: true, method: "totp" })
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorGate>
          <div data-testid="children" />
        </TwoFactorGate>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("setup")).toBeDefined()
    expect(screen.queryByTestId("children")).toBeNull()
  })

  it("re-engages the wizard on a second 'change method' in the same session", () => {
    // clearMfaConfirmed nulls mfaConfirmedAt, making needsSetup true again.
    // The done latch must reset so the gate shows the wizard instead of the app.
    // Setup phase one: setup needed, user completes the wizard.
    useQueryMock.mockReturnValue({ confirmed: false, method: null })
    const { rerender } = renderGate()
    expect(screen.getByTestId("setup")).toBeDefined()

    // Wizard completion: status flips confirmed, then user clicks through.
    useQueryMock.mockReturnValue({ confirmed: true, method: "totp" })
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorGate>
          <div data-testid="children" />
        </TwoFactorGate>
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByTestId("setup"))
    expect(screen.getByTestId("children")).toBeDefined()
    expect(screen.queryByTestId("setup")).toBeNull()

    // "Change method" in account settings: clearMfaConfirmed runs, server
    // nulls mfaConfirmedAt, status query returns needsSetup true again.
    useQueryMock.mockReturnValue({ confirmed: false, method: null })
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorGate>
          <div data-testid="children" />
        </TwoFactorGate>
      </NextIntlClientProvider>
    )
    // The bug: done was still true, so children kept rendering.
    // The fix: needsSetup resets done, so the wizard re-engages.
    expect(screen.getByTestId("setup")).toBeDefined()
    expect(screen.queryByTestId("children")).toBeNull()

    // Complete the second setup round.
    fireEvent.click(screen.getByTestId("setup"))
    expect(screen.getByTestId("children")).toBeDefined()
    expect(screen.queryByTestId("setup")).toBeNull()
  })

  it("does NOT reset done during the token-refresh blip (status null/undefined) after completion", () => {
    // After wizard completion (done=true), the auth token may briefly refresh
    // causing status to become null/undefined. done must stay true so the app
    // keeps rendering without bouncing back to the wizard.
    useQueryMock.mockReturnValue({ confirmed: false, method: null })
    const { rerender } = renderGate()

    useQueryMock.mockReturnValue({ confirmed: true, method: "totp" })
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorGate>
          <div data-testid="children" />
        </TwoFactorGate>
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByTestId("setup"))
    expect(screen.getByTestId("children")).toBeDefined()

    // Blip: status goes null (needsSetup = false because status is null, not
    // because confirmed flipped). done must NOT reset here.
    useQueryMock.mockReturnValue(null)
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorGate>
          <div data-testid="children" />
        </TwoFactorGate>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("children")).toBeDefined()
    expect(screen.queryByTestId("setup")).toBeNull()

    // Blip: status undefined (same reasoning).
    useQueryMock.mockReturnValue(undefined)
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorGate>
          <div data-testid="children" />
        </TwoFactorGate>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("children")).toBeDefined()
    expect(screen.queryByTestId("setup")).toBeNull()
  })
})
