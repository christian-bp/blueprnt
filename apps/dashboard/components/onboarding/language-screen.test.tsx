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
const setPreviewLocaleMock = vi.fn()

vi.mock("@/components/locale-provider", () => ({
  useSetPreviewLocale: () => setPreviewLocaleMock,
}))

vi.mock("@/lib/locale", () => ({
  detectBrowserLocale: () => "sv",
}))

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

import { LanguageScreen } from "@/components/onboarding/language-screen"

const labels = messages.dashboard.onboarding.organization

function renderScreen(props: Parameters<typeof LanguageScreen>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LanguageScreen {...props} />
    </NextIntlClientProvider>
  )
}

describe("LanguageScreen", () => {
  beforeEach(() => {
    updateSettingsMock.mockReset()
    setPreviewLocaleMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("picking a card previews that locale immediately", () => {
    updateSettingsMock.mockResolvedValue(undefined)
    renderScreen({ orgId: "org-1", saved: null, onDone: vi.fn() })
    fireEvent.click(screen.getByRole("button", { name: labels.languages.en }))
    expect(setPreviewLocaleMock).toHaveBeenCalledWith("en")
  })

  it("picking a card saves the language and auto-advances", async () => {
    updateSettingsMock.mockResolvedValue(undefined)
    const onDone = vi.fn()
    renderScreen({ orgId: "org-1", saved: null, onDone })

    fireEvent.click(screen.getByRole("button", { name: labels.languages.fi }))

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        orgId: "org-1",
        language: "fi",
      })
    })
    // onDone waits for both the save and the fade-out of the other cards.
    await waitFor(
      () => {
        expect(onDone).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 }
    )
  })

  it("disables the other cards while a pick is in flight", () => {
    // A pending save keeps the choice in flight.
    updateSettingsMock.mockReturnValue(new Promise(() => {}))
    renderScreen({ orgId: "org-1", saved: null, onDone: vi.fn() })

    fireEvent.click(screen.getByRole("button", { name: labels.languages.fi }))

    expect(
      screen.getByRole("button", { name: labels.languages.sv })
    ).toHaveProperty("disabled", true)
    expect(
      screen.getByRole("button", { name: labels.languages.fi })
    ).toHaveProperty("disabled", false)
  })

  it("a saved value preselects its card", () => {
    renderScreen({ orgId: "org-1", saved: "nb", onDone: vi.fn() })
    expect(
      screen
        .getByRole("button", { name: labels.languages.nb })
        .getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: labels.languages.sv })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("shows an alert and restores the cards when the save rejects", async () => {
    updateSettingsMock.mockRejectedValue(
      new Error("ConvexError: adminRequired")
    )
    const onDone = vi.fn()
    renderScreen({ orgId: "org-1", saved: "sv", onDone })

    fireEvent.click(screen.getByRole("button", { name: labels.languages.en }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onDone).not.toHaveBeenCalled()
    // The cards are interactive again, and the failed pick stays marked so
    // the cards keep agreeing with the previewed page language.
    expect(
      screen.getByRole("button", { name: labels.languages.sv })
    ).toHaveProperty("disabled", false)
    expect(
      screen
        .getByRole("button", { name: labels.languages.en })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })
})
