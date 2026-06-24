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

const { updateOrgMock } = vi.hoisted(() => ({ updateOrgMock: vi.fn() }))

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "platform.admin.updateOrganization") return updateOrgMock
    return vi.fn()
  },
  useQuery: () => [],
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    platform: {
      admin: {
        listOrganizationMembers: "platform.admin.listOrganizationMembers",
        setMembershipRole: "platform.admin.setMembershipRole",
        removeMembership: "platform.admin.removeMembership",
        updateOrganization: "platform.admin.updateOrganization",
      },
    },
  },
}))

// Stub the select-based sub-components so the test does not depend on their
// internal rendering.
vi.mock("@/components/country-select", () => ({
  CountrySelect: () => null,
}))
// Interactive stub so a test can change a setting (making the form dirty).
vi.mock("@/components/currency-select", () => ({
  CurrencySelect: ({
    onValueChange,
    "aria-label": ariaLabel,
  }: {
    onValueChange: (value: string) => void
    "aria-label"?: string
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onValueChange("USD")}
    >
      currency
    </button>
  ),
}))
vi.mock("@/components/industry-select", () => ({
  IndustrySelect: () => null,
}))

import { ManageOrganizationDialog } from "@/components/admin/manage-organization-dialog"

const org = {
  orgId: "org-1",
  name: "Acme Corp",
  slug: "acme-corp",
  country: null,
  currency: null,
  language: null,
  industry: null,
}

const manageLabels = messages.dashboard.admin.orgs.manage

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ManageOrganizationDialog org={org} open={true} onOpenChange={() => {}} />
    </NextIntlClientProvider>
  )
}

describe("ManageOrganizationDialog", () => {
  beforeEach(() => {
    updateOrgMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("renders the members heading", () => {
    renderDialog()
    expect(screen.getByText(manageLabels.membersHeading)).toBeDefined()
  })

  it("does not render an add-member control", () => {
    renderDialog()
    expect(screen.queryByText(manageLabels.addMemberHeading)).toBeNull()
  })

  it("renders the settings heading", () => {
    renderDialog()
    expect(screen.getByText(manageLabels.settingsHeading)).toBeDefined()
  })

  it("keeps Save disabled until a setting is changed", () => {
    renderDialog()
    const save = screen.getByRole("button", {
      name: manageLabels.saveSettings,
    }) as HTMLButtonElement
    // Pristine (valid but unchanged) stays disabled: no no-op save.
    expect(save.disabled).toBe(true)
  })

  it("saves the settings through updateOrganization on submit", async () => {
    updateOrgMock.mockResolvedValue(undefined)
    renderDialog()
    // Change a setting so the form is dirty (Save is gated on a change).
    fireEvent.click(
      screen.getByRole("button", { name: manageLabels.currencyLabel })
    )
    // Click the actual Save button (in the footer, outside the <form>) so the
    // form="org-settings-form" association is what is exercised, not a direct
    // form submit.
    const save = screen.getByRole("button", {
      name: manageLabels.saveSettings,
    }) as HTMLButtonElement
    await waitFor(() => {
      expect(save.disabled).toBe(false)
    })
    fireEvent.click(save)
    await waitFor(() => {
      expect(updateOrgMock).toHaveBeenCalledWith({
        orgId: "org-1",
        country: "",
        currency: "USD",
        language: "",
        industry: "",
      })
    })
  })
})
