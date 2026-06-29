import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { RoleRatingCard } from "@/components/roles/role-rating-card"

function renderCard(over: {
  ratedCount: number
  totalCriteria: number
  profileComplete?: boolean
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleRatingCard
        slug="r1"
        archived={false}
        profileComplete={over.profileComplete ?? true}
        ratedCount={over.ratedCount}
        totalCriteria={over.totalCriteria}
      />
    </NextIntlClientProvider>
  )
}

describe("RoleRatingCard", () => {
  afterEach(() => cleanup())

  it("shows a binary state, not a rating count", () => {
    renderCard({ ratedCount: 3, totalCriteria: 9 })
    expect(
      screen.getByText(messages.dashboard.roles.notEvaluated)
    ).toBeDefined()
    // The fractional criteria count is intentionally gone.
    expect(screen.queryByText("3 of 9 criteria rated")).toBeNull()
  })

  it("reads as evaluated when every criterion is rated", () => {
    renderCard({ ratedCount: 9, totalCriteria: 9 })
    expect(screen.getByText(messages.dashboard.roles.evaluated)).toBeDefined()
  })

  it("links to the slug-based rate route", () => {
    renderCard({ ratedCount: 0, totalCriteria: 9 })
    expect(screen.getByRole("link").getAttribute("href")).toBe("/roles/r1/rate")
  })
})
