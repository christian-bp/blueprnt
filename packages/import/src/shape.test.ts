import { describe, expect, it } from "vitest"
import { classifyColumn } from "./shape.js"

describe("classifyColumn money vs postal-code / grouped-number (Plan A)", () => {
  it("classifies Swedish 3+2 postal codes as id, not money (SC-05)", () => {
    const result = classifyColumn(["114 55", "752 28", "211 20"])
    expect(result.shape).toBe("id")
  })

  it("classifies space-grouped employee numbers as id, not money (SC-02)", () => {
    const result = classifyColumn(["114 77", "225 88", "312 90"])
    expect(result.shape).toBe("id")
  })

  it("keeps a true thousands-grouped salary column as money (M05-M07 lock)", () => {
    const result = classifyColumn(["52 000", "61 000", "1 234 567"])
    expect(result.shape).toBe("money")
  })

  it("keeps a currency-suffixed single group as money (SC-24 lock)", () => {
    const result = classifyColumn(["9 500 kr", "8 200 kr"])
    expect(result.shape).toBe("money")
  })
})

describe("classifyColumn Nordic gender / boolean / personnummer (Plan A)", () => {
  it("classifies a Norwegian Mann/Kvinne column as gender (GEN-08)", () => {
    expect(classifyColumn(["Mann", "Kvinne", "Mann"]).shape).toBe("gender")
  })

  it("classifies a Danish Mand/Kvinde column as gender (GEN-08)", () => {
    expect(classifyColumn(["Mand", "Kvinde", "Mand"]).shape).toBe("gender")
  })

  it("classifies a Finnish Mies/Nainen column as gender (GEN-08)", () => {
    expect(classifyColumn(["Mies", "Nainen", "Mies"]).shape).toBe("gender")
  })

  it("classifies an M/F column as gender (GEN-10, GEN-18)", () => {
    expect(classifyColumn(["M", "F", "M", "F"]).shape).toBe("gender")
    expect(classifyColumn(["F", "F", "F", "F"]).shape).toBe("gender")
  })

  it("classifies a Norwegian Ja/Nei column as boolean at full confidence (bool-04)", () => {
    const result = classifyColumn(["Ja", "Nei", "Ja", "Nei"])
    expect(result.shape).toBe("boolean")
    expect(result.confidence).toBe(1)
  })

  it("classifies a Finnish Kyllä/Ei column as boolean (bool-05)", () => {
    expect(classifyColumn(["Kyllä", "Ei", "Kyllä"]).shape).toBe("boolean")
  })

  it("classifies a full personnummer column as id (id-03)", () => {
    expect(classifyColumn(["19850612-1234", "19901130-5678"]).shape).toBe("id")
  })

  it("classifies a short personnummer column as id (id-04)", () => {
    expect(classifyColumn(["850612-1234", "901130-5678"]).shape).toBe("id")
  })
})

describe("classifyColumn fill-rate signal (SC-09)", () => {
  it("reports fillRate and sampleSize alongside confidence for a sparse column", () => {
    const values = ["", "", "", "", "", "", "", "", "52 000", "61 000"]
    const result = classifyColumn(values)
    expect(result.shape).toBe("money")
    expect(result.confidence).toBe(1) // match ratio among the 2 non-blank cells
    expect(result.sampleSize).toBe(2)
    expect(result.fillRate).toBeCloseTo(0.2, 5)
  })

  it("reports fillRate 1 and full sampleSize for a dense column", () => {
    const result = classifyColumn(["Man", "Kvinna", "Man"])
    expect(result.sampleSize).toBe(3)
    expect(result.fillRate).toBe(1)
  })

  it("reports fillRate 0 and sampleSize 0 for an all-blank column", () => {
    const result = classifyColumn(["", "  ", ""])
    expect(result.shape).toBe("text")
    expect(result.confidence).toBe(0)
    expect(result.fillRate).toBe(0)
    expect(result.sampleSize).toBe(0)
  })
})

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
