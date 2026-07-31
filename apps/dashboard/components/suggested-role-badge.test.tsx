import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { SuggestedRoleBadge } from "@/components/suggested-role-badge"

const people = messages.dashboard.people

describe("SuggestedRoleBadge", () => {
  afterEach(() => cleanup())

  it("shows the short label and carries the explanation for assistive tech", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SuggestedRoleBadge />
      </NextIntlClientProvider>
    )
    expect(screen.getByText(people.suggestedBadge)).toBeDefined()
    // The visible text is a two-word pill, so the reason and where to confirm
    // it live on the aria-label (and the tooltip, which needs a hover).
    expect(screen.getByLabelText(people.suggestedBadgeTooltip)).toBeDefined()
  })
})
