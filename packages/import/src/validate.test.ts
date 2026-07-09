// Tests for validateImport: readiness + data-quality validation.
import { describe, expect, it } from "vitest"
import type { DetectedMapping } from "./detect"
import type { CanonicalFieldKey } from "./fields"
import { tokenizeCsv } from "./tokenize"
import { validateFile, validateImport } from "./validate"

// Real-derived 16-column Swedish payroll fixture.
// Headers match the detect.test.ts SWEDISH_HEADERS fixture.
const HEADERS =
  "Anstallningsdatum;Fornamn;Efternamn;Chef;Kon;Land;Löneår;Födelsedatum;Befattning;Statistikkod;Månadslön;Tjänstebil;Målbonus;Valuta;Anstnr;Sysselssättningsgrad".split(
    ";"
  )

// Column index helper.
const col = (name: string) => HEADERS.indexOf(name)

// Full mapping (all detected columns present).
const FULL_MAPPING: DetectedMapping = {
  map: {
    employmentStartDate: {
      columnIndex: col("Anstallningsdatum"),
      confidence: 1.0,
    },
    firstName: { columnIndex: col("Fornamn"), confidence: 1.0 },
    lastName: { columnIndex: col("Efternamn"), confidence: 1.0 },
    isManager: { columnIndex: col("Chef"), confidence: 1.0 },
    gender: { columnIndex: col("Kon"), confidence: 1.0 },
    country: { columnIndex: col("Land"), confidence: 1.0 },
    payYear: { columnIndex: col("Löneår"), confidence: 1.0 },
    birthDate: { columnIndex: col("Födelsedatum"), confidence: 1.0 },
    title: { columnIndex: col("Befattning"), confidence: 1.0 },
    statisticalCode: { columnIndex: col("Statistikkod"), confidence: 1.0 },
    basicMonthly: { columnIndex: col("Månadslön"), confidence: 1.0 },
    benefitInKind: { columnIndex: col("Tjänstebil"), confidence: 1.0 },
    variable: { columnIndex: col("Målbonus"), confidence: 1.0 },
    currency: { columnIndex: col("Valuta"), confidence: 1.0 },
    externalRef: { columnIndex: col("Anstnr"), confidence: 1.0 },
    ftePercent: { columnIndex: col("Sysselssättningsgrad"), confidence: 1.0 },
  },
  unmappedColumns: [],
}

// Data rows (index = row in data array, 0-based).
// Row 0: Anna Svensson — clean
// Row 1: Erik Lindqvist — clean
// Row 2: duplicate Anstnr 114 (same as row 0)
// Row 3: non-numeric Statistikkod
const ROWS: string[][] = [
  // row 0
  "2019-03-01;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Senior Analyst;1231;49788;0;5000;SEK;114;100".split(
    ";"
  ),
  // row 1
  "2021-08-15;Erik;Lindqvist;Ja;Man;Sverige;2024;1990-11-30;Product Manager;1232;65000;3500;8000;SEK;115;80".split(
    ";"
  ),
  // row 2 — duplicate Anstnr 114
  "2022-01-01;Sara;Berg;Nej;Kvinna;Sverige;2024;1988-04-20;Analyst;1231;52000;0;0;SEK;114;100".split(
    ";"
  ),
  // row 3 — non-numeric Statistikkod
  "2020-06-01;Lars;Ek;Nej;Man;Sverige;2024;1982-09-05;Developer;INVALID;58000;0;3000;SEK;116;100".split(
    ";"
  ),
]

