import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const useQueryMock = vi.fn()

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: { assessment: { results: { getRoleResult: "results.getRoleResult" } } },
}))

import { RatingResult } from "@/components/rating/rating-result"

const labels = messages.dashboard.rating.result

// A fully complete result. The score is the normalized 0-100 integer
// (ADR-0004).
const COMPLETE_RESULT = {
  roleId: "role-1",
  title: "Senior Engineer",
  complete: true,
  ratedCount: 2,
  totalCriteria: 2,
  score: 74,
  band: 2,
  criteria: [
    {
      criterionId: "c-scope",
      name: "Scope",
      weightPoints: 4,
      value: 4,
      motivation: null,
    },
    {
      criterionId: "c-risk",
      name: "Risk",
      weightPoints: 2,
      value: 3,
      motivation: "Moderate risk exposure",
    },
  ],
}

function renderResult(orgId = "org-1", roleId = "role-1") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RatingResult orgId={orgId} roleId={roleId} />
    </NextIntlClientProvider>
  )
}

describe("RatingResult", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("shows a spinner while the result is still loading (undefined)", () => {
    useQueryMock.mockReturnValue(undefined)
    renderResult()
    expect(screen.getByLabelText(labels.computing)).toBeDefined()
  })

  it("shows a spinner when the result exists but is not yet complete", () => {
    useQueryMock.mockReturnValue({ ...COMPLETE_RESULT, complete: false })
    renderResult()
    expect(screen.getByLabelText(labels.computing)).toBeDefined()
  })

  it("shows the score, band badge, and bandHighest note when complete", () => {
    useQueryMock.mockReturnValue(COMPLETE_RESULT)
    renderResult()

    // Score (with its fixed 0-100 scale) and band visible.
    expect(
      screen.getByText(labels.scoreOutOf.replace("{score}", "74"))
    ).toBeDefined()
    expect(screen.getByText("2")).toBeDefined()

    // Band-1-is-highest explanation.
    expect(screen.getByText(labels.bandHighest)).toBeDefined()
  })

  it("renders the back-to-role link with the correct href", () => {
    useQueryMock.mockReturnValue(COMPLETE_RESULT)
    renderResult("org-1", "role-abc")
    const link = screen.getByRole("link", { name: labels.backToRole })
    expect(link.getAttribute("href")).toBe("/roles/role-abc")
  })
})
