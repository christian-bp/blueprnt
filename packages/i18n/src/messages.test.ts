/// <reference types="vite/client" />
import { describe, expect, it } from "vitest"
import da from "../messages/da.json"
import en from "../messages/en.json"
import fi from "../messages/fi.json"
import nb from "../messages/nb.json"
import sv from "../messages/sv.json"

// en.json is the base message file; every other locale must mirror its keys
// exactly (the type system only catches keys missing from en).
function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === "object") {
      return flattenKeys(value as Record<string, unknown>, path)
    }
    return [path]
  })
}

const locales = { da, fi, nb, sv } as const
const enKeys = flattenKeys(en).sort()

describe("message file parity", () => {
  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale}.json has exactly the keys of en.json`, () => {
      expect(flattenKeys(messages).sort()).toEqual(enKeys)
    })
  }
})

// Language-purity guard: en.json values must read as English, not Swedish
// (a real bug found via manual QA: Swedish domain words like "samverkan"
// leaking into English strings). Checks two signals: any å/ä/ö character
// (illegitimate in English), and a small denylist of ASCII Swedish words
// that would otherwise read as plausible English. The one sanctioned
// exception is a single "(Swedish: <term>)" gloss on a statutory term in a
// help body (Swedish HR users need to recognize the legal term); such
// glosses are stripped before checking so they don't trip the guard.
function flattenStringValues(
  obj: Record<string, unknown>,
  prefix = ""
): Array<[string, string]> {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === "object") {
      return flattenStringValues(value as Record<string, unknown>, path)
    }
    return typeof value === "string" ? ([[path, value]] as const) : []
  })
}

const SWEDISH_GLOSS_PATTERN = /\(Swedish: [^)]*\)/g
const SWEDISH_DIACRITICS_PATTERN = /[åäöÅÄÖ]/
const SWEDISH_WORD_DENYLIST = [
  "samverkan",
  "klarmarkera",
  "klarmarkerad",
  "underlag",
  "riktpunkt",
  "lonekartlaggning",
]
const SWEDISH_WORD_PATTERN = new RegExp(
  `\\b(${SWEDISH_WORD_DENYLIST.join("|")})\\b`,
  "i"
)

describe("en.json language purity", () => {
  // dashboard.languages.* is a language switcher: it names each locale in
  // its own language on purpose (Svenska, Norsk bokmål, Dansk, Suomi), so
  // those endonyms are excluded rather than mistaken for leakage.
  const strippedValues = flattenStringValues(en)
    .filter(([key]) => !key.startsWith("dashboard.languages."))
    .map(
      ([key, value]) => [key, value.replace(SWEDISH_GLOSS_PATTERN, "")] as const
    )

  it("has no Swedish diacritics (å/ä/ö) outside a (Swedish: ...) gloss", () => {
    const offenders = strippedValues
      .filter(([, value]) => SWEDISH_DIACRITICS_PATTERN.test(value))
      .map(([key]) => key)
    expect(offenders).toEqual([])
  })

  it("has no denylisted Swedish words outside a (Swedish: ...) gloss", () => {
    const offenders = strippedValues
      .filter(([, value]) => SWEDISH_WORD_PATTERN.test(value))
      .map(([key]) => key)
    expect(offenders).toEqual([])
  })
})

import { routing } from "./routing"

it("messages folder matches routing.locales exactly", () => {
  const files = Object.keys(
    import.meta.glob("../messages/*.json", { eager: false })
  )
    .map((p) => p.replace("../messages/", "").replace(".json", ""))
    .sort()
  expect(files).toEqual([...routing.locales].sort())
})
