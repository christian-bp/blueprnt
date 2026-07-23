import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { PayGapFlagBadge } from "./pay-gap-flag-badge"

function renderBadge(flag: "critical" | "elevated" | "ok" | "insufficient") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PayGapFlagBadge flag={flag} />
    </NextIntlClientProvider>
  )
}

describe("PayGapFlagBadge", () => {
  it("renders the localized label for each flag", () => {
    renderBadge("critical")
    expect(screen.getByText("Over 10%")).toBeDefined()
  })

  it("carries a data-flag attribute for the severity", () => {
    const { container } = renderBadge("insufficient")
    expect(container.querySelector('[data-flag="insufficient"]')).not.toBeNull()
    expect(screen.getByText("Not enough data")).toBeDefined()
  })

  it("renders the elevated and ok flags", () => {
    renderBadge("elevated")
    expect(screen.getByText("5-10%")).toBeDefined()
  })
})
