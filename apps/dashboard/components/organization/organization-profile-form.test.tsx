import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const updateName = vi.fn(async () => null)
const updateSettings = vi.fn(async () => null)

// Mock the generated api to PLAIN STRING refs: a real FunctionReference is a
// proxy that throws on String()/coercion, so route useMutation by identity.
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      organization: {
        updateOrganizationName: "accounts.organization.updateOrganizationName",
        updateOrganizationSettings:
          "accounts.organization.updateOrganizationSettings",
      },
    },
  },
}))
vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "accounts.organization.updateOrganizationName"
      ? updateName
      : updateSettings,
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "o1", name: "Acme AB", role: "admin" }),
}))

import { OrganizationProfileForm } from "./organization-profile-form"

const t = en.dashboard.organization.general

function renderForm(
  initial = { country: "se", currency: "SEK", language: "sv", industry: "tech" }
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <OrganizationProfileForm initial={initial} />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  updateName.mockClear()
  updateSettings.mockClear()
})

describe("OrganizationProfileForm", () => {
  it("disables save until a field changes", () => {
    renderForm()
    const save = screen.getByRole("button", {
      name: t.save,
    }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })

  it("saves a changed name through updateOrganizationName", async () => {
    renderForm()
    const nameInput = screen.getByLabelText(t.nameLabel)
    fireEvent.change(nameInput, { target: { value: "Renamed AB" } })
    fireEvent.blur(nameInput)
    const save = screen.getByRole("button", { name: t.save })
    await waitFor(() =>
      expect((save as HTMLButtonElement).disabled).toBe(false)
    )
    fireEvent.click(save)
    await waitFor(() =>
      expect(updateName).toHaveBeenCalledWith({
        orgId: "o1",
        name: "Renamed AB",
      })
    )
    // Name-only change must not fire a settings write.
    expect(updateSettings).not.toHaveBeenCalled()
  })
})
