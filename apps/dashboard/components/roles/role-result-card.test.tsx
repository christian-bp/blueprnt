import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { RoleResultCard } from "@/components/roles/role-result-card"

type Result = {
  roleId: string
  title: string
  complete: boolean
  ratedCount: number
  totalCriteria: number
  score: number | null
  band: number | null
  criteria: {
    criterionId: string
    name: string
    weightPoints: number
    value: number | null
    motivation: string | null
  }[]
}

let result: Result

function setResult(next: Result) {
  result = next
  onQuery((ref) =>
    ref === "assessment.results.getRoleResult" ? result : undefined
  )
}

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleResultCard orgId="org_1" roleId="role_1" />
    </NextIntlClientProvider>
  )
}

describe("RoleResultCard", () => {
  beforeEach(() => {
    setResult({
      roleId: "role_1",
      title: "Engineer",
      complete: true,
      ratedCount: 3,
      totalCriteria: 3,
      score: 71,
      band: 3,
      criteria: [
        // contributions: 15, 20, 2 -> total 37
        {
          criterionId: "scope",
          name: "Scope",
          weightPoints: 5,
          value: 3,
          motivation: null,
        },
        {
          criterionId: "complexity",
          name: "Complexity",
          weightPoints: 4,
          value: 5,
          motivation: null,
        },
        {
          criterionId: "people",
          name: "People",
          weightPoints: 2,
          value: 1,
          motivation: null,
        },
      ],
    })
  })
  afterEach(() => cleanup())

  // The per-criterion breakdown (sort, shares, values, motivation) is owned and
  // tested by RoleCriterionBreakdown; the card test covers the card's own
  // chrome (weighting, band, and the complete-only gate).

  it("shows the weighting and band when complete", () => {
    renderCard()
    expect(screen.getByText("71 / 100")).toBeTruthy()
    expect(screen.getByText("Band 3")).toBeTruthy()
  })

  it("renders the criterion breakdown when complete", () => {
    renderCard()
    expect(screen.getByText("Complexity")).toBeTruthy()
    expect(screen.getByText("54%")).toBeTruthy()
  })

  it("renders nothing until the assessment is complete", () => {
    setResult({ ...result, complete: false })
    const { container } = renderCard()
    expect(container.textContent).toBe("")
  })
})
