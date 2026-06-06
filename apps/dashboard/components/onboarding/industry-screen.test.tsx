import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const updateSettingsMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: () => updateSettingsMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      organization: {
        updateOrganizationSettings:
          "accounts.organization.updateOrganizationSettings",
      },
    },
  },
}))

import { IndustryScreen } from "@/components/onboarding/industry-screen"

const profile = messages.dashboard.onboarding.profile
const continueCta = messages.dashboard.onboarding.screens.continueCta

function renderScreen(props: Parameters<typeof IndustryScreen>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <IndustryScreen {...props} />
    </NextIntlClientProvider>
  )
}

describe("IndustryScreen", () => {
  beforeEach(() => {
    updateSettingsMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("selecting a card and continuing saves the chosen industry", async () => {
    updateSettingsMock.mockResolvedValue(undefined)
    const onDone = vi.fn()
    renderScreen({ orgId: "org-1", saved: null, onDone })

    fireEvent.click(
      screen.getByRole("button", { name: profile.industries.healthcare })
    )
    fireEvent.click(screen.getByRole("button", { name: continueCta }))

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        orgId: "org-1",
        industry: "healthcare",
      })
    })
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1)
    })
  })

  it("continue saves the default industry when nothing is picked", async () => {
    updateSettingsMock.mockResolvedValue(undefined)
    renderScreen({ orgId: "org-1", saved: null, onDone: vi.fn() })

    fireEvent.click(screen.getByRole("button", { name: continueCta }))

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        orgId: "org-1",
        industry: "itTelecom",
      })
    })
  })

  it("a saved value preselects its card", () => {
    renderScreen({ orgId: "org-1", saved: "manufacturing", onDone: vi.fn() })
    expect(
      screen
        .getByRole("button", { name: profile.industries.manufacturing })
        .getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: profile.industries.itTelecom })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("shows an alert when the save rejects", async () => {
    updateSettingsMock.mockRejectedValue(
      new Error("ConvexError: adminRequired")
    )
    const onDone = vi.fn()
    renderScreen({ orgId: "org-1", saved: "retail", onDone })

    fireEvent.click(screen.getByRole("button", { name: continueCta }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onDone).not.toHaveBeenCalled()
  })
})
