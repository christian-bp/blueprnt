import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
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
vi.mock("@/components/currency-select", () => ({
  CurrencySelect: () => null,
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
})
