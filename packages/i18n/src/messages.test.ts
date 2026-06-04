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
