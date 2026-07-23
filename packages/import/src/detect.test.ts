// Tests for detectColumns: column auto-detection via header synonyms + shape heuristics.
import { describe, expect, it } from "vitest"
import { detectColumns } from "./detect"

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

describe("detectColumns — Plan A restrictions and Nordic mappings", () => {
  it("maps a full Norwegian file after the fold fix (DC-13)", () => {
    const headers = ["Ansattnr", "Kjønn", "Grunnlønn", "Stilling"]
    const rows = [
      ["10042", "Mann", "52 000", "Utvikler"],
      ["10043", "Kvinne", "61 000", "Leder"],
    ]
    const result = detectColumns({ headers, rows })
    expect(result.map.externalRef?.columnIndex).toBe(0)
    expect(result.map.gender?.columnIndex).toBe(1)
    expect(result.map.basicMonthly?.columnIndex).toBe(2)
    expect(result.map.title?.columnIndex).toBe(3)
  })

  it("maps a Finnish file without the lon landmine (DC-15, DC-25)", () => {
    const headers = ["Henkilönro", "Peruspalkka", "Tehtävänimike"]
    const rows = [
      ["114 77", "3200", "Insinööri"],
      ["225 88", "3600", "Päällikkö"],
    ]
    const result = detectColumns({ headers, rows })
    expect(result.map.externalRef?.columnIndex).toBe(0)
    expect(result.map.basicMonthly?.columnIndex).toBe(1)
    expect(result.map.title?.columnIndex).toBe(2)
  })

  it("routes unknown text/id/percent columns to unmappedColumns, not shape-only fields (DC-09)", () => {
    const headers = ["Anstnr", "Kostnadskonto", "Hemort", "Lönenivå"]
    const rows = [
      ["10042", "7010", "Stockholm", "3"],
      ["10043", "7020", "Göteborg", "5"],
    ]
    const result = detectColumns({ headers, rows })
    // Only externalRef (Anstnr header) is mapped; the rest are unmapped.
    expect(result.map.externalRef?.columnIndex).toBe(0)
    expect(result.unmappedColumns).toContain(1) // Kostnadskonto (id) not shape-only assigned
    expect(result.unmappedColumns).toContain(2) // Hemort (text) not shape-only assigned
    expect(result.unmappedColumns).toContain(3) // Lönenivå (id) not shape-only assigned
  })

  it("sends a runner-up salary synonym to unmappedColumns instead of stealing it (DC-10)", () => {
    const headers = ["Lön", "Grundlön"]
    const rows = [
      ["52 000", "48 000"],
      ["61 000", "55 000"],
    ]
    const result = detectColumns({ headers, rows })
    // Lön wins basicMonthly; Grundlön (a header-candidate loser) is not stolen into variable.
    expect(result.map.basicMonthly?.columnIndex).toBe(0)
    expect(result.map.variable).toBeUndefined()
    expect(result.unmappedColumns).toContain(1)
  })

  it("routes a blank-header column straight to unmappedColumns (DC-22)", () => {
    const headers = ["Anstnr", "", "Månadslön"]
    const rows = [
      ["10042", "Anna", "52 000"],
      ["10043", "Erik", "61 000"],
    ]
    const result = detectColumns({ headers, rows })
    // The blank-header column (index 1) never earns firstName via shape-only.
    expect(result.map.firstName).toBeUndefined()
    expect(result.unmappedColumns).toContain(1)
  })

  it("still assigns a distinctive gender shape by shape-only when no header matches (DC-12 counter-lock)", () => {
    const headers = ["Anstnr", "Ukjentkolonne"]
    const rows = [
      ["10042", "Mann"],
      ["10043", "Kvinne"],
    ]
    const result = detectColumns({ headers, rows })
    expect(result.map.gender?.columnIndex).toBe(1)
  })
})

