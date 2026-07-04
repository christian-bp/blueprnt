import { describe, it, expect } from "vitest"
import {
  parseMoney,
  parseCurrency,
  parsePercent,
  parseGender,
  parseDate,
  parseBool,
  parseIntId,
  parseStringId,
} from "./parse.js"

describe("parseMoney", () => {
  it("parses a Swedish-formatted salary with space separators and trailing kr", () => {
    expect(parseMoney("94 500 kr")).toBe(94500)
  })

  it("parses a plain integer string", () => {
    expect(parseMoney("52000")).toBe(52000)
  })

  it("parses with multiple space groups and trailing SEK", () => {
    expect(parseMoney("1 200 000 SEK")).toBe(1200000)
  })

  it("parses with trailing sek (lowercase)", () => {
    expect(parseMoney("75 000 sek")).toBe(75000)
  })

  it("returns null for blank string", () => {
    expect(parseMoney("")).toBeNull()
  })

  it("returns null for whitespace-only string", () => {
    expect(parseMoney("   ")).toBeNull()
  })

  it("returns null for non-numeric input", () => {
    expect(parseMoney("abc")).toBeNull()
  })

  it("returns null for currency-only string", () => {
    expect(parseMoney("SEK")).toBeNull()
  })

  it("returns null for unknown trailing word", () => {
    expect(parseMoney("94 500 bad")).toBeNull()
  })

  it("parses with trailing sek (lowercase, known currency)", () => {
    expect(parseMoney("94 500 sek")).toBe(94500)
  })

  it("returns null for mixed alphanumeric (12abc)", () => {
    expect(parseMoney("12abc")).toBeNull()
  })

  it("returns null for negative value", () => {
    expect(parseMoney("-500")).toBeNull()
  })

  it("parses zero", () => {
    expect(parseMoney("0")).toBe(0)
  })
})

describe("parseCurrency", () => {
  it("trims and uppercases a valid code", () => {
    expect(parseCurrency(" SEK ")).toBe("SEK")
  })

  it("uppercases lowercase input", () => {
    expect(parseCurrency("eur")).toBe("EUR")
  })

  it("returns null for blank string", () => {
    expect(parseCurrency("")).toBeNull()
  })

  it("returns null for whitespace-only string", () => {
    expect(parseCurrency("   ")).toBeNull()
  })
})

describe("parsePercent", () => {
  it("parses a plain integer string", () => {
    expect(parsePercent("80")).toBe(80)
  })

  it("parses a value with a trailing % sign", () => {
    expect(parsePercent("100%")).toBe(100)
  })

  it("parses zero", () => {
    expect(parsePercent("0")).toBe(0)
  })

  it("returns null for a value above 100", () => {
    expect(parsePercent("101")).toBeNull()
  })

  it("returns null for a negative value", () => {
    expect(parsePercent("-1")).toBeNull()
  })

  it("returns null for blank string", () => {
    expect(parsePercent("")).toBeNull()
  })

  it("returns null for non-numeric input", () => {
    expect(parsePercent("abc")).toBeNull()
  })

  it("accepts a decimal value (fractional FTE like 87.5)", () => {
    expect(parsePercent("87.5")).toBe(87.5)
  })
})

describe("parseGender", () => {
  it("maps 'man' -> Man", () => {
    expect(parseGender("man")).toBe("Man")
  })

  it("maps 'Man' (mixed case) -> Man", () => {
    expect(parseGender("Man")).toBe("Man")
  })

  it("maps 'male' -> Man", () => {
    expect(parseGender("male")).toBe("Man")
  })

  it("maps 'm' -> Man", () => {
    expect(parseGender("m")).toBe("Man")
  })

  it("maps 'kvinna' -> Kvinna", () => {
    expect(parseGender("kvinna")).toBe("Kvinna")
  })

  it("maps 'Kvinna' (mixed case) -> Kvinna", () => {
    expect(parseGender("Kvinna")).toBe("Kvinna")
  })

  it("maps 'female' -> Kvinna", () => {
    expect(parseGender("female")).toBe("Kvinna")
  })

  it("maps 'woman' -> Kvinna", () => {
    expect(parseGender("woman")).toBe("Kvinna")
  })

  it("maps 'k' -> Kvinna", () => {
    expect(parseGender("k")).toBe("Kvinna")
  })

  it("maps 'MALE' (all caps) -> Man via case-folding", () => {
    // fold() lowercases the input, so 'MALE' -> 'male' which matches the 'male' synonym.
    expect(parseGender("MALE")).toBe("Man")
  })

  it("returns null for unrecognized values", () => {
    expect(parseGender("other")).toBeNull()
  })

  it("returns null for blank string", () => {
    expect(parseGender("")).toBeNull()
  })
})

describe("parseDate", () => {
  it("returns a valid YYYY-MM-DD date unchanged", () => {
    expect(parseDate("2023-01-15")).toBe("2023-01-15")
  })

  it("returns null for an invalid calendar date", () => {
    expect(parseDate("2023-02-30")).toBeNull()
  })

  it("returns null for wrong format", () => {
    expect(parseDate("15/01/2023")).toBeNull()
  })

  it("returns null for blank string", () => {
    expect(parseDate("")).toBeNull()
  })

  it("returns null for a string that looks like a date but has wrong separators", () => {
    expect(parseDate("2023.01.15")).toBeNull()
  })

  it("returns null for month 13", () => {
    expect(parseDate("2023-13-01")).toBeNull()
  })

  it("accepts a real birth date", () => {
    expect(parseDate("1990-05-20")).toBe("1990-05-20")
  })
})

