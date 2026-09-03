import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { FULL_TIME_HOURS_MAX } from "@workspace/constants"
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
const tHelp = en.dashboard.help

function renderForm(
  initial: {
    country: string
    currency: string
    language: string
    industry: string
    fullTimeHoursPerMonth: number
  } = {
    country: "se",
    currency: "SEK",
    language: "sv",
    industry: "tech",
    fullTimeHoursPerMonth: 165,
  }
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
    // The full-time hours field always carries a real number now, so a
    // click-driven implicit submit hits happy-dom's step-mismatch tolerance
    // bug on its step="0.01" input (see the full-time hours tests below):
    // submit the form directly instead.
    fireEvent.submit(nameInput.closest("form") as HTMLFormElement)
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
    // See the name-save test above: submit the form directly to sidestep
    // happy-dom's step-mismatch bug on the full-time hours input.
    fireEvent.submit(nameInput.closest("form") as HTMLFormElement)
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
    // See the name-save test above: submit the form directly to sidestep
    // happy-dom's step-mismatch bug on the full-time hours input.
    fireEvent.submit(nameInput.closest("form") as HTMLFormElement)
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledOnce())
    expect(toastSuccess).toHaveBeenCalledWith(en.dashboard.toast.orgSaved)
  })

  it("shows the country-seeded full-time hours value and a help button", () => {
    renderForm()
    const input = screen.getByLabelText(t.fullTimeHoursLabel)
    expect(input).toHaveProperty("value", "165")
    expect(
      screen.getByRole("button", { name: tHelp.fullTimeHoursLabel })
    ).toBeDefined()
  })

  it("changing the country to Norway sets the full-time hours field to the Norwegian default", async () => {
    renderForm()
    await pickSelectOption(
      screen.getByRole("combobox", { name: t.countryLabel }),
      /Norway|Norge/
    )
    const input = screen.getByLabelText(t.fullTimeHoursLabel)
    await waitFor(() => expect(input).toHaveProperty("value", "162.5"))
  })

  it("editing the full-time hours value enables save and sends it", async () => {
    renderForm()
    const input = screen.getByLabelText(t.fullTimeHoursLabel)
    fireEvent.change(input, { target: { value: "160" } })
    fireEvent.blur(input)
    const save = screen.getByRole("button", { name: t.save })
    await waitFor(() =>
      expect((save as HTMLButtonElement).disabled).toBe(false)
    )
    // Submitted via the form, not a click on the button: happy-dom's native
    // step-mismatch check on a step="0.01" number input has a floating-point
    // tolerance bug that blocks a click-driven implicit submission even for
    // a value real browsers accept. Dispatching the submit event directly
    // exercises the same form.handleSubmit(onSubmit) path without going
    // through that check (see edit-person-dialog.test.tsx for the same fix).
    fireEvent.submit(input.closest("form") as HTMLFormElement)
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ fullTimeHoursPerMonth: 160 })
      )
    )
  })

  it("clearing the full-time hours value keeps save disabled", async () => {
    renderForm()
    const input = screen.getByLabelText(t.fullTimeHoursLabel)
    const save = screen.getByRole("button", {
      name: t.save,
    }) as HTMLButtonElement
    fireEvent.change(input, { target: { value: "" } })
    fireEvent.blur(input)
    await waitFor(() => expect(save.disabled).toBe(true))
  })

  it("keeps save disabled for 0 or a value above the max", async () => {
    renderForm()
    const input = screen.getByLabelText(t.fullTimeHoursLabel)
    const save = screen.getByRole("button", {
      name: t.save,
    }) as HTMLButtonElement

    fireEvent.change(input, { target: { value: "0" } })
    fireEvent.blur(input)
    await waitFor(() => expect(save.disabled).toBe(true))

    fireEvent.change(input, { target: { value: "401" } })
    fireEvent.blur(input)
    await waitFor(() => expect(save.disabled).toBe(true))
  })

  it("enables save at exactly the max and disables it just past the max", async () => {
    renderForm()
    const input = screen.getByLabelText(t.fullTimeHoursLabel)
    const save = screen.getByRole("button", {
      name: t.save,
    }) as HTMLButtonElement

    fireEvent.change(input, { target: { value: String(FULL_TIME_HOURS_MAX) } })
    fireEvent.blur(input)
    await waitFor(() => expect(save.disabled).toBe(false))

    fireEvent.change(input, {
      target: { value: String(FULL_TIME_HOURS_MAX + 0.01) },
    })
    fireEvent.blur(input)
    await waitFor(() => expect(save.disabled).toBe(true))
  })
})
