import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import type { OnboardingStatus } from "@/components/onboarding/onboarding-wizard"

// The wizard reads getOrganizationSettings via convex/react useQuery; each case
// supplies the settings fixture (or undefined for the loading state).
const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

// Each screen is mocked as a marker plus its onDone callback, so the tests
// assert which screen the machine selected without pulling in real screens.
vi.mock("@/components/onboarding/onboarding-header", () => ({
  OnboardingHeader: () => <div data-testid="header" />,
}))

vi.mock("@/components/onboarding/name-screen", () => ({
  NameScreen: (props: {
    existing: { orgId: string; name: string } | null
    onDone: () => void
  }) => (
    <div data-testid="name-screen">
      <span data-testid="name-mode">
        {props.existing ? `existing:${props.existing.name}` : "fresh"}
      </span>
      <button type="button" onClick={() => props.onDone()}>
        name-done
      </button>
    </div>
  ),
}))

vi.mock("@/components/onboarding/language-screen", () => ({
  LanguageScreen: (props: { saved: string | null; onDone: () => void }) => (
    <div data-testid="language-screen">
      <span data-testid="language-saved">{props.saved ?? "null"}</span>
      <button type="button" onClick={() => props.onDone()}>
        language-done
      </button>
    </div>
  ),
}))

vi.mock("@/components/onboarding/country-screen", () => ({
  CountryScreen: (props: {
    savedCountry: string | null
    onDone: () => void
  }) => (
    <div data-testid="country-screen">
      <span data-testid="country-saved">{props.savedCountry ?? "null"}</span>
      <button type="button" onClick={() => props.onDone()}>
        country-done
      </button>
    </div>
  ),
}))

vi.mock("@/components/onboarding/industry-screen", () => ({
  IndustryScreen: (props: { saved: string | null; onDone: () => void }) => (
    <div data-testid="industry-screen">
      <span data-testid="industry-saved">{props.saved ?? "null"}</span>
      <button type="button" onClick={() => props.onDone()}>
        industry-done
      </button>
    </div>
  ),
}))

vi.mock("@/components/onboarding/model-setup-step", () => ({
  ModelSetupStep: (props: { orgId: string; onContinue: () => void }) => (
    <div data-testid="model-step">
      <span data-testid="model-orgid">{props.orgId}</span>
      <button type="button" onClick={() => props.onContinue()}>
        model-continue
      </button>
    </div>
  ),
}))

