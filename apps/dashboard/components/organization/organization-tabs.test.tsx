import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/organization/general",
}))

import { OrganizationTabs } from "./organization-tabs"

afterEach(() => cleanup())

describe("OrganizationTabs", () => {
  it("renders the general and members tabs", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OrganizationTabs />
      </NextIntlClientProvider>
    )
    expect(
      screen.getByText(messages.dashboard.organization.tabs.general)
    ).toBeDefined()
    expect(
      screen.getByText(messages.dashboard.organization.tabs.members)
    ).toBeDefined()
  })
})