describe("detectColumns — Norwegian and Danish FTE synonyms (Plan A parity)", () => {
  it("maps Stillingsprosent (nb FTE) to ftePercent, not title via 'stilling' substring (MUST-FIX 1)", () => {
    // "Stillingsprosent" folds to "stillingsprosent" which is an exact synonym for
    // ftePercent. The title field has "stilling" as a synonym (5 chars, qualifies for
    // substring), but exact beats substring, so ftePercent must win.
    const headers = ["Ansattnr", "Grunnlonn", "Stilling", "Stillingsprosent"]
    const rows = [
      ["10042", "52 000", "Utvikler", "100"],
      ["10043", "61 000", "Leder", "80"],
    ]
    const result = detectColumns({ headers, rows })
    expect(result.map.ftePercent?.columnIndex).toBe(3)
    // title maps to the actual "Stilling" column, not the FTE column
    expect(result.map.title?.columnIndex).toBe(2)
  })

  it("maps Beskæftigelsesgrad (da FTE) to ftePercent (MUST-FIX 1)", () => {
    // "Beskæftigelsesgrad" folds to "beskaeftigelsesgrad" (æ -> ae, o-slash handled).
    // It is an exact synonym for ftePercent.
    const headers = ["Ansattnr", "Grunnlonn", "Beskæftigelsesgrad"]
    const rows = [
      ["10042", "52 000", "100"],
      ["10043", "61 000", "80"],
    ]
    const result = detectColumns({ headers, rows })
    expect(result.map.ftePercent?.columnIndex).toBe(2)
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

describe("detectColumns content-only mode (headerless files)", () => {
  // Column layout: id, name, gender, title, dept, birth, start, fte, salary.
  const ROWS = [
    [
      "1001",
      "Anna Svensson",
      "Kvinna",
      "Utvecklare",
      "IT",
      "1985-04-12",
      "2020-01-15",
      "100",
      "52 000,00",
    ],
    [
      "1002",
      "Erik Johansson",
      "Man",
      "Controller",
      "Ekonomi",
      "1979-11-02",
      "2018-03-01",
      "80",
      "48 500,00",
    ],
    [
      "1003",
      "Maria Karlsson",
      "Kvinna",
      "HR-specialist",
      "HR",
      "1992-06-23",
      "2021-09-01",
      "100",
      "44 000,00",
    ],
  ]
  const HEADERS = (ROWS[0] ?? []).map((_, i) => `column_${i + 1}`)

  function detect(rows: string[][], currentYear = 2026) {
    const headers = (rows[0] ?? []).map((_, i) => `column_${i + 1}`)
    return detectColumns({ headers, rows, headerless: true, currentYear })
  }

  it("CO-01: suggests by shape and disambiguates the two date columns", () => {
    const { map } = detectColumns({
      headers: HEADERS,
      rows: ROWS,
      headerless: true,
      currentYear: 2026,
    })
    expect(map.gender?.columnIndex).toBe(2)
    expect(map.ftePercent?.columnIndex).toBe(7)
    expect(map.basicMonthly?.columnIndex).toBe(8)
    expect(map.externalRef?.columnIndex).toBe(0)
    // Newer-maxed date column is the start date, the older the birth date.
    expect(map.employmentStartDate?.columnIndex).toBe(6)
    expect(map.birthDate?.columnIndex).toBe(5)
    // Text columns (name, title, department) carry no shape signal.
    expect(map.title).toBeUndefined()
    expect(map.department).toBeUndefined()
  })

  it("CO-02: content suggestions carry low confidence", () => {
    const { map } = detect(ROWS)
    expect(map.gender?.confidence).toBe(0.4)
  })

  it("CO-03: a single old-maxed date column is the birth date", () => {
    const { map } = detect(
      [
        ["Anna", "1985-04-12"],
        ["Erik", "1979-11-02"],
      ],
      2026
    )
    expect(map.birthDate?.columnIndex).toBe(1)
    expect(map.employmentStartDate).toBeUndefined()
  })

  it("CO-04: a single recent-maxed date column is the start date", () => {
    const { map } = detect(
      [
        ["Anna", "2020-01-15"],
        ["Erik", "2024-03-01"],
      ],
      2026
    )
    expect(map.employmentStartDate?.columnIndex).toBe(1)
    expect(map.birthDate).toBeUndefined()
  })

  it("CO-05: a single date column stays unmapped without a reference year (no clock read; ADR-0010)", () => {
    const rows = [
      ["Anna", "1985-04-12"],
      ["Erik", "1979-11-02"],
    ]
    const headers = (rows[0] ?? []).map((_, i) => `column_${i + 1}`)
    // No currentYear passed: the engine must not read the clock, so the
    // birth-vs-start heuristic stays off and the date column is left unmapped.
    const { map } = detectColumns({ headers, rows, headerless: true })
    expect(map.birthDate).toBeUndefined()
    expect(map.employmentStartDate).toBeUndefined()
  })

  it("CO-05: an all-year id column is the pay year, not the employee number", () => {
    const { map } = detect([
      ["Anna", "2024"],
      ["Erik", "2024"],
    ])
    expect(map.payYear?.columnIndex).toBe(1)
    expect(map.externalRef).toBeUndefined()
  })

  it("CO-06: several money columns stay unmapped (basic vs variable vs benefits)", () => {
    const { map, unmappedColumns } = detect([
      ["Anna", "52 000,00", "5 000,00"],
      ["Erik", "48 500,00", "3 000,00"],
    ])
    expect(map.basicMonthly).toBeUndefined()
    expect(unmappedColumns).toContain(1)
    expect(unmappedColumns).toContain(2)
  })

  it("CO-07: several id columns stay unmapped (nothing tells them apart)", () => {
    const { map } = detect([
      ["1001", "12345"],
      ["1002", "23456"],
    ])
    expect(map.externalRef).toBeUndefined()
    expect(map.payYear).toBeUndefined()
  })
})

describe("detectColumns — new component-kind and employment-type synonyms", () => {
  it("detects new component and employment-type columns", () => {
    const { map } = detectColumns({
      headers: ["Bonus", "Anställningsform", "Aktier"],
      rows: [["10000", "Tillsvidare", "5000"]],
      headerless: false,
      currentYear: 2026,
    })
    expect(map.bonus?.columnIndex).toBe(0)
    expect(map.employmentType?.columnIndex).toBe(1)
    expect(map.equity?.columnIndex).toBe(2)
  })
})

describe("detectColumns content-only ambiguity guards (CO-AMB)", () => {
  it("CO-AMB-01: two gender-shaped columns stay unmapped", () => {
    const rows = [
      ["Anna", "Kvinna", "Kvinna"],
      ["Erik", "Man", "Man"],
    ]
    const { map } = detectColumns({
      headers: ["column_1", "column_2", "column_3"],
      rows,
      headerless: true,
      currentYear: 2026,
    })
    expect(map.gender).toBeUndefined()
  })

  it("CO-AMB-02: two date columns with the same newest year stay unmapped", () => {
    const rows = [
      ["2020-01-15", "2020-06-01"],
      ["2019-03-01", "2018-02-01"],
    ]
    const { map } = detectColumns({
      headers: ["column_1", "column_2"],
      rows,
      headerless: true,
      currentYear: 2026,
    })
    expect(map.employmentStartDate).toBeUndefined()
    expect(map.birthDate).toBeUndefined()
  })
})
