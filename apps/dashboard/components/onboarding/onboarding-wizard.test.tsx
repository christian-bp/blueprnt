import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import type { OnboardingStatus } from "@/components/onboarding/onboarding-wizard"

// The wizard reads getOrganizationSettings via useQuery and completeOnboarding
// via useMutation. Each case supplies the settings fixture; the single mutation
// is captured so the families-finish test can assert completion.
const useQueryMock = vi.fn()
const completeOnboardingMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: () => completeOnboardingMock,
}))

// The shell renders children, headerRight, and footer so that step/dots
// assertions resolve without needing the real split-screen layout.
vi.mock("@/components/auth/auth-shell", () => ({
  AuthShell: (p: {
    children: ReactNode
    headerRight?: ReactNode
    footer?: ReactNode
  }) => (
    <div>
      {p.headerRight}
      {p.children}
      {p.footer}
    </div>
  ),
}))

vi.mock("@/components/account-menu", () => ({
  AccountMenu: () => null,
}))

vi.mock("@/components/onboarding/name-screen", () => ({
  NameScreen: (props: {
    existing: { orgId: string; name: string } | null
    onAdvance: () => void
  }) => (
    <div data-testid="name-screen">
      <span data-testid="name-mode">
        {props.existing ? `existing:${props.existing.name}` : "fresh"}
      </span>
      <button type="button" onClick={() => props.onAdvance()}>
        name-done
      </button>
    </div>
  ),
}))

vi.mock("@/components/onboarding/country-screen", () => ({
  CountryScreen: (props: {
    savedCountry: string | null
    onAdvance: () => void
  }) => (
    <div data-testid="country-screen">
      <span data-testid="country-saved">{props.savedCountry ?? "null"}</span>
      <button type="button" onClick={() => props.onAdvance()}>
        country-done
      </button>
    </div>
  ),
}))

vi.mock("@/components/onboarding/industry-screen", () => ({
  IndustryScreen: (props: { saved: string | null; onAdvance: () => void }) => (
    <div data-testid="industry-screen">
      <span data-testid="industry-saved">{props.saved ?? "null"}</span>
      <button type="button" onClick={() => props.onAdvance()}>
        industry-done
      </button>
    </div>
  ),
}))

