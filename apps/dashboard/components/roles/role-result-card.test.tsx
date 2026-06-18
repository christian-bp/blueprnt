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

  it("renders criteria sorted by contribution, biggest driver first", () => {
    renderCard()
    const names = screen
      .getAllByText(/^(Scope|Complexity|People)$/)
      .map((el) => el.textContent)
    expect(names).toEqual(["Complexity", "Scope", "People"])
  })

  it("shows the true contribution share per criterion (total 37)", () => {
    renderCard()
    // 20/37 = 54%, 15/37 = 41%, 2/37 = 5%
    expect(screen.getByText("54%")).toBeTruthy()
    expect(screen.getByText("41%")).toBeTruthy()
    expect(screen.getByText("5%")).toBeTruthy()
  })

  it("shows each role's assessed value and drops the model-weight column", () => {
    renderCard()
    expect(screen.getByText("rated 5 / 5")).toBeTruthy()
    expect(screen.queryByText("Weight points")).toBeNull()
  })

  it("renders nothing until the assessment is complete", () => {
    setResult({ ...result, complete: false })
    const { container } = renderCard()
    expect(container.textContent).toBe("")
  })

  it("renders a criterion's motivation when present", () => {
    setResult({
      ...result,
      criteria: [
        {
          criterionId: "scope",
          name: "Scope",
          weightPoints: 5,
          value: 3,
          motivation: "Owns the whole platform.",
        },
      ],
    })
    renderCard()
    expect(screen.getByText("Owns the whole platform.")).toBeTruthy()
  })

  it("gives a single rated criterion a 100% share", () => {
    setResult({
      ...result,
      ratedCount: 1,
      totalCriteria: 1,
      criteria: [
        {
          criterionId: "scope",
          name: "Scope",
          weightPoints: 5,
          value: 3,
          motivation: null,
        },
      ],
    })
    renderCard()
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("shows 0% for every criterion when all ratings are 0", () => {
    setResult({
      ...result,
      criteria: result.criteria.map((c) => ({ ...c, value: 0 })),
    })
    renderCard()
    expect(screen.getAllByText("0%")).toHaveLength(3)
  })
})
