import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

import { CountryDisplay } from "@/components/country-display"

const countries = messages.dashboard.onboarding.profile.countries

function renderDisplay(code: string | null | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CountryDisplay code={code} />
    </NextIntlClientProvider>
  )
}

describe("CountryDisplay", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the flag and name for a known country", () => {
    renderDisplay("se")
    expect(screen.getByText(countries.se)).toBeDefined()
  })

  it("renders the label for the 'other' country", () => {
    renderDisplay("other")
    expect(screen.getByText(countries.other)).toBeDefined()
  })

  it("renders nothing for a null code", () => {
    const { container } = renderDisplay(null)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing for an unknown code", () => {
    const { container } = renderDisplay("xx")
    expect(container.firstChild).toBeNull()
  })
})
