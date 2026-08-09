import { render, screen, cleanup } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))
// The gate now resolves the active company through Better Auth before it
// queries: a membership and an active org must be present for it to reach the
// status query. With no active org it would only auto-pick one and spin.
let orgsData: { id: string; name: string }[] = []
let activeData: { id: string; name: string } | null = null
// The real query reports data: null while it is IN FLIGHT, which is
// indistinguishable from "no active company" unless isPending is read, so the
// mock carries it too.
let activePending = false
const setActiveMock = vi.fn()
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useListOrganizations: () => ({ data: orgsData }),
    useActiveOrganization: () => ({
      data: activeData,
      isPending: activePending,
    }),
    organization: { setActive: (...a: unknown[]) => setActiveMock(...a) },
  },
}))
vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { children?: React.ReactNode }) => (
    <div data-testid="shell">{props.children}</div>
  ),
}))
vi.mock("@/components/onboarding/onboarding-wizard", () => ({
  OnboardingWizard: () => <div data-testid="wizard" />,
}))

import { OnboardingGate } from "@/components/onboarding/onboarding-gate"

function renderGate() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OnboardingGate>
        <div data-testid="page" />
      </OnboardingGate>
    </NextIntlClientProvider>
  )
}

describe("OnboardingGate", () => {
  beforeEach(() => {
    orgsData = [{ id: "o1", name: "Acme" }]
    activeData = { id: "o1", name: "Acme" }
    activePending = false
    setActiveMock.mockReset()
    setActiveMock.mockResolvedValue(undefined)
  })
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
    expect(screen.getByTestId("page")).toBeDefined()
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
        <OnboardingGate>
          <div data-testid="page" />
        </OnboardingGate>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("wizard")).toBeDefined()
    expect(screen.queryByTestId("shell")).toBeNull()
  })

  // The bug this guards: on every reload the active-organization query is
  // briefly pending with data: null, which reads as "no active company". The
  // gate used to answer that by persisting the FIRST membership, silently
  // overwriting the company the user had chosen, so a reload after switching
  // came back on the wrong one.
  describe("while the active company is still loading", () => {
    beforeEach(() => {
      activePending = true
      activeData = null
      orgsData = [
        { id: "o1", name: "Acme" },
        { id: "o2", name: "Globex" },
      ]
    })

    it("does not persist a default company over the user's choice", () => {
      renderGate()
      expect(setActiveMock).not.toHaveBeenCalled()
    })

    it("holds on the loading screen instead of scoping to the first company", () => {
      // Cleared here, not in the shared beforeEach: the mock's return value is
      // configured per test there and resetting it would strip that too.
      useQueryMock.mockClear()
      renderGate()
      expect(screen.queryByTestId("shell")).toBeNull()
      expect(screen.queryByTestId("wizard")).toBeNull()
      // Nothing is queried for a company that has not been resolved yet.
      for (const call of useQueryMock.mock.calls) {
        expect(call[1]).not.toEqual({ orgId: "o1" })
      }
    })
  })

  // Once it HAS settled and there genuinely is no active company, picking a
  // default is still the right answer: the next load needs one persisted.
  it("persists the first membership once the query settles with none active", () => {
    activePending = false
    activeData = null
    orgsData = [{ id: "o1", name: "Acme" }]
    renderGate()
    expect(setActiveMock).toHaveBeenCalledWith({ organizationId: "o1" })
  })
})
