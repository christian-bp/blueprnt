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

import { CountryScreen } from "@/components/onboarding/country-screen"

const profile = messages.dashboard.onboarding.profile

function renderScreen(props: Parameters<typeof CountryScreen>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CountryScreen {...props} />
    </NextIntlClientProvider>
  )
}

describe("CountryScreen", () => {
  beforeEach(() => {
    updateSettingsMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("picking Norway saves the country with its derived currency and auto-advances", async () => {
    updateSettingsMock.mockResolvedValue(undefined)
    const onDone = vi.fn()
    renderScreen({ orgId: "org-1", savedCountry: null, onDone })

    fireEvent.click(screen.getByRole("button", { name: profile.countries.no }))

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        orgId: "org-1",
        country: "no",
        currency: "NOK",
      })
    })
    await waitFor(
      () => {
        expect(onDone).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 }
    )
  })

  it.each([
    ["se", "SEK"],
    ["no", "NOK"],
    ["dk", "DKK"],
    ["fi", "EUR"],
    ["other", "EUR"],
  ])("derives the currency for %s as %s", async (country, currency) => {
    updateSettingsMock.mockResolvedValue(undefined)
    renderScreen({ orgId: "org-1", savedCountry: null, onDone: vi.fn() })

    fireEvent.click(
      screen.getByRole("button", {
        name: profile.countries[country as keyof typeof profile.countries],
      })
    )

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        orgId: "org-1",
        country,
        currency,
      })
    })
  })

  it("the fresh flow marks no card", () => {
    renderScreen({ orgId: "org-1", savedCountry: null, onDone: vi.fn() })
    for (const name of Object.values(profile.countries)) {
      expect(
        screen.getByRole("button", { name }).getAttribute("aria-pressed")
      ).toBe("false")
    }
  })

  it("a saved country preselects its card", () => {
    renderScreen({ orgId: "org-1", savedCountry: "dk", onDone: vi.fn() })
    expect(
      screen
        .getByRole("button", { name: profile.countries.dk })
        .getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: profile.countries.se })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("shows an alert and restores the cards when the save rejects", async () => {
    updateSettingsMock.mockRejectedValue(
      new Error("ConvexError: adminRequired")
    )
    const onDone = vi.fn()
    // Fresh flow: nothing saved, so the marking must come from the pick alone.
    renderScreen({ orgId: "org-1", savedCountry: null, onDone })

    fireEvent.click(screen.getByRole("button", { name: profile.countries.no }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onDone).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: profile.countries.se })
    ).toHaveProperty("disabled", false)
    // The failed pick stays marked next to the error alert.
    expect(
      screen
        .getByRole("button", { name: profile.countries.no })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })
})
