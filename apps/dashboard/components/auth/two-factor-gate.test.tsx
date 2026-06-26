import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))
vi.mock("@/components/auth/two-factor-setup", () => ({
  TwoFactorSetup: () => <div data-testid="setup" />,
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
})
