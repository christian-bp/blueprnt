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
const continueCta = messages.dashboard.onboarding.screens.continueCta

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

  it("selecting a card previews that locale", () => {
    renderScreen({ orgId: "org-1", saved: null, onDone: vi.fn() })
    fireEvent.click(screen.getByRole("button", { name: labels.languages.en }))
    expect(setPreviewLocaleMock).toHaveBeenCalledWith("en")
  })

  it("continue saves the selected language and calls onDone", async () => {
    updateSettingsMock.mockResolvedValue(undefined)
    const onDone = vi.fn()
    renderScreen({ orgId: "org-1", saved: null, onDone })

    fireEvent.click(screen.getByRole("button", { name: labels.languages.fi }))
    fireEvent.click(screen.getByRole("button", { name: continueCta }))

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        orgId: "org-1",
        language: "fi",
      })
    })
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1)
    })
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

  it("shows an alert when the save rejects", async () => {
    updateSettingsMock.mockRejectedValue(
      new Error("ConvexError: adminRequired")
    )
    const onDone = vi.fn()
    renderScreen({ orgId: "org-1", saved: "sv", onDone })

    fireEvent.click(screen.getByRole("button", { name: continueCta }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onDone).not.toHaveBeenCalled()
  })
})
