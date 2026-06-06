import { describe, expect, it } from "vitest"
import {
  COUNTRY_KEYS,
  CURRENCY_BY_COUNTRY,
  clampCountry,
  defaultCurrencyFor,
} from "./countries"

describe("countries", () => {
  it("every country has a derived currency", () => {
    for (const country of COUNTRY_KEYS) {
      expect(CURRENCY_BY_COUNTRY[country]).toMatch(/^[A-Z]{3}$/)
    }
  })

  it("derives the documented currency per country", () => {
    expect(defaultCurrencyFor("se")).toBe("SEK")
    expect(defaultCurrencyFor("no")).toBe("NOK")
    expect(defaultCurrencyFor("dk")).toBe("DKK")
    expect(defaultCurrencyFor("fi")).toBe("EUR")
    expect(defaultCurrencyFor("other")).toBe("EUR")
  })

  it("unknown or missing countries fall back to EUR", () => {
    expect(clampCountry("xx")).toBe("other")
    expect(clampCountry(undefined)).toBe("other")
    expect(defaultCurrencyFor("xx")).toBe("EUR")
    expect(defaultCurrencyFor(undefined)).toBe("EUR")
  })
})
