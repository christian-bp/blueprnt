// Tests for detectColumns: column auto-detection via header synonyms + shape heuristics.
import { describe, expect, it } from "vitest"
import { detectColumns } from "./detect.js"

// Real 16-column Swedish payroll export (Sysselssättningsgrad has the known typo).
const SWEDISH_HEADERS =
  "Anstallningsdatum;Fornamn;Efternamn;Chef;Kon;Land;Löneår;Födelsedatum;Befattning;Statistikkod;Månadslön;Tjänstebil;Målbonus;Valuta;Anstnr;Sysselssättningsgrad".split(
    ";"
  )

const SWEDISH_ROWS = [
  "2019-03-01;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Senior Analyst;1231;49 788;0;5 000;SEK;10042;100".split(
    ";"
  ),
  "2021-08-15;Erik;Lindqvist;Ja;Man;Sverige;2024;1990-11-30;Product Manager;1232;65 000;3 500;8 000;SEK;10043;80".split(
    ";"
  ),
]

// Column index lookup for the Swedish header array.
const idx = (name: string) => SWEDISH_HEADERS.indexOf(name)

describe("detectColumns — Swedish 16-column payroll file", () => {
  it("maps externalRef to Anstnr", () => {
    const result = detectColumns({
      headers: SWEDISH_HEADERS,
      rows: SWEDISH_ROWS,
    })
    expect(result.map.externalRef?.columnIndex).toBe(idx("Anstnr"))
  })

  it("maps gender to Kon", () => {
    const result = detectColumns({
      headers: SWEDISH_HEADERS,
      rows: SWEDISH_ROWS,
    })
    expect(result.map.gender?.columnIndex).toBe(idx("Kon"))
  })

  it("maps basicMonthly to Månadslön", () => {
    const result = detectColumns({
      headers: SWEDISH_HEADERS,
      rows: SWEDISH_ROWS,
    })
    expect(result.map.basicMonthly?.columnIndex).toBe(idx("Månadslön"))
  })

  it("maps title to Befattning", () => {
    const result = detectColumns({
      headers: SWEDISH_HEADERS,
      rows: SWEDISH_ROWS,
    })
    expect(result.map.title?.columnIndex).toBe(idx("Befattning"))
  })

  it("maps ftePercent to Sysselssättningsgrad (typo matched via synonym)", () => {
    const result = detectColumns({
      headers: SWEDISH_HEADERS,
      rows: SWEDISH_ROWS,
    })
    expect(result.map.ftePercent?.columnIndex).toBe(idx("Sysselssättningsgrad"))
  })

  it("maps payYear to Löneår", () => {
    const result = detectColumns({
      headers: SWEDISH_HEADERS,
      rows: SWEDISH_ROWS,
    })
    expect(result.map.payYear?.columnIndex).toBe(idx("Löneår"))
  })

  it("maps currency to Valuta", () => {
    const result = detectColumns({
      headers: SWEDISH_HEADERS,
      rows: SWEDISH_ROWS,
    })
    expect(result.map.currency?.columnIndex).toBe(idx("Valuta"))
  })

  it("includes unmapped columns for headers with no match", () => {
    const result = detectColumns({
      headers: SWEDISH_HEADERS,
      rows: SWEDISH_ROWS,
    })
    // Result must have an unmappedColumns array (may be non-empty for unmatched headers).
    expect(Array.isArray(result.unmappedColumns)).toBe(true)
  })
})

describe("detectColumns — English headers", () => {
  const headers = "EmployeeID;Gender;Base Salary;Job Title".split(";")
  const rows = [
    "EMP001;Male;50000 sek;Software Engineer".split(";"),
    "EMP002;Female;60000 sek;Product Manager".split(";"),
  ]

  it("maps externalRef to EmployeeID", () => {
    const result = detectColumns({ headers, rows })
    expect(result.map.externalRef?.columnIndex).toBe(0)
  })

  it("maps gender to Gender", () => {
    const result = detectColumns({ headers, rows })
    expect(result.map.gender?.columnIndex).toBe(1)
  })

  it("maps basicMonthly to Base Salary", () => {
    const result = detectColumns({ headers, rows })
    expect(result.map.basicMonthly?.columnIndex).toBe(2)
  })

  it("maps title to Job Title", () => {
    const result = detectColumns({ headers, rows })
    expect(result.map.title?.columnIndex).toBe(3)
  })
})

describe("detectColumns — shape-only fallback", () => {
  it("maps a Foo-headed column full of Man/Kvinna to gender at low confidence", () => {
    // Only column: header 'Foo' (no synonym match), values are gender strings.
    // gender field has no other candidate, so the shape-only path should claim it.
    const headers = ["Foo"]
    const rows = [["Man"], ["Kvinna"], ["Man"], ["Kvinna"], ["Man"]]
    const result = detectColumns({ headers, rows })
    expect(result.map.gender?.columnIndex).toBe(0)
    // Confidence should be the shape-only level (0.4) — it can be boosted but stays below 1.0.
    expect(result.map.gender?.confidence).toBeLessThan(0.7)
  })
})

describe("detectColumns — unmapped columns", () => {
  it("reports the index of a junk column that has no synonym or shape match", () => {
    // Build a header set that explicitly covers every canonical field (including department
    // via 'Avdelning'), then append a junk column 'Notes' at index 17. With all fields
    // claimed by named headers, the extra column has no field to absorb it and must land
    // in unmappedColumns.
    const headers = [
      ...SWEDISH_HEADERS, // 16 known columns (indices 0-15)
      "Avdelning", // index 16: maps department, leaving no unassigned text field
      "Notes", // index 17: truly junk — no synonym and no unassigned field for shape-only
    ]
    const rows = SWEDISH_ROWS.map((row) => [
      ...row,
      "IT", // Avdelning value
      "some free text", // Notes value
    ])
    const result = detectColumns({ headers, rows })
    // The junk column must appear in unmappedColumns.
    expect(result.unmappedColumns).toContain(17)
    // Core mappings must still be correct.
    expect(result.map.externalRef?.columnIndex).toBe(idx("Anstnr"))
    expect(result.map.gender?.columnIndex).toBe(idx("Kon"))
    expect(result.map.department?.columnIndex).toBe(16)
  })
})
