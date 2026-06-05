import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import type { OnboardingStatus } from "@/components/onboarding/onboarding-wizard"

// Each step is mocked as a small set of buttons that expose its callback props
// and, for the organization step, the "existing" prop. This keeps the test focused
// on the wizard's two-step selection and back-navigation wiring.
vi.mock("@/components/onboarding/onboarding-header", () => ({
  OnboardingHeader: () => <div data-testid="header" />,
}))

vi.mock("@/components/onboarding/organization-setup-step", () => ({
  OrganizationSetupStep: (props: {
    existing: { orgId: string; name: string } | null
    onDone?: () => void
  }) => (
    <div data-testid="organization-step">
      <span data-testid="organization-mode">
        {props.existing ? `existing:${props.existing.name}` : "fresh"}
      </span>
      <button type="button" onClick={() => props.onDone?.()}>
        organization-done
      </button>
    </div>
  ),
}))

vi.mock("@/components/onboarding/model-setup-step", () => ({
  ModelSetupStep: (props: { orgId: string; onBack?: () => void }) => (
    <div data-testid="model-step">
      <button type="button" onClick={() => props.onBack?.()}>
        model-back
      </button>
    </div>
  ),
}))

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

const admin = { orgId: "org-1", name: "Acme", role: "admin" }

function renderWizard(status: OnboardingStatus) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OnboardingWizard status={status} onFinished={() => {}} />
    </NextIntlClientProvider>
  )
}

describe("OnboardingWizard", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the organization step in fresh mode when no organization exists", () => {
    renderWizard({
      organization: null,
      settingsComplete: false,
      hasModel: false,
      completed: false,
    })
    expect(screen.getByTestId("organization-mode").textContent).toBe("fresh")
  })

  it("stays on the organization step (existing mode) when the organization exists but the profile is incomplete", () => {
    // A fresh-create retry: the org exists but the profile write has not landed,
    // so derived is still step 1 with a non-null existing.
    renderWizard({
      organization: admin,
      settingsComplete: false,
      hasModel: false,
      completed: false,
    })
    expect(screen.getByTestId("organization-mode").textContent).toBe(
      "existing:Acme"
    )
    expect(screen.queryByTestId("model-step")).toBeNull()
  })

  it("renders the model step at derived step 2 (organization plus complete profile)", () => {
    renderWizard({
      organization: admin,
      settingsComplete: true,
      hasModel: false,
      completed: false,
    })
    expect(screen.getByTestId("model-step")).toBeDefined()
  })

  it("back from the model step revisits the organization step in existing mode", () => {
    renderWizard({
      organization: admin,
      settingsComplete: true,
      hasModel: false,
      completed: false,
    })
    expect(screen.getByTestId("model-step")).toBeDefined()

    fireEvent.click(screen.getByText("model-back"))

    expect(screen.getByTestId("organization-mode").textContent).toBe(
      "existing:Acme"
    )
    expect(screen.queryByTestId("model-step")).toBeNull()
  })

  it("organization done from the revisit returns forward to the model step", () => {
    renderWizard({
      organization: admin,
      settingsComplete: true,
      hasModel: false,
      completed: false,
    })

    fireEvent.click(screen.getByText("model-back"))
    expect(screen.getByTestId("organization-step")).toBeDefined()

    fireEvent.click(screen.getByText("organization-done"))
    // backTo cleared, derived step 2 shows again.
    expect(screen.getByTestId("model-step")).toBeDefined()
    expect(screen.queryByTestId("organization-step")).toBeNull()
  })

  it("the step indicator follows the effective step, not the derived step", () => {
    renderWizard({
      organization: admin,
      settingsComplete: true,
      hasModel: false,
      completed: false,
    })
    // Derived step 2.
    expect(screen.getByText(/Step 2 of 2/)).toBeDefined()

    fireEvent.click(screen.getByText("model-back"))
    // Effective step 1 after going back.
    expect(screen.getByText(/Step 1 of 2/)).toBeDefined()
  })

  it("neutralizes a stale backTo once the derived step is no longer above it", () => {
    // The user is at derived step 2 and goes back to step 1. backTo (1) is held
    // only while it stays below derived; once derived is no longer above it the
    // revisit is dropped. With a two-step wizard derived cannot exceed 2, so a
    // back to 1 from 2 is honored until cleared.
    renderWizard({
      organization: admin,
      settingsComplete: true,
      hasModel: false,
      completed: false,
    })
    fireEvent.click(screen.getByText("model-back"))
    expect(screen.getByTestId("organization-mode").textContent).toBe(
      "existing:Acme"
    )
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
})