vi.mock("@/components/onboarding/families-step", () => ({
  FamiliesStep: (props: { orgId: string; onFinished: () => void }) => (
    <div data-testid="families-step">
      <span data-testid="families-orgid">{props.orgId}</span>
      <button type="button" onClick={() => props.onFinished()}>
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
vi.mock("@/components/onboarding-dots", () => ({
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
  })

  it("renders the name screen in fresh mode when no organization exists", () => {
    renderWizard({
      organization: null,
      settingsComplete: false,
      hasModel: false,
      completed: false,
    })
    expect(screen.getByTestId("name-mode").textContent).toBe("fresh")
  })

  it("renders the language screen when the organization exists but no language is saved", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: false,
        hasModel: false,
        completed: false,
      },
      { ...fullSettings, language: null }
    )
    expect(screen.getByTestId("language-screen")).toBeDefined()
    expect(screen.queryByTestId("name-screen")).toBeNull()
  })

  it("renders the country screen when the language is saved but no country is set", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: false,
        hasModel: false,
        completed: false,
      },
      { ...fullSettings, country: null, currency: null }
    )
    expect(screen.getByTestId("country-screen")).toBeDefined()
    expect(screen.queryByTestId("language-screen")).toBeNull()
  })

  it("renders the industry screen when country and currency are set but no industry is chosen", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: false,
        hasModel: false,
        completed: false,
      },
      { ...fullSettings, industry: null }
    )
    expect(screen.getByTestId("industry-screen")).toBeDefined()
    expect(screen.queryByTestId("country-screen")).toBeNull()
  })

  it("renders the model step when every setting is present", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: false,
        completed: false,
      },
      fullSettings
    )
    expect(screen.getByTestId("model-step")).toBeDefined()
    expect(screen.getByTestId("model-orgid").textContent).toBe("org-1")
  })

  it("shows a spinner while settings are still loading", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: false,
        hasModel: false,
        completed: false,
      },
      undefined
    )
    expect(
      screen.getByLabelText(messages.dashboard.onboarding.loading)
    ).toBeDefined()
    expect(screen.queryByTestId("model-step")).toBeNull()
  })

  it("shows the waiting message to non-admin members", () => {
    renderWizard({
      organization: { orgId: "org-1", name: "Acme", role: "member" },
      settingsComplete: false,
      hasModel: false,
      completed: false,
    })
    expect(
      screen.getByText(messages.dashboard.onboarding.waitingForAdmin)
    ).toBeDefined()
  })

  it("gates the dots at the derived frontier (the model step before continue)", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: false,
        completed: false,
      },
      fullSettings
    )
    // Frontier is the model screen (index 4); the gate follows the frontier, so
    // the families dot (index 5) stays unreachable until the model continues.
    expect(dotsProps?.activeIndex).toBe(4)
    expect(dotsProps?.maxReachedIndex).toBe(4)
  })

  it("the model continue advances to the families screen and opens its dot", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: true,
        completed: false,
      },
      fullSettings
    )
    expect(screen.getByTestId("model-step")).toBeDefined()
    expect(dotsProps?.maxReachedIndex).toBe(4)

    // onContinue sets the session step to the families index (5).
    fireEvent.click(screen.getByText("model-continue"))

    expect(screen.getByTestId("families-step")).toBeDefined()
    expect(screen.getByTestId("families-orgid").textContent).toBe("org-1")
    expect(screen.queryByTestId("model-step")).toBeNull()
    expect(dotsProps?.activeIndex).toBe(5)
    expect(dotsProps?.maxReachedIndex).toBe(5)
  })

  it("completing a revisited screen advances one step, not to the frontier", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: false,
        completed: false,
      },
      fullSettings
    )
    // Frontier is the model screen (index 4); jump back to the language
    // screen (index 1) via its dot.
    expect(screen.getByTestId("model-step")).toBeDefined()
    fireEvent.click(screen.getByTestId("dot-1"))
    expect(screen.getByTestId("language-screen")).toBeDefined()

    // Completing it lands on the country screen (index 2), not the frontier.
    fireEvent.click(screen.getByText("language-done"))
    expect(screen.getByTestId("country-screen")).toBeDefined()
    expect(screen.queryByTestId("model-step")).toBeNull()
    expect(dotsProps?.activeIndex).toBe(2)

    // Walking the rest of the way returns to the frontier and clears the
    // back-state (industry, then model).
    fireEvent.click(screen.getByText("country-done"))
    expect(screen.getByTestId("industry-screen")).toBeDefined()
    fireEvent.click(screen.getByText("industry-done"))
    expect(screen.getByTestId("model-step")).toBeDefined()
    expect(dotsProps?.activeIndex).toBe(4)
  })

  it("discarding the model retracts the families dot and returns to the model step", () => {
    // The session latch (model continue) must only count while the model still
    // exists: after a discard the families screen would dead-end on its
    // spinner, so the dot may not stay reachable.
    useQueryMock.mockReturnValue(fullSettings)
    const status = {
      organization: admin,
      settingsComplete: true,
      hasModel: true,
      completed: false,
    }
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingWizard status={status} onFinished={() => {}} />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByText("model-continue"))
    expect(screen.getByTestId("families-step")).toBeDefined()
    expect(dotsProps?.maxReachedIndex).toBe(5)

    // The model is discarded (change-choice inside the model step); the status
    // query updates reactively and hasModel flips to false.
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingWizard
          status={{ ...status, hasModel: false }}
          onFinished={() => {}}
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("model-step")).toBeDefined()
    expect(screen.queryByTestId("families-step")).toBeNull()
    expect(dotsProps?.activeIndex).toBe(4)
    expect(dotsProps?.maxReachedIndex).toBe(4)
  })

  it("clicking a previous dot navigates back to that screen", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: false,
        completed: false,
      },
      fullSettings
    )
    expect(screen.getByTestId("model-step")).toBeDefined()

    // Drive back-navigation through the dot button (index 1 = language).
    fireEvent.click(screen.getByTestId("dot-1"))

    expect(screen.getByTestId("language-screen")).toBeDefined()
    expect(screen.queryByTestId("model-step")).toBeNull()
    // The active dot follows the revisited screen; the gate is unchanged.
    expect(dotsProps?.activeIndex).toBe(1)
    expect(dotsProps?.maxReachedIndex).toBe(4)
  })
})