describe("validateImport — readiness", () => {
  it("readiness covers all canonical fields", () => {
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {}
    )
    const keys = result.readiness.map((r) => r.key)
    // Must have an entry for every canonical field.
    const requiredKeys: CanonicalFieldKey[] = [
      "externalRef",
      "title",
      "gender",
      "basicMonthly",
      "firstName",
      "lastName",
      "ftePercent",
      "payYear",
      "birthDate",
      "employmentStartDate",
      "statisticalCode",
      "variable",
      "benefitInKind",
      "currency",
      "country",
      "department",
      "isManager",
    ]
    for (const k of requiredKeys) {
      expect(keys).toContain(k)
    }
  })

  it("mapped fields report mapped: true", () => {
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {}
    )
    const entry = result.readiness.find((r) => r.key === "externalRef")
    expect(entry?.mapped).toBe(true)
    expect(entry?.tier).toBe("required")
  })

  it("unmapped fields report mapped: false", () => {
    const mapping: DetectedMapping = {
      map: { ...FULL_MAPPING.map, department: undefined },
      unmappedColumns: [],
    }
    const result = validateImport({ headers: HEADERS, rows: ROWS }, mapping, {})
    const entry = result.readiness.find((r) => r.key === "department")
    expect(entry?.mapped).toBe(false)
    expect(entry?.tier).toBe("optional")
  })
})

describe("validateImport — blocking (required fields missing)", () => {
  it("blocking is empty when all required fields are mapped", () => {
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {}
    )
    expect(result.blocking).toHaveLength(0)
  })

  it("blocking contains basicMonthly when salary mapping is dropped", () => {
    const mapping: DetectedMapping = {
      map: { ...FULL_MAPPING.map, basicMonthly: undefined },
      unmappedColumns: [col("Månadslön")],
    }
    const result = validateImport({ headers: HEADERS, rows: ROWS }, mapping, {})
    expect(result.blocking).toContain("basicMonthly")
  })

  it("blocking contains all unresolved required fields", () => {
    const mapping: DetectedMapping = {
      map: {},
      unmappedColumns: [],
    }
    const result = validateImport({ headers: HEADERS, rows: ROWS }, mapping, {})
    expect(result.blocking).toContain("externalRef")
    expect(result.blocking).toContain("title")
    expect(result.blocking).toContain("gender")
    expect(result.blocking).toContain("basicMonthly")
  })
})

describe("validateImport — warnings (recommended fields missing)", () => {
  it("warnings is empty when all recommended fields are mapped", () => {
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {}
    )
    expect(result.warnings).toHaveLength(0)
  })

  it("warnings contains ftePercent when FTE mapping is dropped", () => {
    const mapping: DetectedMapping = {
      map: { ...FULL_MAPPING.map, ftePercent: undefined },
      unmappedColumns: [col("Sysselssättningsgrad")],
    }
    const result = validateImport({ headers: HEADERS, rows: ROWS }, mapping, {})
    expect(result.warnings).toContain("ftePercent")
  })

  it("warnings does not contain optional fields", () => {
    const mapping: DetectedMapping = {
      map: { ...FULL_MAPPING.map, currency: undefined, variable: undefined },
      unmappedColumns: [],
    }
    const result = validateImport({ headers: HEADERS, rows: ROWS }, mapping, {})
    expect(result.warnings).not.toContain("currency")
    expect(result.warnings).not.toContain("variable")
  })
})

describe("validateImport — issues: duplicateId", () => {
  it("reports duplicateId for rows with the same externalRef value", () => {
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {}
    )
    const dupes = result.issues.filter((i) => i.code === "duplicateId")
    // Both row 0 (first seen) and row 2 (duplicate) should be flagged.
    // At minimum, the second occurrence (row 2) must appear.
    expect(dupes.length).toBeGreaterThanOrEqual(1)
    const dupeRows = dupes.map((i) => i.row)
    expect(dupeRows).toContain(2)
  })

  it("no duplicateId when externalRef is not mapped", () => {
    const mapping: DetectedMapping = {
      map: { ...FULL_MAPPING.map, externalRef: undefined },
      unmappedColumns: [],
    }
    const result = validateImport({ headers: HEADERS, rows: ROWS }, mapping, {})
    expect(result.issues.filter((i) => i.code === "duplicateId")).toHaveLength(
      0
    )
  })
})

describe("validateImport — issues: nonNumericCode", () => {
  it("reports nonNumericCode at row 3 (INVALID Statistikkod)", () => {
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {}
    )
    const bad = result.issues.filter((i) => i.code === "nonNumericCode")
    expect(bad.length).toBeGreaterThanOrEqual(1)
    expect(bad.map((i) => i.row)).toContain(3)
  })

  it("no nonNumericCode when statisticalCode is not mapped", () => {
    const mapping: DetectedMapping = {
      map: { ...FULL_MAPPING.map, statisticalCode: undefined },
      unmappedColumns: [],
    }
    const result = validateImport({ headers: HEADERS, rows: ROWS }, mapping, {})
    expect(
      result.issues.filter((i) => i.code === "nonNumericCode")
    ).toHaveLength(0)
  })
})

