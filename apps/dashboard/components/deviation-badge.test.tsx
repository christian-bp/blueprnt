import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { DeviationBadge } from "@/components/deviation-badge"

describe("DeviationBadge", () => {
  afterEach(() => cleanup())

  it("shows the flag for the agreed level with an accessible label, self-contained", () => {
    // No external TooltipProvider in the tree: the component provides its own.
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DeviationBadge agreedLevel={2} />
      </NextIntlClientProvider>
    )
    expect(
      screen.getByText(
        messages.dashboard.levels.deviation.replace("{level}", "2")
      )
    ).toBeDefined()
    // The full explanation (also the tooltip text) is the accessible label.
    expect(
      screen.getByLabelText(
        messages.dashboard.levels.deviationLabel.replace("{level}", "2")
      )
    ).toBeDefined()
  })
})
