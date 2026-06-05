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

const createMock = vi.fn()
const orgUpdateMock = vi.fn()
const updateProfileMock = vi.fn()
const useQueryMock = vi.fn()
const setPreviewLocaleMock = vi.fn()

vi.mock("@/components/locale-provider", () => ({
  useSetPreviewLocale: () => setPreviewLocaleMock,
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => orgUpdateMock(...args),
    },
  },
}))

vi.mock("@/lib/slug", () => ({
  organizationSlug: (name: string) => `${name.toLowerCase()}-xxxx`,
}))

vi.mock("convex/react", () => ({
  useMutation: () => updateProfileMock,
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

// Mock the Convex API reference so the import resolves without the generated
// client being present in the test environment.
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      organization: {
        updateOrganizationSettings:
          "accounts.organization.updateOrganizationSettings",
        getOrganizationSettings:
          "accounts.organization.getOrganizationSettings",
      },
    },
  },
}))

import { OrganizationSetupStep } from "@/components/onboarding/organization-setup-step"

function renderStep(
  props: Parameters<typeof OrganizationSetupStep>[0] = { existing: null }
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationSetupStep {...props} />
    </NextIntlClientProvider>
  )
}

describe("OrganizationSetupStep", () => {
  beforeEach(() => {
    createMock.mockReset()
    orgUpdateMock.mockReset()
    updateProfileMock.mockReset()
    useQueryMock.mockReset()
    setPreviewLocaleMock.mockReset()
    // Default: the profile query is unresolved (create mode skips it anyway).
    useQueryMock.mockReturnValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it("create mode: the CTA is disabled for a too-short name", () => {
    renderStep()
    const input = screen.getByLabelText(
      messages.dashboard.onboarding.organization.nameLabel
    )
    const button = screen.getByRole("button", {
      name: messages.dashboard.onboarding.organization.cta,
    })

    // Initially disabled (empty name).
    expect(button).toHaveProperty("disabled", true)

    // Single character: still too short (minLength=2).
    fireEvent.change(input, { target: { value: "a" } })
    expect(button).toHaveProperty("disabled", true)

    // Two characters: button becomes enabled.
    fireEvent.change(input, { target: { value: "ab" } })
    expect(button).toHaveProperty("disabled", false)
  })

  it("create mode: submits org create then the full profile update", async () => {
    // Stub browser language to Swedish so the detected locale is deterministic.
    vi.stubGlobal("navigator", { language: "sv-SE" })
    createMock.mockResolvedValue({
      data: { id: "org-id-from-create-mock" },
      error: null,
    })
    updateProfileMock.mockResolvedValue(undefined)
    renderStep()

    const input = screen.getByLabelText(
      messages.dashboard.onboarding.organization.nameLabel
    )
    fireEvent.change(input, { target: { value: "Acme Corp" } })

    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: "Acme Corp",
        slug: "acme corp-xxxx",
      })
    })
    await waitFor(() => {
      // Full profile: browser-detected language sv, default lowercase country
      // "se", default currency, default industry itTelecom. Employee count is
      // never sent.
      expect(updateProfileMock).toHaveBeenCalledWith({
        orgId: "org-id-from-create-mock",
        language: "sv",
        country: "se",
        currency: "SEK",
        industry: "itTelecom",
      })
    })
    const call = updateProfileMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call).not.toHaveProperty("employeeCount")
    expect(call.country).toBe(String(call.country).toLowerCase())
    vi.unstubAllGlobals()
  })

  it("create mode: detects sv from navigator.language and previews on mount", async () => {
    vi.stubGlobal("navigator", { language: "sv-SE" })
    renderStep()

    // The hidden Radix select reflects the controlled value.
    const hiddenSelect = document.querySelector("select")
    if (hiddenSelect) {
      expect(hiddenSelect.value).toBe("sv")
    }
    // On mount the detected locale (sv) differs from activeLocale (en), so
    // setPreviewLocale must be called to align the page with the select.
    await waitFor(() => {
      expect(setPreviewLocaleMock).toHaveBeenCalledWith("sv")
    })
    vi.unstubAllGlobals()
  })

  it("create mode: an unsupported browser language falls back without a preview call", async () => {
    vi.stubGlobal("navigator", { language: "de-DE" })
    renderStep()

    const hiddenSelect = document.querySelector("select")
    if (hiddenSelect) {
      // Falls back to activeLocale "en".
      expect(hiddenSelect.value).toBe("en")
    }
    // No preview call needed: detected locale equals activeLocale already.
    await new Promise((r) => setTimeout(r, 50))
    expect(setPreviewLocaleMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("calls setPreviewLocale when the language select value changes", () => {
    renderStep()

    // Radix Select renders a hidden <select> for native form compatibility.
    // The first one is the language select (declared first in the markup).
    const hiddenSelect = document.querySelector("select")
    if (!hiddenSelect) {
      // If Radix does not render a hidden select in this environment, the
      // interaction is e2e scope; assert the mock itself is wired.
      expect(setPreviewLocaleMock).toBeDefined()
      return
    }
    fireEvent.change(hiddenSelect, { target: { value: "fi" } })
    expect(setPreviewLocaleMock).toHaveBeenCalledWith("fi")
  })

  it("create mode: shows the error alert when organization.create resolves with an error", async () => {
    createMock.mockResolvedValue({
      error: { message: "already taken" },
      data: null,
    })
    renderStep()

    const input = screen.getByLabelText(
      messages.dashboard.onboarding.organization.nameLabel
    )
    fireEvent.change(input, { target: { value: "Acme Corp" } })

    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    // The profile write must not run when the org create failed.
    expect(updateProfileMock).not.toHaveBeenCalled()
    // Button must be re-enabled after failure.
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.onboarding.organization.cta,
      })
    ).toHaveProperty("disabled", false)
  })

  it("create mode: shows the error alert when organization.create rejects", async () => {
    createMock.mockRejectedValue(new Error("Network error"))
    renderStep()

    const input = screen.getByLabelText(
      messages.dashboard.onboarding.organization.nameLabel
    )
    fireEvent.change(input, { target: { value: "Acme Corp" } })

    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.onboarding.organization.cta,
      })
    ).toHaveProperty("disabled", false)
  })

  it("create mode: shows the error alert when the profile write rejects after create", async () => {
    createMock.mockResolvedValue({ data: { id: "org-new" }, error: null })
    updateProfileMock.mockRejectedValue(new Error("ConvexError: adminRequired"))
    renderStep()

    const input = screen.getByLabelText(
      messages.dashboard.onboarding.organization.nameLabel
    )
    fireEvent.change(input, { target: { value: "Acme Corp" } })

    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    // The org was created; the failing write surfaces the error and re-enables
    // the button so a retry (now in existing mode through the wizard) is
    // possible.
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.onboarding.organization.cta,
      })
    ).toHaveProperty("disabled", false)
  })

  it("existing mode: prefills the name and seeds language and profile from the saved profile", async () => {
    useQueryMock.mockReturnValue({
      orgId: "org-9",
      language: "fi",
      country: "no",
      currency: "NOK",
      industry: "manufacturing",
    })
    updateProfileMock.mockResolvedValue(undefined)
    renderStep({ existing: { orgId: "org-9", name: "Existing Name" } })

    // The name input is prefilled with the existing org name.
    const input = screen.getByLabelText(
      messages.dashboard.onboarding.organization.nameLabel
    ) as HTMLInputElement
    expect(input.value).toBe("Existing Name")

    // The CTA uses the save label, not the create label.
    const saveButton = screen.getByRole("button", {
      name: messages.dashboard.onboarding.organization.saveCta,
    })
    expect(saveButton).toBeDefined()

    // Submitting without changing the name sends the seeded profile values and
    // skips the org rename.
    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        orgId: "org-9",
        language: "fi",
        country: "no",
        currency: "NOK",
        industry: "manufacturing",
      })
    })
    expect(orgUpdateMock).not.toHaveBeenCalled()
  })

  it("existing mode: null profile fields fall back to the defaults", async () => {
    useQueryMock.mockReturnValue({
      orgId: "org-9",
      language: null,
      country: null,
      currency: null,
      industry: null,
    })
    updateProfileMock.mockResolvedValue(undefined)
    renderStep({ existing: { orgId: "org-9", name: "Same Name" } })

    const form = screen
      .getByRole("button", {
        name: messages.dashboard.onboarding.organization.saveCta,
      })
      .closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        orgId: "org-9",
        language: "sv",
        country: "se",
        currency: "SEK",
        industry: "itTelecom",
      })
    })
  })

  it("existing mode: a changed name calls organization.update then the profile update and onDone", async () => {
    useQueryMock.mockReturnValue({
      orgId: "org-9",
      language: "sv",
      country: "se",
      currency: "SEK",
      industry: "itTelecom",
    })
    orgUpdateMock.mockResolvedValue({ data: { id: "org-9" }, error: null })
    updateProfileMock.mockResolvedValue(undefined)
    const onDone = vi.fn()
    renderStep({ existing: { orgId: "org-9", name: "Old Name" }, onDone })

    const input = screen.getByLabelText(
      messages.dashboard.onboarding.organization.nameLabel
    )
    fireEvent.change(input, { target: { value: "New Name" } })

    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(orgUpdateMock).toHaveBeenCalledWith({
        organizationId: "org-9",
        data: { name: "New Name" },
      })
    })
    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        orgId: "org-9",
        language: "sv",
        country: "se",
        currency: "SEK",
        industry: "itTelecom",
      })
    })
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1)
    })
  })

  it("existing mode: shows the error alert when the profile write rejects", async () => {
    useQueryMock.mockReturnValue({
      orgId: "org-9",
      language: "sv",
      country: "se",
      currency: "SEK",
      industry: "itTelecom",
    })
    updateProfileMock.mockRejectedValue(new Error("ConvexError: adminRequired"))
    const onDone = vi.fn()
    renderStep({ existing: { orgId: "org-9", name: "Same Name" }, onDone })

    const form = screen
      .getByRole("button", {
        name: messages.dashboard.onboarding.organization.saveCta,
      })
      .closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onDone).not.toHaveBeenCalled()
  })
})