// EnsureDefaultModel wraps the families step; here it is a pass-through so the
// wizard's step logic is tested in isolation (its own behavior is covered by
// ensure-default-model.test.tsx).
vi.mock("@/components/onboarding/ensure-default-model", () => ({
  EnsureDefaultModel: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("@/components/onboarding/families-step", () => ({
  FamiliesStep: (props: { orgId: string; onAdvance: () => void }) => (
    <div data-testid="families-step">
      <span data-testid="families-orgid">{props.orgId}</span>
      <button type="button" onClick={() => props.onAdvance()}>
        families-finished
      </button>
    </div>
  ),
}))

// The dots are a probe: it records the props it received (active index, the
// reach gate) and renders one real button per step that calls onSelect, so
// tests drive back-navigation through React's event batching (fireEvent),
// not by invoking the callback outside act().
let dotsProps: {
  steps: { key: string; label: string }[]
  activeIndex: number
  maxReachedIndex: number
  onSelect: (index: number) => void
} | null = null
vi.mock("@/components/onboarding/onboarding-dots", () => ({
  OnboardingDots: (props: {
    steps: { key: string; label: string }[]
    activeIndex: number
    maxReachedIndex: number
    onSelect: (index: number) => void
  }) => {
    dotsProps = props
    return (
      <div data-testid="dots">
        {props.steps.map((step, index) => (
          <button
            key={step.key}
            type="button"
            data-testid={`dot-${index}`}
            onClick={() => props.onSelect(index)}
          >
            {step.key}
          </button>
        ))}
      </div>
    )
  },
}))

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

const admin = { orgId: "org-1", name: "Acme", role: "admin" }

const fullSettings = {
  orgId: "org-1",
  country: "se",
  currency: "SEK",
  language: "sv",
  employeeCount: null,
  industry: "itTelecom",
}

// Steps are now: name(0), country(1), industry(2), families(3). Families is the
// last step and completes onboarding (model + score steps were removed).
function renderWizard(status: OnboardingStatus, settings: unknown = undefined) {
  useQueryMock.mockReturnValue(settings)
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OnboardingWizard status={status} onFinished={() => {}} />
    </NextIntlClientProvider>
  )
}

describe("OnboardingWizard", () => {
  afterEach(() => {
    cleanup()
    dotsProps = null
    useQueryMock.mockReset()
    completeOnboardingMock.mockReset()
  })

  it("renders the name screen in fresh mode when no organization exists", () => {
    renderWizard({
      organization: null,
      settingsComplete: false,
      hasModel: false,
      hasRoles: false,
      completed: false,
    })
    expect(screen.getByTestId("name-mode").textContent).toBe("fresh")
  })

  it("renders the country screen when the organization exists but no country is set", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: false,
        hasModel: false,
        hasRoles: false,
        completed: false,
      },
      { ...fullSettings, country: null, currency: null }
    )
    expect(screen.getByTestId("country-screen")).toBeDefined()
    expect(screen.queryByTestId("name-screen")).toBeNull()
  })

  it("renders the industry screen when country and currency are set but no industry is chosen", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: false,
        hasModel: false,
        hasRoles: false,
        completed: false,
      },
      { ...fullSettings, industry: null }
    )
    expect(screen.getByTestId("industry-screen")).toBeDefined()
    expect(screen.queryByTestId("country-screen")).toBeNull()
  })

  it("renders the families step when every setting is present and onboarding is not complete", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: false,
        hasRoles: false,
        completed: false,
      },
      fullSettings
    )
    expect(screen.getByTestId("families-step")).toBeDefined()
    expect(screen.getByTestId("families-orgid").textContent).toBe("org-1")
  })

  it("a missing language never gates the resume (it derives at creation)", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: false,
        hasRoles: false,
        completed: false,
      },
      { ...fullSettings, language: null }
    )
    // Every screen-gated setting is present, so the families step shows even
    // though language is null.
    expect(screen.getByTestId("families-step")).toBeDefined()
  })

  it("shows a spinner while settings are still loading", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: false,
        hasModel: false,
        hasRoles: false,
        completed: false,
      },
      undefined
    )
    expect(
      screen.getByLabelText(messages.dashboard.onboarding.loading)
    ).toBeDefined()
    expect(screen.queryByTestId("families-step")).toBeNull()
  })

  it("shows the waiting message to non-admin members", () => {
    renderWizard({
      organization: { orgId: "org-1", name: "Acme", role: "member" },
      settingsComplete: false,
      hasModel: false,
      hasRoles: false,
      completed: false,
    })
    expect(
      screen.getByText(messages.dashboard.onboarding.waitingForAdmin)
    ).toBeDefined()
  })

  it("gates the dots at the derived frontier (families is the last step)", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: false,
        hasRoles: false,
        completed: false,
      },
      fullSettings
    )
    // Frontier is the families screen (index 3); the four dots are name,
    // country, industry, families.
    expect(dotsProps?.steps.map((s) => s.key)).toEqual([
      "name",
      "country",
      "industry",
      "families",
    ])
    expect(dotsProps?.activeIndex).toBe(3)
    expect(dotsProps?.maxReachedIndex).toBe(3)
  })

  it("a reactive settings update never yanks the frontier screen before it advances", async () => {
    // The choice screens persist on pick and play a fade before calling
    // onAdvance; the settings subscription updates in between. The wizard must
    // hold the current screen until the screen itself advances.
    useQueryMock.mockReturnValue({
      ...fullSettings,
      country: null,
      currency: null,
      industry: null,
    })
    const status = {
      organization: admin,
      settingsComplete: false,
      hasModel: false,
      hasRoles: false,
      completed: false,
    }
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingWizard status={status} onFinished={() => {}} />
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("country-screen")).toBeDefined()

    // The pick persisted: settings now complete, derived jumps to the families
    // step, but the country screen must stay until its onAdvance fires.
    useQueryMock.mockReturnValue(fullSettings)
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingWizard status={status} onFinished={() => {}} />
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("country-screen")).toBeDefined()
    expect(screen.queryByTestId("families-step")).toBeNull()

    // onAdvance acknowledges the move: one step forward, not to the frontier.
    fireEvent.click(screen.getByText("country-done"))
    expect(await screen.findByTestId("industry-screen")).toBeDefined()
    fireEvent.click(screen.getByText("industry-done"))
    expect(await screen.findByTestId("families-step")).toBeDefined()
  })

  it("completing a revisited screen advances one step, not to the frontier", async () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: false,
        hasRoles: false,
        completed: false,
      },
      fullSettings
    )
    // Frontier is the families screen (index 3); jump back to the country
    // screen (index 1) via its dot.
    expect(screen.getByTestId("families-step")).toBeDefined()
    fireEvent.click(screen.getByTestId("dot-1"))
    expect(await screen.findByTestId("country-screen")).toBeDefined()

    // Completing it lands on the industry screen (index 2), not the frontier.
    fireEvent.click(screen.getByText("country-done"))
    expect(await screen.findByTestId("industry-screen")).toBeDefined()
    expect(screen.queryByTestId("families-step")).toBeNull()
    expect(dotsProps?.activeIndex).toBe(2)

    // Walking the last step returns to the frontier and clears the back-state.
    fireEvent.click(screen.getByText("industry-done"))
    expect(await screen.findByTestId("families-step")).toBeDefined()
    expect(dotsProps?.activeIndex).toBe(3)
  })

  it("clicking a previous dot navigates back to that screen", async () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: false,
        hasRoles: false,
        completed: false,
      },
      fullSettings
    )
    expect(screen.getByTestId("families-step")).toBeDefined()

    // Drive back-navigation through the dot button (index 1 = country).
    fireEvent.click(screen.getByTestId("dot-1"))

    expect(await screen.findByTestId("country-screen")).toBeDefined()
    expect(screen.queryByTestId("families-step")).toBeNull()
    // The active dot follows the revisited screen; the gate is unchanged.
    expect(dotsProps?.activeIndex).toBe(1)
    expect(dotsProps?.maxReachedIndex).toBe(3)
  })

  it("the families finish completes onboarding and hands control back to the gate", async () => {
    const onFinished = vi.fn()
    completeOnboardingMock.mockResolvedValue(null)
    useQueryMock.mockReturnValue(fullSettings)
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingWizard
          status={{
            organization: admin,
            settingsComplete: true,
            hasModel: true,
            hasRoles: false,
            completed: false,
          }}
          onFinished={onFinished}
        />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByText("families-finished"))
    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledWith({ orgId: "org-1" })
    })
    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
  })
})
