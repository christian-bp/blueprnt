import { describe, expect, it } from "vitest"
import { makeCriterionComplianceSchema } from "@/lib/criterion-compliance-schemas"

const t = ((key: string) => key) as never

describe("makeCriterionComplianceSchema", () => {
  const schema = makeCriterionComplianceSchema(t)

  it("accepts an empty form (partial progress allowed)", () => {
    const result = schema.safeParse({
      purpose: "",
      whyRelevant: "",
      overlapNotes: "",
      biasComment: "",
      biasAction: "",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a valid bias risk and rejects an unknown one", () => {
    expect(
      schema.safeParse({
        purpose: "",
        whyRelevant: "",
        overlapNotes: "",
        biasRisk: "medium",
        biasComment: "",
        biasAction: "",
      }).success
    ).toBe(true)
    expect(
      schema.safeParse({
        purpose: "",
        whyRelevant: "",
        overlapNotes: "",
        biasRisk: "extreme",
        biasComment: "",
        biasAction: "",
      }).success
    ).toBe(false)
  })

  it("rejects text over the max length", () => {
    expect(
      schema.safeParse({
        purpose: "x".repeat(2001),
        whyRelevant: "",
        overlapNotes: "",
        biasComment: "",
        biasAction: "",
      }).success
    ).toBe(false)
  })
})
