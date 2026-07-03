import { describe, expect, it } from "vitest"
import { classifyColumn } from "./shape.js"

describe("classifyColumn", () => {
  const cases: Array<{
    label: string
    values: string[]
    shape: string
    confidenceApprox?: number
  }> = [
    {
      label: "money with kr suffix",
      values: ["94 500 kr", "49 788 kr"],
      shape: "money",
    },
    {
      label: "percent integers 0-100",
      values: ["100", "80", "75"],
      shape: "percent",
    },
    {
      label: "year integers outside 0-100 fall through to id",
      values: ["2026", "2026"],
      shape: "id",
    },
    {
      label: "ISO date",
      values: ["1985-01-11"],
      shape: "date",
    },
    {
      label: "gender swedish",
      values: ["Man", "Kvinna", "Man"],
      shape: "gender",
    },
    {
      label: "boolean swedish",
      values: ["Ja", "Nej"],
      shape: "boolean",
    },
    {
      label: "free text",
      values: ["Head of Ops", "Elektronikkonstruktör"],
      shape: "text",
    },
  ]

  for (const { label, values, shape } of cases) {
    it(label, () => {
      const result = classifyColumn(values)
      expect(result.shape).toBe(shape)
      if (shape !== "text") {
        expect(result.confidence).toBeGreaterThan(0.6)
      }
    })
  }

  it("mixed gender column has confidence ~0.67", () => {
    const result = classifyColumn(["Man", "Man", "xyz"])
    expect(result.shape).toBe("gender")
    expect(result.confidence).toBeCloseTo(0.67, 2)
  })
})
