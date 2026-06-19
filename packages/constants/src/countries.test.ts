import { describe, expect, it } from "vitest"
import {
  COUNTRY_KEYS,
  CURRENCY_BY_COUNTRY,
  LANGUAGE_BY_COUNTRY,
  clampCountry,
  countryForLanguage,
  defaultCurrencyFor,
  defaultLanguageFor,
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

  it("derives the documented language per country", () => {
    for (const country of COUNTRY_KEYS) {
      expect(LANGUAGE_BY_COUNTRY[country]).toMatch(/^[a-z]{2}$/)
    }
    expect(defaultLanguageFor("se")).toBe("sv")
    expect(defaultLanguageFor("no")).toBe("nb")
    expect(defaultLanguageFor("dk")).toBe("da")
    expect(defaultLanguageFor("fi")).toBe("fi")
    expect(defaultLanguageFor("other")).toBe("en")
    expect(defaultLanguageFor("xx")).toBe("en")
    expect(defaultLanguageFor(undefined)).toBe("en")
  })

  it("maps a language back to the country key whose language it is", () => {
    expect(countryForLanguage("sv")).toBe("se")
    expect(countryForLanguage("nb")).toBe("no")
    expect(countryForLanguage("da")).toBe("dk")
    expect(countryForLanguage("fi")).toBe("fi")
    expect(countryForLanguage("en")).toBe("other")
  })

  it("returns undefined for an unset or unknown language", () => {
    expect(countryForLanguage("")).toBeUndefined()
    expect(countryForLanguage(undefined)).toBeUndefined()
    expect(countryForLanguage("xx")).toBeUndefined()
  })

  it("round-trips with LANGUAGE_BY_COUNTRY", () => {
    for (const country of COUNTRY_KEYS) {
      expect(countryForLanguage(LANGUAGE_BY_COUNTRY[country])).toBe(country)
    }
  })
})
