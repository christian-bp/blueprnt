import { describe, expect, it } from "vitest"
import { classifyColumn } from "./shape"

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
    {
      label: "comma-decimal salary column is money (SC-20, M14)",
      values: ["45 000,00", "52 000,50", "41 300,00"],
      shape: "money",
    },
    {
      label: "dot-thousands salary column is money (M10)",
      values: ["52.000", "48.500", "61.000"],
      shape: "money",
    },
    {
      label: "run-on kr suffix column is money (M41)",
      values: ["52000kr", "48000kr"],
      shape: "money",
    },
    {
      label: "decimal-percent column is percent (pp-14)",
      values: ["87.5", "62.5", "100"],
      shape: "percent",
    },
    {
      label: "space-before-% column is percent (pp-13)",
      values: ["80 %", "100 %", "75 %"],
      shape: "percent",
    },
    {
      label: "comma-decimal percent column is percent (pp-16 non-fraction)",
      values: ["87,5", "62,5", "100,00"],
      shape: "percent",
    },
    {
      label: "DD.MM.YYYY column is date (date-10)",
      values: ["15.01.2023", "03.11.2022", "28.02.2021"],
      shape: "date",
    },
    {
      label: "DD/MM/YYYY column is date (date-09)",
      values: ["15/01/2023", "03/11/2022", "28/02/2021"],
      shape: "date",
    },
    {
      label: "datetime column is date (date-13)",
      values: ["2023-01-15 00:00:00", "2022-11-03 00:00:00"],
      shape: "date",
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

  it("flags a fraction FTE column with fraction: true (pp-15)", () => {
    const result = classifyColumn(["1.0", "0.8", "0.5", "0.75"])
    expect(result.shape).toBe("percent")
    expect(result.fraction).toBe(true)
  })

  it("flags a comma-decimal fraction column with fraction: true (pp-16)", () => {
    const result = classifyColumn(["1,0", "0,8", "0,5"])
    expect(result.shape).toBe("percent")
    expect(result.fraction).toBe(true)
  })

  it("does not flag a normal percent column as fraction (pp-14)", () => {
    const result = classifyColumn(["87.5", "62.5", "100"])
    expect(result.shape).toBe("percent")
    expect(result.fraction).toBeUndefined()
  })

  it("classifies a compact YYYYMMDD column as date only when header-gated (date-08)", () => {
    const values = ["20230115", "20221103", "20210228"]
    expect(classifyColumn(values, { headerGated: true }).shape).toBe("date")
    // Without the gate a bare 8-digit column is an id.
    expect(classifyColumn(values).shape).toBe("id")
  })

  it("classifies an Excel-serial column as date only when header-gated (date-19)", () => {
    const values = ["44927", "44562", "45000"]
    expect(classifyColumn(values, { headerGated: true }).shape).toBe("date")
    expect(classifyColumn(values).shape).toBe("id")
  })

  // LOCK (SC-05, SC-02): the widened parseMoney now strips space grouping, so
  // parseMoney("114 55") succeeds. The postal-code / small-grouped-id guard
  // carried forward into isMoney (Step 3) must keep these classified as `id`,
  // NOT money, because a 3+2 space group is not a true thousands pattern. This
  // is a lock, not an intended delta: if either flips to "money", the guard was
  // dropped.
  it("keeps Swedish 3+2 postal codes as id after the widening (SC-05 LOCK)", () => {
    expect(classifyColumn(["114 55", "752 28", "211 20"]).shape).toBe("id")
  })

  it("keeps space-grouped employee numbers as id after the widening (SC-02 LOCK)", () => {
    expect(classifyColumn(["114 77", "114 55", "312 90"]).shape).toBe("id")
  })

  it("still classifies a true thousands-grouped salary column as money (M05-M07 LOCK)", () => {
    expect(classifyColumn(["52 000", "61 000", "1 234 567"]).shape).toBe(
      "money"
    )
  })

  it("still classifies a currency-suffixed single group as money (SC-24 LOCK)", () => {
    expect(classifyColumn(["9 500 kr", "8 200 kr"]).shape).toBe("money")
  })
})
