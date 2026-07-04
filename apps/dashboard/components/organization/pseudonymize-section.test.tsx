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

const { toastSuccess } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: toastSuccess },
}))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Test Org", role: "admin" }),
}))

import { mockMutation } from "@/test/convex-mocks"
import { PseudonymizeSection } from "./pseudonymize-section"

const updateSettings = mockMutation(
  "accounts.organization.updateOrganizationSettings"
)

function renderSection(pseudonymizeNames = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PseudonymizeSection pseudonymizeNames={pseudonymizeNames} />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  updateSettings.mockClear()
  toastSuccess.mockClear()
})

describe("PseudonymizeSection", () => {
  it("renders the pseudonymize label", () => {
    renderSection()
    expect(
      screen.getByText(en.dashboard.organization.general.pseudonymizeLabel)
    ).toBeTruthy()
  })

  it("calls updateOrganizationSettings with pseudonymizeNames: true when toggled on", async () => {
    updateSettings.mockResolvedValueOnce(null)
    renderSection(false)
    const toggle = screen.getByRole("switch")
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        orgId: "org-1",
        pseudonymizeNames: true,
      })
    )
  })

  it("fires toast.success(orgSaved) after toggling", async () => {
    updateSettings.mockResolvedValueOnce(null)
    renderSection(false)
    const toggle = screen.getByRole("switch")
    fireEvent.click(toggle)
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledOnce())
    expect(toastSuccess).toHaveBeenCalledWith(en.dashboard.toast.orgSaved)
  })
})
