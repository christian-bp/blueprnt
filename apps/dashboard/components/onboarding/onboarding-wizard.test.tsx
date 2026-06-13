import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
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

// Each screen is mocked as a marker plus its onAdvance callback, so the tests
// assert which screen the machine selected without pulling in real screens.
vi.mock("@/components/onboarding/onboarding-header", () => ({
  OnboardingHeader: () => <div data-testid="header" />,
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

vi.mock("@/components/onboarding/model-setup-step", () => ({
  ModelSetupStep: (props: { orgId: string; onAdvance: () => void }) => (
    <div data-testid="model-step">
      <span data-testid="model-orgid">{props.orgId}</span>
      <button type="button" onClick={() => props.onAdvance()}>
        model-continue
      </button>
    </div>
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

vi.mock("@/components/onboarding/score-step", () => ({
  ScoreStep: (props: { orgId: string; onFinish: () => void }) => (
    <div data-testid="score-step">
      <span data-testid="score-orgid">{props.orgId}</span>
      <button type="button" onClick={() => props.onFinish()}>
        score-finished
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
    // Every screen-gated setting is present, so the model step shows even
    // though language is null.
    expect(screen.getByTestId("model-step")).toBeDefined()
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

  it("renders the model step when every setting is present", () => {
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
    expect(screen.getByTestId("model-step")).toBeDefined()
    expect(screen.getByTestId("model-orgid").textContent).toBe("org-1")
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
    expect(screen.queryByTestId("model-step")).toBeNull()
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

  it("gates the dots at the derived frontier (the model step before continue)", () => {
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
    // Frontier is the model screen (index 3); the gate follows the frontier, so
    // the families dot (index 4) stays unreachable until the model continues.
    expect(dotsProps?.activeIndex).toBe(3)
    expect(dotsProps?.maxReachedIndex).toBe(3)
  })

  it("the model continue advances to the families screen and opens its dot", async () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: true,
        hasRoles: false,
        completed: false,
      },
      fullSettings
    )
    expect(screen.getByTestId("model-step")).toBeDefined()
    expect(dotsProps?.maxReachedIndex).toBe(3)

    // onAdvance sets the session step to the families index (4). The step
    // crossfade mounts the next screen only after the old one has faded out.
    fireEvent.click(screen.getByText("model-continue"))

    expect(await screen.findByTestId("families-step")).toBeDefined()
    expect(screen.getByTestId("families-orgid").textContent).toBe("org-1")
    await waitFor(() => {
      expect(screen.queryByTestId("model-step")).toBeNull()
    })
    expect(dotsProps?.activeIndex).toBe(4)
    expect(dotsProps?.maxReachedIndex).toBe(4)
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

    // The pick persisted: settings now complete, derived jumps to the model
    // step, but the country screen must stay until its onAdvance fires.
    useQueryMock.mockReturnValue(fullSettings)
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingWizard status={status} onFinished={() => {}} />
      </NextIntlClientProvider>
    )
    expect(screen.getByTestId("country-screen")).toBeDefined()
    expect(screen.queryByTestId("model-step")).toBeNull()

    // onAdvance acknowledges the move: one step forward, not to the frontier.
    fireEvent.click(screen.getByText("country-done"))
    expect(await screen.findByTestId("industry-screen")).toBeDefined()
    fireEvent.click(screen.getByText("industry-done"))
    expect(await screen.findByTestId("model-step")).toBeDefined()
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
    // Frontier is the model screen (index 3); jump back to the country
    // screen (index 1) via its dot.
    expect(screen.getByTestId("model-step")).toBeDefined()
    fireEvent.click(screen.getByTestId("dot-1"))
    expect(await screen.findByTestId("country-screen")).toBeDefined()

    // Completing it lands on the industry screen (index 2), not the frontier.
    fireEvent.click(screen.getByText("country-done"))
    expect(await screen.findByTestId("industry-screen")).toBeDefined()
    expect(screen.queryByTestId("model-step")).toBeNull()
    expect(dotsProps?.activeIndex).toBe(2)

    // Walking the last step returns to the frontier and clears the back-state.
    fireEvent.click(screen.getByText("industry-done"))
    expect(await screen.findByTestId("model-step")).toBeDefined()
    expect(dotsProps?.activeIndex).toBe(3)
  })

  it("discarding the model retracts the families dot and returns to the model step", async () => {
    // The session latch (model continue) must only count while the model still
    // exists: after a discard the families screen would dead-end on its
    // spinner, so the dot may not stay reachable.
    useQueryMock.mockReturnValue(fullSettings)
    const status = {
      organization: admin,
      settingsComplete: true,
      hasModel: true,
      hasRoles: false,
      completed: false,
    }
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingWizard status={status} onFinished={() => {}} />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByText("model-continue"))
    expect(await screen.findByTestId("families-step")).toBeDefined()
    expect(dotsProps?.maxReachedIndex).toBe(4)

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
    expect(await screen.findByTestId("model-step")).toBeDefined()
    await waitFor(() => {
      expect(screen.queryByTestId("families-step")).toBeNull()
    })
    expect(dotsProps?.activeIndex).toBe(3)
    expect(dotsProps?.maxReachedIndex).toBe(3)
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
    expect(screen.getByTestId("model-step")).toBeDefined()

    // Drive back-navigation through the dot button (index 1 = country).
    fireEvent.click(screen.getByTestId("dot-1"))

    expect(await screen.findByTestId("country-screen")).toBeDefined()
    expect(screen.queryByTestId("model-step")).toBeNull()
    // The active dot follows the revisited screen; the gate is unchanged.
    expect(dotsProps?.activeIndex).toBe(1)
    expect(dotsProps?.maxReachedIndex).toBe(3)
  })

  it("resumes on the score step when families is server-complete but onboarding is not", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: true,
        hasRoles: true,
        completed: false,
      },
      fullSettings
    )
    // families.isComplete follows hasRoles (true), score.isComplete follows
    // completed (false), so the first incomplete step is the score step.
    expect(screen.getByTestId("score-step")).toBeDefined()
    expect(screen.getByTestId("score-orgid").textContent).toBe("org-1")
  })

  it("the families continue advances to the score step", async () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: true,
        hasRoles: false,
        completed: false,
      },
      fullSettings
    )
    // hasRoles is false, so families is the frontier. Continue from model,
    // then from families, landing on the score step.
    fireEvent.click(screen.getByText("model-continue"))
    expect(await screen.findByTestId("families-step")).toBeDefined()
    fireEvent.click(screen.getByText("families-finished"))
    expect(await screen.findByTestId("score-step")).toBeDefined()
  })

  it("the score step's finish hands control back to the gate", async () => {
    const onFinished = vi.fn()
    useQueryMock.mockReturnValue(fullSettings)
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingWizard
          status={{
            organization: admin,
            settingsComplete: true,
            hasModel: true,
            hasRoles: true,
            completed: false,
          }}
          onFinished={onFinished}
        />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByText("score-finished"))
    expect(onFinished).toHaveBeenCalledTimes(1)
  })
})
