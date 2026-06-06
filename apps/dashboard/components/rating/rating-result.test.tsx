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

// A fully complete result with no guardrail violations.
const COMPLETE_RESULT = {
  roleId: "role-1",
  title: "Senior Engineer",
  complete: true,
  ratedCount: 2,
  totalCriteria: 2,
  score: 540,
  band: 2,
  criteria: [
    {
      criterionId: "c-scope",
      name: "Scope",
      importanceLevel: 6,
      value: 4,
      motivation: null,
      guardrail: { min: 2, max: 5 },
      outside: false,
    },
    {
      criterionId: "c-risk",
      name: "Risk",
      importanceLevel: 5,
      value: 3,
      motivation: "Moderate risk exposure",
      guardrail: { min: 1, max: 4 },
      outside: false,
    },
  ],
}

// Same result but with the first criterion outside its guardrail.
const RESULT_WITH_WARNING = {
  ...COMPLETE_RESULT,
  criteria: [
    { ...COMPLETE_RESULT.criteria[0], value: 1, outside: true },
    COMPLETE_RESULT.criteria[1],
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

  it("shows the score, band badge, bandHighest note, and noWarnings when complete with no violations", () => {
    useQueryMock.mockReturnValue(COMPLETE_RESULT)
    renderResult()

    // Score and band visible.
    expect(screen.getByText("540")).toBeDefined()
    expect(screen.getByText("2")).toBeDefined()

    // Band-1-is-highest explanation.
    expect(screen.getByText(labels.bandHighest)).toBeDefined()

    // No warnings message.
    expect(screen.getByText(labels.noWarnings)).toBeDefined()
  })

  it("shows the warning list when some criteria are outside their guardrail", () => {
    useQueryMock.mockReturnValue(RESULT_WITH_WARNING)
    renderResult()

    // The guardrailRow message is formatted as "Scope: 1 is outside 2 to 5".
    const warningText = screen.getByText(
      (content) =>
        content.includes("Scope") &&
        content.includes("1") &&
        content.includes("2") &&
        content.includes("5")
    )
    expect(warningText).toBeDefined()

    // noWarnings text must NOT be present.
    expect(screen.queryByText(labels.noWarnings)).toBeNull()
  })

  it("renders the back-to-role link with the correct href", () => {
    useQueryMock.mockReturnValue(COMPLETE_RESULT)
    renderResult("org-1", "role-abc")
    const link = screen.getByRole("link", { name: labels.backToRole })
    expect(link.getAttribute("href")).toBe("/roles/role-abc")
  })
})
