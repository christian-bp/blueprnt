import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))
const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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
  OnboardingWizard: (props: { onFinished: () => void }) => (
    <div data-testid="wizard">
      <button type="button" onClick={() => props.onFinished()}>
        finish
      </button>
    </div>
  ),
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
    pushMock.mockReset()
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

  // The wizard never changes the URL while it runs (fully state-driven), so a
  // deep link into the model section left the browser there once onboarding
  // finished. The gate now navigates explicitly on exit, regardless of what
  // route was current when the session started.
  it("routes to the overview when the wizard hands control back", () => {
    useQueryMock.mockReturnValue({
      organization: null,
      settingsComplete: false,
      hasModel: false,
      completed: false,
    })
    renderGate()
    fireEvent.click(screen.getByText("finish"))
    expect(pushMock).toHaveBeenCalledWith("/")
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

  // The bug this guards: a fresh login starts a session with no active
  // company, so the gate settles on the first membership and shows the app
  // while the effect persists that default. Better Auth answers set-active by
  // refetching the active-organization query, and because its data is still
  // null the store reports isPending: true again for that beat. Deciding on
  // the live isPending swapped the whole app for the loading screen, a
  // visible split-second "reload" right after the overview appeared. Once
  // settled, an in-flight refetch must never blank the app.
  it("keeps the app mounted through the refetch after persisting the default company", () => {
    useQueryMock.mockReturnValue({
      organization: { orgId: "o1", name: "Acme", role: "admin" },
      settingsComplete: true,
      hasModel: true,
      completed: true,
    })
    activePending = false
    activeData = null
    orgsData = [{ id: "o1", name: "Acme" }]
    const { rerender } = renderGate()
    expect(screen.getByTestId("shell")).toBeDefined()
    expect(setActiveMock).toHaveBeenCalledWith({ organizationId: "o1" })

    // The set-active response triggers the refetch: pending again, data
    // still null.
    activePending = true
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingGate>
          <div data-testid="page" />
        </OnboardingGate>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("shell")).toBeDefined()
    expect(screen.getByTestId("page")).toBeDefined()

    // The refetch lands with the persisted company: still the same app.
    activePending = false
    activeData = { id: "o1", name: "Acme" }
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingGate>
          <div data-testid="page" />
        </OnboardingGate>
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("shell")).toBeDefined()
    expect(screen.getByTestId("page")).toBeDefined()
  })
})
