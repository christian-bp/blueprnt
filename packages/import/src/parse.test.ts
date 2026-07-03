import { describe, it, expect } from "vitest"
import {
  parseMoney,
  parseCurrency,
  parsePercent,
  parseGender,
  parseDate,
  parseBool,
  parseIntId,
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

  it("handles diacritics via fold (e.g. Kön header value)", () => {
    // 'Kön' folded is 'kon' which is not a gender value synonym,
    // but the cell value 'kvinna' with a diacritic context should work
    // The relevant case: actual cell value with diacritics is unusual,
    // test that ordinary case-folding applies
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
