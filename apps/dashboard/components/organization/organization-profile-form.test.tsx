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

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/lib/toast", () => ({
  toast: { success: toastSuccess, error: toastError },
}))

// Typed by their argument shape so tests can read the gesture id back off a
// recorded call.
const updateName = vi.fn(async (_args: { gestureId?: string }) => null)
const updateSettings = vi.fn(async (_args: { gestureId?: string }) => null)

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

import { pickSelectOption } from "@/test/select"
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
  toastSuccess.mockClear()
  toastError.mockClear()
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
        gestureId: expect.any(String),
      })
    )
    // Name-only change must not fire a settings write.
    expect(updateSettings).not.toHaveBeenCalled()
  })

  // One Save can change the name AND the settings, which is two mutations and
  // two audit rows. They share a gesture id so the log reads them as one story
  // instead of as two unrelated edits a second apart.
  it("gives one save's two writes a single gesture id", async () => {
    renderForm()
    const nameInput = screen.getByLabelText(t.nameLabel)
    fireEvent.change(nameInput, { target: { value: "Renamed AB" } })
    fireEvent.blur(nameInput)
    await pickSelectOption(
      screen.getByRole("combobox", { name: t.countryLabel }),
      /Norway|Norge/
    )
    const save = screen.getByRole("button", { name: t.save })
    await waitFor(() =>
      expect((save as HTMLButtonElement).disabled).toBe(false)
    )
    fireEvent.click(save)
    await waitFor(() => expect(updateSettings).toHaveBeenCalled())
    const nameId = updateName.mock.calls[0]?.[0]?.gestureId
    expect(typeof nameId).toBe("string")
    expect(updateSettings.mock.calls[0]?.[0]?.gestureId).toBe(nameId)
  })

  it("fires toast.success(orgSaved) after a successful save", async () => {
    renderForm()
    const nameInput = screen.getByLabelText(t.nameLabel)
    fireEvent.change(nameInput, { target: { value: "Toast AB" } })
    fireEvent.blur(nameInput)
    const save = screen.getByRole("button", { name: t.save })
    await waitFor(() =>
      expect((save as HTMLButtonElement).disabled).toBe(false)
    )
    fireEvent.click(save)
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledOnce())
    expect(toastSuccess).toHaveBeenCalledWith(en.dashboard.toast.orgSaved)
  })
})
