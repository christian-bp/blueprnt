import { describe, expect, it } from "vitest"
import { weightMotivationTarget } from "@/lib/weighting"

// The engine clears dimensionWeightBalance as soon as ANY criterion in the
// dominant dimension carries a weightMotivation, so answering a warning about
// the DIMENSION means choosing one of its criteria to carry the text. This is
// that choice, and it has to be deterministic: the same click must always write
// to the same criterion, or a reader who reopens the dialog finds their own
// motivation missing and writes a second one.
describe("weightMotivationTarget", () => {
  const criterion = (weightPoints: number, order: number) => ({
    weightPoints,
    order,
  })

  it("picks the heaviest criterion in the dimension", () => {
    expect(
      weightMotivationTarget([
        criterion(2, 1),
        criterion(5, 2),
        criterion(3, 3),
      ])
    ).toEqual(criterion(5, 2))
  })

  // Display order, so the pick matches the column the reader is looking at and
  // never depends on how the query happened to return the rows.
  it("breaks a tie on display order, not query order", () => {
    expect(
      weightMotivationTarget([
        criterion(4, 3),
        criterion(4, 1),
        criterion(4, 2),
      ])
    ).toEqual(criterion(4, 1))
  })

  it("has no target in an empty dimension", () => {
    expect(weightMotivationTarget([])).toBeUndefined()
  })
})