describe("parseBool", () => {
  it("maps 'ja' -> true", () => {
    expect(parseBool("ja")).toBe(true)
  })

  it("maps 'Ja' (mixed case) -> true", () => {
    expect(parseBool("Ja")).toBe(true)
  })

  it("maps 'yes' -> true", () => {
    expect(parseBool("yes")).toBe(true)
  })

  it("maps 'true' -> true", () => {
    expect(parseBool("true")).toBe(true)
  })

  it("maps 'nej' -> false", () => {
    expect(parseBool("nej")).toBe(false)
  })

  it("maps 'no' -> false", () => {
    expect(parseBool("no")).toBe(false)
  })

  it("maps 'false' -> false", () => {
    expect(parseBool("false")).toBe(false)
  })

  it("returns null for unrecognized values", () => {
    expect(parseBool("maybe")).toBeNull()
  })

  it("returns null for blank string", () => {
    expect(parseBool("")).toBeNull()
  })
})

describe("parseIntId", () => {
  it("parses a numeric employee id", () => {
    expect(parseIntId("251200")).toBe(251200)
  })

  it("parses a simple integer", () => {
    expect(parseIntId("42")).toBe(42)
  })

  it("returns null for a non-numeric code", () => {
    expect(parseIntId("UX Developer")).toBeNull()
  })

  it("returns null for blank string", () => {
    expect(parseIntId("")).toBeNull()
  })

  it("returns null for whitespace-only string", () => {
    expect(parseIntId("   ")).toBeNull()
  })

  it("returns null for a mixed alphanumeric code", () => {
    expect(parseIntId("EMP001")).toBeNull()
  })
})

describe("parseGender Plan A broadening", () => {
  it("resolves Norwegian mann/kvinne (GEN-05)", () => {
    expect(parseGender("Mann")).toBe("Man")
    expect(parseGender("Kvinne")).toBe("Kvinna")
  })

  it("resolves Danish mand/kvinde (GEN-06)", () => {
    expect(parseGender("Mand")).toBe("Man")
    expect(parseGender("Kvinde")).toBe("Kvinna")
  })

  it("resolves Finnish mies/nainen (GEN-07)", () => {
    expect(parseGender("Mies")).toBe("Man")
    expect(parseGender("Nainen")).toBe("Kvinna")
  })

  it("resolves English F to Kvinna, symmetric with M (GEN-04)", () => {
    expect(parseGender("F")).toBe("Kvinna")
    expect(parseGender("M")).toBe("Man")
  })

  it("does NOT map numeric codes without the opt-in flag (GEN-09 guard)", () => {
    expect(parseGender("1")).toBeNull()
    expect(parseGender("2")).toBeNull()
  })

  it("maps SCB numeric 1/2 only when allowNumericCodes is true (GEN-09, P6)", () => {
    expect(parseGender("1", { allowNumericCodes: true })).toBe("Man")
    expect(parseGender("2", { allowNumericCodes: true })).toBe("Kvinna")
  })

  it("flags ambiguous numeric codes as null even with the flag (Decision 3)", () => {
    expect(parseGender("0", { allowNumericCodes: true })).toBeNull()
    expect(parseGender("3", { allowNumericCodes: true })).toBeNull()
  })

  it("returns null for non-binary tokens (no third value)", () => {
    expect(parseGender("Annat")).toBeNull()
    expect(parseGender("Ukjent")).toBeNull()
    expect(parseGender("X")).toBeNull()
  })
})

describe("parseBool Plan A broadening", () => {
  it("resolves Norwegian nei to false (bool-01)", () => {
    expect(parseBool("Nei")).toBe(false)
  })

  it("resolves Finnish kyllä to true (bool-02)", () => {
    expect(parseBool("Kyllä")).toBe(true)
  })

  it("resolves Finnish ei to false (bool-03)", () => {
    expect(parseBool("Ei")).toBe(false)
  })

  it("keeps existing ja/nej/yes/no/true/false (lock)", () => {
    expect(parseBool("Ja")).toBe(true)
    expect(parseBool("Nej")).toBe(false)
    expect(parseBool("yes")).toBe(true)
    expect(parseBool("FALSE")).toBe(false)
  })
})

describe("parseStringId and parseIntId safe-integer guard (Plan A)", () => {
  it("preserves leading zeros as a string (id-01)", () => {
    expect(parseStringId("00042")).toBe("00042")
  })

  it("returns an alphanumeric code verbatim (id-05)", () => {
    expect(parseStringId("EMP001")).toBe("EMP001")
  })

  it("returns a full personnummer verbatim (id-03)", () => {
    expect(parseStringId("19850612-1234")).toBe("19850612-1234")
  })

  it("returns a short personnummer verbatim (id-04)", () => {
    expect(parseStringId("850612-1234")).toBe("850612-1234")
  })

  it("trims surrounding whitespace but preserves the value", () => {
    expect(parseStringId("  10042  ")).toBe("10042")
  })

  it("returns null for a non-id value (pure letters)", () => {
    expect(parseStringId("Anna")).toBeNull()
  })

  it("returns null for blank", () => {
    expect(parseStringId("")).toBeNull()
  })

  it("parseIntId returns null for an integer beyond the safe range (id-07)", () => {
    expect(parseIntId("123456789012345678")).toBeNull()
  })

  it("parseIntId still parses a safe integer (lock)", () => {
    expect(parseIntId("10042")).toBe(10042)
  })
})
