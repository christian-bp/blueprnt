import { render, screen, cleanup } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi, afterEach } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))
vi.mock("@/components/dashboard-shell", () => ({
  DashboardShell: () => <div data-testid="shell" />,
}))
vi.mock("@/components/onboarding/onboarding-wizard", () => ({
  OnboardingWizard: () => <div data-testid="wizard" />,
}))

import { OnboardingGate } from "@/components/onboarding/onboarding-gate"

function renderGate() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OnboardingGate />
    </NextIntlClientProvider>
  )
}

describe("OnboardingGate", () => {
  afterEach(() => {
    cleanup()
  })
  it("shows the wizard while setup is incomplete", () => {
    useQueryMock.mockReturnValue({
      organization: null,
      settingsComplete: false,
      hasModel: false,
      completed: false,
    })
    renderGate()
    expect(screen.getByTestId("wizard")).toBeDefined()
  })

  it("keeps the wizard when the model exists but onboarding is not completed", () => {
    // The bug: a model exists (hasModel true) but the user never finished, so
    // completed is false. The gate must keep the wizard, not unlock the shell.
    useQueryMock.mockReturnValue({
      organization: { orgId: "o1", name: "Acme", role: "admin" },
      settingsComplete: true,
      hasModel: true,
      completed: false,
    })
    renderGate()
    expect(screen.getByTestId("wizard")).toBeDefined()
    expect(screen.queryByTestId("shell")).toBeNull()
  })

  it("shows the dashboard when setup is complete", () => {
    useQueryMock.mockReturnValue({
      organization: { orgId: "o1", name: "Acme", role: "admin" },
      settingsComplete: true,
      hasModel: true,
      completed: true,
    })
    renderGate()
    expect(screen.getByTestId("shell")).toBeDefined()
  })

  it("keeps the wizard mounted when status completes mid-session", () => {
    useQueryMock.mockReturnValue({
      organization: null,
      settingsComplete: false,
      hasModel: false,
      completed: false,
    })
    const { rerender } = renderGate()
    expect(screen.getByTestId("wizard")).toBeDefined()

    // Simulate the reactive status flip after the model is created and the
    // wizard finishes (completeOnboarding stamps completed: true).
    useQueryMock.mockReturnValue({
      organization: { orgId: "o1", name: "Acme", role: "admin" },
      settingsComplete: true,
      hasModel: true,
      completed: true,
    })
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingGate />
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("wizard")).toBeDefined()
    expect(screen.queryByTestId("shell")).toBeNull()
  })
})
