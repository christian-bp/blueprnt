// End-to-end pipeline regression suite: tokenizeCsv -> detectColumns -> validateImport.
// Covers real-world Nordic and international payroll export formats.
// Fixtures are anonymized synthetic data; no real PII.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { detectColumns } from "./detect.js"
import { tokenizeCsv } from "./tokenize.js"
import { validateFile, validateImport } from "./validate.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures")
const read = (name: string) => readFileSync(join(FIXTURES, name), "utf8")

function runCsv(name: string) {
  const text = read(name)
  const tokenized = tokenizeCsv(text)
  const mapping = detectColumns(tokenized)
  const validation = validateImport(tokenized, mapping, {})
  return { tokenized, mapping, validation }
}

const REQUIRED = ["externalRef", "title", "gender", "basicMonthly"] as const

describe("pipeline: visma-sv (LOCK, B1-ok)", () => {
  it("maps the 4 required fields with no blocking", () => {
    const { mapping, validation } = runCsv("visma-sv.csv")
    for (const key of REQUIRED) {
      expect(mapping.map[key]).toBeDefined()
    }
    expect(validation.blocking).toHaveLength(0)
  })
})

describe("pipeline: hogia-sv (B2 comma-decimal Grundlon)", () => {
  it("maps basicMonthly and reports no unparsableMoney", () => {
    const { mapping, validation } = runCsv("hogia-sv.csv")
    expect(mapping.map.basicMonthly).toBeDefined()
    expect(
      validation.issues.filter((i) => i.code === "unparsableMoney")
    ).toHaveLength(0)
  })
})

describe("pipeline: workday-en (B3 bare int, Female, DD.MM.YYYY)", () => {
  it("maps basicMonthly and employmentStartDate, no blocking", () => {
    const { mapping, validation } = runCsv("workday-en.csv")
    expect(mapping.map.basicMonthly).toBeDefined()
    expect(mapping.map.employmentStartDate).toBeDefined()
    expect(mapping.map.gender).toBeDefined()
    expect(validation.blocking).toHaveLength(0)
  })
})

describe("pipeline: personec-no (B4, D3, D4 fraction FTE + fold fix)", () => {
  it("maps birthDate, basicMonthly, gender and flags fractionScaled", () => {
    const { mapping, validation } = runCsv("personec-no.csv")
    expect(mapping.map.birthDate).toBeDefined()
    expect(mapping.map.basicMonthly).toBeDefined()
    expect(mapping.map.gender).toBeDefined()
    const scaled = validation.issues.filter((i) => i.code === "fractionScaled")
    expect(scaled.length).toBeGreaterThanOrEqual(2)
    // No row should be flagged unresolvedGender (Mann/Kvinne resolve).
    expect(
      validation.issues.filter((i) => i.code === "unresolvedGender")
    ).toHaveLength(0)
  })
})

describe("pipeline: sap-successfactors (D7, P6 SAP codes + numeric gender)", () => {
  it("maps externalRef, title, gender, basicMonthly with no blocking", () => {
    const { mapping, validation } = runCsv("sap-successfactors.csv")
    expect(mapping.map.externalRef).toBeDefined()
    expect(mapping.map.title).toBeDefined()
    expect(mapping.map.gender).toBeDefined()
    expect(mapping.map.basicMonthly).toBeDefined()
    expect(validation.blocking).toHaveLength(0)
    // GESCH 1/2 resolve under a gender header -> no unresolvedGender.
    expect(
      validation.issues.filter((i) => i.code === "unresolvedGender")
    ).toHaveLength(0)
  })
})

describe("pipeline: fortnox-sv (regression companion to DC-16)", () => {
  it("maps all required fields with no blocking", () => {
    const { mapping, validation } = runCsv("fortnox-sv.csv")
    for (const key of REQUIRED) {
      expect(mapping.map[key]).toBeDefined()
    }
    expect(validation.blocking).toHaveLength(0)
  })
})

describe("pipeline: binary.xlsx (A1, A4 invalidFileFormat)", () => {
  it("returns invalidFileFormat blocking, not missing-columns", () => {
    const text = read("binary.xlsx")
    const validation = validateFile(text, { map: {}, unmappedColumns: [] }, {})
    expect(validation.fileFormatError).toBe("invalidFileFormat")
    expect(validation.blocking).toContain("invalidFileFormat")
    expect(validation.blocking).not.toContain("basicMonthly")
  })
})
