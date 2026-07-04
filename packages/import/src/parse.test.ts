import { describe, it, expect } from "vitest"
import {
  parseMoney,
  parseCurrency,
  parsePercent,
  parseGender,
  parseDate,
  isAmbiguousDate,
  parseBool,
  parseIntId,
  parseStringId,
} from "./parse"

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

  it("parses comma-decimal without grouping (M13)", () => {
    expect(parseMoney("52000,50")).toBe(52000.5)
  })

  it("parses space-thousands + comma-decimal (M14)", () => {
    expect(parseMoney("52 000,50")).toBe(52000.5)
  })

  it("parses NBSP-thousands + comma-decimal (M15)", () => {
    expect(parseMoney("52 000,50")).toBe(52000.5)
  })

  it("parses comma zero-cents to a whole number (M16)", () => {
    expect(parseMoney("52000,00")).toBe(52000)
  })

  it("parses dot-decimal without grouping (M17)", () => {
    expect(parseMoney("52000.50")).toBe(52000.5)
  })

  it("parses dot-decimal .00 to a whole number (M18)", () => {
    expect(parseMoney("52000.00")).toBe(52000)
  })

  it("parses space-thousands + dot-decimal (M19)", () => {
    expect(parseMoney("52 000.50")).toBe(52000.5)
  })

  it("parses dot-thousands as grouped integer (M10)", () => {
    expect(parseMoney("52.000")).toBe(52000)
  })

  it("parses dot-thousands + comma-decimal (M11)", () => {
    expect(parseMoney("52.000,50")).toBe(52000.5)
  })

  it("strips a currency word prefix with space (M35)", () => {
    expect(parseMoney("SEK 52000")).toBe(52000)
  })

  it("strips a currency word prefix run-on (P3)", () => {
    expect(parseMoney("SEK54000")).toBe(54000)
  })

  it("strips a NOK prefix (P3)", () => {
    expect(parseMoney("NOK 54000")).toBe(54000)
  })

  it("parses kr suffix with comma-decimal (M33)", () => {
    expect(parseMoney("45 250,75 kr")).toBe(45250.75)
  })

  it("parses a trailing euro symbol (M40)", () => {
    expect(parseMoney("52000 €")).toBe(52000)
  })

  it("parses a run-on kr suffix with no space (M41)", () => {
    expect(parseMoney("52000kr")).toBe(52000)
  })

  it("parses a large space+dot-decimal+EUR value (M43)", () => {
    expect(parseMoney("1 234 567.00 EUR")).toBe(1234567)
  })

  it("parses NBSP-grouped comma-decimal salary (ENC-10)", () => {
    expect(parseMoney("45 000,00")).toBe(45000)
  })

  it("parses spaced dot-decimal (ENC-11)", () => {
    expect(parseMoney("45 000.00")).toBe(45000)
  })

  it("returns null for a parenthesized-negative (M25, V1 unsupported)", () => {
    expect(parseMoney("(500)")).toBeNull()
  })

  // ADR-0010: en-US comma-thousands is unsupported; "52,000" reads the comma as
  // a decimal (-> 52), not thousands. Documented, not a bug.
  it("parses en-US comma-thousands as a Nordic comma-decimal, returning 52 (M20, ADR-0010 documented limitation)", () => {
    expect(parseMoney("52,000")).toBe(52)
  })

  it("rejects multi-comma: 52,000,50 returns null (multi-comma guard)", () => {
    expect(parseMoney("52,000,50")).toBeNull()
  })

  it("rejects multi-comma: 1,234,567 returns null (multi-comma guard)", () => {
    expect(parseMoney("1,234,567")).toBeNull()
  })

  it("parses euro symbol as a PREFIX (M40 prefix variant)", () => {
    expect(parseMoney("€52000")).toBe(52000)
  })

  it("returns null for interleaved letters", () => {
    expect(parseMoney("52a000")).toBeNull()
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

  it("parses comma-decimal percent (pp-04)", () => {
    expect(parsePercent("87,5")).toBe(87.5)
  })

  it("parses comma-decimal 100,00 (pp-05)", () => {
    expect(parsePercent("100,00")).toBe(100)
  })

  it("parses comma-decimal with % sign (pp-06)", () => {
    expect(parsePercent("87,5%")).toBe(87.5)
  })

  it("parses a value with a leading space before % (pp-13)", () => {
    expect(parsePercent("80 %")).toBe(80)
  })

  it("scales a dot fraction to percent in fraction mode (pp-07)", () => {
    expect(parsePercent("0.8", { fraction: true })).toBe(80)
  })

  it("scales 1.0 to 100 in fraction mode (pp-08)", () => {
    expect(parsePercent("1.0", { fraction: true })).toBe(100)
  })

  it("scales 0.375 to 37.5 in fraction mode (pp-09)", () => {
    expect(parsePercent("0.375", { fraction: true })).toBe(37.5)
  })

  it("scales a comma fraction to percent in fraction mode (pp-10, pp-11)", () => {
    expect(parsePercent("0,8", { fraction: true })).toBe(80)
    expect(parsePercent("1,0", { fraction: true })).toBe(100)
  })

  it("does NOT scale in fraction mode when the value is already a percent", () => {
    // A value > 1.0 under a fraction column would exceed [0,100] after x100;
    // range check rejects it so a mis-detected column fails loud, not silently.
    expect(parsePercent("80", { fraction: true })).toBeNull()
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

  it("parses DD/MM/YYYY slash date (was wrong-format, now supported per ADR-0010)", () => {
    expect(parseDate("15/01/2023")).toBe("2023-01-15")
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

  it("parses DD.MM.YYYY dot date (date-05)", () => {
    expect(parseDate("15.01.2023")).toBe("2023-01-15")
  })

  it("parses D.M.YYYY without leading zeros (date-06)", () => {
    expect(parseDate("5.1.2023")).toBe("2023-01-05")
  })

  it("parses DD/MM/YYYY slash date as Nordic day-first (date-02)", () => {
    // 15 > 12 so the first component is unambiguously the day.
    expect(parseDate("15/01/2023")).toBe("2023-01-15")
  })

  it("parses MM/DD/YYYY when the second component > 12 (date-03)", () => {
    // 01/15: first (01) <= 12, second (15) > 12, so 15 is the day (US reading).
    expect(parseDate("01/15/2023")).toBe("2023-01-15")
  })

  it("parses an ambiguous slash date as Nordic day-first (date-04)", () => {
    // 01/06: both <= 12; day-first reading is 01 June.
    expect(parseDate("01/06/2023")).toBe("2023-06-01")
  })

  it("strips a space-separated time (date-11)", () => {
    expect(parseDate("2023-01-15 00:00:00")).toBe("2023-01-15")
  })

  it("strips a T-separated time (date-12)", () => {
    expect(parseDate("2023-01-15T00:00:00")).toBe("2023-01-15")
  })

  it("strips a T-separated time with trailing Z (date-Z)", () => {
    expect(parseDate("2023-01-15T00:00:00Z")).toBe("2023-01-15")
  })

  it("strips a T-separated time with fractional seconds and Z (date-frac-Z)", () => {
    expect(parseDate("2023-01-15T00:00:00.000Z")).toBe("2023-01-15")
  })

  it("strips a T-separated time with numeric UTC offset (date-offset)", () => {
    // Wall-clock date is kept; no UTC normalization across midnight.
    expect(parseDate("2023-01-15T12:30:00+01:00")).toBe("2023-01-15")
  })

  it("parses YYYY/MM/DD year-first slash (date-25)", () => {
    expect(parseDate("2023/01/15")).toBe("2023-01-15")
  })

  it("parses a full personnummer prefix without a reference year (date-14)", () => {
    // Full 8-digit birth prefix needs no century expansion.
    expect(parseDate("19850612-1234")).toBe("1985-06-12")
  })

  it("rejects an invalid dot date (bad day)", () => {
    expect(parseDate("32.01.2023")).toBeNull()
  })

  it("parses compact YYYYMMDD only when header-gated (date-07, date-08)", () => {
    expect(parseDate("20230115", { headerGated: true })).toBe("2023-01-15")
    // Without the gate a bare 8-digit number is an id, not a date.
    expect(parseDate("20230115")).toBeNull()
  })

  it("parses an Excel serial only when header-gated (date-18)", () => {
    // 44941 = 2023-01-15 with the Excel epoch (25569 = 1970-01-01 in Excel serials).
    expect(parseDate("44941", { headerGated: true })).toBe("2023-01-15")
    expect(parseDate("44941")).toBeNull()
    // A salary-magnitude integer is out of the plausible serial range.
    expect(parseDate("52000", { headerGated: true })).toBeNull()
  })

  it("expands a short personnummer with the caller reference year (date-15)", () => {
    // 850612 with referenceYear 2026: 26 -> 2026, so 85 -> 1985 (past century).
    expect(parseDate("850612-1234", { referenceYear: 2026 })).toBe("1985-06-12")
  })

  it("disables short-personnummer expansion without a reference year (determinism)", () => {
    expect(parseDate("850612-1234")).toBeNull()
  })
})

describe("isAmbiguousDate", () => {
  it("flags a slash date with day <= 12 as ambiguous (date-04)", () => {
    // 01/06/2023: both components <= 12, so MM/DD was also calendar-valid.
    expect(isAmbiguousDate("01/06/2023")).toBe(true)
  })

  it("flags a dot date with day <= 12 as ambiguous", () => {
    expect(isAmbiguousDate("05.01.2023")).toBe(true)
  })

  it("does not flag when the first component > 12 (date-02)", () => {
    expect(isAmbiguousDate("15/01/2023")).toBe(false)
  })

  it("does not flag when the second component > 12 (date-03)", () => {
    expect(isAmbiguousDate("01/15/2023")).toBe(false)
  })

  it("does not flag an ISO date", () => {
    expect(isAmbiguousDate("2023-01-15")).toBe(false)
  })

  it("does not flag an unparseable value", () => {
    expect(isAmbiguousDate("not a date")).toBe(false)
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
