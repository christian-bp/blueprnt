import { describe, expect, it } from "vitest"
import { checkGuardrails } from "./guardrails"
import type { GuardrailRange, RatingInput } from "./types"

// Lead3 guardrails mirroring the seeded GUARDRAILS in
// packages/backend/convex/evaluationModel/standardTemplate.ts (illustrative
// fixture; the engine is pure and does not depend on the seed).
const LEAD3: GuardrailRange[] = [
  { criterionId: "scope", min: 4, max: 5 },
  { criterionId: "knowledge", min: 3, max: 4 },
  { criterionId: "people", min: 1, max: 1 },
]

describe("checkGuardrails", () => {
  it("warns for ratings outside the advisory range", () => {
    const ratings: RatingInput[] = [
      { criterionId: "scope", value: 3 },
      { criterionId: "knowledge", value: 4 },
      { criterionId: "people", value: 5 },
    ]
    expect(checkGuardrails(ratings, LEAD3)).toEqual([
      { criterionId: "scope", value: 3, min: 4, max: 5 },
      { criterionId: "people", value: 5, min: 1, max: 1 },
    ])
  })

  it("returns no warnings when everything is in range", () => {
    const ratings: RatingInput[] = [
      { criterionId: "scope", value: 4 },
      { criterionId: "knowledge", value: 3 },
      { criterionId: "people", value: 1 },
    ]
    expect(checkGuardrails(ratings, LEAD3)).toEqual([])
  })

  it("skips unrated criteria (advisory, never blocking)", () => {
    expect(checkGuardrails([], LEAD3)).toEqual([])
  })

  it("throws on duplicate ratings", () => {
    const ratings: RatingInput[] = [
      { criterionId: "scope", value: 4 },
      { criterionId: "scope", value: 5 },
    ]
    expect(() => checkGuardrails(ratings, LEAD3)).toThrow(/duplicate/)
  })
})
