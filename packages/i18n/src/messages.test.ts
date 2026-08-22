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

// TypewriterPlaceholder types its phrases into a single-line, whitespace-nowrap
// overlay: a newline never breaks the line, it just runs the next segment into
// the same line (found in production: the role import's grouped example
// collapsed into one meaningless run-on line). Guard every locale's phrase for
// both placeholder families that feed the component, so a future phrase can't
// reintroduce the bug silently.
// The working-conditions materiality decision is asked in two places, the
// Kriterier column's yes/no question and the dialog's status toggle, and they
// must answer in the SAME words. The dialog's positive option said "Active"
// (a schema word) in every locale while the column beside it said "material",
// which left one decision with two vocabularies.
//
// The stem is taken from each locale's own negative option, which has carried
// the standardized term since the terminology pass: whatever "tested, not
// X" says, the positive option and the column's two answers must say X too.
// Deriving it rather than listing five words per locale means a locale that
// changes its term stays consistent by construction.
const MATERIAL_STEM_LENGTH = 6

describe("the materiality decision speaks one vocabulary", () => {
  for (const [locale, messages] of Object.entries({ en, ...locales })) {
    it(`${locale}.json says the same thing in the dialog and the column`, () => {
      const wc = messages.dashboard.model.criteria.workingConditions
      // "Tested, not material" -> the locale's own term, stemmed so its
      // inflections (väsentlig/väsentligt, olennainen/olennaiseksi) all match.
      const term = wc.testedNotMaterialOption
        .split(/[\s,]+/)
        .filter((word) => word.length > 0)
        .at(-1)
      expect(term).toBeDefined()
      const stem = (term ?? "").toLowerCase().slice(0, MATERIAL_STEM_LENGTH)
      expect(stem.length).toBe(MATERIAL_STEM_LENGTH)
      for (const label of [wc.activeOption, wc.yesCta, wc.noCta]) {
        expect(label.toLowerCase()).toContain(stem)
      }
    })
  }
})

const PLACEHOLDER_PHRASE_PREFIXES = [
  "dashboard.roles.import.paste.placeholder",
  "dashboard.onboarding.families.placeholderPhrase",
]

describe("typewriter placeholder phrases stay single-line", () => {
  const allLocales = { en, ...locales }
  for (const [locale, messages] of Object.entries(allLocales)) {
    it(`${locale}.json has no newline in a placeholder phrase`, () => {
      const offenders = flattenStringValues(messages)
        .filter(([key]) =>
          PLACEHOLDER_PHRASE_PREFIXES.some((prefix) => key.startsWith(prefix))
        )
        .filter(([, value]) => value.includes("\n"))
        .map(([key]) => key)
      expect(offenders).toEqual([])
    })
  }
})

// Help bodies render inside HelpMorphButton's 26rem panel, so a long one turns
// the morph into a wall of text nobody reads. The rule is two sentences: what
// the thing is, plus the single mistake worth preventing (usually the boundary
// against the neighbouring term). en is the locale we author and is held to the
// 200 the rule targets; the others get 240 so a translation has room, since fi
// runs about 7% longer than en across this corpus.
const HELP_BODY_CAP: Record<string, number> = {
  en: 200,
  sv: 240,
  nb: 240,
  da: 240,
  fi: 240,
}

describe("help bodies stay short", () => {
  const allLocales = { en, ...locales }
  for (const [locale, messages] of Object.entries(allLocales)) {
    it(`${locale}.json keeps every help body within its cap`, () => {
      const cap = HELP_BODY_CAP[locale] as number
      const offenders = flattenStringValues(messages)
        .filter(
          ([key]) => key.startsWith("dashboard.help.") && key.endsWith("Body")
        )
        .filter(([, value]) => value.length > cap)
        .map(([key, value]) => `${key} is ${value.length}, cap is ${cap}`)
      expect(offenders).toEqual([])
    })
  }
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
