import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import {
  type BreakdownCriterion,
  RoleCriterionBreakdown,
} from "@/components/roles/role-criterion-breakdown"

// contributions: Scope 15, Complexity 20, People 2 -> total 37
const CRITERIA: BreakdownCriterion[] = [
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
]

function renderBreakdown(criteria: BreakdownCriterion[] = CRITERIA) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleCriterionBreakdown criteria={criteria} />
    </NextIntlClientProvider>
  )
}

describe("RoleCriterionBreakdown", () => {
  afterEach(() => cleanup())

  it("sorts criteria by contribution, biggest driver first", () => {
    renderBreakdown()
    const names = screen
      .getAllByText(/^(Scope|Complexity|People)$/)
      .map((el) => el.textContent)
    expect(names).toEqual(["Complexity", "Scope", "People"])
  })

  it("shows the true contribution share per criterion (total 37)", () => {
    renderBreakdown()
    expect(screen.getByText("54%")).toBeTruthy()
    expect(screen.getByText("41%")).toBeTruthy()
    expect(screen.getByText("5%")).toBeTruthy()
  })

  it("gives a single criterion a 100% share", () => {
    renderBreakdown([CRITERIA[0] as BreakdownCriterion])
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("shows 0% for every criterion when all ratings are 0", () => {
    renderBreakdown(CRITERIA.map((c) => ({ ...c, value: 0 })))
    expect(screen.getAllByText("0%")).toHaveLength(3)
  })

  it("renders a criterion's motivation when present", () => {
    renderBreakdown([
      {
        ...(CRITERIA[0] as BreakdownCriterion),
        motivation: "Owns the whole platform.",
      },
    ])
    expect(screen.getByText("Owns the whole platform.")).toBeTruthy()
  })
})
