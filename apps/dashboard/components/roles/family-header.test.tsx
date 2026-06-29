import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }))
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      families: {
        renameRoleFamily: "assessment.families.renameRoleFamily",
        removeRoleFamily: "assessment.families.removeRoleFamily",
      },
    },
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { FamilyHeader } from "@/components/roles/family-header"

const family = messages.dashboard.roles.family

describe("FamilyHeader", () => {
  afterEach(() => cleanup())

  it("renders the family name as the current page and the actions trigger", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FamilyHeader
          orgId="org-1"
          familyId="fam-1"
          name="Tech"
          roleTitles={["Senior Engineer"]}
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Tech")).toBeDefined()
    expect(
      screen.getByRole("link", { name: messages.dashboard.nav.roles })
    ).toBeDefined()
    expect(
      screen.getByRole("button", { name: family.actionsMenu })
    ).toBeDefined()
  })
})
