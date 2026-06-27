import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { name: "Karl Stolt", email: "karl@blueprnt.se" } },
    }),
    signOut: vi.fn(),
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/org-switch-menu", () => ({
  OrgSwitchMenuSub: () => null,
}))
vi.mock("@/components/language-menu", () => ({ LanguageMenuSub: () => null }))

import { AccountMenu } from "@/components/account-menu"

afterEach(() => cleanup())

describe("AccountMenu", () => {
  it("renders the account trigger with the user's initials", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AccountMenu />
      </NextIntlClientProvider>
    )
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.accountMenu,
      })
    ).toBeDefined()
    expect(screen.getByText("KS")).toBeDefined()
  })
})