describe("validateImport — issues: unparsableMoney", () => {
  it("reports unparsableMoney for a row with a bad salary cell", () => {
    const rows: string[][] = [
      ...ROWS,
      // row 4: bad money value
      "2023-01-01;Test;User;Nej;Man;Sverige;2024;1990-01-01;Analyst;1234;NOT_A_NUMBER;0;0;SEK;117;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    const bad = result.issues.filter((i) => i.code === "unparsableMoney")
    expect(bad.length).toBeGreaterThanOrEqual(1)
    expect(bad.map((i) => i.row)).toContain(4)
  })

  it("no unparsableMoney when basicMonthly is not mapped", () => {
    const mapping: DetectedMapping = {
      map: { ...FULL_MAPPING.map, basicMonthly: undefined },
      unmappedColumns: [],
    }
    const result = validateImport({ headers: HEADERS, rows: ROWS }, mapping, {})
    expect(
      result.issues.filter((i) => i.code === "unparsableMoney")
    ).toHaveLength(0)
  })
})

describe("validateImport — issues: unresolvedGender", () => {
  it("reports unresolvedGender for a row with a blank gender cell", () => {
    const rows: string[][] = [
      ...ROWS,
      // row 4: blank gender
      "2023-01-01;Test;User;Nej;;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    const bad = result.issues.filter((i) => i.code === "unresolvedGender")
    expect(bad.length).toBeGreaterThanOrEqual(1)
    expect(bad.map((i) => i.row)).toContain(4)
  })

  it("reports unresolvedGender for a non-binary token (Annat), never a third value", () => {
    const rows: string[][] = [
      // row 0: gender cell "Annat" -> parseGender null -> flagged, not mapped
      "2023-01-01;Test;User;Nej;Annat;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    const bad = result.issues.filter((i) => i.code === "unresolvedGender")
    expect(bad.map((i) => i.row)).toContain(0)
  })

  it("does not flag a resolvable gender cell (Man)", () => {
    const rows: string[][] = [
      "2023-01-01;Test;User;Nej;Man;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    expect(
      result.issues.filter((i) => i.code === "unresolvedGender")
    ).toHaveLength(0)
  })

  it("does NOT flag numeric SCB/SAP codes 1 and 2 under a mapped gender column (P6, GEN-09)", () => {
    // The mapped gender column is the gender column, so validate passes
    // { allowNumericCodes: true }: 1 -> Man, 2 -> Kvinna resolve and do not flag.
    const rows: string[][] = [
      "2023-01-01;Test;User;Nej;1;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
        ";"
      ),
      "2023-01-01;Test;User;Nej;2;Sverige;2024;1990-01-01;Analyst;1235;55000;0;0;SEK;119;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    expect(
      result.issues.filter((i) => i.code === "unresolvedGender")
    ).toHaveLength(0)
  })

  it("still flags an ambiguous numeric gender code (3) even with numeric codes allowed", () => {
    const rows: string[][] = [
      "2023-01-01;Test;User;Nej;3;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    const bad = result.issues.filter((i) => i.code === "unresolvedGender")
    expect(bad.map((i) => i.row)).toContain(0)
  })

  it("no blankGender code exists anymore", () => {
    const rows: string[][] = [
      "2023-01-01;Test;User;Nej;;Sverige;2024;1990-01-01;Analyst;1234;55000;0;0;SEK;118;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    // blankGender must not appear; unresolvedGender is the renamed code.
    const codes = result.issues.map((i) => i.code as string)
    expect(codes).not.toContain("blankGender")
  })
})

describe("validateImport — issues: genderNameMismatch", () => {
  it("reports genderNameMismatch when firstName conflicts with gender (via opts.knownNames)", () => {
    const rows: string[][] = [
      // row 0: firstName 'Anna' but gender 'Man' — mismatch if Anna is a known female name
      "2019-03-01;Anna;Svensson;Nej;Man;Sverige;2024;1985-06-12;Senior Analyst;1231;49788;0;5000;SEK;119;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {
      knownNames: { Anna: "Kvinna" },
    })
    const mismatches = result.issues.filter(
      (i) => i.code === "genderNameMismatch"
    )
    expect(mismatches.length).toBeGreaterThanOrEqual(1)
    expect(mismatches[0]?.row).toBe(0)
  })

  it("does not report genderNameMismatch when opts.knownNames is absent", () => {
    const rows: string[][] = [
      "2019-03-01;Anna;Svensson;Nej;Man;Sverige;2024;1985-06-12;Senior Analyst;1231;49788;0;5000;SEK;119;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    expect(
      result.issues.filter((i) => i.code === "genderNameMismatch")
    ).toHaveLength(0)
  })

  it("does not report genderNameMismatch when name is not in knownNames list", () => {
    const rows: string[][] = [
      "2019-03-01;Zyx;Person;Nej;Man;Sverige;2024;1985-06-12;Senior Analyst;1231;49788;0;5000;SEK;120;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {
      knownNames: { Anna: "Kvinna" },
    })
    expect(
      result.issues.filter((i) => i.code === "genderNameMismatch")
    ).toHaveLength(0)
  })
})

describe("validateImport — clean fixture produces no issues", () => {
  it("rows 0 and 1 from the clean fixture have no issues", () => {
    const cleanRows = ROWS.slice(0, 2) // only Anna and Erik, no duplicates
    const result = validateImport(
      { headers: HEADERS, rows: cleanRows },
      FULL_MAPPING,
      {}
    )
    expect(result.issues).toHaveLength(0)
    expect(result.blocking).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })
})

describe("validateImport — issues: fractionScaled (pp-07)", () => {
  it("flags every row of a fractional FTE column", () => {
    // ftePercent column (index 15) holds fractions 0.8 / 1.0 / 0,5
    const rows: string[][] = [
      "2019-03-01;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;49788;0;5000;SEK;114;0.8".split(
        ";"
      ),
      "2021-08-15;Erik;Lindqvist;Ja;Man;Sverige;2024;1990-11-30;PM;1232;65000;0;0;SEK;115;1.0".split(
        ";"
      ),
      "2022-01-01;Sara;Berg;Nej;Kvinna;Sverige;2024;1988-04-20;Analyst;1233;52000;0;0;SEK;116;0,5".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    const scaled = result.issues.filter((i) => i.code === "fractionScaled")
    expect(scaled.map((i) => i.row).sort()).toEqual([0, 1, 2])
  })

  it("does not flag a normal 0-100 FTE column", () => {
    // ROWS ftePercent cells are 100 / 80 / 100 / 100 -> not a fraction column
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {}
    )
    expect(
      result.issues.filter((i) => i.code === "fractionScaled")
    ).toHaveLength(0)
  })
})

describe("validateImport — issues: ambiguousDate (date-04)", () => {
  it("flags a DD/MM date whose MM/DD reading is also valid (01/06/2023)", () => {
    // employmentStartDate column (index 0) holds an ambiguous slash date.
    const rows: string[][] = [
      "01/06/2023;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;49788;0;0;SEK;114;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    const amb = result.issues.filter((i) => i.code === "ambiguousDate")
    expect(amb.map((i) => i.row)).toContain(0)
  })

  it("does not flag an unambiguous date (15/06/2023, day > 12)", () => {
    const rows: string[][] = [
      "15/06/2023;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;49788;0;0;SEK;114;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    expect(
      result.issues.filter((i) => i.code === "ambiguousDate")
    ).toHaveLength(0)
  })

  it("does not flag a calendar-invalid date even when both components are <= 12 (date-04-calendar-guard)", () => {
    // 11/11/0000: both components <= 12 so the old local helper returned true,
    // but parseDate("11/11/0000") returns null (year 0 fails toIsoDate via Date.UTC
    // normalization), so isAmbiguousDate correctly returns false.
    const rows: string[][] = [
      "11/11/0000;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;49788;0;0;SEK;114;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    expect(
      result.issues.filter((i) => i.code === "ambiguousDate")
    ).toHaveLength(0)
  })
})

describe("validateImport — issues: negativeValue (ENC-24)", () => {
  it("flags a negative money cell as negativeValue, not unparsableMoney", () => {
    const rows: string[][] = [
      "2019-03-01;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;-45000;0;0;SEK;114;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    expect(
      result.issues.filter((i) => i.code === "negativeValue").map((i) => i.row)
    ).toContain(0)
    expect(
      result.issues.filter((i) => i.code === "unparsableMoney")
    ).toHaveLength(0)
  })

  it("flags a parenthesized-negative money cell as negativeValue", () => {
    const rows: string[][] = [
      "2019-03-01;Anna;Svensson;Nej;Kvinna;Sverige;2024;1985-06-12;Analyst;1231;(500);0;0;SEK;114;100".split(
        ";"
      ),
    ]
    const result = validateImport({ headers: HEADERS, rows }, FULL_MAPPING, {})
    expect(
      result.issues.filter((i) => i.code === "negativeValue").map((i) => i.row)
    ).toContain(0)
  })
})

describe("validateImport — mojibake / ragged / noDelimiter signals", () => {
  it("flags mojibake when 2+ headers contain double-encoding sequences (ENC-04)", () => {
    const headers = ["KÃ¶n", "LÃ¶n", "Namn"]
    const result = validateImport(
      { headers, rows: [] },
      { map: {}, unmappedColumns: [] },
      {}
    )
    expect(result.fileWarnings).toContain("mojibake")
  })

  it("does not flag mojibake for clean headers", () => {
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {}
    )
    expect(result.fileWarnings ?? []).not.toContain("mojibake")
  })

  it("emits the headerless file warning from tokenizer signals (HL)", () => {
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {},
      { headerless: true }
    )
    expect(result.fileWarnings).toContain("headerless")
  })

  it("emits raggedRow per index from tokenizer signals (T19/T20)", () => {
    const result = validateImport(
      { headers: HEADERS, rows: ROWS },
      FULL_MAPPING,
      {},
      { raggedRows: [1, 3] }
    )
    const ragged = result.issues.filter((i) => i.code === "raggedRow")
    expect(ragged.map((i) => i.row).sort()).toEqual([1, 3])
  })

  it("emits noDelimiter file warning from tokenizer signal (T38)", () => {
    const result = validateImport(
      { headers: ["employee salary department"], rows: [["a b c"]] },
      { map: {}, unmappedColumns: [] },
      {},
      { noDelimiter: true }
    )
    expect(result.fileWarnings).toContain("noDelimiter")
  })
})

describe("validateFile — invalidFileFormat (A1, A4)", () => {
  // XLSX / ODS ZIP local-file header.
  const XLSX_MAGIC = "PK\x03\x04\x14\x00\x06\x00"
  // Legacy XLS OLE2 compound-file header.
  const XLS_MAGIC = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"

  const EMPTY_MAPPING: DetectedMapping = { map: {}, unmappedColumns: [] }

  it("returns fileFormatError and the sentinel in blocking for XLSX magic bytes", () => {
    const result = validateFile(XLSX_MAGIC, EMPTY_MAPPING, {})
    expect(result.fileFormatError).toBe("invalidFileFormat")
    expect(result.blocking).toContain("invalidFileFormat")
    // It must NOT masquerade as missing canonical fields.
    expect(result.blocking).not.toContain("basicMonthly")
    expect(result.blocking).not.toContain("gender")
  })

  it("returns fileFormatError for legacy XLS magic bytes", () => {
    const result = validateFile(XLS_MAGIC, EMPTY_MAPPING, {})
    expect(result.fileFormatError).toBe("invalidFileFormat")
    expect(result.blocking).toContain("invalidFileFormat")
  })

  it("throwing tokenizeCsv is the only path to invalidFileFormat", () => {
    // Sanity: a plain CSV text through validateFile has no fileFormatError.
    const csv = "name,salary\nAnna,52000\n"
    const tokenized = tokenizeCsv(csv)
    const result = validateFile(csv, EMPTY_MAPPING, {}, tokenized)
    expect(result.fileFormatError).toBeUndefined()
  })
})
