import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import {
  type BreakdownCriterion,
  RoleCriterionBreakdown,
} from "@/components/roles/role-criterion-breakdown"

const labels = messages.dashboard.rating.result

// contributions: Scope 15, Complexity 20, People 2 -> total 37
const CRITERIA: BreakdownCriterion[] = [
  {
    criterionId: "scope",
    name: "Scope",
    dimensionKey: "responsibility",
    weightPoints: 5,
    value: 3,
    motivation: null,
  },
  {
    criterionId: "complexity",
    name: "Complexity",
    dimensionKey: "effort",
    weightPoints: 4,
    value: 5,
    motivation: null,
  },
  {
    criterionId: "people",
    name: "People",
    dimensionKey: "responsibility",
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

  // A 0 says the role is not covered, so the criterion is not part of the
  // weighting at all (ADR-0025). The row says so instead of printing a 0%
  // that would read as "measured, contributed nothing".
  it("marks an uncovered criterion instead of showing it a 0% share", () => {
    // 0 is only ever a legal rating on a workingConditions criterion; the
    // dimension is overridden here purely so the fixture can express it (a
    // real model never has three, but criterionShares has no opinion on
    // that count, only method validation does).
    renderBreakdown(
      CRITERIA.map((c) => ({
        ...c,
        dimensionKey: "workingConditions",
        value: 0,
      }))
    )
    expect(screen.getAllByText(labels.notCovered)).toHaveLength(3)
    expect(screen.queryByText("0%")).toBeNull()
  })

  it("keeps the percentage on the criteria the role IS measured on", () => {
    renderBreakdown([
      { ...(CRITERIA[0] as BreakdownCriterion) },
      {
        ...(CRITERIA[1] as BreakdownCriterion),
        dimensionKey: "workingConditions",
        value: 0,
      },
    ])
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.getByText(labels.notCovered)).toBeTruthy()
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
