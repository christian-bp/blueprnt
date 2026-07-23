import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { ContinueReviewItem } from "@/components/pay-mapping/continue-review-item"

const t = messages.dashboard.payMapping.review

function renderItem(remaining: number, href = "/pay-mappings/pay-2026/review") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContinueReviewItem href={href} remaining={remaining} />
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("ContinueReviewItem", () => {
  it("carries the full remaining-steps sentence as its accessible name (plural)", () => {
    renderItem(5)
    expect(
      screen.getByRole("link", {
        name: "5 steps remain in the guided review.",
      })
    ).toBeDefined()
  })

  it("carries the singular sentence when exactly one step remains", () => {
    renderItem(1)
    expect(
      screen.getByRole("link", {
        name: "1 step remains in the guided review.",
      })
    ).toBeDefined()
  })

  it("shows the visible label and the bare count, not the full sentence, in the item's own text", () => {
    renderItem(5)
    const link = screen.getByRole("link", {
      name: "5 steps remain in the guided review.",
    })
    expect(link.textContent).toContain(t.continueWizard)
    expect(link.textContent).toContain("5")
    expect(link.textContent).not.toContain("remain in the guided review")
  })

  it("links to the given href", () => {
    renderItem(3, "/pay-mappings/pay-2026/review")
    const link = screen.getByRole("link", {
      name: "3 steps remain in the guided review.",
    })
    expect(link.getAttribute("href")).toBe("/pay-mappings/pay-2026/review")
  })
})
